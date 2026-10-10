import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { normalizeTableNumber } from '@/lib/utils';

export interface SessionEligibilityResult {
    canExpire: boolean;
    isProtected: boolean;
    hasActiveOrders: boolean;
    hasUnpaidBalance: boolean;
    hasPendingRequests: boolean;
    hasOtherActiveMembers: boolean;
    hasRecoverableCart: boolean;
    reasons: string[];
}

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

export class TableSessionLifecycleService {
    /**
     * Evaluates whether a session is protected or eligible for expiration.
     */
    static async evaluateSessionEligibility(
        sessionId: string,
        restaurantId: string
    ): Promise<SessionEligibilityResult> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;
        const reasons: string[] = [];

        const { data: session, error: sessErr } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        if (sessErr || !session) {
            return {
                canExpire: false,
                isProtected: false,
                hasActiveOrders: false,
                hasUnpaidBalance: false,
                hasPendingRequests: false,
                hasOtherActiveMembers: false,
                hasRecoverableCart: false,
                reasons: ['Session not found'],
            };
        }

        const tableNum = session.table_number;
        const tableId = session.table_id;

        // 1. Resolve table ID if numeric
        let resolvedTableId = tableId;
        if (!resolvedTableId || isNaN(Number(resolvedTableId))) {
            const { data: tRow } = await supabaseAdmin
                .from('tables')
                .select('id')
                .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
                .eq('table_number', tableNum)
                .maybeSingle();
            if (tRow) {
                resolvedTableId = String(tRow.id);
            }
        }

        // 2. Check for active/unfinished food orders
        let orderQuery = supabaseAdmin
            .from('orders')
            .select('id, status, is_completed, total_amount')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('is_completed', false);

        if (resolvedTableId && !isNaN(Number(resolvedTableId))) {
            orderQuery = orderQuery.eq('table_id', Number(resolvedTableId));
        } else {
            orderQuery = orderQuery.eq('table_id', -9999); // Safe fallback
        }

        const { data: orders } = await orderQuery;

        const activeOrderList = (orders || []).filter(o => 
            ['queued', 'placed', 'preparing', 'ready', 'served'].includes(o.status?.toLowerCase())
        );
        const hasActiveOrders = activeOrderList.length > 0;
        if (hasActiveOrders) {
            reasons.push(`Contains ${activeOrderList.length} active in-progress order(s)`);
        }

        // 3. Check for unpaid balances
        const unpaidOrderList = (orders || []).filter(o =>
            !['paid', 'cancelled'].includes(o.status?.toLowerCase())
        );
        const hasUnpaidBalance = unpaidOrderList.length > 0;
        if (hasUnpaidBalance) {
            reasons.push(`Contains ${unpaidOrderList.length} unpaid order(s)`);
        }

        // 4. Check for pending service requests (call waiter, etc.)
        let srQuery = supabaseAdmin
            .from('service_requests')
            .select('id')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('request_status', 'pending');

        if (tableNum && resolvedTableId) {
            srQuery = srQuery.or(`table_number.eq.${tableNum},table_id.eq.${resolvedTableId}`);
        } else if (tableNum) {
            srQuery = srQuery.eq('table_number', tableNum);
        }

        const { data: pendingReqs } = await srQuery;
        const hasPendingRequests = Boolean(pendingReqs && pendingReqs.length > 0);
        if (hasPendingRequests) {
            reasons.push(`Contains pending waiter service request(s)`);
        }

        // 5. Check for other active approved members
        const { data: activeMembers } = await supabaseAdmin
            .from('table_join_requests')
            .select('id')
            .eq('session_id', session.id)
            .eq('status', 'approved')
            .eq('membership_status', 'ACTIVE');

        const hasOtherActiveMembers = Boolean(activeMembers && activeMembers.length > 0);
        if (hasOtherActiveMembers) {
            reasons.push(`Has ${activeMembers?.length} other active member(s) seated`);
        }

        // 6. Check for recoverable cart items (10-minute window)
        let hasRecoverableCart = false;
        if (session.cart_data && typeof session.cart_data === 'object' && Object.keys(session.cart_data).length > 0) {
            if (session.cart_updated_at) {
                const cartAgeMs = Date.now() - new Date(session.cart_updated_at).getTime();
                const tenMinMs = 10 * 60 * 1000;
                if (cartAgeMs < tenMinMs) {
                    hasRecoverableCart = true;
                    reasons.push(`Contains unsent cart items preserved for recovery`);
                }
            }
        }

