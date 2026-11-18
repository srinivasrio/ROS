import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireCustomerSession, getSessionScopedOrder, isCustomerEditable } from '@/lib/customer-route-auth';

export const dynamic = 'force-dynamic';

const ceil2 = (num: number) => {
    const n = Number(num || 0);
    const clean = Math.round(n * 1e8) / 1e8;
    return Math.ceil(clean * 100) / 100;
};

/**
 * POST /api/customer/orders/coupon   body: { orderId, couponCode }
 *
 * Server-side replacement for OrderService.updateOrderCoupon in the customer
 * flow. Recomputes subtotal/GST from the stored order_items and the restaurant's
 * tax config, validates the coupon authoritatively, and writes the new totals.
 * Prices/tax are never taken from the client. Scoped to the caller's table
 * session; service-role (audit DIO-C04, and supports DIO-H03 hardening).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireCustomerSession(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { restaurantId } = auth.ctx;

        const body = await req.json().catch(() => ({}));
        const orderId = String(body?.orderId || '').trim();
        const couponCode = body?.couponCode != null ? String(body.couponCode).trim() : '';
        if (!orderId) {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const order = await getSessionScopedOrder(auth.ctx, orderId);
        if (!order) {
            return NextResponse.json({ error: 'Order not found for this table session' }, { status: 403 });
        }
        if (!isCustomerEditable(order)) {
            return NextResponse.json({ error: 'This order can no longer be modified from the table.' }, { status: 409 });
        }

        const { data: orderItems } = await supabaseAdmin
            .from('order_items')
            .select('price_at_time, quantity, tax_percent, cgst_percent, sgst_percent')
            .eq('order_id', orderId);

        const { data: restTax } = await supabaseAdmin
            .from('restaurants')
            .select('gst_percentage, cgst_percentage, sgst_percentage')
            .eq('id', restaurantId)
            .maybeSingle();

        const defaultGst = restTax?.gst_percentage != null ? Number(restTax.gst_percentage) : 5;
        const defaultCgst = restTax?.cgst_percentage != null ? Number(restTax.cgst_percentage) : defaultGst / 2;
        const defaultSgst = restTax?.sgst_percentage != null ? Number(restTax.sgst_percentage) : defaultGst / 2;

        let rawSubtotal = 0;
        let computedCgst = 0;
        let computedSgst = 0;
        for (const item of orderItems || []) {
            const price = Number(item.price_at_time || 0);
            const qty = Number(item.quantity || 1);
            const lineTotal = price * qty;
            rawSubtotal += lineTotal;
            const itemGst = item.tax_percent != null && !isNaN(Number(item.tax_percent)) ? Number(item.tax_percent) : defaultGst;
            const itemCgst = item.cgst_percent != null && !isNaN(Number(item.cgst_percent)) ? Number(item.cgst_percent) : itemGst / 2;
            const itemSgst = item.sgst_percent != null && !isNaN(Number(item.sgst_percent)) ? Number(item.sgst_percent) : itemGst / 2;
            computedCgst += (lineTotal * itemCgst) / 100;
            computedSgst += (lineTotal * itemSgst) / 100;
        }
        // Reference defaults so unused-var lint does not fire while keeping parity with the service method.
        void defaultCgst;
        void defaultSgst;

        const subtotal = ceil2(rawSubtotal);
        const cgstAmount = ceil2(computedCgst);
        const sgstAmount = ceil2(computedSgst);
        const gstAmount = ceil2(cgstAmount + sgstAmount);
        const deliveryFee = ceil2(Number(order.delivery_fee || 0));

        let authoritativeDiscount = 0;
        let cleanCode: string | null = null;

        if (couponCode) {
            cleanCode = couponCode.toUpperCase();
            const { data: offerData } = await supabaseAdmin
                .from('offers')
                .select('id, code, discount_type, discount_value, max_discount, status, start_datetime, end_datetime, applicable_order_type')
                .eq('restaurant_id', restaurantId)
                .eq('code', cleanCode)
                .eq('status', 'active')
                .maybeSingle();

            if (!offerData) {
                return NextResponse.json({ error: `Coupon code "${cleanCode}" is invalid or inactive.` }, { status: 400 });
            }
            const now = new Date();
            if (offerData.start_datetime && new Date(offerData.start_datetime) > now) {
                return NextResponse.json({ error: `Coupon "${cleanCode}" is not active yet.` }, { status: 400 });
            }
            if (offerData.end_datetime && new Date(offerData.end_datetime) < now) {
                return NextResponse.json({ error: `Coupon "${cleanCode}" has expired.` }, { status: 400 });
            }
            if (offerData.applicable_order_type && offerData.applicable_order_type !== 'all') {
                const normOrderType = String(order.order_type || 'DINE_IN').toUpperCase();
                const applicable = String(offerData.applicable_order_type).toUpperCase();
                if (normOrderType !== applicable) {
                    const labelMap: Record<string, string> = { DINE_IN: 'Dine-In', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };
                    return NextResponse.json({ error: `Coupon "${cleanCode}" is only valid for ${labelMap[applicable] || applicable} orders.` }, { status: 400 });
                }
            }
            if (offerData.discount_type === 'percentage') {
                let disc = (subtotal * Number(offerData.discount_value)) / 100;
                if (offerData.max_discount != null) disc = Math.min(disc, Number(offerData.max_discount));
                authoritativeDiscount = disc;
            } else {
                authoritativeDiscount = Number(offerData.discount_value || 0);
            }
            authoritativeDiscount = ceil2(Math.min(authoritativeDiscount, subtotal));
        }

        const finalTotal = ceil2(Math.max(0, subtotal + gstAmount + deliveryFee - authoritativeDiscount));

        const { error } = await supabaseAdmin
            .from('orders')
            .update({
                coupon_code: cleanCode,
                discount_amount: authoritativeDiscount,
                gst_amount: gstAmount,
                cgst_amount: cgstAmount,
                sgst_amount: sgstAmount,
                total_amount: finalTotal,
            })
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;

        return NextResponse.json({
            success: true,
            id: orderId,
            coupon_code: cleanCode,
            discount_amount: authoritativeDiscount,
            gst_amount: gstAmount,
            cgst_amount: cgstAmount,
            sgst_amount: sgstAmount,
            subtotal,
            total_amount: finalTotal,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to apply coupon';
        console.error('[customer/orders/coupon] Error:', message);
        return NextResponse.json({ error: 'Failed to apply coupon' }, { status: 500 });
    }
}
