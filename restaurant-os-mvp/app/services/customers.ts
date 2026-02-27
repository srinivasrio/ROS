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
    async fetchCustomers() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('last_visit', { ascending: false });

        if (error) {
            console.error('Error fetching customers:', error);
            return [];
        }
        return data as Customer[];
    },

    async createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'total_visits' | 'total_spend' | 'last_visit'>) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('customers')
            .insert(customer)
            .select() // Returning * for the inserted row
            .single();

        if (error) throw error;
        return data;
    },

    async updateCustomer(id: string, updates: Partial<Customer>) {
        const supabase = createClient();
        const { error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }
};
