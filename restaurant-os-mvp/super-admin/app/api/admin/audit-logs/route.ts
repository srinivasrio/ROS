import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { formatAuditAction, formatAuditDetails, extractAuditBadges } from '@/lib/audit-formatters';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const actionFilter = searchParams.get('action');

        let query = supabaseAdmin
            .from('audit_logs')
            .select('id, created_at, action, restaurant_id, actor_id, user_id, actor_role, employee_id, ip_address, device, browser, details')
            .order('created_at', { ascending: false })
            .limit(150);

        if (actionFilter && actionFilter !== 'ALL') {
            query = query.ilike('action', `%${actionFilter}%`);
        }

        const logsRes = await query;
        if (logsRes.error) {
            return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
        }

        const logs = logsRes.data || [];

        // Extract only unique referenced IDs to avoid full table scans
        const restaurantIds = Array.from(new Set(logs.map((l: Record<string, unknown>) => l.restaurant_id as string).filter(Boolean)));
        const actorIds = Array.from(new Set(logs.map((l: Record<string, unknown>) => (l.actor_id || l.user_id) as string).filter(Boolean)));

        const [restRes, empRes, duRes] = await Promise.all([
            restaurantIds.length > 0
                ? supabaseAdmin.from('restaurants').select('id, name').in('id', restaurantIds)
                : Promise.resolve({ data: [], error: null }),
            actorIds.length > 0
                ? supabaseAdmin.from('employees').select('id, name, role').in('id', actorIds)
                : Promise.resolve({ data: [], error: null }),
            actorIds.length > 0
                ? supabaseAdmin.from('dine_users').select('id, name, role').in('id', actorIds)
                : Promise.resolve({ data: [], error: null })
        ]);

        const restMap = new Map<string, { id: string; name?: string }>();
        (restRes.data || []).forEach((r: { id: string; name?: string }) => restMap.set(r.id, r));

        const empMap = new Map<string, { id: string; name?: string; role?: string }>();
        (empRes.data || []).forEach((e: { id: string; name?: string; role?: string }) => empMap.set(e.id, e));

        const duMap = new Map<string, { id: string; name?: string; role?: string }>();
        (duRes.data || []).forEach((d: { id: string; name?: string; role?: string }) => duMap.set(d.id, d));

        const formatted = logs.map((log: any, idx: number) => {
            const rawDetails = log.details || {};
            const targetRest = restMap.get(log.restaurant_id);
            const restName = targetRest?.name || rawDetails.restaurant_name || rawDetails.name || null;

            // Resolve Actor identity
            const actorId = log.actor_id || log.user_id;
            let actorName = 'System Automated Process';
            let actorRole = (log.actor_role || 'SYSTEM').toUpperCase();

            if (log.actor_role === 'SUPER_ADMIN' || log.user_id === 'superadmin-master' || log.actor_id === 'superadmin-master') {
                actorName = 'Super Admin (Founder)';
                actorRole = 'SUPER_ADMIN';
            } else if (empMap.has(actorId)) {
                const emp = empMap.get(actorId);
                actorName = emp?.name || 'Staff Member';
                actorRole = (emp?.role || 'EMPLOYEE').toUpperCase();
            } else if (duMap.has(actorId)) {
                const du = duMap.get(actorId);
                actorName = du?.name || 'Registered User';
                actorRole = (du?.role || 'USER').toUpperCase();
            } else if (log.employee_id) {
                actorName = `Staff Member (${log.employee_id})`;
                actorRole = 'STAFF';
            } else if (rawDetails.role) {
                actorRole = String(rawDetails.role).toUpperCase();
                actorName = `${actorRole} User`;
            } else if (rawDetails.updated_by) {
                actorName = rawDetails.updated_by;
            }

            const actionTitle = formatAuditAction(log.action);
            const description = formatAuditDetails(log.action, rawDetails, log);
            const badges = extractAuditBadges(log);

            return {
                id: log.id || `audit-${idx}`,
                timestamp: new Date(log.created_at || Date.now()).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }),
                rawTimestamp: log.created_at,
                actor: actorName,
                role: actorRole,
                actorId: actorId || null,
                action: log.action || 'system_audit_event',
                actionTitle,
                description,
                restaurant: restName || (log.restaurant_id ? `Restaurant #${log.restaurant_id}` : 'Platform Wide (Global)'),
                restaurantId: log.restaurant_id || null,
                resource: restName || (log.restaurant_id ? `Restaurant ${log.restaurant_id}` : 'Global Core'),
                ipAddress: log.ip_address || rawDetails.ip || '127.0.0.1',
                device: log.device || rawDetails.device || null,
                browser: log.browser || rawDetails.browser || null,
                details: rawDetails,
                badges
            };
        });

        return NextResponse.json({
            success: true,
            logs: formatted,
        });
    } catch (err: unknown) {
        console.error('Super Admin audit logs API error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
