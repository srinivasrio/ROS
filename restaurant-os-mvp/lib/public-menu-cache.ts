import { revalidatePath } from 'next/cache';

/**
 * P2-09 (PUBLIC-MENU-CACHE)
 * On-Demand Public Menu Cache Invalidation
 * 
 * Safely purges server-side Next.js route cache and triggers Cloudflare Edge Cache purge
 * strictly for the affected restaurant tenant after successful menu mutations.
 */
export async function revalidatePublicMenuCache(
    restaurantIdOrCode: string,
    origin?: string
): Promise<{ success: boolean; invalidated: string[] }> {
    if (!restaurantIdOrCode) return { success: false, invalidated: [] };

    const invalidated: string[] = [];

    try {
        // 1. Next.js on-demand route revalidation for the affected restaurant
        const targetPath = `/api/public/${restaurantIdOrCode}/menu`;
        revalidatePath(targetPath);
        invalidated.push(targetPath);

        // 2. Cloudflare Edge Cache Purge (if Cloudflare Zone and API credentials exist)
        const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
        const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;

        if (cfZoneId && cfApiToken) {
            const host = origin || process.env.NEXT_PUBLIC_APP_URL || 'https://dineinone.com';
            const purgeUrl = `${host}/api/public/${restaurantIdOrCode}/menu`;

            try {
                const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cfApiToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        files: [purgeUrl]
                    })
                });

                if (cfRes.ok) {
                    invalidated.push(purgeUrl);
                } else {
                    const errText = await cfRes.text();
                    console.warn('[CacheInvalidation] Cloudflare purge response not ok:', errText);
                }
            } catch (cfErr) {
                console.warn('[CacheInvalidation] Cloudflare purge error:', cfErr);
            }
        }

        return { success: true, invalidated };
    } catch (err) {
        console.error('[CacheInvalidation] Error revalidating public menu cache:', err);
        return { success: false, invalidated };
    }
}
