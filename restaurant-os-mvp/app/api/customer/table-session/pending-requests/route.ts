import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function cleanPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * GET /api/customer/table-session/pending-requests
 * Query pending join requests for an active table session (called by host).
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId')?.trim();
        const hostMobile = searchParams.get('hostMobile')?.trim();

        if (!sessionId || !hostMobile) {
            return NextResponse.json({ error: 'sessionId and hostMobile are required' }, { status: 400 });
        }

        const { data: session, error: sessErr } = await supabaseAdmin
            .from('table_active_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('is_active', true)
            .maybeSingle();

        if (sessErr || !session) {
            return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
        }

        if (cleanPhone(session.host_customer_mobile) !== cleanPhone(hostMobile)) {
            return NextResponse.json({ error: 'Unauthorized: Not the table host' }, { status: 403 });
        }

        const { data: requests, error: reqsErr } = await supabaseAdmin
            .from('table_join_requests')
            .select('*')
            .eq('session_id', sessionId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (reqsErr) {
            console.error('[table-session/pending-requests] DB Error:', reqsErr);
            return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 });
        }

        return NextResponse.json({
            requests: requests || [],
        });
    } catch (err: any) {
        console.error('[table-session/pending-requests] Error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
