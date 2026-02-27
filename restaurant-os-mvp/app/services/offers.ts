import { createClient } from '@/lib/supabase';

export interface Offer {
    id: string;
    code: string;
    discount_type: 'percentage' | 'flat';
    discount_value: number;
    status: 'active' | 'paused' | 'expired';
    usage_count: number;
}

export const OfferService = {
    async fetchOffers() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching offers:', error);
            return [];
        }
        return data as Offer[];
    },

    async createOffer(offer: Omit<Offer, 'id' | 'usage_count'>) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('offers')
            .insert(offer)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateOfferStatus(id: string, status: Offer['status']) {
        const supabase = createClient();
        const { error } = await supabase
            .from('offers')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
    },

    async deleteOffer(id: string) {
        const supabase = createClient();
        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
