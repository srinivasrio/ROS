import { supabaseAdmin } from './supabase-admin';

export const SecurityMonitor = {
    /**
     * Checks if there have been repeated failed login attempts for a user or IP address.
     */
    async checkFailedLogins(userId: string, ip: string, restaurantId: string | null) {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            // Query count of failed logins
            const { count, error } = await supabaseAdmin
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .eq('action', 'failed_login_attempt')
                .or(`user_id.eq.${userId},ip_address.eq.${ip}`)
                .gt('created_at', fifteenMinutesAgo);

            if (error) throw error;

            if (count && count >= 5) {
                // Check if an open alert already exists
                const { data: existing } = await supabaseAdmin
                    .from('security_alerts')
                    .select('*')
                    .eq('type', 'repeated_failed_logins')
                    .eq('status', 'open')
                    .or(`details->>userId.eq.${userId},details->>ip.eq.${ip}`)
                    .maybeSingle();

                if (!existing) {
                    await supabaseAdmin.from('security_alerts').insert({
                        restaurant_id: restaurantId,
                        type: 'repeated_failed_logins',
                        message: `Flagged: 5 or more failed login attempts from IP ${ip} or user ${userId} within 15 minutes.`,
                        details: { userId, ip, count, timeframe: '15m' }
                    });
                }
            }
        } catch (err) {
            console.error('[Security Monitor] Failed login check error:', err);
        }
    },

    /**
     * Checks if there has been a mass creation of employee accounts within a short window.
     */
    async checkMassEmployeeCreation(restaurantId: string | null) {
        if (!restaurantId) return;
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

            const { count, error } = await supabaseAdmin
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .eq('action', 'employee_creation')
                .eq('restaurant_id', restaurantId)
                .gt('created_at', tenMinutesAgo);

            if (error) throw error;

            if (count && count >= 10) {
                const { data: existing } = await supabaseAdmin
                    .from('security_alerts')
                    .select('*')
                    .eq('restaurant_id', restaurantId)
                    .eq('type', 'mass_employee_creation')
                    .eq('status', 'open')
                    .maybeSingle();

                if (!existing) {
                    await supabaseAdmin.from('security_alerts').insert({
                        restaurant_id: restaurantId,
                        type: 'mass_employee_creation',
                        message: `Warning: Mass employee creation detected. ${count} employees created within 10 minutes.`,
                        details: { count, timeframe: '10m' }
                    });
                }
            }
        } catch (err) {
            console.error('[Security Monitor] Mass employee creation check error:', err);
        }
    },

    /**
     * Checks if there are repeated MFA resets within 24 hours.
     */
    async checkRepeatedMfaResets(userId: string, restaurantId: string | null) {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { count, error } = await supabaseAdmin
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .eq('action', 'mfa_reset_requested')
                .eq('user_id', userId)
                .gt('created_at', oneDayAgo);

            if (error) throw error;

            if (count && count >= 3) {
                const { data: existing } = await supabaseAdmin
                    .from('security_alerts')
                    .select('*')
                    .eq('type', 'repeated_mfa_resets')
                    .eq('status', 'open')
                    .eq('details->>userId', userId)
                    .maybeSingle();

                if (!existing) {
                    await supabaseAdmin.from('security_alerts').insert({
                        restaurant_id: restaurantId,
                        type: 'repeated_mfa_resets',
                        message: `Warning: Repeated MFA reset requests (${count} resets in 24h) for employee ${userId}.`,
                        details: { userId, count, timeframe: '24h' }
                    });
                }
            }
        } catch (err) {
            console.error('[Security Monitor] MFA reset check error:', err);
        }
    },

    /**
     * Immediately triggers an alert for cross tenant activation attempts.
     */
    async triggerCrossTenantActivation(restaurantId: string | null, employeeId: string, details: any) {
        try {
            await supabaseAdmin.from('security_alerts').insert({
                restaurant_id: restaurantId,
                type: 'cross_tenant_activation',
                message: `Critical: Blocked a cross-tenant activation attempt for employee ${employeeId}.`,
                details: { employeeId, ...details }
            });
        } catch (err) {
            console.error('[Security Monitor] Cross tenant activation log error:', err);
        }
    },

    /**
     * Checks if a user has logged in from multiple distinct IP addresses within a short timeframe.
     */
    async checkSuspiciousActivity(userId: string, currentIp: string, restaurantId: string | null) {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

            const { data: logins, error } = await supabaseAdmin
                .from('audit_logs')
                .select('ip_address')
                .eq('user_id', userId)
                .eq('action', 'login')
                .gt('created_at', fiveMinutesAgo);

            if (error) throw error;

            if (logins && logins.length > 0) {
                const distinctIps = Array.from(new Set(logins.map(l => l.ip_address).filter(Boolean)));
                const otherIps = distinctIps.filter(ip => ip !== currentIp);

                if (otherIps.length > 0) {
                    const { data: existing } = await supabaseAdmin
                        .from('security_alerts')
                        .select('*')
                        .eq('type', 'suspicious_activity')
                        .eq('status', 'open')
                        .eq('details->>userId', userId)
                        .maybeSingle();

                    if (!existing) {
                        await supabaseAdmin.from('security_alerts').insert({
                            restaurant_id: restaurantId,
                            type: 'suspicious_activity',
                            message: `Alert: Suspicious login pattern. Employee ${userId} accessed from multiple distinct IPs (${distinctIps.join(', ')}) within 5 minutes.`,
                            details: { userId, distinctIps, currentIp, timeframe: '5m' }
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[Security Monitor] Suspicious activity check error:', err);
        }
    }
};
