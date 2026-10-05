import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';

// GET /api/owner/settings — Fetch restaurant profile, terms acceptance, and deletion request status
export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const scope = await resolveOwnerScope(auth, branchFilter);
        const restaurantId = scope.targetRestaurantId || auth.restaurantId || (scope.restaurantIds && scope.restaurantIds[0]) || null;

        if (!restaurantId) {
            return NextResponse.json({
                restaurant: null,
                terms: null,
                deletionRequest: null,
                user: {
                    id: auth.userId,
                    name: auth.name,
                    email: auth.email,
                    role: auth.role
                }
            });
        }

        // Fetch restaurant details
        const { data: restaurant, error: restErr } = await supabaseAdmin
            .from('restaurants')
            .select('id, name, legal_name, phone, email, address, logo_url, status, deleted_at, deletion_requested_at, permanent_deletion_at, created_at, updated_at')
            .eq('id', restaurantId)
            .single();

        if (restErr || !restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Fetch latest terms acceptance for this user & restaurant
        const { data: terms } = await supabaseAdmin
            .from('terms_acceptances')
            .select('terms_version, accepted_at, ip_address, user_agent')
            .eq('restaurant_id', restaurantId)
            .order('accepted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Fetch pending deletion request if any
        const { data: deletionRequest } = await supabaseAdmin
            .from('restaurant_deletion_requests')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'PENDING')
            .order('requested_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        return NextResponse.json({
            restaurant,
            terms: terms || {
                terms_version: 'v2.4.0',
                accepted_at: restaurant.created_at,
                is_current: true
            },
            deletionRequest: deletionRequest || null,
            user: {
                id: auth.userId,
                name: auth.name,
                email: auth.email,
                role: auth.role
            }
        });
    } catch (err: any) {
        console.error('[API /owner/settings GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/owner/settings — Update restaurant profile or terms
export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const scope = await resolveOwnerScope(auth, branchFilter);
        const restaurantId = scope.targetRestaurantId || auth.restaurantId;
        const { userId, ip, userAgent } = auth;
        const body = await request.json();

        // Handle Terms acceptance
        if (body.action === 'accept_terms') {
            const version = body.terms_version || 'v2.4.1';
            await supabaseAdmin.from('terms_acceptances').insert({
                restaurant_id: restaurantId,
                user_id: userId,
                terms_version: version,
                ip_address: ip,
                user_agent: userAgent,
                accepted_at: new Date().toISOString()
            });

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                actor_user_id: userId,
                actor_role: auth.role,
                action: 'terms_accepted',
                resource_type: 'terms',
                resource_id: version,
                metadata: { version, ip, userAgent },
                ip_address: ip,
                user_agent: userAgent
            });

            return NextResponse.json({ success: true, message: 'Terms accepted successfully' });
        }

        // Handle Deletion request
        if (body.action === 'request_deletion') {
            const reason = body.reason || 'Requested by owner';
            const scheduledPermanent = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 day retention

            const { data: delReq, error: delErr } = await supabaseAdmin
                .from('restaurant_deletion_requests')
                .insert({
                    restaurant_id: restaurantId,
                    requested_by: userId,
                    reason,
                    status: 'PENDING',
                    retention_days: 30,
                    scheduled_deletion_at: scheduledPermanent
                })
                .select()
                .single();

            if (delErr) {
                console.error('[Settings] Deletion request error:', delErr);
                return NextResponse.json({ error: 'Failed to create deletion request' }, { status: 500 });
            }

            // Update restaurant record with deletion requested state
            await supabaseAdmin
                .from('restaurants')
                .update({
                    status: 'DELETION_REQUESTED',
                    deletion_requested_at: new Date().toISOString(),
                    permanent_deletion_at: scheduledPermanent
                })
                .eq('id', restaurantId);

            // Audit log
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                actor_user_id: userId,
                actor_role: auth.role,
                action: 'restaurant_deletion_requested',
                resource_type: 'restaurants',
                resource_id: restaurantId,
                metadata: { reason, scheduled_permanent_deletion: scheduledPermanent },
                ip_address: ip,
                user_agent: userAgent
            });

            return NextResponse.json({
                success: true,
                message: 'Deletion requested. 30-day retention period active.',
                deletionRequest: delReq
            });
        }

        // Handle regular profile update
        const updates: any = {};
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.legal_name !== undefined) updates.legal_name = body.legal_name.trim();
        if (body.phone !== undefined) updates.phone = body.phone.trim();
        if (body.email !== undefined) updates.email = body.email.trim();
        if (body.address !== undefined) updates.address = body.address;
        if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
        updates.updated_at = new Date().toISOString();

        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('restaurants')
            .update(updates)
            .eq('id', restaurantId)
            .select()
            .single();

        if (updateErr) {
            console.error('[Settings] Profile update failed:', updateErr);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: restaurantId,
            actor_user_id: userId,
            actor_role: auth.role,
            action: 'restaurant_profile_updated',
            resource_type: 'restaurants',
            resource_id: restaurantId,
            metadata: { updated_fields: Object.keys(updates) },
            ip_address: ip,
            user_agent: userAgent
        });

        return NextResponse.json({ success: true, restaurant: updated });
    } catch (err: any) {
        console.error('[API /owner/settings PATCH] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
