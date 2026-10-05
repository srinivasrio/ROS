import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || '').trim().toLowerCase();

        // 1. Fetch data in parallel
        const [restRes, branchRes, ownerRes, ticketRes] = await Promise.all([
            supabaseAdmin.from('restaurants').select('id, name, owner_name, email, status, subscription_plan').limit(30),
            supabaseAdmin.from('branches').select('id, name, restaurant_id, address, phone').limit(30),
            supabaseAdmin.from('dine_users').select('id, name, email, phone, role').limit(30),
            supabaseAdmin.from('support_tickets').select('ticket_id, subject, restaurant_name, status, priority').limit(20)
        ]);

        const results: any[] = [];

        // Match Restaurants
        (restRes.data || []).forEach((r) => {
            if (
                !query ||
                r.name?.toLowerCase().includes(query) ||
                r.id?.toLowerCase().includes(query) ||
                r.owner_name?.toLowerCase().includes(query) ||
                r.email?.toLowerCase().includes(query)
            ) {
                results.push({
                    id: r.id,
                    title: r.name,
                    subtitle: `${r.owner_name || 'Owner'} • ${r.subscription_plan || 'Starter'} • ID: ${r.id}`,
                    category: 'restaurants',
                    url: `/admin/restaurants/${r.id}`,
                    badge: (r.status || 'ACTIVE').toUpperCase(),
                    badgeColor: r.status === 'ACTIVE' ? 'emerald' : 'amber'
                });
            }
        });

        // Match Branches
        (branchRes.data || []).forEach((b) => {
            if (
                !query ||
                b.name?.toLowerCase().includes(query) ||
                b.id?.toLowerCase().includes(query) ||
                b.address?.toLowerCase().includes(query)
            ) {
                results.push({
                    id: b.id,
                    title: b.name,
                    subtitle: `Branch Code: ${b.id} • ${b.address || 'Physical Outlet'}`,
                    category: 'branches',
                    url: `/admin/branches`,
                    badge: 'Branch',
                    badgeColor: 'cyan'
                });
            }
        });

        // Match Owners
        (ownerRes.data || []).forEach((u) => {
            if (
                !query ||
                u.name?.toLowerCase().includes(query) ||
                u.email?.toLowerCase().includes(query) ||
                u.phone?.includes(query)
            ) {
                results.push({
                    id: u.id,
                    title: u.name || 'Owner Account',
                    subtitle: `${u.email} • ${u.phone || 'Verified'}`,
                    category: 'owners',
                    url: `/admin/owners`,
                    badge: u.role || 'Owner',
                    badgeColor: 'indigo'
                });
            }
        });

        // Match Tickets
        (ticketRes.data || []).forEach((t) => {
            if (
                !query ||
                t.ticket_id?.toLowerCase().includes(query) ||
                t.subject?.toLowerCase().includes(query) ||
                t.restaurant_name?.toLowerCase().includes(query)
            ) {
                results.push({
                    id: t.ticket_id,
                    title: `${t.ticket_id}: ${t.subject}`,
                    subtitle: `${t.restaurant_name || 'Platform'} • Priority: ${t.priority}`,
                    category: 'tickets',
                    url: `/admin/support`,
                    badge: t.status,
                    badgeColor: t.priority === 'HIGH' || t.priority === 'CRITICAL' ? 'red' : 'amber'
                });
            }
        });

        return NextResponse.json({
            success: true,
            query,
            total: results.length,
            results: results.slice(0, 20)
        });
    } catch (err: any) {
        console.error('Super Admin search API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
