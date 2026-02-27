import { createClient } from '@/lib/supabase';

export interface Staff {
    id: string;
    name: string;
    role: 'admin' | 'waiter' | 'chef' | 'manager';
    mobile: string;
    pin?: string;
    status: 'active' | 'inactive';
}

export const StaffService = {
    async fetchStaff() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching staff:', error);
            return [];
        }
        return data as Staff[];
    },

    async createStaff(staff: Omit<Staff, 'id'>) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('staff')
            .insert(staff)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateStaff(id: string, updates: Partial<Staff>) {
        const supabase = createClient();
        const { error } = await supabase
            .from('staff')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteStaff(id: string) {
        const supabase = createClient();
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
