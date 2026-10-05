import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        // Query real login audit logs and security events
        const [loginsRes, usersRes, eventsRes] = await Promise.all([
            supabaseAdmin.from('login_audit_logs').select('*').order('created_at', { ascending: false }).limit(60),
            supabaseAdmin.from('dine_users').select('id, name, email, role'),
            supabaseAdmin.from('security_events').select('*').order('created_at', { ascending: false }).limit(30)
        ]);

        const rawLogins = loginsRes.data || [];
        const users = usersRes.data || [];
        const securityEvents = eventsRes.data || [];

        const userMap = new Map();
        users.forEach((u) => userMap.set(u.id, u));

        let failedAttempts = 0;
        const activeUserIds = new Set<string>();

        const formattedLogins = rawLogins.map((log: any) => {
            const user = userMap.get(log.user_id) || {};
            const isFailed = log.action?.includes('fail') || log.action?.includes('block') || log.action?.includes('invalid');
            if (isFailed) failedAttempts++;
            if (log.user_id) activeUserIds.add(log.user_id);

            let eventName = 'PASSWORD_LOGIN';
            if (log.action?.includes('2fa')) eventName = 'TWO_FACTOR_AUTH';
            else if (log.action?.includes('pin')) eventName = 'PIN_AUTH';
            else if (log.action?.includes('oauth') || log.action?.includes('google')) eventName = 'GOOGLE_OAUTH';
            else if (log.action) eventName = log.action.toUpperCase();

            return {
                id: log.id,
                email: user.email || log.employee_id || (log.user_id ? `user-${log.user_id.slice(0, 8)}` : 'System User'),
                role: log.role || user.role || 'USER',
                event: eventName,
                status: isFailed ? 'FAILED' : 'SUCCESS',
                ip: log.ip_address || '127.0.0.1',
                time: new Date(log.created_at).toLocaleString(),
                rawTime: log.created_at
            };
        });

        const suspiciousCount = securityEvents.filter((e: any) => 
            e.severity?.toUpperCase() === 'HIGH' || e.severity?.toUpperCase() === 'CRITICAL'
        ).length;

        const criticalCount = securityEvents.filter((e: any) => 
            e.severity?.toUpperCase() === 'CRITICAL'
        ).length;

        return NextResponse.json({
            success: true,
            summary: {
                status: failedAttempts > 10 ? 'ELEVATED' : 'HEALTHY',
                failedLoginAttempts: failedAttempts,
                suspiciousEvents: suspiciousCount,
                criticalIncidents: criticalCount,
                activeSessions: Math.max(activeUserIds.size, 1),
            },
            loginActivity: formattedLogins,
            securityEvents,
        });
    } catch (err: any) {
        console.error('Super Admin security API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
