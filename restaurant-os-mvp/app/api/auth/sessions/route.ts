import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Helper to parse user-agent to browser/device names
function parseUserAgent(userAgent: string) {
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
    } else if (uaLower.includes('edge')) {
        browser = 'edge';
    }
    
    return { browser, device };
}

// GET: Retrieve all active sessions for the authenticated user
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

        const userId = payload.userId;
        const currentSessionId = payload.sessionId;

        // Fetch active sessions from DB
        const { data: sessions, error } = await supabaseAdmin
            .from('dine_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch active sessions:', error);
            return NextResponse.json({ error: 'Failed to retrieve sessions' }, { status: 500 });
        }

        const formattedSessions = (sessions || []).map((session) => {
            const { browser, device } = parseUserAgent(session.device_info || 'unknown');
            return {
                id: session.id,
                device,
                browser,
                ipAddress: session.ip_address || 'unknown',
                loginTime: session.created_at,
                lastActivity: session.last_activity || session.created_at,
                isCurrent: session.id === currentSessionId
            };
        });

        return NextResponse.json({ sessions: formattedSessions });

    } catch (error: any) {
        console.error('GET Sessions Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// POST: Terminate active session(s)
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
        const currentSessionId = payload.sessionId;

        const body = await request.json();
        const { action, sessionId, sessionIds } = body;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const { browser, device } = parseUserAgent(userAgent);
        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        // Fetch employee details (needed for audit logs)
        const { data: employee } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        const restaurantId = employee?.restaurant_id || null;
        const employeeId = employee?.employee_id || null;

        if (action === 'terminate') {
            if (!sessionId) {
                return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
            }

            // Revoke in database
            const { error: revokeErr } = await supabaseAdmin
                .from('dine_sessions')
                .update({ is_active: false })
                .eq('id', sessionId)
                .eq('user_id', userId);

            if (revokeErr) {
                console.error(`Failed to terminate session ${sessionId}:`, revokeErr);
                return NextResponse.json({ error: 'Failed to terminate session' }, { status: 500 });
            }

            // Write audit log
            await supabaseAdmin.from('audit_logs').insert([
                {
                    restaurant_id: restaurantId,
                    user_id: userId,
                    employee_id: employeeId,
                    action: 'session_terminated',
                    ip_address: ip,
                    device,
                    browser,
                    details: { terminated_session_id: sessionId }
                }
            ]);

            // If revoking current session, clear token cookie
            if (sessionId === currentSessionId) {
                cookieStore.set('dine_auth_token', '', {
                    httpOnly: true,
                    secure: isSecure,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 0
                });
                return NextResponse.json({ success: true, loggedOutCurrent: true });
            }

            return NextResponse.json({ success: true });

        } else if (action === 'terminate-selected') {
            if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
                return NextResponse.json({ error: 'Session IDs array is required' }, { status: 400 });
            }

            // Revoke selected in database
            const { error: revokeErr } = await supabaseAdmin
                .from('dine_sessions')
                .update({ is_active: false })
                .in('id', sessionIds)
                .eq('user_id', userId);

            if (revokeErr) {
                console.error(`Failed to terminate selected sessions:`, revokeErr);
                return NextResponse.json({ error: 'Failed to terminate selected sessions' }, { status: 500 });
            }

            // Write audit log
            await supabaseAdmin.from('audit_logs').insert([
                {
                    restaurant_id: restaurantId,
                    user_id: userId,
                    employee_id: employeeId,
                    action: 'session_terminated',
                    ip_address: ip,
                    device,
                    browser,
                    details: { terminated_session_ids: sessionIds }
                }
            ]);

            // If current session is in the selected list, clear token cookie
            const includesCurrent = sessionIds.includes(currentSessionId);
            if (includesCurrent) {
                cookieStore.set('dine_auth_token', '', {
                    httpOnly: true,
                    secure: isSecure,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 0
                });
                return NextResponse.json({ success: true, loggedOutCurrent: true });
            }

            return NextResponse.json({ success: true });

        } else if (action === 'terminate-all') {
            // 1. Mark all sessions for user as inactive in DB
            const { error: dbErr } = await supabaseAdmin
                .from('dine_sessions')
                .update({ is_active: false })
                .eq('user_id', userId);

            if (dbErr) {
                console.error('Failed to revoke all database sessions:', dbErr);
            }

            // 2. Increment session version on employee table
            const currentVersion = employee?.session_version || 1;
            const nextVersion = currentVersion + 1;

            const { error: empErr } = await supabaseAdmin
                .from('employees')
                .update({ session_version: nextVersion })
                .eq('id', userId);

            if (empErr) {
                console.error('Failed to increment employee session version:', empErr);
            }

            // 3. Clear auth cookie
            cookieStore.set('dine_auth_token', '', {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                path: '/',
                maxAge: 0
            });

            // 4. Write audit log
            await supabaseAdmin.from('audit_logs').insert([
                {
                    restaurant_id: restaurantId,
                    user_id: userId,
                    employee_id: employeeId,
                    action: 'all_sessions_terminated',
                    ip_address: ip,
                    device,
                    browser,
                    details: { prev_version: currentVersion, new_version: nextVersion }
                }
            ]);

            return NextResponse.json({ success: true, loggedOutCurrent: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('POST Sessions Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
