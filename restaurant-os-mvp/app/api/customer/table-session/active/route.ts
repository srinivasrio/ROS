import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

function maskPhone(phone: string): string {
    const c = cleanPhone(phone);
    if (c.length < 10) return phone;
    return `+91 ******${c.slice(-4)}`;
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

        // Query by canonical ID or slug, and by table_number or table_token
        let { data: session, error } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId])
            .or(`table_number.eq.${resolvedTableNumber},table_token.eq.${tableNumber},table_number.eq.${tableNumber}`)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[table-session/active] DB Error:', error);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
        }

        if (!session) {
            return NextResponse.json({ hasActiveSession: false });
        }

        const cleanCustomer = cleanPhone(customerMobile || '');
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

        return NextResponse.json({
            hasActiveSession: true,
            sessionId: session.id,
            hostName: session.host_customer_name || 'Table Host',
            hostMobileMasked: maskPhone(session.host_customer_mobile),
            isHost,
            approvalStatus,
            requestId,
        });
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

        // Check for existing active session on table
        const { data: existingSession } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .in('restaurant_id', [restaurantId, canonicalRestaurantId])
            .or(`table_number.eq.${resolvedTableNumber},table_token.eq.${tableNumber},table_number.eq.${tableNumber}`)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingSession) {
            const cleanHost = cleanPhone(existingSession.host_customer_mobile);
            const isHost = cleanCustomer === cleanHost;

            return NextResponse.json({
                hasActiveSession: true,
                sessionId: existingSession.id,
                isHost,
                hostName: existingSession.host_customer_name,
                hostMobileMasked: maskPhone(existingSession.host_customer_mobile),
            });
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
            })
            .select()
            .single();

        if (insertErr) {
            console.error('[table-session/active] Insert Error:', insertErr);
            // Possible race condition where another host claimed table simultaneously
            const { data: raceSession } = await supabaseAdmin
                .from('table_active_sessions')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('table_number', tableNumber)
                .eq('is_active', true)
                .maybeSingle();

            if (raceSession) {
                const isHost = cleanCustomer === cleanPhone(raceSession.host_customer_mobile);
                return NextResponse.json({
                    hasActiveSession: true,
                    sessionId: raceSession.id,
                    isHost,
                    hostName: raceSession.host_customer_name,
                    hostMobileMasked: maskPhone(raceSession.host_customer_mobile),
                });
            }

            return NextResponse.json({ error: 'Failed to claim table session' }, { status: 500 });
        }

        return NextResponse.json({
            hasActiveSession: true,
            sessionId: newSession.id,
            isHost: true,
            hostName: newSession.host_customer_name,
            hostMobileMasked: maskPhone(newSession.host_customer_mobile),
        });
    } catch (err: any) {
        console.error('[table-session/active] POST Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
