import { createClient } from '@/lib/supabase';

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

export const OfferService = {
    async fetchOffers(restaurantId: string) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching offers:', error);
            return [];
        }
        return data as Offer[];
    },

    async createOffer(offer: Omit<Offer, 'id' | 'usage_count'> & { restaurant_id: string }) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .insert(offer)
            .select()
            .single();

        if (error) throw error;
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
    },

    async deleteOffer(id: string, restaurantId: string) {
        const supabase = createClient();
        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    async validateCoupon(code: string, restaurantId: string): Promise<Offer | null> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .select('*')
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
        }
    }
};