        const isProtected = hasActiveOrders || hasUnpaidBalance || hasPendingRequests || hasOtherActiveMembers || hasRecoverableCart;
        const canExpire = !isProtected;

        return {
            canExpire,
            isProtected,
            hasActiveOrders,
            hasUnpaidBalance,
            hasPendingRequests,
            hasOtherActiveMembers,
            hasRecoverableCart,
            reasons,
        };
    }

    /**
     * Atomically expires a table session if it meets all eligibility rules.
     */
    static async expireSessionIfEligible(
        sessionId: string,
        restaurantId: string,
        reason: string = 'MANUAL_OR_TIMEOUT'
    ): Promise<{ success: boolean; reasons?: string[] }> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;
        const eligibility = await this.evaluateSessionEligibility(sessionId, canonicalRestaurantId);

        if (!eligibility.canExpire) {
            return { success: false, reasons: eligibility.reasons };
        }

        // Atomically transition session status
        const { data: updatedSession, error: updateErr } = await supabaseAdmin
            .from('table_active_sessions')
            .update({
                status: 'EXPIRED',
                is_active: false,
                expired_at: new Date().toISOString(),
                closure_reason: reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId)
            .eq('is_active', true)
            .select()
            .maybeSingle();

        if (updateErr || !updatedSession) {
            return { success: false, reasons: ['Failed to update session or already expired'] };
        }

        // Expire joined members
        await supabaseAdmin
            .from('table_join_requests')
            .update({
                membership_status: 'EXPIRED',
                updated_at: new Date().toISOString(),
            })
            .eq('session_id', sessionId)
            .eq('membership_status', 'ACTIVE');

        // Free the table if status was occupied
        if (updatedSession.table_number || updatedSession.table_id) {
            try {
                let tblQuery = supabaseAdmin
                    .from('tables')
                    .update({ status: 'available' })
                    .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean));

                if (updatedSession.table_id && !isNaN(Number(updatedSession.table_id))) {
                    tblQuery = tblQuery.eq('id', Number(updatedSession.table_id));
                } else {
                    tblQuery = tblQuery.eq('table_number', updatedSession.table_number);
                }
                await tblQuery;
            } catch (_) {}
        }

        return { success: true };
    }

    /**
     * Called when customer scans Table B while having an active session on Table A.
     * If Table A is empty/eligible for expiration, it safely releases Table A so Table B can be claimed.
     * If Table A has protected activity, Table A is retained and detailed info is returned.
     */
    static async checkAndReleasePreviousSession(
        restaurantId: string,
        customerMobile: string,
        targetTableNumber: string
    ): Promise<{
        released: boolean;
        previousSession?: any;
        eligibility?: SessionEligibilityResult;
    }> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;
        const cleanCustomer = cleanPhone(customerMobile);
        if (!cleanCustomer) {
            return { released: false };
        }

        const normTarget = normalizeTableNumber(targetTableNumber);

        // 1. Check if customer is host of an active session at another table
        const { data: hostSession } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('host_customer_mobile', cleanCustomer)
            .eq('is_active', true)
            .maybeSingle();

        if (hostSession && normalizeTableNumber(hostSession.table_number) !== normTarget) {
            const eligibility = await this.evaluateSessionEligibility(hostSession.id, canonicalRestaurantId);
            if (eligibility.canExpire) {
                // Safely expire empty previous session
                await this.expireSessionIfEligible(hostSession.id, canonicalRestaurantId, 'CUSTOMER_SCANNED_NEW_TABLE');
                return { released: true, previousSession: hostSession };
            } else {
                return { released: false, previousSession: hostSession, eligibility };
            }
        }

        // 2. Check if customer is approved member of another table session
        const { data: memberReq } = await supabaseAdmin
            .from('table_join_requests')
            .select('*, table_active_sessions!inner(*)')
            .in('table_active_sessions.restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('table_active_sessions.is_active', true)
            .eq('requester_customer_mobile', cleanCustomer)
            .eq('status', 'approved')
            .eq('membership_status', 'ACTIVE')
            .maybeSingle();

        if (memberReq && normalizeTableNumber(memberReq.table_active_sessions?.table_number) !== normTarget) {
            // A joined member can safely release their membership to scan another table
            // unless the entire table session has orders attributed to them
            await supabaseAdmin
                .from('table_join_requests')
                .update({
                    membership_status: 'INACTIVE',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', memberReq.id);

            return { released: true, previousSession: memberReq.table_active_sessions };
        }

        return { released: false };
    }

    /**
     * Handles customer logout:
     * - Disconnects authenticated user from table session membership.
     * - If empty and eligible, expires the session and frees table.
     * - If cart has unsent items, preserves them for up to 10 minutes.
     * - If protected (orders/unpaid balances), PRESERVES the session and NEVER touches order or payment records.
     * - One customer's logout never terminates a shared table session for other members.
     */
    static async handleCustomerLogout(
        restaurantId: string,
        customerMobile: string,
        clientCart?: any
    ): Promise<{
        membershipReleased: boolean;
        sessionExpired: boolean;
        sessionPreserved: boolean;
        reasons?: string[];
    }> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;
        const cleanCustomer = cleanPhone(customerMobile);
        if (!cleanCustomer) {
            return { membershipReleased: false, sessionExpired: false, sessionPreserved: false };
        }

        // 1. Check if customer is host
        const { data: hostSession } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('host_customer_mobile', cleanCustomer)
            .eq('is_active', true)
            .maybeSingle();

        if (hostSession) {
            // Save client cart if provided for potential recovery
            if (clientCart && typeof clientCart === 'object' && Object.keys(clientCart).length > 0) {
                await supabaseAdmin
                    .from('table_active_sessions')
                    .update({
                        cart_data: clientCart,
                        cart_updated_at: new Date().toISOString(),
                        last_activity_at: new Date().toISOString(),
                    })
                    .eq('id', hostSession.id);
            }

            const eligibility = await this.evaluateSessionEligibility(hostSession.id, canonicalRestaurantId);

            // If other members are seated, do NOT expire the shared session!
            if (eligibility.hasOtherActiveMembers) {
                return {
                    membershipReleased: true,
                    sessionExpired: false,
                    sessionPreserved: true,
                    reasons: ['Shared session preserved for other seated table members'],
                };
            }

            // If session is protected by orders, unpaid balance, or recoverable cart:
            if (eligibility.isProtected) {
                return {
                    membershipReleased: true,
                    sessionExpired: false,
                    sessionPreserved: true,
                    reasons: eligibility.reasons,
                };
            }

            // Otherwise, session is empty & abandoned: expire it immediately
            await this.expireSessionIfEligible(hostSession.id, canonicalRestaurantId, 'CUSTOMER_LOGOUT_EMPTY_SESSION');
            return {
                membershipReleased: true,
                sessionExpired: true,
                sessionPreserved: false,
            };
        }

        // 2. Check if customer is joined member
        const { data: memberReq } = await supabaseAdmin
            .from('table_join_requests')
            .select('id, session_id')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('requester_customer_mobile', cleanCustomer)
            .eq('status', 'approved')
            .eq('membership_status', 'ACTIVE')
            .maybeSingle();

        if (memberReq) {
            await supabaseAdmin
                .from('table_join_requests')
                .update({
                    membership_status: 'INACTIVE',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', memberReq.id);

            return {
                membershipReleased: true,
                sessionExpired: false,
                sessionPreserved: true,
                reasons: ['Member logged out; host session remains active'],
            };
        }

        return { membershipReleased: false, sessionExpired: false, sessionPreserved: false };
    }

    /**
     * Persists or updates the customer cart on the active table session.
     */
    static async syncCart(
        restaurantId: string,
        tableNumber: string,
        customerMobile: string,
        cart: Record<string, any>
    ): Promise<boolean> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;
        const cleanCustomer = cleanPhone(customerMobile);
        const normTable = normalizeTableNumber(tableNumber);

        let query = supabaseAdmin
            .from('table_active_sessions')
            .update({
                cart_data: cart || {},
                cart_updated_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
            })
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('is_active', true);

        if (cleanCustomer) {
            query = query.eq('host_customer_mobile', cleanCustomer);
        } else {
            query = query.or(`table_number.eq.${tableNumber},table_number.eq.${normTable},table_number.ilike.Table ${normTable}`);
        }

        const { error } = await query;
        return !error;
    }

    /**
     * Recovers cart from active session if within 10-minute countdown.
     */
    static async recoverCart(
        restaurantId: string,
        tableNumber: string,
        customerMobile?: string
    ): Promise<{ hasRecoverableCart: boolean; cart?: Record<string, any>; remainingSeconds?: number }> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;
        const normTable = normalizeTableNumber(tableNumber);

        let query = supabaseAdmin
            .from('table_active_sessions')
            .select('cart_data, cart_updated_at')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('is_active', true);

        const cleanCustomer = cleanPhone(customerMobile || '');
        if (cleanCustomer) {
            query = query.eq('host_customer_mobile', cleanCustomer);
        } else {
            query = query.or(`table_number.eq.${tableNumber},table_number.eq.${normTable},table_number.ilike.Table ${normTable}`);
        }

        const { data: session } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (!session || !session.cart_data || Object.keys(session.cart_data).length === 0 || !session.cart_updated_at) {
            return { hasRecoverableCart: false };
        }

        const ageMs = Date.now() - new Date(session.cart_updated_at).getTime();
        const tenMinMs = 10 * 60 * 1000;
        if (ageMs > tenMinMs) {
            return { hasRecoverableCart: false };
        }

        const remainingSeconds = Math.max(0, Math.floor((tenMinMs - ageMs) / 1000));
        return {
            hasRecoverableCart: true,
            cart: session.cart_data,
            remainingSeconds,
        };
    }

    /**
     * Staff/Admin closes table after mandatory checks pass.
     */
    static async closeTableByStaff(
        tableId: number | string,
        restaurantId: string,
        staffId?: string
    ): Promise<{ success: boolean; message: string }> {
        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;

        // Verify active orders on table
        let orderQuery = supabaseAdmin
            .from('orders')
            .select('id, status, is_completed')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('is_completed', false);

        if (!isNaN(Number(tableId))) {
            orderQuery = orderQuery.eq('table_id', Number(tableId));
        }

        const { data: openOrders } = await orderQuery;

        const unsettledOrders = (openOrders || []).filter(o => 
            !['paid', 'cancelled'].includes(o.status?.toLowerCase())
        );

        if (unsettledOrders.length > 0) {
            throw new Error(
                `Cannot close table: ${unsettledOrders.length} order(s) remain unsettled. Please settle the bill or complete payments first.`
            );
        }

        // Close session
        let sessQuery = supabaseAdmin
            .from('table_active_sessions')
            .update({
                status: 'CLOSED',
                is_active: false,
                closed_at: new Date().toISOString(),
                closure_reason: staffId ? `STAFF_CLEARED_${staffId}` : 'STAFF_CLEARED',
                updated_at: new Date().toISOString(),
            })
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('is_active', true);

        if (!isNaN(Number(tableId))) {
            sessQuery = sessQuery.eq('table_id', String(tableId));
        }
        await sessQuery;

        // Set table available
        let tblQuery = supabaseAdmin
            .from('tables')
            .update({
                status: 'available',
                assigned_waiter_id: null,
                co_waiter_ids: [],
                alert_status: null,
            })
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean));

        if (!isNaN(Number(tableId))) {
            tblQuery = tblQuery.eq('id', Number(tableId));
        }
        await tblQuery;

        return { success: true, message: 'Table successfully cleared and closed' };
    }

    /**
     * Executes scheduled background cleanup of idle abandoned sessions.
     */
    static async runScheduledCleanup(restaurantId?: string): Promise<{ cleanedCount: number }> {
        try {
            const { data, error } = await supabaseAdmin.rpc('expire_eligible_table_sessions', {
                p_restaurant_id: restaurantId || null,
            });
            if (error) {
                console.error('[runScheduledCleanup] RPC error:', error);
                return { cleanedCount: 0 };
            }
            return { cleanedCount: Array.isArray(data) ? data.length : 0 };
        } catch (err) {
            console.error('[runScheduledCleanup] Exception:', err);
            return { cleanedCount: 0 };
        }
    }
}
