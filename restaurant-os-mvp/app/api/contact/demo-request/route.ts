import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sesEmailService } from '@/services/ses-email.service';

// CORS response helper
function corsResponse(data: any, status = 200) {
    const response = NextResponse.json(data, { status });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
}

export async function OPTIONS() {
    return corsResponse({ ok: true });
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        if (!body) {
            return corsResponse({ error: 'Invalid JSON request payload' }, 400);
        }

        const name = String(body.name || '').trim();
        const restaurantName = String(body.restaurant || body.restaurant_name || '').trim();
        const phone = String(body.phone || '').trim();
        const email = String(body.email || '').trim();
        const planInterest = String(body.plan || body.plan_interest || 'Not sure yet').trim();
        const tablesCount = Math.max(1, parseInt(body.tables || body.tables_count || '1', 10) || 1);
        const message = String(body.message || body.notes || '').trim();

        if (!name || !restaurantName || !phone) {
            return corsResponse({ error: 'Name, Restaurant name, and Phone number are required' }, 400);
        }

        const insertPayload = {
            name,
            restaurant_name: restaurantName,
            phone,
            email: email || null,
            plan_interest: planInterest,
            tables_count: tablesCount,
            message: message || null,
            email_sent: true,
            status: 'new'
        };

        // 1. Insert into Supabase table `demo_requests`
        const { data: record, error: dbError } = await supabaseAdmin
            .from('demo_requests')
            .insert(insertPayload)
            .select()
            .maybeSingle();

        if (dbError) {
            console.error('[Demo Request] Database insert error:', dbError);
            return corsResponse({ error: 'Failed to record demo request' }, 500);
        }

        // 2. Await both Admin alert email and customer confirmation email via SES
        const emailPromises: Promise<any>[] = [
            sesEmailService.sendDemoAlertEmail({
                name,
                restaurantName,
                phone,
                email,
                planInterest,
                tablesCount,
                message
            }).then(result => {
                console.log('[Demo Request] Admin alert dispatched:', result);
                return result;
            }).catch(err => {
                console.error('[Demo Request] Admin alert error:', err);
                return { success: false, error: err.message };
            })
        ];

        // 3. Trigger professional confirmation email to the lead
        if (email) {
            emailPromises.push(
                sesEmailService.sendDemoCustomerConfirmationEmail({
                    name,
                    email,
                    restaurantName,
                    planInterest
                }).then(result => {
                    console.log('[Demo Request] Customer confirmation email dispatched:', result);
                    return result;
                }).catch(err => {
                    console.error('[Demo Request] Customer confirmation email error:', err);
                    return { success: false, error: err.message };
                })
            );
        }

        // Ensure emails finish before returning response in serverless/workers environments
        await Promise.allSettled(emailPromises);

        return corsResponse({
            success: true,
            id: record?.id || null,
            message: 'Demo request received successfully'
        });
    } catch (err: any) {
        console.error('[Demo Request] Unexpected error:', err);
        return corsResponse({ error: err.message || 'Internal server error' }, 500);
    }
}
