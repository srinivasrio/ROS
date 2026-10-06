import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * POST /api/admin/profile
 * Secure server-side endpoint for updating restaurant profile, basic information,
 * branding (logo), GST, and metadata for authorized Restaurant Admins and Owners.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawRestaurantId = String(body.restaurantId || body.restaurantCode || '').trim();

        if (!rawRestaurantId) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 });
        }

        const resolvedId = await resolveRestaurantId(rawRestaurantId);
        if (!resolvedId) {
            return NextResponse.json({ error: 'Invalid restaurant ID' }, { status: 404 });
        }

        // Extract token from header or cookies
        let token = req.headers.get('x-dine-token');
        if (!token) {
            const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.slice(7).trim();
            }
        }
        if (!token) {
            token = extractTokenForRestaurant(req.cookies, rawRestaurantId) ||
                    extractTokenForRestaurant(req.cookies, resolvedId);
        }

        if (!token) {
            return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
        }

        const user = await verifyJwt(token);
        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired session. Please sign in again.' }, { status: 401 });
        }

        const role = String(user.role || '').toLowerCase().trim();
        const allowedRoles = ['owner', 'restaurant_owner', 'restaurant_admin', 'admin', 'super_admin', 'superadmin'];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: 'Unauthorized: Admin or Owner privileges required' }, { status: 403 });
        }

        // Verify tenant scope (Super Admin has global access)
        const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
        if (!isSuperAdmin) {
            const userRestId = String(user.restaurantId || user.restaurant_id || '').trim();
            if (userRestId && userRestId !== resolvedId && userRestId !== rawRestaurantId) {
                return NextResponse.json({ error: 'Access denied: Tenant mismatch' }, { status: 403 });
            }
        }

        const { info, metaInfo } = body;
        const now = new Date().toISOString();

        // 1. Prepare profile updates
        const profilePayload: Record<string, any> = {
            restaurant_id: resolvedId,
            last_updated: now
        };

        if (info) {
            profilePayload.restaurant_info = info;
            if (info.name) profilePayload.name = String(info.name).trim();
            if (info.phone) profilePayload.phone = String(info.phone).trim();
            if (info.email) profilePayload.email = String(info.email).trim();
            if (info.address) {
                profilePayload.address = typeof info.address === 'string' 
                    ? info.address 
                    : (info.address?.street || '');
            }
            if (info.gst_percentage !== undefined) {
                const gst = Number(info.gst_percentage);
                profilePayload.gst_percentage = gst;
                profilePayload.cgst_percentage = info.cgst_percentage !== undefined ? Number(info.cgst_percentage) : (gst / 2);
                profilePayload.sgst_percentage = info.sgst_percentage !== undefined ? Number(info.sgst_percentage) : (gst / 2);
            }
        }

        if (metaInfo) {
            profilePayload.meta_info = metaInfo;
        }

        const { error: profileErr } = await supabaseAdmin
            .from('restaurant_profile')
            .upsert(profilePayload, { onConflict: 'restaurant_id' });

        if (profileErr) {
            console.error('[api/admin/profile] Failed to upsert restaurant_profile:', profileErr);
            return NextResponse.json({ error: 'Failed to update restaurant profile' }, { status: 500 });
        }

        // 2. Sync core restaurant fields to restaurants table
        try {
            const restUpdate: Record<string, any> = { updated_at: now };
            if (info?.logo_url !== undefined) restUpdate.logo_url = info.logo_url || null;
            if (info?.name) restUpdate.name = String(info.name).trim();
            if (info?.phone) restUpdate.phone = String(info.phone).trim();
            if (info?.email) restUpdate.email = String(info.email).trim();
            if (info?.address) {
                restUpdate.address = typeof info.address === 'string' ? info.address : (info.address?.street || '');
            }
            if (info?.gst_percentage !== undefined) {
                const gst = Number(info.gst_percentage);
                restUpdate.gst_percentage = gst;
                restUpdate.cgst_percentage = info.cgst_percentage !== undefined ? Number(info.cgst_percentage) : (gst / 2);
                restUpdate.sgst_percentage = info.sgst_percentage !== undefined ? Number(info.sgst_percentage) : (gst / 2);
            }

            if (Object.keys(restUpdate).length > 1) {
                await supabaseAdmin
                    .from('restaurants')
                    .update(restUpdate)
                    .eq('id', resolvedId);
            }
        } catch (syncErr) {
            console.warn('[api/admin/profile] Warning: Syncing to restaurants table failed:', syncErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Restaurant profile updated successfully'
        });

    } catch (err: any) {
        console.error('[api/admin/profile] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
