import { createClient } from '@/lib/supabase';

export interface Staff {
    id: string;
    name: string;
    role: string;
    mobile: string;
    pin?: string;
    status: 'active' | 'inactive';
    address?: string;
    aadhaar_id?: string;
    id_document_url?: string;
    joining_date?: string;
}

export const StaffService = {
    async fetchStaff(restaurantId: string) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching staff:', error);
            return [];
        }
        return data as Staff[];
    },

    async createStaff(staff: Omit<Staff, 'id'> & { restaurant_id: string }) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('staff')
            .insert(staff)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateStaff(id: string, restaurantId: string, updates: Partial<Staff>) {
        const supabase = createClient();
        const { error } = await supabase
            .from('staff')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    async deleteStaff(id: string, restaurantId: string) {
        const supabase = createClient();
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    }
};
