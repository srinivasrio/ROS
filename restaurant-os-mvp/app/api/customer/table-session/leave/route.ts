import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { extractCustomerTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * POST /api/customer/table-session/leave
 * 
 * Safely resolves/leaves a customer's active table membership.
 * - If guest: updates join request to cancelled.
 * - If host: checks if there are unpaid/active placed orders.
 *   If no active orders, deactivates table session (is_active = false).
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { restaurantId, customerMobile } = body;

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;

        // Resolve customer phone from param or authenticated JWT
        let resolvedCustomerPhone = customerMobile || '';
        if (!resolvedCustomerPhone) {
            const authHeader = req.headers.get('authorization');
            let token: string | null = null;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7).trim();
            }
            if (!token) {
                token = extractCustomerTokenForRestaurant(req.cookies, canonicalRestaurantId || restaurantId);
            }
            if (token) {
                try {
                    const payload: any = await verifyJwt(token);
                    if (payload?.mobile) {
                        resolvedCustomerPhone = payload.mobile;
                    }
                } catch {}
            }
        }

        const cleanCustomer = cleanPhone(resolvedCustomerPhone);
        if (!cleanCustomer) {
            return NextResponse.json({ error: 'Customer mobile number is required' }, { status: 400 });
        }

        // 1. Check if customer is the HOST of an active session
        const { data: hostSession } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId])
            .eq('host_customer_mobile', cleanCustomer)
            .eq('is_active', true)
            .maybeSingle();

        if (hostSession) {
            // Check if there are active, non-completed orders on this table
            const { data: activeOrders } = await supabaseAdmin
                .from('orders')
                .select('id, status, is_completed')
                .in('restaurant_id', [restaurantId, canonicalRestaurantId])
                .or(`table_id.eq.${hostSession.table_id},table_number.eq.${hostSession.table_number}`)
                .eq('is_completed', false)
                .in('status', ['queued', 'placed', 'preparing', 'ready', 'served']);

            if (activeOrders && activeOrders.length > 0) {
                return NextResponse.json({
                    error: `Table ${hostSession.table_number} has ${activeOrders.length} active order(s). Please ask staff to transfer or settle the bill before switching tables.`,
                    hasActiveOrders: true,
                    tableNumber: hostSession.table_number,
                }, { status: 400 });
            }

            // Deactivate host session
            const { error: updateErr } = await supabaseAdmin
                .from('table_active_sessions')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', hostSession.id);

            if (updateErr) {
                console.error('[table-session/leave] Host Deactivate Error:', updateErr);
                return NextResponse.json({ error: 'Failed to release table session' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: `Table ${hostSession.table_number} session closed successfully.`,
                wasHost: true,
                tableNumber: hostSession.table_number,
            });
        }

        // 2. Check if customer is an approved or pending guest in an active session
        const { data: memberRequest } = await supabaseAdmin
            .from('table_join_requests')
            .select('*, table_active_sessions!inner(*)')
            .in('table_active_sessions.restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('table_active_sessions.is_active', true)
            .eq('requester_customer_mobile', cleanCustomer)
            .in('status', ['approved', 'pending'])
            .maybeSingle();

        if (memberRequest) {
            await supabaseAdmin
                .from('table_join_requests')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', memberRequest.id);

            return NextResponse.json({
                success: true,
                message: `Left table ${memberRequest.table_number} session.`,
                wasHost: false,
                tableNumber: memberRequest.table_number,
            });
        }

        return NextResponse.json({
            success: true,
            message: 'No active session membership found to leave.',
        });
    } catch (err: any) {
        console.error('[table-session/leave] Handler Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
