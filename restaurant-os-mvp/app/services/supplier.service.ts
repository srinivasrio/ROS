import { createClient } from '@/lib/supabase';

export interface Supplier {
    id: string;
    restaurant_id: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    category: string;
    status: 'active' | 'inactive';
    created_at?: string;
}

const supabase = createClient();

export const SupplierService = {
    async fetchSuppliers(restaurantId: string) {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name');
        if (error) throw error;
        return data as Supplier[];
    },

    async createSupplier(supplier: Partial<Supplier>, restaurantId: string) {
        const { data, error } = await supabase
            .from('suppliers')
            .insert({ ...supplier, restaurant_id: restaurantId })
            .select()
            .single();
        if (error) throw error;
        return data as Supplier;
    },

    async updateSupplier(id: string, restaurantId: string, updates: Partial<Supplier>) {
        const { data, error } = await supabase
            .from('suppliers')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId)
            .select()
            .single();
        if (error) throw error;
        return data as Supplier;
    },

    async deleteSupplier(id: string, restaurantId: string) {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    }
};
