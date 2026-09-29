'use client';

import { useRestaurant } from '@/context/RestaurantContext';

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
