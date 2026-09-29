import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffAuth } from '@/lib/staff-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { OrderService } from '@/services/orders.service';

/**
 * POST /api/waiter/tables/[tableId]/action
 * Server-side protected endpoint for waiter table operations.
 * Validates staff authentication AND verifies current table assignment.
 * Rejecting unassigned waiters (HTTP 403 Forbidden).
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ tableId: string }> }
) {
    try {
        const { tableId } = await context.params;
        const body = await req.json().catch(() => ({}));
        const { action, restaurantId, items, waiterId } = body;

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        // 1. Verify staff authentication (token or header check)
        const staffAuth = await verifyStaffAuth(req, {
            requiredRestaurantId: restaurantId,
            allowedRoles: ['waiter', 'supervisor', 'admin', 'restaurant_admin', 'manager'],
        });

        let effectiveWaiterId: string | null = null;
        if (staffAuth.authorized && (staffAuth.user?.id || staffAuth.employee?.id)) {
            effectiveWaiterId = staffAuth.user?.id || staffAuth.employee?.id;
        } else if (waiterId) {
            const actualRestaurantId = (await OrderService.resolveRestaurantId(restaurantId)) || restaurantId;
            const { data: emp } = await supabaseAdmin
                .from('employees')
                .select('id, role, status, is_deleted')
                .eq('id', waiterId)
                .eq('restaurant_id', actualRestaurantId)
                .eq('is_deleted', false)
                .maybeSingle();

            if (emp && emp.status === 'active' && ['waiter', 'supervisor', 'admin', 'restaurant_admin', 'manager'].includes(emp.role.toLowerCase())) {
                effectiveWaiterId = emp.id;
            }
        }

        if (!effectiveWaiterId) {
            return NextResponse.json({ error: 'Unauthorized: Invalid staff credentials' }, { status: 401 });
        }

        // 2. Server-side table assignment verification
        const accessCheck = await OrderService.verifyWaiterTableAccess(
            tableId,
            effectiveWaiterId,
            restaurantId
        );

        if (!accessCheck.authorized) {
            return NextResponse.json(
                {
                    error: `Forbidden: You are not assigned to Table ${accessCheck.table?.table_number || tableId}.`,
                    reason: accessCheck.reason,
                    table_id: tableId,
                },
                { status: 403 }
            );
        }

        // 3. Execute requested action
        switch (action) {
            case 'create_order': {
                if (!Array.isArray(items) || items.length === 0) {
                    return NextResponse.json({ error: 'items array is required' }, { status: 400 });
                }
                const orderResult = await OrderService.createOrder(
                    tableId,
                    items,
                    restaurantId,
                    'placed',
                    effectiveWaiterId
                );
                return NextResponse.json({ success: true, order: orderResult });
            }

            case 'request_bill': {
                await OrderService.requestBill(tableId, restaurantId, effectiveWaiterId);
                return NextResponse.json({ success: true, message: 'Bill requested' });
            }

            case 'clear_table': {
                await OrderService.clearTable(tableId, restaurantId, effectiveWaiterId);
                return NextResponse.json({ success: true, message: 'Table cleared' });
            }

            case 'check_access': {
                return NextResponse.json({
                    authorized: true,
                    table_id: tableId,
                    table_number: accessCheck.table?.table_number,
                    assigned_waiter_id: accessCheck.table?.assigned_waiter_id,
                });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (err: any) {
        console.error('[waiter-table-action] Error:', err);
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: err?.message?.includes('Unauthorized') ? 403 : 500 }
        );
    }
}
