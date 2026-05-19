import { createClient } from '@/lib/supabase';

export interface Festival {
    id: string;
    restaurant_id: string;
    region: string;
    name: string;
    type: string;
    start_date: string;
    end_date: string;
    impact_level: number;
    category_bias: any;
    created_at?: string;
}

const supabase = createClient();

export const FestivalService = {
    async fetchFestivals(restaurantId: string) {
        const { data, error } = await supabase
            .from('festival_calendar')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('start_date', { ascending: true });

        if (error) throw error;
        return data as Festival[];
    },

    async createFestival(festival: Partial<Festival>, restaurantId: string) {
        const { data, error } = await supabase
            .from('festival_calendar')
            .insert({
                ...festival,
                restaurant_id: restaurantId
            })
            .select()
            .single();

        if (error) throw error;
        return data as Festival;
    },

    async deleteFestival(id: string, restaurantId: string) {
        const { error } = await supabase
            .from('festival_calendar')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    }
};
