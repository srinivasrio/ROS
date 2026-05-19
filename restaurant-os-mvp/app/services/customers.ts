import { createClient } from '@/lib/supabase';

export interface Customer {
    id: string;
    name: string;
    mobile: string;
    email?: string;
    total_visits: number;
    total_spend: number;
    last_visit: string;
}

export const CustomerService = {
    async fetchCustomers(restaurantId: string) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('last_visit', { ascending: false });

        if (error) {
            console.error('Error fetching customers:', error);
            return [];
        }
        return data as Customer[];
    },

    async createCustomer(restaurantId: string, customer: Omit<Customer, 'id' | 'created_at' | 'total_visits' | 'total_spend' | 'last_visit'>) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('customers')
            .insert({ ...customer, restaurant_id: restaurantId })
            .select() // Returning * for the inserted row
            .single();

        if (error) throw error;
        return data;
    },

    async updateCustomer(id: string, restaurantId: string, updates: Partial<Customer>) {
        const supabase = createClient();
        const { error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    }
};
