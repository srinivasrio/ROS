import { createClient } from '@/lib/supabase';

const supabase = createClient();

export interface ServiceOption {
    id: number;
    service_key: string;
    label: string;
    sub_label: string;
    image_url: string | null;
    gradient: string;
    border_class: string;
    text_class: string;
    countable: boolean;
    sort_order: number;
    is_active: boolean;
    restaurant_id: string; // Added for multi-tenant isolation
    created_at?: string;
    updated_at?: string;
}

export const ServiceOptionsService = {
    async fetchAll(restaurantId: string): Promise<ServiceOption[]> {
        const { data, error } = await supabase
            .from('service_options')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async fetchActive(restaurantId: string): Promise<ServiceOption[]> {
        const { data, error } = await supabase
            .from('service_options')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async create(option: Partial<ServiceOption> & { restaurant_id: string }): Promise<ServiceOption> {
        // Check for duplicate service_key within the same restaurant
        if (option.service_key) {
            const { data: existing } = await supabase
                .from('service_options')
                .select('id')
                .eq('service_key', option.service_key)
                .eq('restaurant_id', option.restaurant_id)
                .single();

            if (existing) {
                throw new Error('A service with this name already exists.');
            }
        }

        const { data, error } = await supabase
            .from('service_options')
            .insert(option)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: number, restaurantId: string, updates: Partial<ServiceOption>): Promise<void> {
        const { error } = await supabase
            .from('service_options')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    async delete(id: number, restaurantId: string): Promise<void> {
        const { error } = await supabase
            .from('service_options')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    async reorder(items: { id: number; sort_order: number }[], restaurantId: string): Promise<void> {
        for (const item of items) {
            await supabase
                .from('service_options')
                .update({ sort_order: item.sort_order })
                .eq('id', item.id)
                .eq('restaurant_id', restaurantId);
        }
    },

    async uploadServiceImage(file: File, serviceId?: number): Promise<string> {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `service-${serviceId || Date.now()}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('menu-images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('menu-images')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    subscribeToChanges(restaurantId: string, onChange: () => void) {
        const channel = supabase
            .channel(`service-options-${restaurantId}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'service_options',
                    filter: `restaurant_id=eq.${restaurantId}`
                },
                onChange
            );
        channel.subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    }
};
