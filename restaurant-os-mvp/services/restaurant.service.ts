import { createClient } from '@/lib/supabase';

export interface MetaInfo {
    facilities: Record<string, boolean>;
    services: Record<string, boolean>;
    payment_methods: Record<string, boolean>;
    cuisine: string[];
    policies: Record<string, boolean>;
    custom_categories: { name: string; items: Record<string, boolean> }[];
}

const businessTypeCache = new Map<string, 'restaurant' | 'bar' | 'restaurant_bar'>();

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
    logo_url?: string;
    payment_qr_url?: string;
    upi_id?: string;
    tax_percentage?: number;
    gst_percentage?: number;
    cgst_percentage?: number;
    sgst_percentage?: number;
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
    logo_url: '',
    payment_qr_url: '',
    upi_id: '',
    tax_percentage: 5,
    gst_percentage: 5,
    cgst_percentage: 2.5,
    sgst_percentage: 2.5,
    address: { street: '', city: '', state: '', pincode: '' },
    timings: { opening_time: '', closing_time: '', days_open: 'Monday - Sunday' },
    social: { instagram: '', facebook: '', google_maps: '' },
};

export const RestaurantService = {
    /**
     * Resolves a restaurant code (ID or slug) to the actual restaurant_id.
     */
    resolveRestaurantId: async (code: string): Promise<string | null> => {
        if (!code) return null;
        const cleanCode = String(code).trim();
        if (!cleanCode) return null;

        const supabase = createClient();
        
        // 1. Direct check in restaurants table first
        const { data: exists } = await supabase
            .from('restaurants')
            .select('id')
            .eq('id', cleanCode)
            .maybeSingle();

        if (exists) return exists.id;

        // 2. Try as direct ID/UUID in restaurant_profile
        const { data: byId } = await supabase
            .from('restaurant_profile')
            .select('restaurant_id')
            .eq('restaurant_id', cleanCode)
            .maybeSingle();

        if (byId) return byId.restaurant_id;

        // 3. Try as Slug in restaurant_profile
        const { data: bySlug } = await supabase
            .from('restaurant_profile')
            .select('restaurant_id')
            .eq('slug', cleanCode.toLowerCase())
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
        const actualId = (await RestaurantService.resolveRestaurantId(restaurantId)) || restaurantId;
        const [{ data: profData }, { data: resData }] = await Promise.all([
            supabase
                .from('restaurant_profile')
                .select('name, restaurant_info')
                .or(`restaurant_id.eq.${actualId},slug.eq.${actualId.toLowerCase()}`)
                .maybeSingle(),
            supabase
                .from('restaurants')
                .select('name, gst_percentage, cgst_percentage, sgst_percentage')
                .eq('id', actualId)
                .maybeSingle()
        ]);

        const raw = (profData?.restaurant_info || {}) as any;
        const fallbackGst = resData?.gst_percentage != null ? Number(resData.gst_percentage) : (raw.gst_percentage !== undefined ? Number(raw.gst_percentage) : (raw.tax_percentage !== undefined ? Number(raw.tax_percentage) : 5));
        const fallbackCgst = resData?.cgst_percentage != null ? Number(resData.cgst_percentage) : (raw.cgst_percentage !== undefined ? Number(raw.cgst_percentage) : fallbackGst / 2);
        const fallbackSgst = resData?.sgst_percentage != null ? Number(resData.sgst_percentage) : (raw.sgst_percentage !== undefined ? Number(raw.sgst_percentage) : fallbackGst / 2);

        return {
            name: raw.name || profData?.name || resData?.name || '',
            description: raw.description || '',
            tagline: raw.tagline || '',
            phone: raw.phone || '',
            email: raw.email || '',
            website: raw.website || '',
            logo_url: raw.logo_url || '',
            payment_qr_url: raw.payment_qr_url || '',
            upi_id: raw.upi_id || '',
            tax_percentage: fallbackGst,
            gst_percentage: fallbackGst,
            cgst_percentage: fallbackCgst,
            sgst_percentage: fallbackSgst,
            address: {
                street: typeof raw.address === 'string' ? raw.address : (raw.address?.street || ''),
                city: typeof raw.address === 'object' ? (raw.address?.city || '') : '',
                state: typeof raw.address === 'object' ? (raw.address?.state || '') : '',
                pincode: typeof raw.address === 'object' ? (raw.address?.pincode || '') : '',
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
     * Retrieves specific GST settings for a restaurant.
     */
    getGstSettings: async (restaurantId: string): Promise<{ gst_percentage: number; cgst_percentage: number; sgst_percentage: number }> => {
        if (!restaurantId) return { gst_percentage: 5, cgst_percentage: 2.5, sgst_percentage: 2.5 };
        const supabase = createClient();
        const actualId = (await RestaurantService.resolveRestaurantId(restaurantId)) || restaurantId;
        const { data } = await supabase
            .from('restaurants')
            .select('gst_percentage, cgst_percentage, sgst_percentage')
            .eq('id', actualId)
            .maybeSingle();

        if (data && data.gst_percentage !== null && data.gst_percentage !== undefined) {
            const gst = Number(data.gst_percentage);
            const cgst = data.cgst_percentage !== null && data.cgst_percentage !== undefined ? Number(data.cgst_percentage) : gst / 2;
            const sgst = data.sgst_percentage !== null && data.sgst_percentage !== undefined ? Number(data.sgst_percentage) : gst / 2;
            return { gst_percentage: gst, cgst_percentage: cgst, sgst_percentage: sgst };
        }

        // Fallback to restaurant_profile
        const { data: profData } = await supabase
            .from('restaurant_profile')
            .select('gst_percentage, cgst_percentage, sgst_percentage, tax_percentage, restaurant_info')
            .eq('restaurant_id', actualId)
            .maybeSingle();

        if (profData) {
            const raw = (profData.restaurant_info || {}) as any;
            const gstVal = profData.gst_percentage ?? raw.gst_percentage ?? profData.tax_percentage ?? raw.tax_percentage;
            if (gstVal !== null && gstVal !== undefined) {
                const gst = Number(gstVal);
                const cgst = profData.cgst_percentage ?? raw.cgst_percentage ?? (gst / 2);
                const sgst = profData.sgst_percentage ?? raw.sgst_percentage ?? (gst / 2);
                return { gst_percentage: gst, cgst_percentage: Number(cgst), sgst_percentage: Number(sgst) };
            }
        }

        return { gst_percentage: 5, cgst_percentage: 2.5, sgst_percentage: 2.5 };
    },

    /**
     * Updates restaurant basic info.
     */
    updateRestaurantInfo: async (restaurantId: string, info: RestaurantInfo): Promise<void> => {
        const supabase = createClient();
        const actualId = (await RestaurantService.resolveRestaurantId(restaurantId)) || restaurantId;

        const { error } = await supabase
            .from('restaurant_profile')
            .upsert({ 
                restaurant_id: actualId, 
                name: info.name || undefined,
                restaurant_info: info 
            }, { onConflict: 'restaurant_id' });

        if (error) {
            console.error('Failed to update restaurant info', error);
            throw new Error('Failed to update restaurant information');
        }

        // Also sync logo_url, name, and GST to restaurants table for universal access
        try {
            const updatePayload: any = {};
            if (info.logo_url !== undefined) updatePayload.logo_url = info.logo_url || null;
            if (info.name) updatePayload.name = info.name;
            if (info.gst_percentage !== undefined) {
                updatePayload.gst_percentage = info.gst_percentage;
                updatePayload.cgst_percentage = info.cgst_percentage ?? (info.gst_percentage / 2);
                updatePayload.sgst_percentage = info.sgst_percentage ?? (info.gst_percentage / 2);
            }
            if (Object.keys(updatePayload).length > 0) {
                await supabase.from('restaurants').update(updatePayload).eq('id', actualId);
            }
        } catch (syncErr) {
            console.warn('Could not sync logo/name/gst to restaurants table:', syncErr);
        }

        // Invalidate homepage builder and memory caches
        try {
            const { clearCache } = await import('./homepage-builder.service');
            clearCache(`homepage-full-${actualId}`);
            clearCache(`homepage-full-${restaurantId}`);
        } catch (e) {}
    },

    /**
     * Retrieves the business type of the restaurant.
     */
    getBusinessType: async (restaurantId: string): Promise<'restaurant' | 'bar' | 'restaurant_bar'> => {
        if (!restaurantId) return 'restaurant';
        if (businessTypeCache.has(restaurantId)) {
            return businessTypeCache.get(restaurantId)!;
        }
        const supabase = createClient();
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('business_type')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        const result: 'restaurant' | 'bar' | 'restaurant_bar' = (data?.business_type as any) || 'restaurant';
        businessTypeCache.set(restaurantId, result);
        return result;
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
