import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from './utils.service';
import { MenuService } from './menu.service';
import { BannerService } from './banner.service';
import { SpecialsService } from './specials.service';
import { OrderService } from './orders.service';
import { QueryMonitor } from './query-monitor.service';
import { formatAddress } from '@/lib/utils';

const supabase = createClient();

import { BoundedCache } from './utils.service';

// In-memory cache for homepage data
const dataCache = new BoundedCache<any>(200, 600000); // Max 200 entries, 10 min default TTL
const STALE_TIME = process.env.NODE_ENV === 'development' ? 2000 : 60000;
const CACHE_TIME = process.env.NODE_ENV === 'development' ? 5000 : 120000;

const activePromises = new Map<string, Promise<any>>();

const getCached = (key: string) => {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < STALE_TIME) {
        return cached.data;
    }
    return null;
};

const setCache = (key: string, data: any) => {
    dataCache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (keyPattern?: string, syncMenu: boolean = true) => {
    // Clear HomepageBuilder cache
    if (!keyPattern) {
        dataCache.clear();
    } else {
        dataCache.deletePattern(keyPattern);
        dataCache.deletePattern('homepage-full-');
    }
    // Clear SpecialsService cache
    SpecialsService.clearCache();
    // Clear MenuService cache as well for full synchronization without recursion
    if (syncMenu) {
        MenuService.clearCache(keyPattern, false);
    }
};

export interface SectionStyleSettings {
    id?: string;
    restaurant_id: string;
    section_name: string;
    page_bg_color?: string;
    card_bg_color?: string;
    section_bg_color?: string;
    border_color?: string;
    title_color?: string;
    subtitle_color?: string;
    button_color?: string;
    button_text_color?: string;
    badge_color?: string;
    title_font_size?: string;
    border_radius?: string;
    padding?: string;
    margin?: string;
    shadow?: string;
    opacity?: string;
    header_alignment?: string;
    header_vertical_alignment?: string;
    header_font?: string;
    header_font_size?: string;
    logo_size?: string;
    header_opacity?: string;
    created_at?: string;
    updated_at?: string;
}

export interface HomepageBanner {
    id?: string;
    restaurant_id?: string;
    title?: string;
    description?: string;
    image_url: string;
    cta_text?: string;
    link?: string;
    order_index?: number;
    active?: boolean;
}

export interface HomepageCategory {
    id?: string;
    restaurant_id?: string;
    name: string;
    image_url: string;
    link?: string;
    order_index?: number;
    active?: boolean;
}


export interface HomepageService {
    id?: string;
    restaurant_id?: string;
    service_title: string;
    service_subtitle?: string;
    service_image?: string;
    service_icon?: string;
    service_key: string;
    display_order?: number;
    active?: boolean;
    countable?: boolean;
    gradient?: string;
    border_class?: string;
    text_class?: string;
}

export interface HomepageSpecial {
    id?: string;
    restaurant_id?: string;
    title: string;
    description: string;
    price: number;
    image_url: string;
    active?: boolean;
    special_type: 'single' | 'combo';
    items?: any[];
    expiry_datetime?: string;
    display_order?: number;
}


export interface HomepageOffer {
    id?: string;
    restaurant_id?: string;
    title: string;
    description: string;
    code: string;
    coupon_code?: string; // for backward compatibility
    discount_type?: 'percentage' | 'flat';
    discount_value?: number;
    banner_image: string;
    image_url?: string; // for compatibility with generic element processing
    end_datetime?: string | null;
    expiry_datetime?: string | null; // for backward compatibility
    active?: boolean;
    status?: 'active' | 'paused' | 'expired';
    applicable_order_type?: 'all' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
}


export interface HomepageSectionVisibility {
    id: string;
    section_type: string;
    active: boolean;
}

export interface HomepageSection {
    id: string;
    restaurant_id?: string;
    section_type?: string;
    type?: string;
    section_title?: string;
    title?: string;
    display_order?: number;
    order?: number;
    active: boolean;
    elements?: any[];
    [key: string]: any;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSection[] = [
    { id: 'sec-header', section_type: 'header', section_title: 'Header', display_order: 1, active: true, layout: {}, elements: [] },
    { id: 'sec-hero_banners', section_type: 'hero_banners', section_title: 'Hero Banners', display_order: 2, active: true, layout: {}, elements: [] },
    { id: 'sec-popular', section_type: 'popular', section_title: 'Popular Items', display_order: 3, active: true, layout: {}, elements: [] },
    { id: 'sec-categories', section_type: 'categories', section_title: 'Categories', display_order: 4, active: true, layout: {}, elements: [] },
    { id: 'sec-services', section_type: 'services', section_title: 'Services', display_order: 5, active: true, layout: {}, elements: [] },
    { id: 'sec-specials', section_type: 'specials', section_title: 'Today Specials', display_order: 6, active: true, layout: {}, elements: [] },
    { id: 'sec-combos', section_type: 'combos', section_title: 'Combo Offers', display_order: 7, active: true, layout: {}, elements: [] },
    { id: 'sec-offers', section_type: 'offers', section_title: 'Coupons & Offers', display_order: 8, active: true, layout: {}, elements: [] },
    { id: 'sec-reorder', section_type: 'reorder', section_title: 'Reorder Section', display_order: 9, active: false, layout: {}, elements: [] },
    { id: 'sec-footer', section_type: 'footer', section_title: 'Footer', display_order: 10, active: true, layout: {}, elements: [] }
];

export interface ThemeSettings {
    primary_button_color?: string;
    secondary_button_color?: string;
    bg_color?: string;
    text_color?: string;
    font_style?: string;
    card_radius?: string;
    webpage_bg_color?: string;
    header_bg_color?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HomepageBuilderService = {
    // Optimized prefetch method
    async prefetchAll(restaurantId: string) {
        try {
            const rid = await resolveRestaurantId(restaurantId);
            // Fire all requests in parallel using allSettled to ensure one failure doesn't block the rest
            const results = await Promise.allSettled([
                this.getSectionStyles(rid),
                this.getBanners(rid),
                this.getCategories(rid),
                this.getServices(rid),
                this.getSpecials(rid, true),
                this.getCombos(rid, true),
                this.getSections(rid)
            ]);

            // Log individual failures as warnings instead of letting the whole prefetch fail
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.warn(`Prefetch sub-task ${index} failed:`, result.reason);
                }
            });
        } catch (err) {
            console.error('Prefetch failed:', err instanceof Error ? err.message : err);
        }
    },

    async getSectionStyles(restaurant_id: string): Promise<Record<string, SectionStyleSettings>> {
        const cacheKey = `styles-${restaurant_id}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('section_style_settings')
            .select(`
                id,
                restaurant_id,
                section_name,
                page_bg_color,
                card_bg_color,
                section_bg_color,
                border_color,
                title_color,
                subtitle_color,
                button_color,
                button_text_color,
                badge_color,
                title_font_size,
                border_radius,
                padding,
                margin,
                shadow,
                opacity,
                header_alignment,
                header_vertical_alignment,
                header_font,
                header_font_size,
                logo_size,
                header_opacity,
                created_at,
                updated_at
            `)
            .eq('restaurant_id', restaurant_id);

        if (error) throw error;
        
        const styles: Record<string, SectionStyleSettings> = {};
        data?.forEach(s => {
            styles[s.section_name] = s as any;
        });

        setCache(cacheKey, styles);
        return styles;
    },

    async saveSectionStyle(style: SectionStyleSettings) {
        // Explicitly pick columns to avoid errors if extra properties exist
        const styleData = {
            restaurant_id: style.restaurant_id,
            section_name: style.section_name,
            page_bg_color: style.page_bg_color,
            card_bg_color: style.card_bg_color,
            section_bg_color: style.section_bg_color,
            border_color: style.border_color,
            title_color: style.title_color,
            subtitle_color: style.subtitle_color,
            button_color: style.button_color,
            button_text_color: style.button_text_color,
            badge_color: style.badge_color,
            title_font_size: style.title_font_size,
            border_radius: style.border_radius,
            padding: style.padding,
            margin: style.margin,
            shadow: style.shadow,
            opacity: style.opacity,
            header_alignment: style.header_alignment,
            header_vertical_alignment: style.header_vertical_alignment,
            header_font: style.header_font,
            header_font_size: style.header_font_size,
            logo_size: style.logo_size,
            header_opacity: style.header_opacity
        };

        const { error } = await supabase
            .from('section_style_settings')
            .upsert(styleData, { onConflict: 'restaurant_id, section_name' });
            
        if (error) throw error;
        clearCache(`styles-${style.restaurant_id}`);
    },
    async ensureSectionsExist(restaurantId: string) {
        if (!restaurantId) return;
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return;

        const expectedSections = [
            { type: 'header', title: 'Header', order: 1 },
            { type: 'hero_banners', title: 'Hero Banners', order: 2 },
            { type: 'categories', title: 'Categories', order: 3 },
            { type: 'services', title: 'Services', order: 4 },
            { type: 'specials', title: 'Today Specials', order: 5 },
            { type: 'combos', title: 'Combo Offers', order: 6 },
            { type: 'offers', title: 'Coupons & Offers', order: 7 },
            { type: 'popular', title: 'Popular Items', order: 8 },
            { type: 'reorder', title: 'Reorder Section', order: 9 },
            { type: 'footer', title: 'Footer', order: 10 }
        ];

        // Fetch all existing sections in one go
        const { data: existingSections, error } = await supabase
            .from('homepage_sections')
            .select('section_type')
            .eq('restaurant_id', rid);
        
        if (error) {
            console.warn('Error checking existing sections:', error?.message || error);
            return;
        }

        const existingTypes = new Set(existingSections?.map(s => s.section_type) || []);
        const toInsert = expectedSections.filter(s => !existingTypes.has(s.type));

        if (toInsert.length > 0) {
            await supabase.from('homepage_sections').insert(
                toInsert.map(s => ({
                    restaurant_id: rid,
                    section_type: s.type,
                    section_title: s.title,
                    display_order: s.order,
                    active: s.type !== 'reorder'
                }))
            );
        }
    },

    async getSections(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `sections-${rid}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        await HomepageBuilderService.ensureSectionsExist(rid);
        const { data, error } = await supabase
            .from('homepage_sections')
            .select('*')
            .eq('restaurant_id', rid)
            .order('display_order', { ascending: true });
        
        if (error) throw error;
        const sections = data || [];
        setCache(cacheKey, sections);
        return sections;
    },

    async getHomepageData(restaurantId: string, tableNumber?: string | number, mode: 'admin' | 'customer' = 'customer') {
        console.count('getHomepageData');
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `homepage-full-${rid}-${tableNumber || 'default'}-${mode}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1500)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('homepage', true, 0);
                return cached.data;
            }
        }

        // 2. Request Deduplication: If same homepage request already running, share it
        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        // 3. React Query behavior (staleTime 300000, cacheTime 600000)
        const cached = dataCache.get(cacheKey);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            if (age < STALE_TIME) {
                // Return fresh cache instantly (0 database queries)
                QueryMonitor.track('homepage', true, 0);
                return cached.data;
            } else if (age < CACHE_TIME) {
                // Return stale cache instantly AND refresh in the background
                QueryMonitor.track('homepage', true, 0);
                const bgFetch = this.executeFetchHomepageData(rid, tableNumber, mode, cacheKey);
                bgFetch.catch(err => console.error('[HomepageBuilderService] Background refresh failed:', err));
                return cached.data;
            }
        }

        // 4. Cache Miss or Completely Expired: Fetch synchronously
        const fetchPromise = this.executeFetchHomepageData(rid, tableNumber, mode, cacheKey);
        return fetchPromise;
    },

    async executeFetchHomepageData(rid: string, tableNumber?: string | number, mode: 'admin' | 'customer' = 'customer', cacheKey?: string): Promise<any> {
        if (!rid) {
            return {
                banners: [],
                categories: [],
                sections: DEFAULT_HOMEPAGE_SECTIONS,
                specials: [],
                combos: [],
                offers: [],
                popularItems: [],
                recentOrders: [],
                theme: {},
                sectionStyles: {},
                services: []
            };
        }

        const activeOnly = mode !== 'admin';
        const promiseKey = cacheKey || `homepage-full-${rid}-${tableNumber || 'default'}-${mode}`;

        if (activePromises.has(promiseKey)) {
            return activePromises.get(promiseKey)!;
        }

        const startTime = Date.now();
        const fetchPromise = (async () => {
            try {
                // Call public.get_homepage_config RPC to get all 9 config modules in a single request,
                // and fetch menu/orders/popular items in parallel.
                const [configRes, popularItemsResult, recentOrdersResult, menuItemsResult] = await Promise.allSettled([
                    supabase.rpc('get_homepage_config', { p_restaurant_id: rid }),
                    this.getPopularItems(rid),
                    tableNumber ? this.getRecentOrders(rid, tableNumber) : Promise.resolve([]),
                    MenuService.fetchMenuItems(rid, undefined, undefined, true)
                ]);

                const config = configRes.status === 'fulfilled' && configRes.value.data ? configRes.value.data : {};
                if (configRes.status === 'rejected' || (configRes.status === 'fulfilled' && configRes.value.error)) {
                    const rpcErr = configRes.status === 'rejected' ? configRes.reason : configRes.value.error;
                    console.warn('[HomepageBuilderService] get_homepage_config RPC returned error:', rpcErr?.message || rpcErr);
                }

                const popularItems = popularItemsResult.status === 'fulfilled' ? popularItemsResult.value : [];
                const recentOrders = recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : [];
                const menuItems = menuItemsResult.status === 'fulfilled' ? menuItemsResult.value : [];

                // Extract and map section styles to Record<string, SectionStyleSettings> format
                const sectionStyles: Record<string, any> = {};
                if (Array.isArray(config.section_styles)) {
                    config.section_styles.forEach((st: any) => {
                        if (st.section_name) {
                            sectionStyles[st.section_name] = st;
                        }
                    });
                }

                // Apply active filters on specials/combos if customer mode
                let specials = config.specials || [];
                let combos = config.combos || [];
                if (activeOnly) {
                    specials = specials.filter((s: any) => s.active);
                    combos = combos.filter((c: any) => c.active);
                }

                let sectionsList = config.sections;
                if (!Array.isArray(sectionsList) || sectionsList.length === 0) {
                    sectionsList = DEFAULT_HOMEPAGE_SECTIONS;
                    this.ensureSectionsExist(rid).catch(err => console.warn('[HomepageBuilderService] ensureSectionsExist background error:', err));
                }

                const rawTheme = config.theme?.row_to_json || config.theme || {};

                const homepageData = {
                    banners: config.banners || [],
                    categories: config.categories || [],
                    services: config.services || [],
                    specials: specials,
                    combos: combos,
                    offers: config.offers || [],
                    popularItems: popularItems || [],
                    recentOrders: recentOrders || [],
                    menuItems: menuItems || [],
                    theme: rawTheme,
                    profile: config.profile || {},
                    sections: sectionsList,
                    sectionStyles: sectionStyles
                };

                // Update cache
                dataCache.set(promiseKey, { data: homepageData, timestamp: Date.now() });

                // Track metrics
                const latency = Date.now() - startTime;
                QueryMonitor.track('homepage', false, latency);

                // Log details for query monitoring
                console.log(`[QUERY_MONITOR] Homepage fetch completed. Restaurant: ${rid}, Table: ${tableNumber || 'none'}. Items: ${menuItems.length}, Orders: ${recentOrders.length}`);

                return homepageData;
            } finally {
                activePromises.delete(promiseKey);
            }
        })();

        activePromises.set(promiseKey, fetchPromise);
        return fetchPromise;
    },

    async getBanners(restaurantId: string): Promise<HomepageBanner[]> {
        // Delegate to BannerService which has no cache and is the source of truth
        const banners = await BannerService.getBanners(restaurantId, false);
        return banners as unknown as HomepageBanner[];
    },



    async updateSectionVisibility(id: string, active: boolean) {
        const { error } = await supabase
            .from('homepage_sections')
            .update({ active })
            .eq('id', id);
        if (error) throw error;
    },
    // saveBanner and deleteBanner removed - handled by BannerService directly in real-time.


    async getCategories(restaurantId: string): Promise<HomepageCategory[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `categories-${rid}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;
        
        // Fetch both builder categories and real categories to establish links
        const [builderRes, mainRes] = await Promise.all([
            supabase
                .from('homepage_categories')
                .select('id, name, image_url, link, active, order_index')
                .eq('restaurant_id', rid)
                .order('order_index', { ascending: true }),
            supabase
                .from('categories')
                .select('id, name, image_url, is_active')
                .eq('restaurant_id', rid)
                .eq('is_active', true)
        ]);

        if (builderRes.error) console.error('Error fetching homepage categories:', builderRes.error);
        if (mainRes.error) console.error('Error fetching real categories:', mainRes.error);

        let finalCats: HomepageCategory[] = [];

        if (builderRes.data && builderRes.data.length > 0) {
            // Map builder categories and try to link them to real categories by name
            finalCats = builderRes.data.map(bc => {
                const match = mainRes.data?.find(rc => rc.name.toLowerCase() === bc.name.toLowerCase());
                return {
                    ...bc,
                    restaurant_id: rid,
                    // If no explicit link is set, use the matched category ID
                    link: bc.link || (match ? match.id.toString() : null)
                } as HomepageCategory;
            });
        } else {
            // Fallback to categories table
            finalCats = (mainRes.data || []).map(cat => ({
                id: cat.id.toString(),
                restaurant_id: rid,
                name: cat.name,
                image_url: cat.image_url,
                active: cat.is_active,
                order_index: 0,
                link: cat.id.toString()
            }));
        }

        // Final Deduplication by name to ensure absolute uniqueness
        const uniqueCats = finalCats.filter((cat, index, self) =>
            index === self.findIndex((c) => c.name === cat.name)
        );

        setCache(cacheKey, uniqueCats);
        return uniqueCats;
    },


    async saveCategory(category: HomepageCategory) {
        const payload: any = {
            restaurant_id: category.restaurant_id,
            name: category.name || '',
            image_url: category.image_url || '',
            link: category.link || '',
            order_index: category.order_index ?? 0,
            active: category.active !== false
        };

        if (category.id && UUID_RE.test(category.id)) {
            payload.id = category.id;
        }

        const { data, error } = await supabase
            .from('homepage_categories')
            .upsert(payload, { onConflict: (payload.id ? 'id' : 'restaurant_id,name') })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error saving homepage category:', error);
            throw error;
        }
        
        if (category.restaurant_id) {
            clearCache(`categories-${category.restaurant_id}`);
        }
        return data;
    },



    async deleteCategory(id: string, restaurantId?: string) {
        if (!UUID_RE.test(id)) return;
        const { error } = await supabase.from('homepage_categories').delete().eq('id', id);
        if (error) throw error;
        if (restaurantId) clearCache(`categories-${restaurantId}`);
        else clearCache('categories-');
    },

    async getServices(restaurantId: string): Promise<HomepageService[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `services-${rid}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        // Try builder-specific table first
        const { data: builderServices, error: bError } = await supabase
            .from('homepage_services')
            .select('id, service_title, service_subtitle, service_image, service_icon, service_key, active, display_order, countable')
            .eq('restaurant_id', rid)
            .order('display_order', { ascending: true });
        
        if (bError) {
            console.error('Error fetching homepage services:', bError.message || bError);
        }

        let finalServices: HomepageService[] = [];

        if (builderServices && builderServices.length > 0) {
            finalServices = builderServices as HomepageService[];
        } else {
            // Fallback to service_options
            const { data: options, error: oError } = await supabase
                .from('service_options')
                .select('*')
                .eq('restaurant_id', rid)
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (oError) throw oError;
            
            // Map to expected format
            finalServices = (options || []).map(opt => ({
                id: opt.id.toString(),
                restaurant_id: rid,
                service_title: opt.label,
                service_subtitle: '',
                active: opt.is_active,
                service_image: opt.image_url,
                service_icon: opt.service_key,
                service_key: opt.service_key,
                display_order: opt.sort_order
            }));
        }

        // Final Deduplication by service_key or service_title
        const uniqueServices = finalServices.filter((s, index, self) =>
            index === self.findIndex((x) => (x.service_key && x.service_key === s.service_key) || (x.service_title === s.service_title))
        );

        setCache(cacheKey, uniqueServices);
        return uniqueServices;
    },


    async saveService(service: HomepageService) {
        const payload: any = {
            restaurant_id: service.restaurant_id,
            service_title: service.service_title || '',
            service_subtitle: service.service_subtitle || '',
            service_icon: service.service_icon || '',
            service_key: service.service_key || '',
            display_order: service.display_order ?? 0,
            active: service.active !== false,
            countable: service.countable ?? false
        };

        if (service.service_image !== undefined) {
            payload.service_image = service.service_image;
        } else {
            payload.service_image = '';
        }

        if (service.id && UUID_RE.test(service.id)) {
            payload.id = service.id;
        }
        
        const { data, error } = await supabase
            .from('homepage_services')
            .upsert(payload, { onConflict: (payload.id ? 'id' : 'restaurant_id,service_title') })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error saving homepage service:', error);
            throw error;
        }
        
        if (service.restaurant_id) {
            clearCache(`services-${service.restaurant_id}`);
        }
        return data;
    },



    async deleteService(id: string, restaurantId?: string) {
        if (!UUID_RE.test(id)) return;
        const { error } = await supabase.from('homepage_services').delete().eq('id', id);
        if (error) throw error;
        if (restaurantId) clearCache(`services-${restaurantId}`);
        else clearCache('services-');
    },

    async getSpecials(restaurantId: string, activeOnly = false) {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `specials-${rid}-${activeOnly}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;
        
        let query = supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('is_today_special', true);
            
        if (activeOnly) {
            query = query.eq('active', true);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[SPECIALS] getSpecials error:', error);
            return [];
        }

        const now = new Date();
        const specials = (data || []).map(item => {
            const isExpired = item.special_expiry_datetime && new Date(item.special_expiry_datetime) <= now;
            const active = item.active && !isExpired;

            return {
                id: item.id,
                restaurant_id: item.restaurant_id,
                title: item.name,
                description: item.description || '',
                price: (item.special_price !== null && item.special_price !== undefined && !isExpired) ? item.special_price : item.price,
                original_price: item.price,
                image_url: item.image_url || '',
                active: active,
                special_type: 'single',
                is_today_special: true,
                special_price: item.special_price,
                special_expiry_datetime: item.special_expiry_datetime,
                items: [{ menu_item: item, quantity: 1, price: item.price }],
                expiry_datetime: item.special_expiry_datetime,
                display_order: item.sort_order || 0
            };
        });

        const filteredSpecials = activeOnly ? specials.filter(s => s.active) : specials;

        setCache(cacheKey, filteredSpecials);
        return filteredSpecials;
    },

    async saveSpecial(special: HomepageSpecial) {
        const rid = await resolveRestaurantId(special.restaurant_id!);
        
        let result;
        const isNumericId = /^\d+$/.test(String(special.id));
        if (isNumericId) {
            const { data, error } = await supabase
                .from('menu_items')
                .update({
                    is_today_special: special.active !== false,
                    special_price: special.price !== undefined ? special.price : (special as any).special_price,
                    special_expiry_datetime: special.expiry_datetime || (special as any).special_expiry_datetime || null
                })
                .eq('id', Number(special.id))
                .eq('restaurant_id', rid)
                .select()
                .maybeSingle();
            if (error) console.error('[HomepageBuilderService] Error updating menu_item special:', error);
            result = data;
        } else if (special.id && UUID_RE.test(special.id)) {
            const success = await SpecialsService.updateSpecial(special.id, rid, {
                title: special.title,
                description: special.description,
                special_price: special.price,
                is_active: special.active,
                valid_to: special.expiry_datetime,
                image_url: special.image_url,
                is_combo: false
            } as any);
            if (success && special.items) {
                await SpecialsService.updateSpecialItems(special.id, rid, special.items);
            }
            result = success ? special : null;
        } else {
            result = await SpecialsService.createSpecial(rid, {
                title: special.title,
                description: special.description,
                special_price: special.price,
                is_combo: false,
                items: special.items || [],
                image_url: special.image_url,
                valid_to: special.expiry_datetime
            });
        }

        if (rid) {
            clearCache(`specials-${rid}`);
        }
        return result;
    },


    async deleteSpecial(id: string, restaurantId?: string) {
        const rid = restaurantId ? await resolveRestaurantId(restaurantId) : '';
        const isNumericId = /^\d+$/.test(String(id));
        if (isNumericId) {
            const { error } = await supabase
                .from('menu_items')
                .update({ is_today_special: false, special_price: null, special_expiry_datetime: null })
                .eq('id', Number(id))
                .eq('restaurant_id', rid);
            if (error) console.error('[HomepageBuilderService] Error removing today special from menu_item:', error);
            if (rid) clearCache(`specials-${rid}`);
            return !error;
        }
        if (!UUID_RE.test(id)) return;
        const success = await SpecialsService.deleteSpecial(id, rid);
        if (success) {
            if (rid) clearCache(`specials-${rid}`);
            else clearCache('specials-');
        }
        return success;
    },

    async getCombos(restaurantId: string, activeOnly = false) {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `combos-${rid}-${activeOnly}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const specials = activeOnly 
            ? await SpecialsService.fetchActiveSpecials(rid)
            : await SpecialsService.fetchAllSpecials(rid);

        const combos = specials
            .filter(s => s.special_type === 'combo' || s.is_combo)
            .map(s => {
                const itemsSum = (s.items || []).reduce((acc: number, it: any) => {
                    const itPrice = Number(it.menu_item?.price || it.price || 0);
                    const itQty = Number(it.quantity || 1);
                    return acc + (itPrice * itQty);
                }, 0);
                const originalPrice = (s.original_price && Number(s.original_price) > 0) ? Number(s.original_price) : itemsSum;

                return {
                    id: s.id,
                    restaurant_id: s.restaurant_id,
                    title: s.title,
                    description: s.description || '',
                    price: Number(s.special_price || (itemsSum > 0 ? itemsSum : s.original_price) || 0),
                    original_price: originalPrice > 0 ? originalPrice : undefined,
                    special_price: s.special_price ? Number(s.special_price) : undefined,
                    image_url: s.image_url || '',
                    active: s.is_active,
                    special_type: 'combo',
                    items: s.items || [],
                    expiry_datetime: s.valid_to,
                    display_order: (s as any).display_order || 0
                };
            });

        setCache(cacheKey, combos);
        return combos;
    },

    async saveCombo(combo: HomepageSpecial) {
        const rid = await resolveRestaurantId(combo.restaurant_id!);
        
        let result;
        if (combo.id && UUID_RE.test(combo.id)) {
            const success = await SpecialsService.updateSpecial(combo.id, rid, {
                title: combo.title,
                description: combo.description,
                special_price: combo.price,
                is_active: combo.active,
                valid_to: combo.expiry_datetime,
                image_url: combo.image_url,
                is_combo: true
            } as any);
            if (success && combo.items) {
                await SpecialsService.updateSpecialItems(combo.id, rid, combo.items);
            }
            result = success ? combo : null;
        } else {
            result = await SpecialsService.createSpecial(rid, {
                title: combo.title,
                description: combo.description,
                special_price: combo.price,
                is_combo: true,
                items: combo.items || [],
                image_url: combo.image_url,
                valid_to: combo.expiry_datetime
            });
        }

        if (rid) {
            clearCache(`specials-${rid}`);
            clearCache(`combos-${rid}`);
        }
        return result;
    },


    async deleteCombo(id: string, restaurantId?: string) {
        if (!UUID_RE.test(id)) return;
        const rid = restaurantId ? await resolveRestaurantId(restaurantId) : '';
        const success = await SpecialsService.deleteSpecial(id, rid);
        if (success) {
            if (rid) {
                clearCache(`specials-${rid}`);
                clearCache(`combos-${rid}`);
            } else {
                clearCache('specials-');
                clearCache('combos-');
            }
        }
        return success;
    },

    async getOffers(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `offers-${rid}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('restaurant_id', rid)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const uniqueOffers = (data || []).filter((o, index, self) =>
            index === self.findIndex((x) => (x.code && x.code === o.code) || (x.title === o.title))
        );
        
        setCache(cacheKey, uniqueOffers);
        return uniqueOffers;
    },

    async saveOffer(offer: HomepageOffer) {
        const rid = await resolveRestaurantId(offer.restaurant_id!);
        const generatedCode = offer.code || (offer as any).coupon_code || `OFFER_${(offer.id || Math.random().toString(36)).slice(0, 6).toUpperCase()}`;
        
        const payload: any = {
            restaurant_id: rid,
            title: offer.title || 'Special Offer',
            description: offer.description || '',
            code: generatedCode,
            discount_type: offer.discount_type || 'percentage',
            discount_value: offer.discount_value ?? 10,
            end_datetime: offer.end_datetime || (offer as any).expiry_datetime || null,
            image_url: offer.image_url || (offer as any).banner_image || '',
            active: offer.active !== false,
            status: offer.status || (offer.active === false ? 'paused' : 'active'),
            applicable_order_type: offer.applicable_order_type || 'all'
        };

        if (offer.id && UUID_RE.test(offer.id)) {
            payload.id = offer.id;
        }

        const { data, error } = await supabase
            .from('offers')
            .upsert(payload, { onConflict: (payload.id ? 'id' : 'restaurant_id,code') })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error saving homepage offer:', error);
            throw error;
        }
        
        clearCache(`offers-${rid}`);
        return data;
    },


    async deleteOffer(id: string, restaurantId?: string) {
        if (!UUID_RE.test(id)) return;
        const { error } = await supabase.from('offers').delete().eq('id', id);
        if (error) throw error;
        if (restaurantId) clearCache(`offers-${restaurantId}`);
        else clearCache('offers-');
    },

    async getTheme(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_theme')
            .select('*')
            .eq('restaurant_id', rid)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async saveTheme(restaurantId: string, theme: any) {
        const rid = await resolveRestaurantId(restaurantId);
        if (!theme) return;
        
        // Map camelCase to snake_case for the database
        const dbTheme = {
            primary_button_color: theme.primary_button_color || theme.primaryColor || theme.button_color || '#f97316',
            secondary_button_color: theme.secondary_button_color || theme.secondaryColor || '#000000',
            bg_color: theme.bg_color || theme.backgroundColor || '#ffffff',
            font_style: theme.font_style || theme.fontFamily || theme.font_family || 'Inter',
            card_radius: theme.card_radius || theme.cardRadius || '16px',
            webpage_bg_color: theme.webpage_bg_color || '#ffffff',
            header_bg_color: theme.header_bg_color || '#ffffff',
        };

        const { data: existing } = await supabase
            .from('restaurant_theme')
            .select('id')
            .eq('restaurant_id', rid)
            .maybeSingle();
        
        if (existing) {
            const { error } = await supabase.from('restaurant_theme').update(dbTheme).eq('restaurant_id', rid);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('restaurant_theme').insert([{ ...dbTheme, restaurant_id: rid }]);
            if (error) throw error;
        }
        clearCache(`theme-${rid}`);
    },

    async getProfile(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('*')
            .eq('restaurant_id', rid)
            .maybeSingle();
        if (error) throw error;
        
        if (data) {
            const info = data.restaurant_info || {};
            const rawAddress = info.address || data.address;
            const formatted = formatAddress(rawAddress);
            return {
                ...data,
                ...info,
                address: formatted || (typeof data.address === 'string' ? data.address : ''),
                raw_address: rawAddress,
                logo_url: info.logo_url || data.logo_url || ''
            };
        }

        // Resilient fallback to restaurants table for newly registered tenants
        const { data: rest } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', rid)
            .maybeSingle();
        if (rest) {
            const formatted = formatAddress(rest.address);
            return {
                restaurant_id: rid,
                name: rest.name,
                logo_url: rest.logo_url || '',
                address: formatted,
                raw_address: rest.address,
                phone: rest.phone,
                email: rest.email,
                operating_hours: rest.operating_hours
            };
        }
        return null;
    },

    async updateProfile(restaurantId: string, profile: any) {
        const rid = await resolveRestaurantId(restaurantId);
        if (!profile) return;
        
        const updateData = { ...profile };
        
        // Get current profile to preserve other restaurant_info fields
        const { data: current } = await supabase
            .from('restaurant_profile')
            .select('restaurant_info, name, address, phone, email')
            .eq('restaurant_id', rid)
            .maybeSingle();
        
        const restaurantInfo = { ...(current?.restaurant_info || {}) };
        
        // Fields to move into restaurant_info instead of base table columns
        const fieldsToNest = ['logo_url', 'footer_info', 'instagram_url', 'facebook_url', 'twitter_url', 'website', 'copyright', 'tagline'];
        
        fieldsToNest.forEach(field => {
            if (field in updateData && updateData[field] !== undefined) {
                restaurantInfo[field] = updateData[field];
            }
        });

        if (updateData.restaurant_info && typeof updateData.restaurant_info === 'object') {
            Object.assign(restaurantInfo, updateData.restaurant_info);
        }

        // Define valid columns for restaurant_profile table to prevent schema errors
        const validColumns = [
            'name', 'opening_time', 'closing_time', 'address', 'phone', 
            'email', 'gst_number', 'tax_percentage', 'meta_info', 
            'slug', 'business_type'
        ];

        const filteredUpdate: any = { 
            restaurant_id: rid,
            restaurant_info: restaurantInfo,
            last_updated: new Date().toISOString()
        };

        validColumns.forEach(col => {
            if (col in updateData && updateData[col] !== undefined) {
                filteredUpdate[col] = updateData[col];
            }
        });

        // Also sync restaurant name to restaurants table
        if (filteredUpdate.name) {
            await supabase.from('restaurants').update({ name: filteredUpdate.name }).eq('id', rid);
        }

        // Use upsert with onConflict on restaurant_id
        const { error } = await supabase.from('restaurant_profile').upsert(filteredUpdate, { onConflict: 'restaurant_id' });
        if (error) {
            console.error('[HomepageBuilderService] Error updating restaurant_profile:', error);
            throw error;
        }
        clearCache(`profile-${rid}`);
    },
    async getThemeSettings(restaurantId: string) {
        return HomepageBuilderService.getTheme(restaurantId);
    },

    async saveThemeSettings(restaurantId: string, settings: any) {
        return HomepageBuilderService.saveTheme(restaurantId, settings);
    },

    async initializeDefaultSections(restaurantId: string) {
        await HomepageBuilderService.ensureSectionsExist(restaurantId);
        return HomepageBuilderService.getSections(restaurantId);
    },

    async saveAllSections(restaurantId: string, sections: any[]) {
        if (!sections || !Array.isArray(sections)) return;
        const rid = await resolveRestaurantId(restaurantId);
        
        for (let i = 0; i < sections.length; i++) {
            const s = sections[i];
            const sectionType = s.section_type || s.type;
            if (!sectionType) continue;

            const payload: any = {
                restaurant_id: rid,
                section_type: sectionType,
                section_title: s.section_title || s.title || sectionType,
                section_subtitle: s.section_subtitle || s.subtitle || '',
                display_order: s.display_order ?? s.order ?? (i + 1),
                active: s.active !== false,
                layout: s.layout || {},
                elements: s.elements || []
            };

            if (s.id && UUID_RE.test(s.id)) {
                payload.id = s.id;
            }

            const { error } = await supabase
                .from('homepage_sections')
                .upsert(payload, { onConflict: 'restaurant_id,section_type' });
                
            if (error) {
                console.error(`[HomepageBuilderService] saveAllSections error for ${sectionType}:`, error);
            }
        }
        clearCache(`sections-${rid}`);
    },

    // Legacy support aliases
    async getCategoryButtons(restaurantId: string) {
        return HomepageBuilderService.getCategories(restaurantId);
    },

    async getQuickActions(restaurantId: string) {
        return HomepageBuilderService.getServices(restaurantId);
    },

    async getPopularItems(restaurantId: string, limit: number = 10) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('menu_items')
            .select('id, category_id, sub_category_id, name, description, price, image_url, is_available, item_type, is_veg, sort_order, preparation_time, tax_percent, restaurant_id, menu_item_type, price_variants, stock_ml, is_popular, active, rating, is_today_special, special_price, special_expiry_datetime')
            .eq('restaurant_id', rid)
            .eq('is_popular', true)
            .eq('active', true)
            .order('rating', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    async getRecentOrders(restaurantId: string, tableNumber: string | number) {
        const rid = await resolveRestaurantId(restaurantId);
        const physicalTable = await OrderService.findTableAnywhere(tableNumber, rid);
        
        let query = supabase
            .from('orders')
            .select(`
                id,
                created_at,
                status,
                total_amount,
                discount_amount,
                coupon_code,
                table_id,
                restaurant_id,
                order_items (
                    id,
                    order_id,
                    menu_item_id,
                    quantity,
                    price_at_time,
                    status,
                    item_type,
                    combo_name,
                    combo_image,
                    combo_items,
                    menu_items!order_items_menu_item_id_restaurant_fkey (
                        name,
                        image_url
                    )
                )
            `)
            .eq('restaurant_id', rid);

        if (physicalTable) {
            if (physicalTable.merged_group_id) {
                query = query.or(`table_id.eq.${physicalTable.id},merge_group_id.eq.${physicalTable.merged_group_id}`);
            } else {
                query = query.eq('table_id', physicalTable.id);
            }
        } else {
            if (/^\d+$/.test(String(tableNumber))) {
                query = query.eq('table_id', Number(tableNumber));
            }
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        
        const mappedData = data?.map((order: any) => ({
            ...order,
            items: order.order_items?.map((item: any) => {
                const mi = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                return {
                    ...item,
                    name: item.combo_name || mi?.name || item.name || item.item_name || (item.item_type === 'combo' ? 'Combo' : (item.item_type === 'special' ? 'Special' : `Item #${item.menu_item_id || item.id}`)),
                    image_url: item.combo_image || mi?.image_url || item.image_url,
                    price: item.price_at_time
                };
            }) || []
        })) || [];
        return mappedData;
    },

    async initializeDefaultServices(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        
        // Check if services already exist to avoid duplicates
        const { count, error: countError } = await supabase
            .from('homepage_services')
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', rid);
            
        if (countError) {
            console.error('Error checking existing services:', countError);
        }
        
        if (count && count > 0) return; // Already initialized

        const defaultServices: Omit<HomepageService, 'restaurant_id'>[] = [
            { 
                service_title: 'Call Waiter', 
                service_subtitle: 'Quick assistance', 
                service_key: 'call_waiter', 
                service_icon: 'HandPlatter', 
                service_image: '/services/Waiter.webm',
                display_order: 1, 
                active: true, 
                gradient: 'from-orange-400/20 to-orange-600/20', 
                border_class: 'border-orange-200/50', 
                text_class: 'text-orange-900' 
            },
            { 
                service_title: 'Request Bill', 
                service_subtitle: 'Ready to pay', 
                service_key: 'bill_requested', 
                service_icon: 'Receipt', 
                service_image: '/services/Bill.png',
                display_order: 2, 
                active: true, 
                gradient: 'from-emerald-400/20 to-emerald-600/20', 
                border_class: 'border-emerald-200/50', 
                text_class: 'text-emerald-900' 
            },
            { 
                service_title: 'Water', 
                service_subtitle: 'Fresh water', 
                service_key: 'water_requested', 
                service_icon: 'GlassWater', 
                service_image: '/services/Water.png',
                display_order: 3, 
                active: true, 
                gradient: 'from-cyan-400/20 to-cyan-600/20', 
                border_class: 'border-cyan-200/50', 
                text_class: 'text-cyan-900' 
            },
            { 
                service_title: 'Cutlery', 
                service_subtitle: 'Spoons, Forks', 
                service_key: 'cutlery_requested', 
                service_icon: 'Utensils', 
                service_image: '/services/Cutlery.webp',
                display_order: 4, 
                active: true, 
                gradient: 'from-orange-400/20 to-orange-600/20', 
                border_class: 'border-orange-200/50', 
                text_class: 'text-orange-900' 
            },
            { 
                service_title: 'Extra Glass', 
                service_subtitle: 'Clean glasses', 
                service_key: 'glass_requested', 
                service_icon: 'GlassWater', 
                service_image: '/services/Glass.jpg',
                display_order: 5, 
                active: true, 
                gradient: 'from-neutral-400/20 to-neutral-600/20', 
                border_class: 'border-neutral-200/50', 
                text_class: 'text-neutral-900' 
            },
            { 
                service_title: 'Straw', 
                service_subtitle: 'Drinking straws', 
                service_key: 'straw_requested', 
                service_icon: 'Pipette', 
                service_image: '/services/Straw.png',
                display_order: 6, 
                active: true, 
                gradient: 'from-yellow-400/20 to-yellow-600/20', 
                border_class: 'border-yellow-200/50', 
                text_class: 'text-yellow-900' 
            },
            { 
                service_title: 'Extra Plate', 
                service_subtitle: 'Additional plates', 
                service_key: 'plate_requested', 
                service_icon: 'Disc', 
                service_image: '/services/Plate.png',
                display_order: 7, 
                active: true, 
                gradient: 'from-neutral-400/20 to-neutral-600/20', 
                border_class: 'border-neutral-200/50', 
                text_class: 'text-neutral-900' 
            },
            { 
                service_title: 'Finger Bowl', 
                service_subtitle: 'Warm water', 
                service_key: 'bowl_requested', 
                service_icon: 'Soup', 
                service_image: '/services/Finger bowl.jpg',
                display_order: 8, 
                active: true, 
                gradient: 'from-amber-400/20 to-amber-600/20', 
                border_class: 'border-amber-200/50', 
                text_class: 'text-amber-900' 
            },
            { 
                service_title: 'Salt', 
                service_subtitle: 'Extra salt', 
                service_key: 'salt_requested', 
                service_icon: 'GripHorizontal', 
                service_image: '/services/Salt.jpg',
                display_order: 9, 
                active: true, 
                gradient: 'from-neutral-100/40 to-neutral-300/40', 
                border_class: 'border-neutral-300/50', 
                text_class: 'text-neutral-900' 
            },
            { 
                service_title: 'Pepper', 
                service_subtitle: 'Extra pepper', 
                service_key: 'pepper_requested', 
                service_icon: 'Wind', 
                service_image: '/services/Pepper.jpg',
                display_order: 10, 
                active: true, 
                gradient: 'from-neutral-800/10 to-neutral-900/20', 
                border_class: 'border-neutral-800/20', 
                text_class: 'text-neutral-900' 
            },
            { 
                service_title: 'Ketchup', 
                service_subtitle: 'Tomato sauce', 
                service_key: 'sauce_requested', 
                service_icon: 'Droplet', 
                service_image: '/services/Ketchup.jpg',
                display_order: 11, 
                active: true, 
                gradient: 'from-red-400/20 to-red-600/20', 
                border_class: 'border-red-200/50', 
                text_class: 'text-red-900' 
            },
            { 
                service_title: 'Tissue', 
                service_subtitle: 'Paper napkins', 
                service_key: 'tissue_requested', 
                service_icon: 'Square', 
                display_order: 12, 
                active: true, 
                gradient: 'from-neutral-100/40 to-neutral-200/40', 
                border_class: 'border-neutral-200/50', 
                text_class: 'text-neutral-900' 
            }
        ];

        for (const service of defaultServices) {
            await this.saveService({ ...service, restaurant_id: rid } as HomepageService);
        }
    },
    async subscribeToProfile(restaurantId: string, onChange: (payload: any) => void) {
        const rid = await resolveRestaurantId(restaurantId);
        const channel = supabase
            .channel(`profile-${rid}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'restaurant_profile',
                    filter: `restaurant_id=eq.${rid}`
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;
                    if (rec.restaurant_id != null && String(rec.restaurant_id) !== String(rid)) return;
                    onChange(payload);
                }
            )
            .subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    async subscribeToTheme(restaurantId: string, onChange: (payload: any) => void) {
        const rid = await resolveRestaurantId(restaurantId);
        const channel = supabase
            .channel(`theme-${rid}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'restaurant_theme',
                    filter: `restaurant_id=eq.${rid}`
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;
                    if (rec.restaurant_id != null && String(rec.restaurant_id) !== String(rid)) return;
                    onChange(payload);
                }
            )
            .subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    async subscribeToSections(restaurantId: string, onChange: (payload: any) => void) {
        const rid = await resolveRestaurantId(restaurantId);
        const channel = supabase
            .channel(`sections-${rid}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'homepage_sections',
                    filter: `restaurant_id=eq.${rid}`
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;
                    if (rec.restaurant_id != null && String(rec.restaurant_id) !== String(rid)) return;
                    onChange(payload);
                }
            )
            .subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },


    async saveFullState(restaurantId: string, state: any) {
        const rid = await resolveRestaurantId(restaurantId);
        console.log(`[HomepageBuilderService] saveFullState: starting for restaurant ${rid}`);
        
        // Clear cache before starting to ensure we fetch fresh data for reconciliation
        clearCache(rid);
        dataCache.clear();
        activePromises.clear();
        
        // 1. Save Theme
        if (state.theme) {
            await HomepageBuilderService.saveTheme(rid, state.theme);
        }
        
        // 2. Save Section Visibility, Order, Layout, Elements
        if (state.sections && state.sections.length > 0) {
            await HomepageBuilderService.saveAllSections(rid, state.sections);
        }

        // 3. Save Profile (Name, Address, Logo, Tagline, Footer)
        if (state.profile) {
            await HomepageBuilderService.updateProfile(rid, state.profile);
        }

        // Helper: reconcile DB items vs state items — delete removed, upsert remaining
        const reconcile = async (
            section: string,
            fetchFn: () => Promise<any[]>,
            saveFn: (item: any) => Promise<any>,
            deleteFn: (id: string, rid?: string) => Promise<any>
        ) => {
            console.log(`[HomepageBuilderService] reconcile start: ${section}`);
            
            // Priority 1: Use flat state.data[section] (which is what SharedHomepageLayout directly mutates)
            let stateItems: any[] = [];
            if (Array.isArray(state.data?.[section])) {
                stateItems = state.data[section];
            } else {
                // Priority 2: Extract from sections if state.data is not present
                const sectionTypeMapping: Record<string, string> = {
                    'banners': 'hero_banners',
                    'categories': 'categories',
                    'services': 'services',
                    'offers': 'offers',
                    'specials': 'specials',
                    'combos': 'combos'
                };
                
                const targetSectionType = sectionTypeMapping[section];
                const sectionFromBuilder = state.sections?.find((s: any) => s.section_type === targetSectionType || s.type === targetSectionType);
                
                if (sectionFromBuilder && sectionFromBuilder.elements && sectionFromBuilder.elements.length > 0) {
                    stateItems = sectionFromBuilder.elements.map((el: any) => ({
                        id: el.id,
                        order_index: el.order ?? 0,
                        active: el.visible !== false,
                        ...el.content
                    }));
                }
            }

            console.log(`[HomepageBuilderService] reconcile ${section}: items to save:`, stateItems.length);

            let dbItems: any[] = [];
            try {
                dbItems = await fetchFn();
            } catch (e) {
                console.warn(`[HomepageBuilderService] Failed to fetch existing ${section} for reconciliation:`, e);
            }
            
            // Delete items that are in DB but NOT in current state
            const stateIds = new Set(stateItems.map((item: any) => String(item.id)));
            for (const dbItem of dbItems) {
                if (dbItem.id && !stateIds.has(String(dbItem.id))) {
                    console.log(`[HomepageBuilderService] reconcile ${section}: deleting orphaned item ${dbItem.id}`);
                    try {
                        await deleteFn(String(dbItem.id), rid);
                    } catch (e) {
                        console.warn(`[HomepageBuilderService] Failed to delete ${section} item ${dbItem.id}:`, e);
                    }
                }
            }
            
            // Save (upsert) remaining items
            for (const item of stateItems) {
                try {
                    await saveFn({ ...item, restaurant_id: rid });
                } catch (err) {
                    console.error(`[Reconcile] Error saving ${section} item:`, item, err);
                }
            }
        };
        
        // 4. Save Banners
        if (Array.isArray(state.data?.banners) && state.data.banners.length > 0) {
            await BannerService.reconcileBanners(rid, state.data.banners);
        }
        
        // 5. Save Categories
        await reconcile(
            'categories',
            () => HomepageBuilderService.getCategories(rid),
            (item) => HomepageBuilderService.saveCategory(item),
            (id) => HomepageBuilderService.deleteCategory(id, rid)
        );
        
        // 6. Save Services
        await reconcile(
            'services',
            () => HomepageBuilderService.getServices(rid),
            (item) => HomepageBuilderService.saveService(item),
            (id) => HomepageBuilderService.deleteService(id, rid)
        );

        // 7. Save Specials
        await reconcile(
            'specials',
            () => HomepageBuilderService.getSpecials(rid),
            (item) => HomepageBuilderService.saveSpecial(item),
            (id) => HomepageBuilderService.deleteSpecial(id, rid)
        );

        // 8. Save Combos
        await reconcile(
            'combos',
            () => HomepageBuilderService.getCombos(rid),
            (item) => HomepageBuilderService.saveCombo(item),
            (id) => HomepageBuilderService.deleteCombo(id, rid)
        );

        // 9. Save Offers
        await reconcile(
            'offers',
            () => HomepageBuilderService.getOffers(rid),
            (item) => HomepageBuilderService.saveOffer(item),
            (id) => HomepageBuilderService.deleteOffer(id, rid)
        );

        // 10. Save Section Styles
        if (state.data?.sectionStyles) {
            for (const sectionName of Object.keys(state.data.sectionStyles)) {
                const style = state.data.sectionStyles[sectionName];
                if (style) {
                    await HomepageBuilderService.saveSectionStyle({ ...style, restaurant_id: rid, section_name: sectionName });
                }
            }
        }

        // 11. Clear all caches for this restaurant to ensure immediate publication
        clearCache(rid);
        dataCache.clear();
        activePromises.clear();
        console.log(`[HomepageBuilderService] saveFullState: completed successfully for restaurant ${rid}`);
    },

    async subscribeToAll(restaurantId: string, onUpdate: (table: string, payload: any) => void) {
        const rid = await resolveRestaurantId(restaurantId);
        const tables = [
            'restaurant_profile',
            'restaurant_theme',
            'homepage_sections',
            'homepage_banners',
            'homepage_categories',
            'homepage_services',
            'homepage_specials',  // Also contains combos (special_type='combo')
            'offers',
            'section_style_settings',
            'menu_items',
            'categories',
            'sub_categories'
        ];

        const channels = tables.map(table => {
            return supabase
                .channel(`${table}-${rid}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table, filter: `restaurant_id=eq.${rid}` },
                    (payload) => {
                        const rec = (payload.new || payload.old) as any;
                        if (!rec) return;
                        if (rec.restaurant_id != null) {
                            if (String(rec.restaurant_id) !== String(rid)) return;
                        } else if (payload.eventType !== 'DELETE') {
                            return;
                        }
                        // Clear cache on any change to ensure fresh data
                        clearCache(rid);
                        onUpdate(table, payload);
                    }
                )
                .subscribe();
        });

        return {
            unsubscribe: () => {
                channels.forEach(channel => supabase.removeChannel(channel));
            }
        };
    }
};

export { HomepageBuilderService };
export default HomepageBuilderService;
