import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from './utils';
import { MenuService } from './menu';
import { BannerService } from './banner.service';
import { SpecialsService } from './specials.service';

const supabase = createClient();

// In-memory cache for homepage data
const dataCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key: string) => {
    const cached = dataCache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
};

const setCache = (key: string, data: any) => {
    dataCache[key] = { data, timestamp: Date.now() };
};

export const clearCache = (keyPattern?: string) => {
    // Clear HomepageBuilder cache
    if (!keyPattern) {
        Object.keys(dataCache).forEach(key => delete dataCache[key]);
    } else {
        Object.keys(dataCache).forEach(key => {
            if (key.includes(keyPattern)) delete dataCache[key];
        });
    }
    // Clear MenuService cache as well for full synchronization
    MenuService.clearCache(keyPattern);
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
        const rid = await resolveRestaurantId(restaurantId);
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
            console.error('Error checking existing sections:', error);
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
                    active: true
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
        const rid = await resolveRestaurantId(restaurantId);
        const activeOnly = mode !== 'admin'; // Admin sees all items, customer sees only active
        const results = await Promise.allSettled([
            this.getBanners(rid),
            this.getCategories(rid),
            this.getServices(rid),
            this.getSpecials(rid, activeOnly),
            this.getCombos(rid, activeOnly),
            this.getOffers(rid),
            this.getPopularItems(rid),
            tableNumber ? this.getRecentOrders(rid, tableNumber) : Promise.resolve([]),
            MenuService.fetchMenuItems(rid),
            this.getTheme(rid),
            this.getProfile(rid),
            this.getSections(rid),
            this.getSectionStyles(rid)
        ]);

        const banners = results[0].status === 'fulfilled' ? results[0].value : [];
        const categories = results[1].status === 'fulfilled' ? results[1].value : [];
        const services = results[2].status === 'fulfilled' ? results[2].value : [];
        const specials = results[3].status === 'fulfilled' ? results[3].value : [];
        const combos = results[4].status === 'fulfilled' ? results[4].value : [];
        const offers = results[5].status === 'fulfilled' ? results[5].value : [];
        const popularItems = results[6].status === 'fulfilled' ? results[6].value : [];
        const recentOrders = results[7].status === 'fulfilled' ? results[7].value : [];
        const menuItems = results[8].status === 'fulfilled' ? results[8].value : [];
        const theme = results[9].status === 'fulfilled' ? results[9].value : {};
        const profile = results[10].status === 'fulfilled' ? results[10].value : {};
        const sections = results[11].status === 'fulfilled' ? results[11].value : [];
        const sectionStyles = results[12].status === 'fulfilled' ? results[12].value : {};

        // Log errors for failed sections
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const sectionNames = [
                    'banners', 'categories', 'services', 'specials', 'combos', 
                    'offers', 'popularItems', 'recentOrders', 'menuItems', 
                    'theme', 'profile', 'sections', 'sectionStyles'
                ];
                console.error(`[HomepageBuilderService] Section "${sectionNames[index]}" failed to load:`, result.reason);
            }
        });

        return {
            banners: banners || [],
            categories: categories || [],
            services: services || [],
            specials: specials || [],
            combos: combos || [],
            offers: offers || [],
            popularItems: popularItems || [],
            recentOrders: recentOrders || [],
            menuItems: menuItems || [],
            theme: theme || {},
            profile: profile || {},
            sections: sections || [],
            sectionStyles: sectionStyles || {}
        };
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
        
        const specials = activeOnly 
            ? await SpecialsService.fetchActiveSpecials(rid)
            : await SpecialsService.fetchAllSpecials(rid);

        // Filter for 'single' type if needed (Today Specials usually are 'single')
        const filteredSpecials = specials
            .filter(s => s.special_type !== 'combo')
            .map(s => ({
                id: s.id,
                restaurant_id: s.restaurant_id,
                title: s.title,
                description: s.description || '',
                price: s.special_price || s.original_price || 0,
                image_url: s.image_url || '',
                active: s.is_active,
                special_type: 'single',
                items: s.items || [],
                expiry_datetime: s.valid_to,
                display_order: (s as any).display_order || 0
            }));

        setCache(cacheKey, filteredSpecials);
        return filteredSpecials;
    },

    async saveSpecial(special: HomepageSpecial) {
        const rid = await resolveRestaurantId(special.restaurant_id!);
        
        let result;
        if (special.id && UUID_RE.test(special.id)) {
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
        if (!UUID_RE.test(id)) return;
        const rid = restaurantId ? await resolveRestaurantId(restaurantId) : '';
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
            .map(s => ({
                id: s.id,
                restaurant_id: s.restaurant_id,
                title: s.title,
                description: s.description || '',
                price: s.special_price || s.original_price || 0,
                image_url: s.image_url || '',
                active: s.is_active,
                special_type: 'combo',
                items: s.items || [],
                expiry_datetime: s.valid_to,
                display_order: (s as any).display_order || 0
            }));

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
        
        const offers = (data || []).map((o: any) => {
            const discountLabel = o.discount_type === 'flat' ? `₹${o.discount_value}` : `${o.discount_value}%`;
            
            return {
                id: o.id,
                restaurant_id: o.restaurant_id,
                title: o.title || `${discountLabel} OFF`,
                description: o.description || `Get ${discountLabel} discount using code ${o.code || 'PROMO'} on your order.`,
                code: o.code || '',
                coupon_code: o.code || '',
                discount_type: o.discount_type || 'percentage',
                discount_value: o.discount_value || 0,
                banner_image: o.image_url || '',
                end_datetime: o.end_datetime || o.expiry || null,
                expiry_datetime: o.end_datetime || o.expiry || null,
                active: o.active ?? (o.status === 'active'),
                status: o.status || 'active'
            };
        });
        
        // Final Deduplication by title or code
        const uniqueOffers = offers.filter((o, index, self) =>
            index === self.findIndex((x) => (x.code && x.code === o.code) || (x.title === o.title))
        );
        
        setCache(cacheKey, uniqueOffers);
        return uniqueOffers;
    },

    async saveOffer(offer: HomepageOffer) {
        const rid = await resolveRestaurantId(offer.restaurant_id!);
        
        const payload: any = {
            restaurant_id: rid,
            title: offer.title || '',
            description: offer.description || '',
            code: offer.code || offer.coupon_code || '',
            discount_type: offer.discount_type || 'percentage',
            discount_value: offer.discount_value ?? 0,
            end_datetime: offer.end_datetime || offer.expiry_datetime,
            image_url: offer.image_url || offer.banner_image || '',
            active: offer.active !== false,
            status: offer.status || (offer.active === false ? 'paused' : 'active')
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
        
        // Map camelCase to snake_case for the database
        const dbTheme = {
            primary_button_color: theme.primary_button_color || theme.primaryColor,
            secondary_button_color: theme.secondary_button_color || theme.secondaryColor,
            bg_color: theme.bg_color || theme.backgroundColor,
            font_style: theme.font_style || theme.fontFamily,
            card_radius: theme.card_radius || theme.cardRadius,
            webpage_bg_color: theme.webpage_bg_color,
            header_bg_color: theme.header_bg_color,
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
    },

    async getProfile(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('*')
            .eq('restaurant_id', rid)
            .maybeSingle();
        if (error) throw error;
        
        if (data && data.restaurant_info) {
            return {
                ...data,
                ...data.restaurant_info
            };
        }
        return data;
    },

    async updateProfile(restaurantId: string, profile: any) {
        const rid = await resolveRestaurantId(restaurantId);
        
        // Handle fields by nesting them in restaurant_info if present
        const updateData = { ...profile };
        
        // Get current profile to preserve other restaurant_info fields
        const { data: current } = await supabase
            .from('restaurant_profile')
            .select('restaurant_info')
            .eq('restaurant_id', rid)
            .maybeSingle();
        
        const restaurantInfo = { ...(current?.restaurant_info || {}) };
        let hasChanges = false;

        // Fields to move into restaurant_info instead of base table columns
        const fieldsToNest = ['logo_url', 'footer_info', 'instagram_url', 'facebook_url', 'twitter_url', 'website', 'copyright'];
        
        fieldsToNest.forEach(field => {
            if (field in updateData) {
                restaurantInfo[field] = updateData[field];
                delete updateData[field];
                hasChanges = true;
            }
        });

        // Always update restaurant_info if we have nested fields or if it was already in updateData
        if (hasChanges || 'restaurant_info' in updateData) {
            updateData.restaurant_info = restaurantInfo;
        }

        // Define valid columns for restaurant_profile table to prevent schema errors
        const validColumns = [
            'name', 'opening_time', 'closing_time', 'address', 'phone', 
            'email', 'gst_number', 'tax_percentage', 'meta_info', 
            'restaurant_info', 'slug', 'business_type'
        ];

        // Ensure restaurant_id is included for upsert
        const filteredUpdate: any = { restaurant_id: rid };
        validColumns.forEach(col => {
            if (col in updateData) {
                filteredUpdate[col] = updateData[col];
            }
        });

        // Use upsert to handle cases where the profile doesn't exist yet
        const { error } = await supabase.from('restaurant_profile').upsert(filteredUpdate);
        if (error) throw error;
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
        for (const s of sections) {
            const payload: any = {
                restaurant_id: restaurantId,
                section_type: s.section_type || 'custom',
                section_title: s.section_title || s.title,
                section_subtitle: s.section_subtitle || s.subtitle,
                display_order: s.display_order || 0,
                active: s.active,
                layout: s.layout,
                elements: s.elements
            };

            if (s.id && UUID_RE.test(s.id)) {
                payload.id = s.id;
            }

            await supabase
                .from('homepage_sections')
                .upsert(payload, { onConflict: 'restaurant_id,section_type' });
        }
    },

    // Legacy support aliases
    async getCategoryButtons(restaurantId: string) {
        return HomepageBuilderService.getCategories(restaurantId);
    },

    async getQuickActions(restaurantId: string) {
        return HomepageBuilderService.getServices(restaurantId);
    },

    async getPopularItems(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('is_popular', true)
            .eq('active', true)
            .order('rating', { ascending: false })
            .limit(10);
        if (error) throw error;
        return data || [];
    },

    async getRecentOrders(restaurantId: string, tableNumber: string | number) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                )
            `)
            .eq('restaurant_id', rid)
            .order('created_at', { ascending: false })
            .limit(5);
        if (error) throw error;
        return data || [];
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
                service_image: '/services/Waiter.png',
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
                (payload) => onChange(payload)
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
                (payload) => onChange(payload)
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
                (payload) => onChange(payload)
            )
            .subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },


    async saveFullState(restaurantId: string, state: any) {
        const rid = await resolveRestaurantId(restaurantId);
        console.log(`[HomepageBuilderService] saveFullState: starting for restaurant ${rid}`);
        
        // Clear cache before starting to ensure we fetch fresh data for reconciliation
        clearCache(rid);
        
        // 1. Save Theme
        await HomepageBuilderService.saveTheme(rid, state.theme);
        
        // 2. Save Section Visibility
        await HomepageBuilderService.saveAllSections(rid, state.sections);

        // 2b. Save Profile (Name, Address, Logo)
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
            
            // Priority 1: Extract from sections if it exists there (Live Builder approach)
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
            
            let stateItems: any[] = [];
            
            if (sectionFromBuilder && sectionFromBuilder.elements && sectionFromBuilder.elements.length > 0) {
                console.log(`[HomepageBuilderService] reconcile ${section}: using sections data (${sectionFromBuilder.elements.length} items)`);
                // Map BuilderElements to flat data items
                stateItems = sectionFromBuilder.elements.map((el: any) => {
                    const baseItem = {
                        id: el.id,
                        ...el.content
                    };
                    
                    // Only override if the wrapper properties are explicitly defined
                    if (el.order !== undefined) baseItem.order_index = el.order;
                    if (el.visible !== undefined) baseItem.active = el.visible;
                    
                    // Ensure defaults if still missing
                    if (baseItem.order_index === undefined) baseItem.order_index = 0;
                    if (baseItem.active === undefined) baseItem.active = true;
                    
                    return baseItem;
                });
            } else {
                console.log(`[HomepageBuilderService] reconcile ${section}: using flat state.data.${section}`);
                // Priority 2: Use the data object (Legacy/Storefront approach)
                stateItems = state.data?.[section] || [];
            }

            console.log(`[HomepageBuilderService] reconcile ${section}: items to save:`, stateItems.length);

            let dbItems: any[] = [];
            try {
                dbItems = await fetchFn();
                console.log(`[HomepageBuilderService] reconcile ${section}: existing DB items:`, dbItems.length);
            } catch (e) {
                console.warn(`[HomepageBuilderService] Failed to fetch existing ${section} for reconciliation:`, e);
            }
            
            // Delete items that are in DB but NOT in current state
            const stateIds = new Set(stateItems.map((item: any) => item.id));
            for (const dbItem of dbItems) {
                if (dbItem.id && !stateIds.has(dbItem.id)) {
                    console.log(`[HomepageBuilderService] reconcile ${section}: deleting orphaned item ${dbItem.id}`);
                    try {
                        await deleteFn(dbItem.id, rid);
                    } catch (e) {
                        console.warn(`[HomepageBuilderService] Failed to delete ${section} item ${dbItem.id}:`, e);
                    }
                }
            }
            
            // Save (upsert) remaining items
            console.log(`[HomepageBuilderService] reconcile ${section}: processing ${stateItems.length} items for upsert`);
            for (const item of stateItems) {
                try {
                    console.log(`[Reconcile] Saving ${section} item:`, item.title || item.name || item.id);
                    const result = await saveFn({ ...item, restaurant_id: rid });
                    console.log(`[Reconcile] Saved ${section} item successfully:`, result?.id);
                } catch (err) {
                    console.error(`[Reconcile] Error saving ${section} item:`, item, err);
                    // Continue with other items
                }
            }
            console.log(`[HomepageBuilderService] reconcile ${section}: completed successfully`);
        };
        
        // Clear all caches before reconciliation to ensure we compare against fresh DB state
        clearCache(rid);

        // 3. Save Banners - REMOVED (Handled directly by BannerService in real-time)
        
        // 4. Save Categories
        await reconcile(
            'categories',
            () => HomepageBuilderService.getCategories(rid),
            (item) => HomepageBuilderService.saveCategory(item),
            (id) => HomepageBuilderService.deleteCategory(id, rid)
        );
        
        // 5. Save Services
        await reconcile(
            'services',
            () => HomepageBuilderService.getServices(rid),
            (item) => HomepageBuilderService.saveService(item),
            (id) => HomepageBuilderService.deleteService(id, rid)
        );

        // 6. Save Specials
        await reconcile(
            'specials',
            () => HomepageBuilderService.getSpecials(rid),
            (item) => HomepageBuilderService.saveSpecial(item),
            (id) => HomepageBuilderService.deleteSpecial(id, rid)
        );

        // 7. Save Combos
        await reconcile(
            'combos',
            () => HomepageBuilderService.getCombos(rid),
            (item) => HomepageBuilderService.saveCombo(item),
            (id) => HomepageBuilderService.deleteCombo(id, rid)
        );

        // 8. Save Offers
        await reconcile(
            'offers',
            () => HomepageBuilderService.getOffers(rid),
            (item) => HomepageBuilderService.saveOffer(item),
            (id) => HomepageBuilderService.deleteOffer(id, rid)
        );

        // 9. Save Section Styles
        if (state.data?.sectionStyles) {
            for (const sectionName of Object.keys(state.data.sectionStyles)) {
                const style = state.data.sectionStyles[sectionName];
                await HomepageBuilderService.saveSectionStyle({ ...style, restaurant_id: rid, section_name: sectionName });
            }
        }

        // 10. Clear all caches for this restaurant
        clearCache(rid);
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
