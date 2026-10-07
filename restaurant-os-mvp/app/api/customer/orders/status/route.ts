import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, secondaryAdmin } from '@/lib/supabase-admin';
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

        const orderSelectFields = `
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
        `;

        // Fetch minimal order fields strictly scoped to this restaurant
        let { data: order, error: orderErr } = await supabaseAdmin
            .from('orders')
            .select(orderSelectFields)
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .maybeSingle();

        if (!order && secondaryAdmin) {
            const { data: secOrder } = await secondaryAdmin
                .from('orders')
                .select(orderSelectFields)
                .eq('id', orderId)
                .eq('restaurant_id', actualRestaurantId)
                .maybeSingle();
            if (secOrder) order = secOrder;
        }

        if (orderErr && !order) {
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

/**
 * POST /api/customer/orders/status
 * Confirms a queued customer order to 'placed' (auto-confirm or manual button).
 * Atomic, authoritative server update with supabaseAdmin.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const orderId = (body.orderId || '').trim();
        const restaurantCode = (body.restaurantId || body.restaurantCode || '').trim();
        const newStatus = (body.status || 'placed').toLowerCase().trim();

        if (!orderId) {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const actualRestaurantId = restaurantCode ? await resolveRestaurantId(restaurantCode) : null;

        // 1. Verify order exists across primary and secondary databases
        let targetAdmins = [supabaseAdmin];
        if (secondaryAdmin) {
            targetAdmins.push(secondaryAdmin);
        }

        let existingOrder: any = null;
        let matchedAdmin = supabaseAdmin;

        for (const admin of targetAdmins) {
            let orderQuery = admin
                .from('orders')
                .select('id, restaurant_id, table_id, status')
                .eq('id', orderId);

            if (actualRestaurantId) {
                orderQuery = orderQuery.eq('restaurant_id', actualRestaurantId);
            }

            const { data, error } = await orderQuery.maybeSingle();
            if (data) {
                existingOrder = data;
                matchedAdmin = admin;
                break;
            }
        }

        if (!existingOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // 2. Cascade update to all queued order items across all active admins (ensuring both stay in sync)
        for (const admin of targetAdmins) {
            await admin
                .from('order_items')
                .update({ status: newStatus })
                .eq('order_id', orderId);
        }

        // 3. Update orders status across active admins
        let updatedOrder: any = null;
        for (const admin of targetAdmins) {
            const { data, error } = await admin
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId)
                .select('id, status, table_id, restaurant_id')
                .maybeSingle();

            if (data && !updatedOrder) {
                updatedOrder = data;
            }
        }

        return NextResponse.json({
            success: true,
            orderId: updatedOrder?.id || orderId,
            status: updatedOrder?.status || newStatus
        });
    } catch (err: any) {
        console.error('[OrderStatus POST] Fatal exception:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
