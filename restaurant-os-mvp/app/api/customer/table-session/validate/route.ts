import { NextRequest, NextResponse } from 'next/server';
import {
    validateTableToken,
    createCustomerTableSessionToken,
    setCustomerTableSessionCookie,
    getCustomerTableSession,
} from '@/lib/customer-table-session';

/**
 * POST /api/customer/table-session/validate
 * 
 * Cryptographically validates a table token, binds session to cookie,
 * and returns safe restaurant & table metadata.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const token = body?.token?.trim();

        if (!token) {
            return NextResponse.json({ error: 'Table token is required' }, { status: 400 });
        }

        const validated = await validateTableToken(token);
        if (!validated) {
            return NextResponse.json(
                { error: 'Invalid or expired table token. Please rescan QR code.' },
                { status: 404 }
            );
        }

        const sessionPayload = {
            restaurant_id: validated.restaurant.id,
            table_id: validated.table.id,
            table_number: validated.table.table_number,
            table_token: validated.table.table_token,
            restaurant_slug: validated.restaurant.slug,
            restaurant_name: validated.restaurant.name,
        };

        const sessionJwt = await createCustomerTableSessionToken(sessionPayload);

        const response = NextResponse.json({
            success: true,
            valid: true,
            table: {
                table_token: validated.table.table_token,
                table_number: validated.table.table_number,
                table_id: validated.table.id,
            },
            restaurant: {
                id: validated.restaurant.id,
                name: validated.restaurant.name,
                slug: validated.restaurant.slug,
                phone: validated.restaurant.phone,
            },
            sessionToken: sessionJwt,
        });

        // Bind secure session cookie
        setCustomerTableSessionCookie(response, sessionJwt);

        return response;
    } catch (err: any) {
        console.error('[TableSessionValidate API Error]', err);
        return NextResponse.json(
            { error: 'Failed to validate table session' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/customer/table-session/validate
 * 
 * Verifies currently active customer table session cookie.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getCustomerTableSession(req);
        if (!session) {
            return NextResponse.json({ valid: false, error: 'No active session' }, { status: 401 });
        }

        return NextResponse.json({
            valid: true,
            session,
        });
    } catch (err: any) {
        return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
    }
}
