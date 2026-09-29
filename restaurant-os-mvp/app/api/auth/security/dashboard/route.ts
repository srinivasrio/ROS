import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('dine_auth_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyJwt(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const role = payload.role;
        const userRestaurantId = payload.restaurantId;

        // Verify Permission: only restaurant_admin
        const isRestaurantAdmin = role === 'restaurant_admin';

        if (!isRestaurantAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        // Use the user's restaurant ID
        const targetRestaurantId = userRestaurantId;

        // 1. Fetch employee list for the restaurant (needed for joining tables manually)
        let employeeQuery = supabaseAdmin
            .from('employees')
            .select('id, email')
            .eq('is_deleted', false);
            
        if (targetRestaurantId) {
            employeeQuery = employeeQuery.eq('restaurant_id', targetRestaurantId);
        }
        
        const { data: employees, error: empErr } = await employeeQuery;
        if (empErr) {
            console.error('Failed to query employees:', empErr);
        }
        
        const employeeIds = (employees || []).map(e => e.id);
        const employeeEmails = (employees || []).map(e => e.email).filter(Boolean);

        // GATHER METRICS
        
        // 2. Failed login attempts
        let failedLoginsQuery = supabaseAdmin
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'failed_login_attempt');
        if (targetRestaurantId) {
            failedLoginsQuery = failedLoginsQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { count: failedLogins } = await failedLoginsQuery;

        // 3. Locked accounts (employees whose auth.failed_attempts >= 5)
        let lockedAccounts = 0;
        if (employeeIds.length > 0) {
            const { count: lockedCount, error: lockedErr } = await supabaseAdmin
                .from('auth')
                .select('*', { count: 'exact', head: true })
                .in('user_id', employeeIds)
                .gte('failed_attempts', 5);
                
            if (!lockedErr) {
                lockedAccounts = lockedCount || 0;
            }
        }

        // 4. Suspended users
        let suspendedQuery = supabaseAdmin
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'suspended')
            .eq('is_deleted', false);
        if (targetRestaurantId) {
            suspendedQuery = suspendedQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { count: suspendedUsers } = await suspendedQuery;

        // 5. MFA reset requests
        let mfaResetsQuery = supabaseAdmin
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'mfa_reset_required')
            .eq('is_deleted', false);
        if (targetRestaurantId) {
            mfaResetsQuery = mfaResetsQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { count: mfaResetRequests } = await mfaResetsQuery;

        // 6. Force logout / session termination events
        let forceLogoutsQuery = supabaseAdmin
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .in('action', ['session_terminated', 'all_sessions_terminated', 'session_version_incremented']);
        if (targetRestaurantId) {
            forceLogoutsQuery = forceLogoutsQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { count: forceLogoutEvents } = await forceLogoutsQuery;

        // 7. Restaurant suspension events
        let restaurantSuspensionsQuery = supabaseAdmin
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .in('action', ['restaurant_suspended', 'restaurant_reactivated']);
        if (targetRestaurantId) {
            restaurantSuspensionsQuery = restaurantSuspensionsQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { count: restaurantSuspensionEvents } = await restaurantSuspensionsQuery;

        // 8. Recent audit events (limit 50)
        let recentAuditsQuery = supabaseAdmin
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (targetRestaurantId) {
            recentAuditsQuery = recentAuditsQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { data: recentAudits } = await recentAuditsQuery;

        // 9. Recent Mock Sent Emails (for debugging email alerts)
        let recentEmailsQuery = supabaseAdmin
            .from('sent_emails')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (targetRestaurantId) {
            if (employeeEmails.length > 0) {
                recentEmailsQuery = recentEmailsQuery.in('to_email', employeeEmails);
            } else {
                recentEmailsQuery = recentEmailsQuery.eq('to_email', 'nonexistent_placeholder_to_force_empty');
            }
        }
        const { data: recentEmails } = await recentEmailsQuery;

        // 10. Recent Security Alerts (Anomaly warnings)
        let securityAlertsQuery = supabaseAdmin
            .from('security_alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
        if (targetRestaurantId) {
            securityAlertsQuery = securityAlertsQuery.eq('restaurant_id', targetRestaurantId);
        }
        const { data: securityAlerts } = await securityAlertsQuery;

        return NextResponse.json({
            metrics: {
                failedLogins: failedLogins || 0,
                lockedAccounts,
                suspendedUsers: suspendedUsers || 0,
                mfaResetRequests: mfaResetRequests || 0,
                forceLogoutEvents: forceLogoutEvents || 0,
                restaurantSuspensionEvents: restaurantSuspensionEvents || 0
            },
            recentAudits: recentAudits || [],
            recentEmails: recentEmails || [],
            securityAlerts: securityAlerts || []
        });

    } catch (error: any) {
        console.error('Security Dashboard API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
