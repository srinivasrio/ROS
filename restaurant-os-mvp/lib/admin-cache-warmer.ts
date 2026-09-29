'use client';

import { adminPreloadManager } from './cache/preload-manager';

/**
 * Backward compatibility wrapper for warmupAdminDataCache.
 * Delegates directly to the centralized adminPreloadManager.
 */
export async function warmupAdminDataCache(restaurantId: string): Promise<void> {
    if (!restaurantId || typeof window === 'undefined') return;
    await adminPreloadManager.startPreload(restaurantId);
}
