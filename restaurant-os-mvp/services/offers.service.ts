import { createClient } from '@/lib/supabase';
import { BoundedCache } from './utils.service';
import { QueryMonitor } from './query-monitor.service';

export interface Offer {
    id: string;
    code: string;
    title?: string;
    description?: string;
    discount_type: 'percentage' | 'flat';
    discount_value: number;
    max_discount?: number | null;
    status: 'active' | 'paused' | 'expired';
    usage_count: number;
    restaurant_id: string;
    end_datetime?: string | null;
}

const dataCache = new BoundedCache<any>(100, 300000);
const activePromises = new Map<string, Promise<any>>();
const CACHE_TTL = 300000; // 5 minutes

export const OfferService = {
    clearCache(restaurantId?: string) {
        activePromises.clear();
        if (restaurantId) {
            dataCache.delete(`offers-${restaurantId}`);
        } else {
            dataCache.clear();
        }
    },

    async fetchOffers(restaurantId: string) {
        const cacheKey = `offers-${restaurantId}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('offer', true, 0);
                return cached as Offer[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('offer', true, 0);
            return cached as Offer[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('offers')
                    .select('id, code, title, description, discount_type, discount_value, max_discount, status, usage_count, restaurant_id, end_datetime')
                    .eq('restaurant_id', restaurantId)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching offers:', error);
                    return [];
                }
                const result = data as Offer[];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('offer', false, Date.now() - startTime);
                return result;
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
    },

    async createOffer(offer: Omit<Offer, 'id' | 'usage_count'> & { restaurant_id: string }) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .insert(offer)
            .select()
            .single();

        if (error) throw error;
        this.clearCache(offer.restaurant_id);
        return data;
    },

    async updateOffer(id: string, restaurantId: string, updates: Partial<Offer>) {
        const supabase = createClient();
        
        // Remove read-only fields from updates
        const { id: _, restaurant_id: __, usage_count: ___, created_at: ____, ...cleanUpdates } = updates as any;

        const { error } = await supabase
            .from('offers')
            .update(cleanUpdates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
        this.clearCache(restaurantId);
    },

    async deleteOffer(id: string, restaurantId: string) {
        const supabase = createClient();
        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
        this.clearCache(restaurantId);
    },

    async validateCoupon(code: string, restaurantId: string): Promise<Offer | null> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .select('id, code, title, description, discount_type, discount_value, max_discount, status, usage_count, restaurant_id, end_datetime')
            .eq('code', code.toUpperCase().trim())
            .eq('restaurant_id', restaurantId)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            console.error('Error validating coupon:', error);
            return null;
        }
        return data as Offer | null;
    },

    async incrementUsage(offerId: string, restaurantId: string) {
        const supabase = createClient();
        const { data } = await supabase
            .from('offers')
            .select('usage_count')
            .eq('id', offerId)
            .eq('restaurant_id', restaurantId)
            .single();

        if (data) {
            await supabase
                .from('offers')
                .update({ usage_count: (data.usage_count || 0) + 1 })
                .eq('id', offerId)
                .eq('restaurant_id', restaurantId);
            this.clearCache(restaurantId);
        }
    }
};
