import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword, verifyPassword, validatePasswordComplexity } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import { EmailService } from '@/lib/email-service';

export async function POST(request: Request) {
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

        const userId = payload.userId;
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // 1. Rate Limiting (limit by User ID: 5/min)
        const limiterResult = await RateLimiter.check(`user:${userId}:change_password`, 5, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'change_password', key: `user:${userId}:change_password` }
            });
            return NextResponse.json(
                { error: 'Too many attempts. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
        }

        // Parse user-agent
        let browser = 'unknown';
        let device = 'desktop';
        const uaLower = userAgent.toLowerCase();
        if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone') || uaLower.includes('ipad')) {
            device = 'mobile';
        }
        if (uaLower.includes('chrome')) {
            browser = 'chrome';
        } else if (uaLower.includes('safari')) {
            browser = 'safari';
        } else if (uaLower.includes('firefox')) {
            browser = 'firefox';
        }

        // 2. Fetch Employee details (needed for restaurantId, email, and session_version)
        const { data: employee, error: empErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', userId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empErr || !employee) {
            return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
        }

        // 3. Fetch Auth Credentials
        const { data: authUser, error: authErr } = await supabaseAdmin
            .from('auth')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (authErr || !authUser) {
            return NextResponse.json({ error: 'Authentication details not found' }, { status: 404 });
        }

        // 4. Verify Current Password
        const isCurrentValid = await verifyPassword(currentPassword, authUser.password_hash);
        if (!isCurrentValid) {
            // Log failed password change attempt
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'failed_password_change',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'incorrect_current_password' }
            });
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
        }

        // 5. Enforce Password Complexity on New Password
        if (!validatePasswordComplexity(newPassword)) {
            return NextResponse.json({
                error: 'New password is too weak. It must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one numeric digit, and one special character.'
            }, { status: 400 });
        }

        // 6. Check Password History (no reuse of last 5 passwords)
        const { data: history, error: historyErr } = await supabaseAdmin
            .from('password_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!historyErr && history && history.length > 0) {
            for (const hist of history) {
                const matchesHistory = await verifyPassword(newPassword, hist.password_hash);
                if (matchesHistory) {
                    return NextResponse.json({
                        error: 'You cannot reuse any of your last 5 passwords. Please choose a different password.'
                    }, { status: 400 });
                }
            }
        }

        // 7. Hash New Password and Update Auth
        const newHash = await hashPassword(newPassword);
        const { error: updateAuthErr } = await supabaseAdmin
            .from('auth')
            .update({
                password_hash: newHash,
                failed_attempts: 0
            })
            .eq('user_id', userId);

        if (updateAuthErr) {
            console.error('Failed to update password hash in auth:', updateAuthErr);
            return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
        }

        // 8. Insert into password history
        await supabaseAdmin
            .from('password_history')
            .insert({
                user_id: userId,
                password_hash: newHash
            });

        // Optional: Clean up history to keep only last 5 records
        try {
            const { data: allHistory } = await supabaseAdmin
                .from('password_history')
                .select('id')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (allHistory && allHistory.length > 5) {
                const idsToDelete = allHistory.slice(5).map(h => h.id);
                await supabaseAdmin
                    .from('password_history')
                    .delete()
                    .in('id', idsToDelete);
            }
        } catch (cleanupErr) {
            console.error('Failed to clean up password history:', cleanupErr);
        }

        // 9. Increment employee session version to force log out all other active sessions
        const nextSessionVersion = (employee.session_version || 1) + 1;
        const { error: updateEmpErr } = await supabaseAdmin
            .from('employees')
            .update({
                session_version: nextSessionVersion
            })
            .eq('id', userId);

        if (updateEmpErr) {
            console.error('Failed to increment employee session version:', updateEmpErr);
        }

        // 10. Write audit logs
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'password_changed',
                ip_address: ip,
                device,
                browser,
                details: { new_version: nextSessionVersion }
            }
        ]);

        // 11. Send Security Notification Email
        if (employee.email) {
            await EmailService.notifyPasswordChanged(employee.email, {
                ip,
                device,
                browser,
                timestamp: new Date().toLocaleString()
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Change Password Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
