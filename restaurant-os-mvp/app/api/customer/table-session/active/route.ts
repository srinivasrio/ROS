import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { extractCustomerTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';
import { normalizeTableNumber } from '@/lib/utils';
import { createCustomerTableSessionToken, setCustomerTableSessionCookie } from '@/lib/customer-table-session';
import { TableSessionLifecycleService } from '@/services/table-session-lifecycle.service';

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

function maskPhone(phone: string): string {
    const c = cleanPhone(phone);
    if (c.length < 10) return phone;
    return `+91 ******${c.slice(-4)}`;
}

async function buildOtherSessionPayload(
    session: any,
    restaurantId: string,
    canonicalRestaurantId: string,
    isHost: boolean,
    hostName: string
) {
    const tableNum = String(session.table_number || '');
    let tableToken: string | null = session.table_token || null;

    if (!tableToken && tableNum) {
        const { data: tRow } = await supabaseAdmin
            .from('tables')
            .select('table_token')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId])
            .eq('table_number', tableNum)
            .maybeSingle();
        if (tRow?.table_token) {
            tableToken = tRow.table_token;
        }
    }

    let restaurantSlug: string | null = null;
    const { data: prof } = await supabaseAdmin
        .from('restaurant_profile')
        .select('slug')
        .in('restaurant_id', [restaurantId, canonicalRestaurantId])
        .maybeSingle();
    if (prof?.slug) {
        restaurantSlug = prof.slug;
    }

    const restCode = restaurantSlug || canonicalRestaurantId || restaurantId;
    let homeUrl = '';
    if (tableToken) {
        homeUrl = `/customer/t/${tableToken}/home`;
    } else if (restCode && tableNum) {
        homeUrl = `/${restCode}/customer/home/${encodeURIComponent(tableNum)}`;
    }

    return {
        sessionId: session.id,
        tableNumber: tableNum,
        tableToken: tableToken,
        restaurantId: canonicalRestaurantId,
        restaurantSlug: restaurantSlug,
        restaurantCode: restCode,
        homeUrl: homeUrl,
        isHost: isHost,
        hostName: hostName || 'Table Host',
    };
}

