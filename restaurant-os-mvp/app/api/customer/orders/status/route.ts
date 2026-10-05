import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { RateLimiter } from '@/lib/rate-limiter';

/**
 * GET /api/customer/orders/status
 * 
 * Minimal, sanitized public order status endpoint for customer QR order tracking.
 * Exposes ONLY non-sensitive progress information (status, order number, table, items).
 * STRICTLY NEVER returns customer PII (no customer phone, delivery phone, delivery address, notes, customer ID).
 * Never issues identity tokens.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const orderId = (searchParams.get('orderId') || '').trim();
        const restaurantCode = (searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '').trim();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const rateCheck = await RateLimiter.checkPublicStatus(orderId, clientIp);
        if (!rateCheck.success) {
            return RateLimiter.createRateLimitResponse(rateCheck);
        }

        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid or unknown restaurant' }, { status: 400 });
        }

        // Fetch minimal order fields strictly scoped to this restaurant
        const { data: order, error: orderErr } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                total_amount,
                order_type,
                created_at,
                restaurant_id,
                tables:table_id (table_number),
                table_merge_groups:merge_group_id (display_name),
                order_items (
                    id,
                    quantity,
                    price_at_time,
                    notes,
                    status,
                    item_type,
                    combo_name,
                    combo_image,
                    menu_items (
                        name,
                        image_url
                    )
                )
            `)
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .maybeSingle();

        if (orderErr) {
            console.error('[OrderStatus] DB error:', orderErr);
            return NextResponse.json({ error: 'Failed to retrieve order status' }, { status: 500 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const tableDisplay = (order as any).table_merge_groups?.display_name || (order as any).tables?.table_number || undefined;

        // Sanitize items (no internal secrets)
        const sanitizedItems = (order.order_items || []).map((item: any) => ({
            id: String(item.id),
            name: item.combo_name || item.menu_items?.name || (item.item_type === 'combo' ? 'Combo' : 'Special Item'),
            quantity: item.quantity,
            price: item.price_at_time,
            notes: item.notes || '',
            status: item.status || order.status,
            image_url: item.combo_image || item.menu_items?.image_url || getCategoryMenuItemImage(item.combo_name || item.menu_items?.name || 'Item'),
        }));

        // Return ONLY non-sensitive tracking information
        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                status: order.status,
                total_amount: order.total_amount,
                order_type: order.order_type,
                created_at: order.created_at,
                restaurant_id: order.restaurant_id,
                table_number: tableDisplay,
                items: sanitizedItems,
            },
        });
    } catch (err: any) {
        console.error('[OrderStatus] Exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
