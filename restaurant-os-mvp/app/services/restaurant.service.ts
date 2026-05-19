import { createClient } from '@/lib/supabase';

export interface MetaInfo {
    facilities: Record<string, boolean>;
    services: Record<string, boolean>;
    payment_methods: Record<string, boolean>;
    cuisine: string[];
    policies: Record<string, boolean>;
    custom_categories: { name: string; items: Record<string, boolean> }[];
}

const DEFAULT_META_INFO: MetaInfo = {
    facilities: {
        parking: false,
        ac_available: false,
        wifi_available: false,
        pet_friendly: false,
        wheelchair_accessible: false
    },
    services: {
        catering: false,
        private_party: false,
        birthday_setup: false,
        home_delivery: false
    },
    payment_methods: {
        cash: true,
        upi: true,
        card: true
    },
    cuisine: [],
    policies: {
        outside_food_allowed: false,
        smoking_zone: false
    },
    custom_categories: []
};

// Helper: Takes an input object and ensures it's a Record<string, boolean> 
// while keeping the mandatory default keys mapped to their actual input values or false.
const sanitizeBooleanRecord = (input: any, defaults: Record<string, boolean> = {}): Record<string, boolean> => {
    const result: Record<string, boolean> = { ...defaults };
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        for (const [k, v] of Object.entries(input)) {
            result[k] = Boolean(v);
        }
    }
    return result;
};

// Helper for migrating lists to records for custom categories
const sanitizeCustomCategoryItems = (inputItems: any): Record<string, boolean> => {
    if (Array.isArray(inputItems)) {
        // Migration from string[] to Record<string, boolean>
        const result: Record<string, boolean> = {};
        for (const item of inputItems) {
            if (typeof item === 'string') {
                const key = item.toLowerCase().replace(/\s+/g, '_');
                result[key] = true;
            }
        }
        return result;
    }
    return sanitizeBooleanRecord(inputItems, {});
};

// Ensure no arbitrary root keys are preserved during merge.
const sanitizeMetaInfo = (input: any): MetaInfo => {
    return {
        facilities: sanitizeBooleanRecord(input?.facilities, DEFAULT_META_INFO.facilities),
        services: sanitizeBooleanRecord(input?.services, DEFAULT_META_INFO.services),
        payment_methods: sanitizeBooleanRecord(input?.payment_methods, DEFAULT_META_INFO.payment_methods),
        cuisine: Array.isArray(input?.cuisine) ? input.cuisine.map(String) : [],
        policies: sanitizeBooleanRecord(input?.policies, DEFAULT_META_INFO.policies),
        custom_categories: Array.isArray(input?.custom_categories)
            ? input.custom_categories.map((c: any) => ({
                name: String(c?.name || ''),
                items: sanitizeCustomCategoryItems(c?.items)
            }))
            : []
    };
};

export interface RestaurantInfo {
    name: string;
    description: string;
    tagline: string;
    phone: string;
    email: string;
    website: string;
    address: {
        street: string;
        city: string;
        state: string;
        pincode: string;
    };
    timings: {
        opening_time: string;
        closing_time: string;
        days_open: string;
    };
    social: {
        instagram: string;
        facebook: string;
        google_maps: string;
    };
}

const DEFAULT_RESTAURANT_INFO: RestaurantInfo = {
    name: '',
    description: '',
    tagline: '',
    phone: '',
    email: '',
    website: '',
    address: { street: '', city: '', state: '', pincode: '' },
    timings: { opening_time: '', closing_time: '', days_open: 'Monday - Sunday' },
    social: { instagram: '', facebook: '', google_maps: '' },
};

