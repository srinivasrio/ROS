import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from './utils';
import { MenuService } from './menu';

const supabase = createClient();

export interface UniversalTheme {
    bg_color: string;
    primary_button_color: string;
    secondary_button_color: string;
    text_color: string;
    font_style: string;
    card_radius: string;
}

export interface UniversalBanner {
    id: string;
    title?: string;
    description?: string;
    image_url: string;
    cta_text?: string;
    link?: string;
    expiry_datetime?: string;
}


export interface UniversalCategory {
    id: string;
    name: string;
    image_url?: string;
    link?: string;
    order_index: number;
}



export interface UniversalService {
    id: string;
    name: string;
    image_url?: string;
    service_key: string;
}


export interface UniversalOffer {
    id: string;
    title: string;
    coupon_code?: string;
    description?: string;
    expiry_datetime?: string;
    image_url?: string;
}


export interface UniversalSpecial {
    id: string;
    image_url?: string;
    title: string;
    description?: string;
    price?: number;
    items?: any[];
}

export interface UniversalCombo {
    id: string;
    image_url?: string;
    title: string;
    description?: string;
    price?: number;
    items?: any[];
}


export const UniversalHomepageService = {
    async getTheme(restaurantId: string): Promise<UniversalTheme | null> {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_theme')
            .select('*')
            .eq('restaurant_id', rid)
            .maybeSingle();
        
        if (error) {
            console.error('Error fetching theme:', error);
            return null;
        }
        return data;
    },

    async getBanners(restaurantId: string): Promise<UniversalBanner[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('homepage_banners')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('active', true)
            .or(`expiry_datetime.is.null,expiry_datetime.gt.${now}`);
        
        if (error) {
            console.error('Error fetching banners:', error);
            return [];
        }
        return data || [];
    },

    async getCategories(restaurantId: string): Promise<UniversalCategory[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('homepage_categories')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('active', true)
            .order('order_index', { ascending: true });
        
        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
        return data || [];
    },

    async getServices(restaurantId: string): Promise<UniversalService[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('homepage_services')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('active', true);
        
        if (error) {
            console.error('Error fetching services:', error);
            return [];
        }
        return data || [];
    },

    async getSpecials(restaurantId: string): Promise<UniversalSpecial[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('homepage_specials')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('active', true)
            .eq('special_type', 'single')
            .or(`expiry_datetime.is.null,expiry_datetime.gt.${now}`);
        
        if (error) {
            console.error('Error fetching specials:', error);
            return [];
        }

        if (!data || data.length === 0) return [];

        // Enrich with menu item details
        const menuItems = await MenuService.fetchMenuItems(restaurantId);
        const menuMap = new Map(menuItems.map(m => [m.id, m]));

        return data.map(s => {
            const enrichedItems = (s.items || []).map((si: any) => {
                const menuItemId = si.menu_item_id || si.id;
                const menu_item = menuItemId ? menuMap.get(Number(menuItemId)) : null;
                return {
                    ...si,
                    menu_item: menu_item || si.menu_item
                };
            });


            return {
                id: s.id,
                image_url: s.image_url,
                title: s.title || '',
                description: s.description,
                price: s.price,
                items: enrichedItems
            };
        });

    },

    async getCombos(restaurantId: string): Promise<UniversalCombo[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('homepage_specials')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('active', true)
            .eq('special_type', 'combo')
            .or(`expiry_datetime.is.null,expiry_datetime.gt.${now}`);
        
        if (error) {
            console.error('Error fetching combos:', error);
            return [];
        }

        if (!data || data.length === 0) return [];

        // Enrich with menu item details
        const menuItems = await MenuService.fetchMenuItems(restaurantId);
        const menuMap = new Map(menuItems.map(m => [m.id, m]));

        return data.map(s => {
            const enrichedItems = (s.items || []).map((si: any) => {
                const menuItemId = si.menu_item_id || si.id;
                const menu_item = menuItemId ? menuMap.get(Number(menuItemId)) : null;
                return {
                    ...si,
                    menu_item: menu_item || si.menu_item
                };
            });


            return {
                id: s.id,
                image_url: s.image_url,
                title: s.title || '',
                description: s.description,
                price: s.price,
                items: enrichedItems
            };
        });

    },

    async getOffers(restaurantId: string): Promise<UniversalOffer[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('homepage_offers')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('active', true)
            .or(`expiry_datetime.is.null,expiry_datetime.gt.${now}`);
        
        if (error) {
            console.error('Error fetching offers:', error);
            return [];
        }
        return data || [];
    },

    async getRestaurantProfile(restaurantId: string) {
        const rid = await resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_profile')
            .select('*')
            .eq('restaurant_id', rid)
            .maybeSingle();
        
        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }

        if (data && data.restaurant_info) {
            return {
                ...data,
                ...data.restaurant_info
            };
        }
        return data;
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
        
        if (error) {
            console.error('Error fetching popular items:', error);
            return [];
        }
        return data || [];
    },

    async getRecentOrders(restaurantId: string, tableId: string | number) {
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
            // In a real app, we'd filter by customer_id/phone
            // For now, let's just show recent orders from THIS table if any
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) {
            console.error('Error fetching recent orders:', error);
            return [];
        }
        return data || [];
    }
};
