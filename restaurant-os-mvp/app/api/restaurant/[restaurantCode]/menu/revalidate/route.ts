import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '@/services/utils.service';
import { revalidatePublicMenuCache } from '@/lib/public-menu-cache';
import { withCacheHeaders, API_CACHE_POLICIES } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ restaurantCode: string }> }
) {
    try {
        const { restaurantCode } = await context.params;
        if (!restaurantCode) {
            return withCacheHeaders(
                NextResponse.json({ error: 'Restaurant code is required' }, { status: 400 }),
                API_CACHE_POLICIES.MUTATION_NO_STORE
            );
        }

        const actualId = await resolveRestaurantId(restaurantCode);
        
        // Verify restaurant actually exists in database before proceeding
        const { supabaseAdmin } = await import('@/lib/supabase-admin');
        const { data: exists } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .or(`id.eq.${actualId},internal_id.eq.${actualId},restaurant_code.eq.${restaurantCode}`)
            .maybeSingle();

        if (!exists) {
            return withCacheHeaders(
                NextResponse.json({ error: 'Restaurant not found' }, { status: 404 }),
                API_CACHE_POLICIES.MUTATION_NO_STORE
            );
        }

        const origin = request.nextUrl.origin;

        // Perform on-demand revalidation for both slug and UUID paths
        const [res1, res2] = await Promise.all([
            revalidatePublicMenuCache(restaurantCode, origin),
            actualId !== restaurantCode ? revalidatePublicMenuCache(actualId, origin) : Promise.resolve({ success: true, invalidated: [] })
        ]);

        const allInvalidated = Array.from(new Set([...res1.invalidated, ...res2.invalidated]));

        return withCacheHeaders(
            NextResponse.json({
                success: true,
                message: 'Public menu cache successfully revalidated',
                restaurantCode,
                restaurantId: actualId,
                invalidated: allInvalidated
            }),
            API_CACHE_POLICIES.MUTATION_NO_STORE
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Revalidation failed';
        console.error('[MenuRevalidateAPI] Error:', err);
        return withCacheHeaders(
            NextResponse.json({ error: message }, { status: 500 }),
            API_CACHE_POLICIES.MUTATION_NO_STORE
        );
    }
}
