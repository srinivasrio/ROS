import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * POST /api/customer/table-session/respond
 * Host approves or rejects a pending join request.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { requestId, action, hostMobile } = body;

        if (!requestId || !action || !hostMobile) {
            return NextResponse.json({
                error: 'requestId, action (approve|reject), and hostMobile are required',
            }, { status: 400 });
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 });
        }

        // Fetch join request
        const { data: joinReq, error: reqErr } = await supabaseAdmin
            .from('table_join_requests')
            .select('*, table_active_sessions!inner(*)')
            .eq('id', requestId)
            .maybeSingle();

        if (reqErr || !joinReq) {
            return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
        }

        const session = joinReq.table_active_sessions;
        const cleanHost = cleanPhone(session?.host_customer_mobile);
        const cleanCaller = cleanPhone(hostMobile);

        if (cleanHost !== cleanCaller) {
            return NextResponse.json({ error: 'Only the active table host can approve or reject join requests' }, { status: 403 });
        }

        const nextStatus = action === 'approve' ? 'approved' : 'rejected';

        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('table_join_requests')
            .update({
                status: nextStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', requestId)
            .select()
            .single();

        if (updateErr) {
            console.error('[table-session/respond] Update Error:', updateErr);
            return NextResponse.json({ error: 'Failed to update request status' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            requestId: updated.id,
            status: updated.status,
            requesterName: updated.requester_customer_name,
        });
    } catch (err: any) {
        console.error('[table-session/respond] Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
