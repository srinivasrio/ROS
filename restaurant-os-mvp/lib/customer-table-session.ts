import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { signJwt, verifyJwt } from './jwt-utils';

export interface CustomerTableSessionData {
    restaurant_id: string;
    table_id: number | string;
    table_number: string;
    table_token: string;
    restaurant_slug?: string;
    restaurant_name?: string;
    session_id?: string;
}

export const CUSTOMER_TABLE_SESSION_COOKIE = 'customer_table_session';

/**
 * Validates a cryptographic table token from database.
 * Returns table and restaurant metadata if valid, or null if invalid.
 */
export async function validateTableToken(token: string): Promise<{
    table: {
        id: number | string;
        table_number: string;
        table_token: string;
        restaurant_id: string;
    };
    restaurant: {
        id: string;
        name: string;
        slug: string;
        phone?: string;
    };
} | null> {
    if (!token || typeof token !== 'string' || token.trim().length < 8) {
        return null;
    }

    const cleanToken = token.trim();

    try {
        const { data: tableData, error: tableErr } = await supabaseAdmin
            .from('tables')
            .select('id, table_number, restaurant_id, table_token')
            .eq('table_token', cleanToken)
            .maybeSingle();

        if (tableErr || !tableData) {
            return null;
        }

        // Fetch restaurant profile
        const { data: profile } = await supabaseAdmin
            .from('restaurant_profile')
            .select('restaurant_id, name, slug, phone')
            .eq('restaurant_id', tableData.restaurant_id)
            .maybeSingle();

        const restaurantSlug = profile?.slug || tableData.restaurant_id;

        return {
            table: {
                id: tableData.id,
                table_number: tableData.table_number,
                table_token: tableData.table_token,
                restaurant_id: tableData.restaurant_id,
            },
            restaurant: {
                id: tableData.restaurant_id,
                name: profile?.name || 'Restaurant',
                slug: restaurantSlug,
                phone: profile?.phone || '',
            },
        };
    } catch (err) {
        console.error('[validateTableToken] Unexpected error:', err);
        return null;
    }
}

/**
 * Creates a signed JWT token binding customer session to table_id and restaurant_id.
 */
export async function createCustomerTableSessionToken(
    sessionData: CustomerTableSessionData
): Promise<string> {
    const payload = {
        role: 'customer_table',
        restaurant_id: String(sessionData.restaurant_id),
        table_id: String(sessionData.table_id),
        table_number: String(sessionData.table_number),
        table_token: String(sessionData.table_token),
        restaurant_slug: sessionData.restaurant_slug || '',
        session_id: sessionData.session_id || crypto.randomUUID(),
    };

    // Customer table session valid for 24 hours
    return signJwt(payload, 86400);
}

/**
 * Verifies customer table session from request cookie or Authorization header.
 */
export async function getCustomerTableSession(
    req: NextRequest
): Promise<CustomerTableSessionData | null> {
    try {
        let rawToken = req.cookies.get(CUSTOMER_TABLE_SESSION_COOKIE)?.value;

        if (!rawToken) {
            const authHeader = req.headers.get('x-customer-table-token') || req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                rawToken = authHeader.substring(7).trim();
            } else if (authHeader) {
                rawToken = authHeader.trim();
            }
        }

        if (!rawToken) return null;

        const payload = await verifyJwt(rawToken);
        if (!payload || payload.role !== 'customer_table') {
            return null;
        }

        return {
            restaurant_id: String(payload.restaurant_id),
            table_id: payload.table_id,
            table_number: String(payload.table_number),
            table_token: String(payload.table_token),
            restaurant_slug: payload.restaurant_slug,
            session_id: payload.session_id,
        };
    } catch (err) {
        console.error('[getCustomerTableSession] Verification failed:', err);
        return null;
    }
}

/**
 * Sets secure HTTP-only cookie binding customer to table session.
 */
export function setCustomerTableSessionCookie(
    res: NextResponse,
    token: string
): void {
    res.cookies.set(CUSTOMER_TABLE_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400, // 24 hours
    });
}