export const RestaurantService = {
    /**
     * Resolves a restaurant code (ID or slug) to the actual restaurant_id.
     */
    resolveRestaurantId: async (code: string): Promise<string | null> => {
        const supabase = createClient();
        
        // 1. Try as direct ID/UUID first
        const { data: byId } = await supabase
            .from('restaurant_profile')
            .select('restaurant_id')
            .eq('restaurant_id', code)
            .maybeSingle();

        if (byId) return byId.restaurant_id;

        // 2. Try as Slug
        const { data: bySlug } = await supabase
            .from('restaurant_profile')
            .select('restaurant_id')
            .eq('slug', code.toLowerCase())
            .maybeSingle();

        return bySlug?.restaurant_id || null;
    },

    /**
     * Retrieves structured Meta Info for the restaurant profile.
     * Merges db state with defaults to always return a strict structure.
     */
    getMetaInfo: async (restaurantId: string): Promise<MetaInfo> => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('meta_info')
            .eq('restaurant_id', restaurantId)
            .single();

        if (error || !data || !data.meta_info) {
            return DEFAULT_META_INFO;
        }

        return sanitizeMetaInfo(data.meta_info);
    },

    /**
     * Deep-merges partial updates tightly into the specific schema.
     */
    updateMetaInfo: async (restaurantId: string, updates: Partial<MetaInfo>): Promise<void> => {
        const currentMeta = await RestaurantService.getMetaInfo(restaurantId);

        // Safely spread keeping exact strict properties
        const mergedMeta: MetaInfo = {
            ...currentMeta,
            facilities: { ...currentMeta.facilities, ...updates.facilities },
            services: { ...currentMeta.services, ...updates.services },
            payment_methods: { ...currentMeta.payment_methods, ...updates.payment_methods },
            cuisine: updates.cuisine !== undefined ? Array.from(updates.cuisine) : currentMeta.cuisine,

            policies: { ...currentMeta.policies, ...updates.policies },
            custom_categories: updates.custom_categories !== undefined ? updates.custom_categories : currentMeta.custom_categories
        };

        const sanitizedUpdate = sanitizeMetaInfo(mergedMeta);

        const supabase = createClient();
        const { error } = await supabase
            .from('restaurant_profile')
            .upsert({ restaurant_id: restaurantId, meta_info: sanitizedUpdate }, { onConflict: 'restaurant_id' });

        if (error) {
            console.error('Failed to update meta info', error);
            throw new Error('Failed to update restaurant meta information');
        }
    },

    /**
     * Retrieves restaurant basic info (name, address, phone, timings, etc.)
     */
    getRestaurantInfo: async (restaurantId: string): Promise<RestaurantInfo> => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('restaurant_info')
            .eq('restaurant_id', restaurantId)
            .single();

        if (error || !data || !data.restaurant_info) {
            return DEFAULT_RESTAURANT_INFO;
        }

        const raw = data.restaurant_info as any;
        return {
            name: raw.name || '',
            description: raw.description || '',
            tagline: raw.tagline || '',
            phone: raw.phone || '',
            email: raw.email || '',
            website: raw.website || '',
            address: {
                street: raw.address?.street || '',
                city: raw.address?.city || '',
                state: raw.address?.state || '',
                pincode: raw.address?.pincode || '',
            },
            timings: {
                opening_time: raw.timings?.opening_time || '',
                closing_time: raw.timings?.closing_time || '',
                days_open: raw.timings?.days_open || 'Monday - Sunday',
            },
            social: {
                instagram: raw.social?.instagram || '',
                facebook: raw.social?.facebook || '',
                google_maps: raw.social?.google_maps || '',
            },
        };
    },

    /**
     * Updates restaurant basic info.
     */
    updateRestaurantInfo: async (restaurantId: string, info: RestaurantInfo): Promise<void> => {
        const supabase = createClient();
        const { error } = await supabase
            .from('restaurant_profile')
            .upsert({ restaurant_id: restaurantId, restaurant_info: info }, { onConflict: 'restaurant_id' });

        if (error) {
            console.error('Failed to update restaurant info', error);
            throw new Error('Failed to update restaurant information');
        }
    },

    /**
     * Retrieves the business type of the restaurant.
     */
    getBusinessType: async (restaurantId: string): Promise<'restaurant' | 'bar' | 'restaurant_bar'> => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('business_type')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (error || !data) {
            return 'restaurant'; // Default fallback
        }

        return data.business_type as any;
    },

    /**
     * Retrieves the slug (code) for a restaurant ID.
     */
    getSlugById: async (restaurantId: string): Promise<string | null> => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('slug')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (error) {
            console.error('Failed to fetch slug', error);
            return null;
        }

        return data?.slug || null;
    },
};
