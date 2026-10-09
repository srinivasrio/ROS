import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * GET /api/customer/table-session/join-request?requestId=...
 * Check the status of a join request.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const requestId = searchParams.get('requestId')?.trim();

        if (!requestId) {
            return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
        }

        const { data: joinReq, error } = await supabaseAdmin
            .from('table_join_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (error || !joinReq) {
            return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
        }

        return NextResponse.json({
            requestId: joinReq.id,
            sessionId: joinReq.session_id,
            tableNumber: joinReq.table_number,
            status: joinReq.status,
            requesterName: joinReq.requester_customer_name,
        });
    } catch (err: any) {
        console.error('[table-session/join-request] GET Error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

/**
 * POST /api/customer/table-session/join-request
 * Submit a request to join an active table session.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const {
            sessionId,
            restaurantId,
            tableNumber,
            requesterName,
            requesterMobile,
        } = body;

        if (!sessionId || !restaurantId || !tableNumber || !requesterMobile) {
            return NextResponse.json({
                error: 'sessionId, restaurantId, tableNumber, and requesterMobile are required',
            }, { status: 400 });
        }

        const cleanMobile = cleanPhone(requesterMobile);
        const cleanName = (requesterName || 'Guest Customer').trim();

        // Verify active session exists
        const { data: session, error: sessErr } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('is_active', true)
            .maybeSingle();

        if (sessErr || !session) {
            return NextResponse.json({ error: 'Active table session no longer exists' }, { status: 404 });
        }

        // Check if an existing request exists for this customer
        const { data: existing } = await supabaseAdmin
            .from('table_join_requests')
            .select('*')
            .eq('session_id', sessionId)
            .eq('requester_customer_mobile', cleanMobile)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existing) {
            if (existing.status === 'rejected') {
                // Re-open request as pending
                const { data: reopened } = await supabaseAdmin
                    .from('table_join_requests')
                    .update({
                        status: 'pending',
                        requester_customer_name: cleanName,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                return NextResponse.json({
                    requestId: reopened?.id || existing.id,
                    status: 'pending',
                    hostName: session.host_customer_name,
                });
            }

            // If already pending or approved, return it
            return NextResponse.json({
                requestId: existing.id,
                status: existing.status,
                hostName: session.host_customer_name,
            });
        }

        // Insert new request
        const { data: newReq, error: insertErr } = await supabaseAdmin
            .from('table_join_requests')
            .insert({
                session_id: sessionId,
                restaurant_id: session.restaurant_id,
                table_number: session.table_number,
                requester_customer_name: cleanName,
                requester_customer_mobile: cleanMobile,
                status: 'pending',
            })
            .select()
            .single();

        if (insertErr) {
            console.error('[table-session/join-request] Insert Error:', insertErr);
            return NextResponse.json({ error: 'Failed to create join request' }, { status: 500 });
        }

        return NextResponse.json({
            requestId: newReq.id,
            status: 'pending',
            hostName: session.host_customer_name,
        });
    } catch (err: any) {
        console.error('[table-session/join-request] POST Error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
