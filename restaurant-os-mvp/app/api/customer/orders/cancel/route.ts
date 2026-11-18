import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireCustomerSession, getSessionScopedOrder, isCustomerEditable } from '@/lib/customer-route-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/orders/cancel   body: { orderId }
 *
 * Server-side replacement for OrderService.deleteOrder in the customer flow.
 * Only deletes an order that belongs to the caller's own table session and is
 * still customer-editable (not yet ready/served/paid). Service-role; survives
 * the anon RLS removal on orders/order_items (audit DIO-C04).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireCustomerSession(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await req.json().catch(() => ({}));
        const orderId = String(body?.orderId || '').trim();
        if (!orderId) {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const order = await getSessionScopedOrder(auth.ctx, orderId);
        if (!order) {
            return NextResponse.json({ error: 'Order not found for this table session' }, { status: 403 });
        }
        if (!isCustomerEditable(order)) {
            return NextResponse.json({ error: 'This order can no longer be cancelled from the table.' }, { status: 409 });
        }

        await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', orderId)
            .eq('restaurant_id', auth.ctx.restaurantId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to cancel order';
        console.error('[customer/orders/cancel] Error:', message);
        return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
    }
}
