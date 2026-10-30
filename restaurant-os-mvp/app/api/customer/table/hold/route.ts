import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireCustomerSession } from '@/lib/customer-route-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/table/hold
 *
 * Server-side replacement for OrderService.holdTable in the (tokenless) customer
 * flow. Puts the caller's OWN table (from the signed session) on hold and
 * auto-assigns the least-busy waiter if none is assigned. Uses the service role,
 * so it keeps working after the anon RLS on tables/employees is removed.
 * The table id comes from the session, never from the client body.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireCustomerSession(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { restaurantId, tableId } = auth.ctx;

        // Resolve the physical table (scoped to the session's restaurant).
        const { data: table } = await supabaseAdmin
            .from('tables')
            .select('id, status, assigned_waiter_id, merged_group_id, restaurant_id')
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (!table) {
            return NextResponse.json({ error: 'Table not found for this session' }, { status: 404 });
        }

        const now = new Date().toISOString();

        // Only transition from an idle/opening state — mirrors OrderService.holdTable.
        const holdable = ['empty', 'free', 'customer_present', 'on_hold'];
        if (!holdable.includes(String(table.status || '').toLowerCase())) {
            return NextResponse.json({ success: true, skipped: true, status: table.status });
        }

        let assignedWaiterId: string | null = table.assigned_waiter_id || null;
        let waiterAssignedJustNow = false;

        if (!assignedWaiterId) {
            // Server-side waiter auto-assignment via the existing SECURITY DEFINER RPC.
            const { data: waiterId } = await supabaseAdmin.rpc('get_least_busy_waiter', {
                p_restaurant_id: restaurantId,
            });
            if (waiterId) {
                assignedWaiterId = String(waiterId);
                waiterAssignedJustNow = true;
            }
        }

        const updateData: { status: string; last_activity_at: string; assigned_waiter_id?: string } = {
            status: 'on_hold',
            last_activity_at: now,
        };
        if (assignedWaiterId) {
            updateData.assigned_waiter_id = assignedWaiterId;
        }

        if (table.merged_group_id) {
            await supabaseAdmin.from('table_merge_groups').update(updateData).eq('id', table.merged_group_id).eq('restaurant_id', restaurantId);
            await supabaseAdmin.from('tables').update(updateData).eq('merged_group_id', table.merged_group_id).eq('restaurant_id', restaurantId);
        } else {
            await supabaseAdmin.from('tables').update(updateData).eq('id', table.id).eq('restaurant_id', restaurantId);
        }

        if (waiterAssignedJustNow && assignedWaiterId) {
            await supabaseAdmin.from('employees').update({ last_assigned_at: now }).eq('id', assignedWaiterId).eq('restaurant_id', restaurantId);
        }

        return NextResponse.json({ success: true, assigned_waiter_id: assignedWaiterId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to hold table';
        console.error('[customer/table/hold] Error:', message);
        return NextResponse.json({ error: 'Failed to hold table' }, { status: 500 });
    }
}
