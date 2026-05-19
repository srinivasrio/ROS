import { supabase } from '@/lib/supabase';
import { resolveRestaurantId } from './utils';
import { ContextValidator } from '@/app/lib/context-validator';

export interface Category {
    id: number;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    count?: number; // Virtual count
    sort_order?: number;
    sub_categories?: SubCategory[]; // Virtual field
    category_type: 'food' | 'alcohol';
}

export interface SubCategory {
    id: number;
    category_id: number;
    name: string;
    sort_order?: number;
}

export interface PriceVariant {
    name: string;
    price: number;
}

export interface MenuItem {
    id: number;
    category_id: number;
    sub_category_id?: number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    is_available: boolean;
    item_type: 'Veg' | 'Non-Veg' | 'Egg'; // Replaced is_veg
    is_veg?: boolean; // Deprecated, kept for backward compat if needed temporarily
    category?: Category;
    sub_category?: SubCategory;
    sort_order?: number;
    preparation_time?: number;
    tax_percent?: number;
    restaurant_id?: string;
    menu_item_type: 'food' | 'alcohol';
    price_variants?: PriceVariant[];
    stock_ml?: number;
    is_popular: boolean;
    active: boolean;
    rating: number;
    // Client-side only
    ingredients?: Array<{
        inventory_item_id: string;
        quantity_required: number;
        unit?: string;
    }>;
}

const dataCache: Record<string, { data: any; expiry: number }> = {};
const CACHE_TTL = 300000; // 5 minutes

