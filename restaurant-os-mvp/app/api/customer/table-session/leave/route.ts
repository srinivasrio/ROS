import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/customer/table-session/leave
 * 
 * Enforce backend single-active-session restriction:
 * Customers cannot unilaterally abandon or switch table sessions.
 * Sessions can only be transferred or closed by authorized restaurant staff.
 */
export async function POST(req: NextRequest) {
    try {
        return NextResponse.json({
            error: 'Unauthorized: Active table sessions cannot be closed or switched by customers. Only authorized restaurant staff can clear or transfer tables.',
            code: 'TABLE_SWITCH_FORBIDDEN'
        }, { status: 403 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
