/**
 * Unified Pricing & Tax Calculation Engine for Dine in One
 * 
 * Provides consistent, authoritative calculations for:
 * - Original Items Subtotal
 * - Coupon Discounts
 * - GST (CGST + SGST) according to restaurant-configured tax rules
 * - Delivery Fees
 * - Final Payable Total
 * - Payment & Balance Due
 * 
 * Used across Customer, Waiter, Admin, Owner panels, and Invoices.
 */

export interface OrderPricingItem {
    price?: number | null;
    price_at_time?: number | null;
    quantity?: number | null;
    tax_percent?: number | null;
    gst_percentage?: number | null;
    cgst_percent?: number | null;
    cgst_percentage?: number | null;
    sgst_percent?: number | null;
    sgst_percentage?: number | null;
}

export interface OrderPricingInput {
    id?: string;
    total_amount?: number | string | null;
    discount_amount?: number | string | null;
    coupon_code?: string | null;
    gst_amount?: number | string | null;
    cgst_amount?: number | string | null;
    sgst_amount?: number | string | null;
    delivery_fee?: number | string | null;
    amount_paid?: number | string | null;
    items?: OrderPricingItem[] | null;
    order_items?: OrderPricingItem[] | null;
}

export interface RestaurantTaxSettings {
    gst_percentage?: number | string | null;
    cgst_percentage?: number | string | null;
    sgst_percentage?: number | string | null;
}

export interface OrderPricingBreakdown {
    itemsSubtotal: number;
    discountAmount: number;
    couponCode: string | null;
    cgstAmount: number;
    sgstAmount: number;
    gstAmount: number;
    deliveryFee: number;
    finalTotal: number;
    amountPaid: number;
    balanceDue: number;
    effectiveGstRate: number;
}

/**
 * High-precision rounding to 2 decimal places using ceil logic consistent with backend RPC
 */
export const ceil2 = (num: number | string | null | undefined): number => {
    const n = Number(num || 0);
    if (isNaN(n)) return 0;
    const clean = Math.round(n * 1e8) / 1e8;
    return Math.ceil(clean * 100) / 100;
};

export const round2 = ceil2;

/**
 * Calculates authoritative order pricing breakdown
 */
export function calculateOrderPricing(
    order?: OrderPricingInput | null,
    restaurantTaxSettings?: RestaurantTaxSettings | null
): OrderPricingBreakdown {
    if (!order) {
        return {
            itemsSubtotal: 0,
            discountAmount: 0,
            couponCode: null,
            cgstAmount: 0,
            sgstAmount: 0,
            gstAmount: 0,
            deliveryFee: 0,
            finalTotal: 0,
            amountPaid: 0,
            balanceDue: 0,
            effectiveGstRate: 5,
        };
    }

    const items = (Array.isArray(order.items) && order.items.length > 0)
        ? order.items
        : (Array.isArray(order.order_items) && order.order_items.length > 0 ? order.order_items : []);

    const defaultGst = restaurantTaxSettings?.gst_percentage != null
        ? Number(restaurantTaxSettings.gst_percentage)
        : 5;
    const defaultCgst = restaurantTaxSettings?.cgst_percentage != null
        ? Number(restaurantTaxSettings.cgst_percentage)
        : defaultGst / 2;
    const defaultSgst = restaurantTaxSettings?.sgst_percentage != null
        ? Number(restaurantTaxSettings.sgst_percentage)
        : defaultGst / 2;

    // 1. Calculate items subtotal
    let rawItemsSubtotal = 0;
    let computedCgst = 0;
    let computedSgst = 0;

    if (items.length > 0) {
        for (const item of items) {
            const price = Number(item.price ?? item.price_at_time ?? 0);
            const qty = Number(item.quantity ?? 1);
            const lineSubtotal = price * qty;
            rawItemsSubtotal += lineSubtotal;

            const itemGst = item.tax_percent != null && !isNaN(Number(item.tax_percent))
                ? Number(item.tax_percent)
                : (item.gst_percentage != null && !isNaN(Number(item.gst_percentage))
                    ? Number(item.gst_percentage)
                    : defaultGst);

            const itemCgst = item.cgst_percent != null && !isNaN(Number(item.cgst_percent))
                ? Number(item.cgst_percent)
                : (item.cgst_percentage != null && !isNaN(Number(item.cgst_percentage))
                    ? Number(item.cgst_percentage)
                    : (itemGst / 2));

            const itemSgst = item.sgst_percent != null && !isNaN(Number(item.sgst_percent))
                ? Number(item.sgst_percent)
                : (item.sgst_percentage != null && !isNaN(Number(item.sgst_percentage))
                    ? Number(item.sgst_percentage)
                    : (itemGst / 2));

            computedCgst += (lineSubtotal * itemCgst) / 100;
            computedSgst += (lineSubtotal * itemSgst) / 100;
        }
    }

    const deliveryFee = ceil2(order.delivery_fee);
    const discountAmount = ceil2(order.discount_amount);
    const couponCode = order.coupon_code && String(order.coupon_code).trim()
        ? String(order.coupon_code).trim().toUpperCase()
        : null;

    // 2. GST Resolution
    let cgstAmount = 0;
    let sgstAmount = 0;
    let gstAmount = 0;

    if (order.cgst_amount != null && order.sgst_amount != null && (Number(order.cgst_amount) > 0 || Number(order.sgst_amount) > 0)) {
        cgstAmount = ceil2(order.cgst_amount);
        sgstAmount = ceil2(order.sgst_amount);
        gstAmount = ceil2(order.gst_amount != null && Number(order.gst_amount) > 0 ? order.gst_amount : (cgstAmount + sgstAmount));
    } else if (order.gst_amount != null && Number(order.gst_amount) > 0) {
        gstAmount = ceil2(order.gst_amount);
        cgstAmount = ceil2(gstAmount / 2);
        sgstAmount = ceil2(gstAmount / 2);
    } else if (items.length > 0) {
        cgstAmount = ceil2(computedCgst);
        sgstAmount = ceil2(computedSgst);
        gstAmount = ceil2(cgstAmount + sgstAmount);
    } else {
        gstAmount = 0;
        cgstAmount = 0;
        sgstAmount = 0;
    }

    // 3. Subtotal Resolution (if items not populated)
    const itemsSubtotal = items.length > 0
        ? ceil2(rawItemsSubtotal)
        : ceil2(Math.max(0, (Number(order.total_amount) || 0) - gstAmount - deliveryFee + discountAmount));

    // 4. Final Total Resolution:
    // In database, order.total_amount is ALREADY net of discount (itemsSubtotal + gst + delivery - discount).
    // NEVER subtract discount_amount from total_amount a second time!
    const finalTotal = (order.total_amount != null && Number(order.total_amount) > 0)
        ? ceil2(order.total_amount)
        : ceil2(Math.max(0, itemsSubtotal + gstAmount + deliveryFee - discountAmount));

    const amountPaid = ceil2(order.amount_paid);
    const balanceDue = ceil2(Math.max(0, finalTotal - amountPaid));

    const effectiveGstRate = itemsSubtotal > 0
        ? Math.round((gstAmount / itemsSubtotal) * 100 * 100) / 100
        : defaultGst;

    return {
        itemsSubtotal,
        discountAmount,
        couponCode,
        cgstAmount,
        sgstAmount,
        gstAmount,
        deliveryFee,
        finalTotal,
        amountPaid,
        balanceDue,
        effectiveGstRate,
    };
}
