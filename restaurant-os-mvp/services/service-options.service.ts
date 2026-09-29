import { createClient } from '@/lib/supabase';
import { compressImage, validateImageFile } from '@/lib/image-compress';
import { BoundedCache, resolveRestaurantId } from './utils.service';
import { QueryMonitor } from './query-monitor.service';

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

const dataCache = new BoundedCache<any>(100, 300000);
const activePromises = new Map<string, Promise<any>>();
const CACHE_TTL = 300000; // 5 minutes

export const ServiceOptionsService = {
    clearCache(restaurantId?: string) {
        activePromises.clear();
        if (restaurantId) {
            dataCache.delete(`all-${restaurantId}`);
            dataCache.delete(`active-${restaurantId}`);
        } else {
            dataCache.clear();
        }
    },

    async fetchAll(restaurantId: string): Promise<ServiceOption[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `all-${rid}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('service', true, 0);
                return cached as ServiceOption[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('service', true, 0);
            return cached as ServiceOption[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const { data, error } = await supabase
                    .from('service_options')
                    .select('id, service_key, label, sub_label, image_url, gradient, border_class, text_class, countable, sort_order, is_active, restaurant_id')
                    .eq('restaurant_id', rid)
                    .order('sort_order', { ascending: true });

                if (error) throw error;
                const result = data || [];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('service', false, Date.now() - startTime);
                return result;
            } catch (err: any) {
                const cached = dataCache.get(cacheKey);
                if (cached) {
                    return cached as ServiceOption[];
                }
                console.warn('[ServiceOptionsService] fetchAll error:', err?.message || err);
                return [];
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
    },

    async fetchActive(restaurantId: string): Promise<ServiceOption[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `active-${rid}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('service', true, 0);
                return cached as ServiceOption[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('service', true, 0);
            return cached as ServiceOption[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const { data, error } = await supabase
                    .from('service_options')
                    .select('id, service_key, label, sub_label, image_url, gradient, border_class, text_class, countable, sort_order, is_active, restaurant_id')
                    .eq('restaurant_id', rid)
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (error) throw error;
                const result = data || [];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('service', false, Date.now() - startTime);
                return result;
            } catch (err: any) {
                const cached = dataCache.get(cacheKey);
                if (cached) {
                    return cached as ServiceOption[];
                }
                console.warn('[ServiceOptionsService] fetchActive error:', err?.message || err);
                return [];
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
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
        this.clearCache(option.restaurant_id);
        return data;
    },

    async update(id: number, restaurantId: string, updates: Partial<ServiceOption>): Promise<void> {
        const { error } = await supabase
            .from('service_options')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
        this.clearCache(restaurantId);
    },

    async delete(id: number, restaurantId: string): Promise<void> {
        const { error } = await supabase
            .from('service_options')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
        this.clearCache(restaurantId);
    },

    async reorder(items: { id: number; sort_order: number }[], restaurantId: string): Promise<void> {
        for (const item of items) {
            await supabase
                .from('service_options')
                .update({ sort_order: item.sort_order })
                .eq('id', item.id)
                .eq('restaurant_id', restaurantId);
        }
        this.clearCache(restaurantId);
    },

    async uploadServiceImage(file: File, serviceId?: number | string, restaurantId?: string): Promise<string> {
        let targetRestaurantId: string | undefined = restaurantId;

        if (!targetRestaurantId && typeof serviceId === 'string' && serviceId.trim() !== '') {
            targetRestaurantId = serviceId.trim();
        }

        if (!targetRestaurantId && typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) {
                const candidate = pathParts[0];
                const ignored = ['login', 'register', 'api', 'admin', 'customer', 'super-admin', 'activation'];
                if (!ignored.includes(candidate)) {
                    targetRestaurantId = candidate;
                }
            }
            if (!targetRestaurantId) {
                const stored = sessionStorage.getItem('current_restaurant_id') || localStorage.getItem('current_restaurant_id');
                if (stored) targetRestaurantId = stored;
            }
        }

        if (!targetRestaurantId) {
            try {
                const { UserService } = await import('@/services/users.service');
                const profile = await UserService.getCurrentProfile();
                targetRestaurantId = profile?.restaurant_id;

                if (!targetRestaurantId && profile?.id) {
                    const { data: owned } = await supabase
                        .from('restaurants')
                        .select('id')
                        .eq('owner_id', profile.id)
                        .limit(1)
                        .maybeSingle();
                    if (owned?.id) {
                        targetRestaurantId = owned.id;
                    }
                }
            } catch (e) {
                console.warn('[ServiceOptionsService] Failed to retrieve current user profile for restaurantId:', e);
            }
        }

        if (!targetRestaurantId) {
            throw new Error('Restaurant ID is required for image upload');
        }

        targetRestaurantId = await resolveRestaurantId(targetRestaurantId);

        const validationError = validateImageFile(file);
        if (validationError) throw new Error(validationError);

        let uploadFile = file;
        try {
            const compressed = await compressImage(file);
            uploadFile = compressed.file;
        } catch (e) {
            console.warn('[ServiceOptionsService] Image compression failed, falling back to original:', e);
        }

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('restaurantId', targetRestaurantId);
        formData.append('type', 'menu'); // Services belong to menu/public category

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        return data.url;
    },

    subscribeToChanges(restaurantId: string, onChange: () => void) {
        if (!restaurantId || !String(restaurantId).trim()) {
            return { unsubscribe: () => {} };
        }
        let isCancelled = false;
        let channel: any = null;

        resolveRestaurantId(restaurantId).then(resolvedId => {
            if (isCancelled || !resolvedId) return;

            channel = supabase
                .channel(`service-options-${resolvedId}`)
                .on(
                    'postgres_changes',
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'service_options',
                        filter: `restaurant_id=eq.${resolvedId}`
                    },
                    (payload) => {
                        const rec = (payload.new || payload.old) as any;
                        if (!rec) return;
                        if (rec.restaurant_id != null) {
                            if (String(rec.restaurant_id) !== String(resolvedId)) return;
                        } else if (payload.eventType !== 'DELETE') {
                            return;
                        }
                        onChange();
                    }
                );
            channel.subscribe();
        });

        return { 
            unsubscribe: () => { 
                isCancelled = true;
                if (channel) supabase.removeChannel(channel); 
            } 
        };
    }
};
