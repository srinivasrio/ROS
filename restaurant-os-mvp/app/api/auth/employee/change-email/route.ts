import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EmailService } from '@/lib/email-service';
import { RateLimiter } from '@/lib/rate-limiter';
import crypto from 'crypto';

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

        const actorId = payload.userId;
        const actorRole = payload.role;
        const actorRestaurantId = payload.restaurantId;

        const body = await request.json();
        const { employeeId, newEmail } = body;

        if (!newEmail) {
            return NextResponse.json({ error: 'New email is required' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

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

        // 1. Rate Limiting (limit by Actor ID: 3/hour)
        const limiterResult = await RateLimiter.check(`actor:${actorId}:change_email`, 3, 3600);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'change_email', key: `actor:${actorId}:change_email` }
            });
            return NextResponse.json(
                { error: 'Too many email change requests. Please try again in an hour.' },
                { status: 429 }
            );
        }

        // Target employee defaults to actor if not provided
        const targetId = employeeId || actorId;

        // Fetch target employee
        const { data: targetEmployee, error: targetErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', targetId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (targetErr || !targetEmployee) {
            return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });
        }

        // Verify Permission
        const isRestaurantAdmin = actorRole === 'restaurant_admin' && actorRestaurantId === targetEmployee.restaurant_id;
        const isSelf = actorId === targetEmployee.id;

        if (!isRestaurantAdmin && !isSelf) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Verify new email is not already taken by another employee
        const { data: existingEmail } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('email', newEmail)
            .eq('is_deleted', false)
            .maybeSingle();

        if (existingEmail && existingEmail.id !== targetEmployee.id) {
            return NextResponse.json({ error: 'Email address is already in use' }, { status: 400 });
        }

        // Generate email change token
        const changeToken = crypto.randomBytes(32).toString('hex');
        
        // Update target employee with pending email changes
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                pending_email: newEmail,
                email_change_token: changeToken,
                email_change_token_created_at: new Date().toISOString()
            })
            .eq('id', targetEmployee.id);

        if (updateErr) {
            console.error('Failed to update pending email change:', updateErr);
            return NextResponse.json({ error: 'Failed to request email change' }, { status: 500 });
        }

        // Send alerts and verification link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const verificationLink = `${appUrl}/api/auth/employee/verify-email?token=${changeToken}`;

        const meta = {
            ip,
            device,
            browser,
            timestamp: new Date().toLocaleString()
        };

        // Notify old email (if target employee has one currently)
        if (targetEmployee.email) {
            await EmailService.notifyEmailChangeRequested(targetEmployee.email, newEmail, verificationLink, meta);
        } else {
            // Send verification link to new email directly
            await EmailService.sendSecurityEmail(newEmail, 'Dine In One: Verify Your New Email Address', `
                <h3>Verify Your Email Address</h3>
                <p>Click the link below to confirm your new email address:</p>
                <p><a href="${verificationLink}">${verificationLink}</a></p>
            `);
        }

        // Write audit log
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: targetEmployee.restaurant_id || null,
                user_id: targetEmployee.id,
                employee_id: targetEmployee.employee_id || null,
                actor_id: actorId,
                action: 'email_change_requested',
                ip_address: ip,
                device,
                browser,
                details: { old_email: targetEmployee.email || null, pending_email: newEmail }
            }
        ]);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Change Email Request Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
