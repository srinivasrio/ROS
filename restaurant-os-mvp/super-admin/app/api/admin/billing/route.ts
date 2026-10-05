import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        // Fetch real invoices and restaurants from Supabase
        const [invRes, restRes, subRes] = await Promise.all([
            supabaseAdmin.from('invoices').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('restaurants').select('id, name, owner_name, email'),
            supabaseAdmin.from('subscriptions').select('restaurant_id, plan_type, amount, status, created_at').order('created_at', { ascending: false })
        ]);

        const invoicesData = invRes.data || [];
        const restaurants = restRes.data || [];

        const restMap = new Map();
        restaurants.forEach((r) => restMap.set(r.id, r));

        let totalRevenue = 0;
        let pendingTotal = 0;
        let failedCount = 0;

        const formattedInvoices = invoicesData.map((inv: any) => {
            const rest = restMap.get(inv.restaurant_id) || {};
            const amount = Number(inv.total || inv.amount || inv.subtotal || 0);
            const statusUpper = (inv.status || 'paid').toUpperCase();
            const gstAmount = Number(inv.tax_amount || Math.round(amount * 0.18));

            if (statusUpper === 'PAID') {
                totalRevenue += amount;
            } else if (statusUpper === 'ISSUED' || statusUpper === 'PENDING') {
                pendingTotal += amount;
            } else if (statusUpper === 'VOID' || statusUpper === 'OVERDUE') {
                failedCount++;
            }

            return {
                id: inv.invoice_number || inv.id,
                rawId: inv.id,
                restaurantId: inv.restaurant_id,
                restaurantName: rest.name || 'Organization',
                ownerName: rest.owner_name || 'Owner',
                amount: amount,
                formattedAmount: `₹${amount.toLocaleString('en-IN')}`,
                date: new Date(inv.created_at || Date.now()).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                }),
                status: statusUpper === 'ISSUED' ? 'PENDING' : statusUpper,
                paymentMethod: inv.metadata?.payment_method || (statusUpper === 'PAID' ? 'UPI / Razorpay AutoDebit' : 'Awaiting Settlement'),
                gstAmount: gstAmount,
                notes: inv.notes || '',
                dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
            };
        });

        // Compute MRR from the latest active/trialing subscription for each
        // restaurant. Invoice revenue is historical cash flow, not MRR.
        const latestSubscriptionByRestaurant = new Map<string, any>();
        for (const subscription of subRes.data || []) {
            if (!latestSubscriptionByRestaurant.has(subscription.restaurant_id)) {
                latestSubscriptionByRestaurant.set(subscription.restaurant_id, subscription);
            }
        }
        const monthlyMRR = Array.from(latestSubscriptionByRestaurant.values())
            .filter(subscription => ['active', 'trialing'].includes(String(subscription.status || '').toLowerCase()))
            .reduce((sum, subscription) => {
                const amount = Number(subscription.amount || 0);
                return sum + (String(subscription.plan_type || '').toLowerCase() === 'annual' ? amount / 12 : amount);
            }, 0);

        return NextResponse.json({
            success: true,
            summary: {
                totalRevenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
                monthlyMRR: `₹${Math.round(monthlyMRR).toLocaleString('en-IN')}`,
                pendingInvoices: pendingTotal > 0 ? `₹${pendingTotal.toLocaleString('en-IN')}` : '₹0',
                failedPayments: failedCount,
            },
            invoices: formattedInvoices,
        });
    } catch (err: any) {
        console.error('Super Admin billing API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { invoiceId, action } = body;

        if (!invoiceId) {
            return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
        }

        if (action === 'mark_paid') {
            await supabaseAdmin
                .from('invoices')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`);

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                action: 'super_admin_mark_invoice_paid',
                details: { invoiceId, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Invoice marked as paid.' });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
