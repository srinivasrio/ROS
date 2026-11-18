import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireCustomerSession, getSessionScopedOrder, isCustomerEditable } from '@/lib/customer-route-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/orders/item/remove   body: { itemId }
 *
 * Server-side replacement for OrderService.deleteOrderItem in the customer flow.
 * Removes a single line item from an order owned by the caller's table session,
 * recomputes the order total, and deletes the order if it becomes empty.
 * Service-role; survives the anon RLS removal on order_items (audit DIO-C04).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireCustomerSession(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await req.json().catch(() => ({}));
        const itemId = String(body?.itemId || '').trim();
        if (!itemId) {
            return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }

        // Load the item and its parent order id.
        const { data: item } = await supabaseAdmin
            .from('order_items')
            .select('id, price_at_time, quantity, order_id')
            .eq('id', itemId)
            .maybeSingle();
        if (!item) {
            return NextResponse.json({ success: true, alreadyRemoved: true });
        }

        // Authorize via the parent order's ownership + editability.
        const order = await getSessionScopedOrder(auth.ctx, String(item.order_id));
        if (!order) {
            return NextResponse.json({ error: 'Item does not belong to this table session' }, { status: 403 });
        }
        if (!isCustomerEditable(order)) {
            return NextResponse.json({ error: 'This order can no longer be edited from the table.' }, { status: 409 });
        }

        const { error: delErr } = await supabaseAdmin.from('order_items').delete().eq('id', itemId);
        if (delErr) throw delErr;

        // If no items remain, delete the order; else recompute total.
        const { count } = await supabaseAdmin
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', item.order_id);

        if (count === 0) {
            await supabaseAdmin.from('orders').delete().eq('id', item.order_id).eq('restaurant_id', auth.ctx.restaurantId);
            return NextResponse.json({ success: true, orderDeleted: true });
        }

        const amountDeduction = Number(item.price_at_time || 0) * Number(item.quantity || 1);
        const newTotal = Math.max(0, Number(order.total_amount || 0) - amountDeduction);
        await supabaseAdmin
            .from('orders')
            .update({ total_amount: newTotal })
            .eq('id', item.order_id)
            .eq('restaurant_id', auth.ctx.restaurantId);

        return NextResponse.json({ success: true, total_amount: newTotal });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove item';
        console.error('[customer/orders/item/remove] Error:', message);
        return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
    }
}
