import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/jwt-utils';
import { getAuthenticatedOwner } from '@/lib/owner-auth';
import { getCustomerTableSession } from '@/lib/customer-table-session';
import { isRealtimeTokenConfigured, signRealtimeToken, type RealtimeClaims } from '@/lib/realtime-token';

export const dynamic = 'force-dynamic';

/**
 * GET /api/realtime/token
 *
 * Issues a short-lived Supabase Realtime token scoped to the caller:
 *  - customer: bound to the signed table session (restaurant + table)
 *  - owner: all restaurants the owner controls
 *  - staff (admin/waiter/kds/delivery): their own restaurant
 * The client never supplies a restaurant or table id. 204 = not configured or
 * no identity, so the client keeps its current (pre-lockdown) behavior.
 */
export async function GET(req: NextRequest) {
    try {
        if (!isRealtimeTokenConfigured()) {
            return new NextResponse(null, { status: 204 });
        }

        // 1) Staff / owner via the app token (header, bearer, or cookies).
        const owner = await getAuthenticatedOwner(req);
        if (owner) {
            const ids = (owner.restaurantIds?.length ? owner.restaurantIds : [owner.restaurantId]).filter(Boolean);
            if (ids.length) {
                const claims: RealtimeClaims = { sub: owner.userId, scope: 'staff', restaurant_ids: ids.map(String) };
                return NextResponse.json(await signRealtimeToken(claims), { headers: { 'Cache-Control': 'no-store' } });
            }
        }

        const authHeader = req.headers.get('authorization') || '';
        const raw = req.headers.get('x-dine-token') || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
        const payload = raw ? await verifyJwt(raw) : null;
        if (payload && payload.role !== 'customer_table') {
            const restaurantId = payload.restaurantId || payload.restaurant_id;
            if (restaurantId) {
                // Same revocation checks as /api/auth/session so a revoked staff member cannot mint.
                if (payload.sessionId) {
                    const { data: s } = await supabaseAdmin.from('dine_sessions').select('is_active').eq('id', payload.sessionId).maybeSingle();
                    if (!s || s.is_active === false) return NextResponse.json({ error: 'Session revoked' }, { status: 401 });
                }
                if (payload.userId) {
                    const { data: emp } = await supabaseAdmin
                        .from('employees')
                        .select('status, approval_status, is_deleted, session_version')
                        .eq('id', payload.userId)
                        .maybeSingle();
                    if (emp && (emp.is_deleted || emp.status !== 'active' || emp.approval_status !== 'approved'
                        || (payload.sessionVersion && emp.session_version && payload.sessionVersion < emp.session_version))) {
                        return NextResponse.json({ error: 'Staff session revoked' }, { status: 401 });
                    }
                }
                const claims: RealtimeClaims = { sub: String(payload.userId || payload.sub || 'staff'), scope: 'staff', restaurant_ids: [String(restaurantId)] };
                return NextResponse.json(await signRealtimeToken(claims), { headers: { 'Cache-Control': 'no-store' } });
            }
        }

        // 2) Customer via httpOnly table-session cookie.
        const session = await getCustomerTableSession(req);
        if (session?.restaurant_id && session.table_id !== undefined && session.table_id !== null) {
            const claims: RealtimeClaims = {
                sub: String(session.session_id || `table:${session.table_id}`),
                scope: 'customer',
                restaurant_ids: [String(session.restaurant_id)],
                table_id: String(session.table_id),
            };
            return NextResponse.json(await signRealtimeToken(claims), { headers: { 'Cache-Control': 'no-store' } });
        }

        return new NextResponse(null, { status: 204 });
    } catch (err: unknown) {
        console.error('[realtime/token] Error:', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Failed to issue realtime token' }, { status: 500 });
    }
}