export const MenuService = {
    /**
     * Clear specific or all cache
     */
    clearCache(keyPattern?: string) {
        if (keyPattern) {
            Object.keys(dataCache).forEach(key => {
                if (key.includes(keyPattern)) delete dataCache[key];
            });
        } else {
            Object.keys(dataCache).forEach(k => delete dataCache[k]);
        }
    },

    /**
     * Fetch all categories
     */
    async fetchCategories(restaurantId: string, branchId?: string) {
        const cacheKey = `categories-${restaurantId}-${branchId || 'default'}`;
        const cached = dataCache[cacheKey];
        if (cached && cached.expiry > Date.now()) {
            return cached.data as Category[];
        }

        const actualId = await resolveRestaurantId(restaurantId);
        let query = supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // Fallback

        query = query.eq('restaurant_id', actualId);
        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;

        dataCache[cacheKey] = { data, expiry: Date.now() + CACHE_TTL };
        return data as Category[];
    },

    /**
     * Fetch all subcategories for a category
     */
    async fetchSubCategories(categoryId: number, restaurantId: string, branchId?: string) {
        const actualId = await resolveRestaurantId(restaurantId);
        let query = supabase
            .from('sub_categories')
            .select('*')
            .eq('category_id', categoryId)
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true });

        query = query.eq('restaurant_id', actualId);
        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;

        if (error) throw error;
        return data as SubCategory[];
    },

    /**
     * Fetch all menu items
     */
    async fetchMenuItems(restaurantId: string, branchId?: string) {
        const cacheKey = `menu-items-${restaurantId}-${branchId || 'default'}`;
        const cached = dataCache[cacheKey];
        if (cached && cached.expiry > Date.now()) {
            return cached.data as MenuItem[];
        }

        const actualId = await resolveRestaurantId(restaurantId);
        let query = supabase
            .from('menu_items')
            .select(`
                id, category_id, sub_category_id, name, description, price, 
                image_url, is_available, item_type, is_veg, sort_order,
                preparation_time, tax_percent, restaurant_id, menu_item_type,
                price_variants, stock_ml, is_popular, active, rating,
                categories (name),
                sub_categories (name)
            `)
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // Fallback

        query = query.eq('restaurant_id', actualId);
        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;

        if (error) throw error;
        const processed = data?.map(item => ({
            ...item,
            category: item.categories,
            sub_category: item.sub_categories
        })) as unknown as MenuItem[];

        dataCache[cacheKey] = { data: processed, expiry: Date.now() + CACHE_TTL };
        return processed;
    },

    /**
     * Create a new menu item
     */
    async createMenuItem(item: Omit<MenuItem, 'id'>) {
        const { data, error } = await supabase
            .from('menu_items')
            .insert({
                name: item.name,
                category_id: item.category_id,
                sub_category_id: item.sub_category_id,
                price: item.price,
                description: item.description,
                is_available: item.is_available,
                item_type: item.item_type,
                image_url: item.image_url,
                preparation_time: item.preparation_time,
                sort_order: 9999,
                restaurant_id: item.restaurant_id,
                menu_item_type: item.menu_item_type || 'food',
                price_variants: item.price_variants,
                stock_ml: item.stock_ml,
                is_popular: item.is_popular || false,
                active: item.active !== undefined ? item.active : true,
                rating: item.rating || 4.5
            })
            .select()
            .single();

        if (error) throw error;
        this.clearCache();
        return data;
    },

    /**
     * Create or update a menu item along with its ingredients in a single transaction
     */
    async saveItemWithRecipe(item: Partial<MenuItem> & { id?: number }, ingredients: Array<{ inventory_item_id: string; quantity_required: number; unit?: string }>) {
        const payload = {
            p_menu_item: item,
            p_ingredients: ingredients
        };

        const { data, error } = await supabase.rpc('save_menu_item_with_recipe', payload);

        if (error) throw error;
        this.clearCache();
        return data;
    },
    // ...
    /**
     * Create a new category
     */
    async createCategory(name: string, restaurantId: string, imageUrl?: string, categoryType: 'food' | 'alcohol' = 'food') {
        const { data, error } = await supabase.rpc('create_category_sequential', {
            p_name: name,
            p_restaurant_id: restaurantId,
            p_image_url: imageUrl || null,
            p_category_type: categoryType
        });

        if (error) throw error;
        this.clearCache();
        return data;
    },

    /**
     * Update a category's image
     */
    async updateCategoryImage(categoryId: number, restaurantId: string, imageUrl: string) {
        const { error } = await supabase
            .from('categories')
            .update({ image_url: imageUrl })
            .eq('id', categoryId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Create a new subcategory
     */
    async createSubCategory(categoryId: number, name: string, restaurantId: string) {
        const { data, error } = await supabase.rpc('create_subcategory_sequential', {
            p_category_id: categoryId,
            p_name: name,
            p_restaurant_id: restaurantId
        });

        if (error) throw error;
        this.clearCache();
        return data;
    },
    /**
     * Toggle availability or update item
     */
    async updateMenuItem(id: number, restaurantId: string, updates: Partial<MenuItem>) {
        const { error } = await supabase
            .from('menu_items')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Delete a menu item
     */
    async deleteMenuItem(id: number, restaurantId: string) {
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Delete a category
     */
    async deleteCategory(id: number, restaurantId: string) {
        // Manual cascade delete items
        const { error: itemsError } = await supabase
            .from('menu_items')
            .delete()
            .eq('category_id', id)
            .eq('restaurant_id', restaurantId);

        if (itemsError) throw itemsError;

        // Manual cascade delete subcategories
        const { error: subError } = await supabase
            .from('sub_categories')
            .delete()
            .eq('category_id', id)
            .eq('restaurant_id', restaurantId);

        if (subError) throw subError;

        // Then delete the category
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Delete a subcategory
     */
    async deleteSubCategory(id: number, restaurantId: string) {
        // Warning: This will set items' sub_category_id to NULL due to DB constraint (SET NULL)
        // ...
        const { error } = await supabase
            .from('sub_categories')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Reorder categories
     */
    async reorderCategories(items: Partial<Category>[], restaurantId: string) {
        const updates = items.map(item => ({ ...item, restaurant_id: restaurantId }));
        const { error } = await supabase
            .from('categories')
            .upsert(updates as any, { onConflict: 'id' });

        if (error) throw error;
    },

    /**
     * Reorder subcategories
     */
    async reorderSubCategories(items: Partial<SubCategory>[], restaurantId: string) {
        const updates = items.map(item => ({ ...item, restaurant_id: restaurantId }));
        const { error } = await supabase
            .from('sub_categories')
            .upsert(updates as any, { onConflict: 'id' });

        if (error) throw error;
    },

    /**
     * Reorder menu items
     */
    async reorderMenuItems(items: Partial<MenuItem>[], restaurantId: string) {
        // Remove joined objects and ensure restaurant_id
        const cleanItems = items.map(({ category, sub_category, ...rest }) => ({
            ...rest,
            restaurant_id: restaurantId
        }));

        const { error } = await supabase
            .from('menu_items')
            .upsert(cleanItems as any, { onConflict: 'id' });

        if (error) throw error;
        this.clearCache();
    },

    /**
     * Upload menu item image to Supabase Storage
     */
    async uploadMenuImage(file: File, itemId?: number): Promise<string> {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${itemId || Date.now()}-${Date.now()}.${ext}`;

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

    /**
     * Update a menu item's image_url
     */
    async updateMenuItemImage(itemId: number, restaurantId: string, imageUrl: string) {
        const { error } = await supabase
            .from('menu_items')
            .update({ image_url: imageUrl })
            .eq('id', itemId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Delete a menu image from storage
     */
    async deleteMenuImage(imageUrl: string) {
        // Extract filename from URL
        const parts = imageUrl.split('/menu-images/');
        if (parts.length < 2) return;
        const fileName = parts[1];

        await supabase.storage
            .from('menu-images')
            .remove([fileName]);
    }
};
