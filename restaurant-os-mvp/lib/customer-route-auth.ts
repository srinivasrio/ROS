import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerTableSession, type CustomerTableSessionData } from '@/lib/customer-table-session';

/**
 * Server-side authorization for customer dining actions.
 *
 * Customers authenticate with the httpOnly `customer_table_session` cookie
 * (role `customer_table`, bound to restaurant_id + table_id). These helpers let
 * customer API routes act with the service role while staying strictly scoped to
 * the caller's own table session — replacing the broad anon RLS the browser used
 * to rely on (audit DIO-C04). The client never supplies the table or order id for
 * scoping; it is taken from the signed session.
 */

export interface CustomerCtx {
    session: CustomerTableSessionData;
    restaurantId: string;
    tableId: string;
}

export type CustomerAuthResult =
    | { ok: true; ctx: CustomerCtx }
    | { ok: false; status: number; error: string };

export async function requireCustomerSession(req: NextRequest): Promise<CustomerAuthResult> {
    const session = await getCustomerTableSession(req);
    if (!session || !session.restaurant_id || session.table_id === undefined || session.table_id === null) {
        return { ok: false, status: 401, error: 'No valid table session. Please re-scan the table QR code.' };
    }
    return {
        ok: true,
        ctx: {
            session,
            restaurantId: String(session.restaurant_id),
            tableId: String(session.table_id),
        },
    };
}

/**
 * Returns the order row only if it belongs to the caller's table session
 * (same restaurant, and the order's table is the session table or a merged
 * group that contains it). Returns null otherwise — callers map that to 403/404.
 */
export async function getSessionScopedOrder(ctx: CustomerCtx, orderId: string) {
    if (!orderId) return null;
    const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, restaurant_id, table_id, merge_group_id, status, is_completed, total_amount, discount_amount, gst_amount, cgst_amount, sgst_amount, delivery_fee, order_type, coupon_code')
        .eq('id', orderId)
        .maybeSingle();

    if (!order) return null;
    if (String(order.restaurant_id) !== ctx.restaurantId) return null;

    if (order.table_id !== null && order.table_id !== undefined && String(order.table_id) === ctx.tableId) {
        return order;
    }

    if (order.merge_group_id) {
        const { data: member } = await supabaseAdmin
            .from('tables')
            .select('id')
            .eq('merged_group_id', order.merge_group_id)
            .eq('id', ctx.tableId)
            .maybeSingle();
        if (member) return order;
    }

    return null;
}

/** Statuses at which a customer may still edit/cancel their own order. */
const CUSTOMER_EDITABLE_STATUSES = new Set(['placed', 'queued', 'preparing']);

export function isCustomerEditable(order: { status?: string | null; is_completed?: boolean | null }): boolean {
    if (!order || order.is_completed) return false;
    return CUSTOMER_EDITABLE_STATUSES.has(String(order.status || '').toLowerCase());
}
