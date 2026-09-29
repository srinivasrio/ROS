import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EmailService } from '@/lib/email-service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

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

        const meta = {
            ip,
            device,
            browser,
            timestamp: new Date().toLocaleString()
        };

        if (!token) {
            return renderErrorPage('Verification token is missing.');
        }

        // Fetch employee by token
        const { data: employee, error: empErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('email_change_token', token)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empErr || !employee) {
            return renderErrorPage('Invalid or already used verification token.');
        }

        // Verify token expiration (24h lifespan)
        const tokenCreated = new Date(employee.email_change_token_created_at).getTime();
        const isExpired = Date.now() - tokenCreated > 24 * 60 * 60 * 1000;

        if (isExpired) {
            // Clear expired token fields
            await supabaseAdmin
                .from('employees')
                .update({
                    pending_email: null,
                    email_change_token: null,
                    email_change_token_created_at: null
                })
                .eq('id', employee.id);

            return renderErrorPage('Verification token has expired. Please request a new email change.');
        }

        const oldEmail = employee.email;
        const newEmail = employee.pending_email;

        if (!newEmail) {
            return renderErrorPage('No pending email change request found.');
        }

        // Update employee details and increment session version
        const nextSessionVersion = (employee.session_version || 1) + 1;
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                email: newEmail,
                pending_email: null,
                email_change_token: null,
                email_change_token_created_at: null,
                session_version: nextSessionVersion
            })
            .eq('id', employee.id);

        if (updateErr) {
            console.error('Failed to apply email update:', updateErr);
            return renderErrorPage('Failed to update email address. Please contact support.');
        }

        // Invalidate all active sessions in the database for this employee
        const { error: sessionsErr } = await supabaseAdmin
            .from('dine_sessions')
            .update({ is_active: false })
            .eq('user_id', employee.id);

        if (sessionsErr) {
            console.error('Failed to invalidate sessions:', sessionsErr);
        }

        // Clear active auth cookie in current client if any
        const cookieStore = await cookies();
        cookieStore.set('dine_auth_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });

        // Write audit log
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'email_change_verified',
                ip_address: ip,
                device,
                browser,
                details: { old_email: oldEmail || null, new_email: newEmail }
            }
        ]);

        // Send alert/notification emails
        await EmailService.notifyEmailChanged(oldEmail || newEmail, newEmail, meta);

        // Render gorgeous success page
        return renderSuccessPage(newEmail);

    } catch (error: any) {
        console.error('Email Verification Error:', error);
        return renderErrorPage('An internal error occurred while verifying your email.');
    }
}

function renderSuccessPage(email: string) {
    return new NextResponse(
        `<!DOCTYPE html>
        <html>
            <head>
                <title>Email Change Verified - Dine In One</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
                <style>
                    body {
                        background: #0B0F19;
                        color: #E2E8F0;
                        font-family: 'Outfit', sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.02);
                        backdrop-filter: blur(16px);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        padding: 48px 40px;
                        border-radius: 24px;
                        text-align: center;
                        max-width: 480px;
                        width: 100%;
                        box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
                    }
                    .icon {
                        width: 64px;
                        height: 64px;
                        background: rgba(16, 185, 129, 0.1);
                        color: #10B981;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 24px;
                        font-size: 32px;
                        font-weight: bold;
                    }
                    h1 {
                        color: #FFFFFF;
                        font-size: 28px;
                        margin: 0 0 16px;
                        font-weight: 700;
                        letter-spacing: -0.5px;
                    }
                    p {
                        color: #94A3B8;
                        line-height: 1.6;
                        margin: 0 0 24px;
                        font-size: 15px;
                    }
                    .email-highlight {
                        color: #F8FAFC;
                        background: rgba(255, 255, 255, 0.05);
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-family: monospace;
                        font-size: 14px;
                    }
                    a {
                        display: inline-block;
                        background: #FF6B6B;
                        color: #FFFFFF;
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 10px;
                        font-weight: 600;
                        font-size: 15px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
                    }
                    a:hover {
                        background: #E85B5B;
                        transform: translateY(-1px);
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✓</div>
                    <h1>Email Address Verified</h1>
                    <p>Your Dine In One registered email address is now <br><strong class="email-highlight">${email}</strong>.</p>
                    <p>All previous sessions have been logged out to protect your account. Please log in again with your new email.</p>
                    <a href="/login">Return to Login</a>
                </div>
            </body>
        </html>`,
        {
            headers: {
                'Content-Type': 'text/html'
            }
        }
    );
}

function renderErrorPage(message: string) {
    return new NextResponse(
        `<!DOCTYPE html>
        <html>
            <head>
                <title>Verification Error - Dine In One</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
                <style>
                    body {
                        background: #0B0F19;
                        color: #E2E8F0;
                        font-family: 'Outfit', sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.02);
                        backdrop-filter: blur(16px);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        padding: 48px 40px;
                        border-radius: 24px;
                        text-align: center;
                        max-width: 480px;
                        width: 100%;
                        box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
                    }
                    .icon {
                        width: 64px;
                        height: 64px;
                        background: rgba(239, 68, 68, 0.1);
                        color: #EF4444;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 24px;
                        font-size: 32px;
                        font-weight: bold;
                    }
                    h1 {
                        color: #FFFFFF;
                        font-size: 28px;
                        margin: 0 0 16px;
                        font-weight: 700;
                        letter-spacing: -0.5px;
                    }
                    p {
                        color: #94A3B8;
                        line-height: 1.6;
                        margin: 0 0 24px;
                        font-size: 15px;
                    }
                    a {
                        display: inline-block;
                        background: rgba(255, 255, 255, 0.08);
                        color: #FFFFFF;
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 10px;
                        font-weight: 600;
                        font-size: 15px;
                        transition: all 0.2s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    a:hover {
                        background: rgba(255, 255, 255, 0.15);
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">!</div>
                    <h1>Verification Failed</h1>
                    <p>${message}</p>
                    <a href="/login">Go to Login</a>
                </div>
            </body>
        </html>`,
        {
            headers: {
                'Content-Type': 'text/html'
            }
        }
    );
}