/**
 * GET /api/customer/table-session/active
 * Check if an active dining session exists for this table.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const restaurantId = searchParams.get('restaurantId')?.trim();
        const tableNumber = searchParams.get('tableNumber')?.trim();
        const customerMobile = searchParams.get('customerMobile')?.trim();

        if (!restaurantId || !tableNumber) {
            return NextResponse.json({ error: 'restaurantId and tableNumber are required' }, { status: 400 });
        }

        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;

        let resolvedTableNumber = tableNumber;
        if (tableNumber.length >= 16) {
            const { data: tRow } = await supabaseAdmin
                .from('tables')
                .select('table_number')
                .eq('table_token', tableNumber)
                .maybeSingle();
            if (tRow?.table_number) {
                resolvedTableNumber = String(tRow.table_number);
            }
        }

        let resolvedCustomerPhone = customerMobile || '';
        if (!resolvedCustomerPhone) {
            const authHeader = req.headers.get('authorization');
            let token: string | null = null;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7).trim();
            }
            if (!token) {
                token = extractCustomerTokenForRestaurant(req.cookies, canonicalRestaurantId || restaurantId);
            }
            if (token) {
                try {
                    const payload: any = await verifyJwt(token);
                    if (payload?.mobile) {
                        resolvedCustomerPhone = payload.mobile;
                    }
                } catch {}
            }
        }

        const cleanCustomer = cleanPhone(resolvedCustomerPhone);
        const normReqTable = normalizeTableNumber(resolvedTableNumber);

        // Check if customer belongs to a protected active session at ANOTHER table in this restaurant
        // If their previous session was empty/abandoned, it is safely expired so they can dine here.
        if (cleanCustomer) {
            const releaseCheck = await TableSessionLifecycleService.checkAndReleasePreviousSession(
                canonicalRestaurantId,
                cleanCustomer,
                resolvedTableNumber
            );

            if (!releaseCheck.released && releaseCheck.previousSession) {
                const prev = releaseCheck.previousSession;
                const isHost = cleanPhone(prev.host_customer_mobile) === cleanCustomer;
                const otherPayload = await buildOtherSessionPayload(
                    prev,
                    restaurantId,
                    canonicalRestaurantId,
                    isHost,
                    prev.host_customer_name
                );
                return NextResponse.json({
                    hasActiveSession: true,
                    customerHasOtherActiveSession: true,
                    otherSession: otherPayload,
                    reasons: releaseCheck.eligibility?.reasons || [],
                    isAuthorized: false,
                    isHost: false,
                    tableNumber: resolvedTableNumber,
                    message: isHost
                        ? `You are already seated at Table ${prev.table_number}`
                        : `You are already a member of Table ${prev.table_number}`,
                });
            }
        }

        // Query by canonical ID or slug, and by table_number or table_token
        let sessionQuery = supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId].filter(Boolean))
            .eq('is_active', true);

        const orConditions: string[] = [];
        if (resolvedTableNumber) {
            orConditions.push(`table_number.eq.${resolvedTableNumber}`);
            if (normReqTable && normReqTable !== resolvedTableNumber) {
                orConditions.push(`table_number.eq.${normReqTable}`);
            }
            orConditions.push(`table_number.ilike.Table ${normReqTable}`);
        }
        if (tableNumber && tableNumber !== resolvedTableNumber) {
            orConditions.push(`table_token.eq.${tableNumber}`);
            orConditions.push(`table_number.eq.${tableNumber}`);
        }
        if (orConditions.length > 0) {
            sessionQuery = sessionQuery.or(orConditions.join(','));
        }

        let { data: session, error } = await sessionQuery
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[table-session/active] DB Error:', error);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
        }

        if (!session) {
            return NextResponse.json({ hasActiveSession: false, customerHasOtherActiveSession: false });
        }

        const cleanHost = cleanPhone(session.host_customer_mobile);
        const isHost = Boolean(cleanCustomer && cleanCustomer === cleanHost);

        let approvalStatus: 'host' | 'approved' | 'pending' | 'rejected' | 'none' = isHost ? 'host' : 'none';
        let requestId: string | null = null;

        if (!isHost && cleanCustomer) {
            const { data: joinReq } = await supabaseAdmin
                .from('table_join_requests')
                .select('id, status')
                .eq('session_id', session.id)
                .eq('requester_customer_mobile', cleanCustomer)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (joinReq) {
                approvalStatus = joinReq.status as any;
                requestId = joinReq.id;
            }
        }

        const { count: approvedCount } = await supabaseAdmin
            .from('table_join_requests')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .eq('status', 'approved');

        const participantCount = 1 + (approvedCount || 0);
        const isAuthorized = Boolean(isHost || approvalStatus === 'approved');

        const response = NextResponse.json({
            hasActiveSession: true,
            customerHasOtherActiveSession: false,
            isAuthorized,
            sessionId: session.id,
            tableNumber: session.table_number,
            hostName: session.host_customer_name || 'Table Host',
            hostMobileMasked: maskPhone(session.host_customer_mobile),
            isHost,
            approvalStatus,
            participantCount,
            requestId,
        });

        // If customer is authorized member or host, bind or refresh customer table session cookie
        if (isAuthorized) {
            try {
                const sessionJwt = await createCustomerTableSessionToken({
                    restaurant_id: canonicalRestaurantId,
                    table_id: session.table_id || session.table_number,
                    table_number: String(session.table_number),
                    table_token: session.table_token || '',
                    session_id: session.id,
                });
                setCustomerTableSessionCookie(response, sessionJwt);
            } catch (jwtErr) {
                console.warn('[table-session/active] Cookie refresh notice:', jwtErr);
            }
        }

        return response;
    } catch (err: any) {
        console.error('[table-session/active] Handler Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

/**
 * POST /api/customer/table-session/active
 * Claim or start a table host session.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const {
            restaurantId,
            tableId,
            tableNumber,
            tableToken,
            customerId,
            customerName,
            customerMobile,
        } = body;

        if (!restaurantId || !tableNumber || !customerMobile) {
            return NextResponse.json({ error: 'restaurantId, tableNumber and customerMobile are required' }, { status: 400 });
        }

        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;

        let resolvedTableNumber = tableNumber;
        let resolvedTableToken = tableToken || null;
        let resolvedTableId = String(tableId || tableNumber);

        if (tableNumber.length >= 16) {
            resolvedTableToken = tableNumber;
            const { data: tRow } = await supabaseAdmin
                .from('tables')
                .select('id, table_number')
                .eq('table_token', tableNumber)
                .maybeSingle();
            if (tRow) {
                resolvedTableNumber = String(tRow.table_number);
                resolvedTableId = String(tRow.id);
            }
        }

        const cleanCustomer = cleanPhone(customerMobile);
        const normReqTable = normalizeTableNumber(resolvedTableNumber);

        // 1. Enforce: Customer cannot create a session if already active on another table with protected activity.
        // If their previous session was empty/abandoned, it is safely released & expired here.
        if (cleanCustomer) {
            const releaseCheck = await TableSessionLifecycleService.checkAndReleasePreviousSession(
                canonicalRestaurantId,
                cleanCustomer,
                resolvedTableNumber
            );

            if (!releaseCheck.released && releaseCheck.previousSession) {
                const prev = releaseCheck.previousSession;
                const isHost = cleanPhone(prev.host_customer_mobile) === cleanCustomer;
                const otherPayload = await buildOtherSessionPayload(
                    prev,
                    restaurantId,
                    canonicalRestaurantId,
                    isHost,
                    prev.host_customer_name
                );
                return NextResponse.json({
                    error: isHost
                        ? `You already have an active session at Table ${prev.table_number}`
                        : `You are already an approved member of Table ${prev.table_number}`,
                    customerHasOtherActiveSession: true,
                    otherSession: otherPayload,
                    reasons: releaseCheck.eligibility?.reasons || [],
                }, { status: 409 });
            }
        }

        // Check for existing active session on table
        const { data: existingSession } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId])
            .or(`table_number.eq.${resolvedTableNumber},table_token.eq.${tableNumber},table_number.eq.${tableNumber},table_number.ilike.Table ${normReqTable}`)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingSession) {
            const cleanHost = cleanPhone(existingSession.host_customer_mobile);
            const isHost = cleanCustomer === cleanHost;

            let approvalStatus: 'host' | 'approved' | 'pending' | 'rejected' | 'none' = isHost ? 'host' : 'none';
            let requestId: string | null = null;

            if (!isHost && cleanCustomer) {
                const { data: joinReq } = await supabaseAdmin
                    .from('table_join_requests')
                    .select('id, status')
                    .eq('session_id', existingSession.id)
                    .eq('requester_customer_mobile', cleanCustomer)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (joinReq) {
                    approvalStatus = joinReq.status as any;
                    requestId = joinReq.id;
                }
            }

            const { count: approvedCount } = await supabaseAdmin
                .from('table_join_requests')
                .select('id', { count: 'exact', head: true })
                .eq('session_id', existingSession.id)
                .eq('status', 'approved');

            const participantCount = 1 + (approvedCount || 0);
            const isAuthorized = Boolean(isHost || approvalStatus === 'approved');

            const response = NextResponse.json({
                hasActiveSession: true,
                sessionId: existingSession.id,
                tableNumber: existingSession.table_number,
                isHost,
                isAuthorized,
                approvalStatus,
                hostName: existingSession.host_customer_name,
                hostMobileMasked: maskPhone(existingSession.host_customer_mobile),
                participantCount,
                requestId,
            });

            if (isAuthorized) {
                try {
                    const sessionJwt = await createCustomerTableSessionToken({
                        restaurant_id: canonicalRestaurantId,
                        table_id: existingSession.table_id || existingSession.table_number,
                        table_number: String(existingSession.table_number),
                        table_token: existingSession.table_token || '',
                        session_id: existingSession.id,
                    });
                    setCustomerTableSessionCookie(response, sessionJwt);
                } catch (jwtErr) {
                    console.warn('[table-session/active] Cookie refresh warning:', jwtErr);
                }
            }

            return response;
        }

        // Create new host session
        const { data: newSession, error: insertErr } = await supabaseAdmin
            .from('table_active_sessions')
            .insert({
                restaurant_id: canonicalRestaurantId,
                table_id: resolvedTableId,
                table_number: resolvedTableNumber,
                table_token: resolvedTableToken,
                host_customer_id: customerId || null,
                host_customer_name: (customerName || 'Table Host').trim(),
                host_customer_mobile: cleanCustomer,
                is_active: true,
                status: 'ACTIVE',
                last_activity_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (insertErr) {
            console.error('[table-session/active] Insert Error:', insertErr);
            return NextResponse.json({ error: 'Failed to create table session' }, { status: 500 });
        }

        const response = NextResponse.json({
            hasActiveSession: true,
            sessionId: newSession.id,
            tableNumber: newSession.table_number,
            isHost: true,
            isAuthorized: true,
            approvalStatus: 'host',
            hostName: newSession.host_customer_name,
            hostMobileMasked: maskPhone(newSession.host_customer_mobile),
            participantCount: 1,
            requestId: null,
        });

        try {
            const sessionJwt = await createCustomerTableSessionToken({
                restaurant_id: canonicalRestaurantId,
                table_id: newSession.table_id || newSession.table_number,
                table_number: String(newSession.table_number),
                table_token: newSession.table_token || '',
                session_id: newSession.id,
            });
            setCustomerTableSessionCookie(response, sessionJwt);
        } catch (jwtErr) {
            console.warn('[table-session/active] Cookie refresh warning:', jwtErr);
        }

        return response;
    } catch (err: any) {
        console.error('[table-session/active] POST Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
