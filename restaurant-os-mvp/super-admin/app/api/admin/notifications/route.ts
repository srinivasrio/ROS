import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { data: notifs } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        const list = notifs || [];

        return NextResponse.json({
            success: true,
            notifications: list,
            unreadCount: list.filter((n) => !n.is_read).length,
        });
    } catch (err: any) {
        console.error('Super Admin notifications error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { id, markAllRead } = body;

        if (markAllRead) {
            await supabaseAdmin.from('notifications').update({ is_read: true }).neq('is_read', true);
        } else if (id) {
            await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', id);
        }

        return NextResponse.json({ success: true, message: 'Notifications updated.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
