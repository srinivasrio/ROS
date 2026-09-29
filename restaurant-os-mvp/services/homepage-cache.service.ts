/**
 * Simple in-memory cache for Customer Panel data to enable "Instant Load"
 * across all bottom navigation tabs.
 */
class CustomerCacheService {
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private TTL = 1000 * 60 * 5; // 5 minutes cache

    private getCacheKey(restaurantId: string, page: string, extra?: string) {
        return `${restaurantId}:${page}${extra ? `:${extra}` : ''}`;
    }

    set(restaurantId: string, page: string, data: any, extra?: string) {
        const key = this.getCacheKey(restaurantId, page, extra);
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(restaurantId: string, page: string, extra?: string) {
        const key = this.getCacheKey(restaurantId, page, extra);
        const entry = this.cache.get(key);
        
        if (!entry) return null;
        
        // Return data even if stale for "Instant Load", we refresh in background
        return entry.data;
    }

    clear(restaurantId?: string, page?: string, extra?: string) {
        if (restaurantId && page) {
            this.cache.delete(this.getCacheKey(restaurantId, page, extra));
        } else {
            this.cache.clear();
        }
    }
}

export const CustomerCache = new CustomerCacheService();

// Maintain backward compatibility if needed, but we'll update usages
export const HomepageCache = CustomerCache;
