'use client';

import { useRestaurant } from '@/app/context/RestaurantContext';

const FALLBACK_RESTAURANT_ID = 'd0637b58-8b77-4404-9469-805152865715';

/**
 * Hook that resolves the current admin/staff user's restaurant_id.
 * Now acts as a wrapper around RestaurantContext for backward compatibility.
 */
export function useRestaurantId() {
    const { restaurantId, loading } = useRestaurant();
    return { restaurantId, loading };
}

/**
 * Clear the cached restaurant ID (e.g. on sign out).
 */
export function clearRestaurantIdCache() {
    // No-op now that we use RestaurantContext
}

export { FALLBACK_RESTAURANT_ID };
