import { resolveRestaurantId, BoundedCache } from './utils.service';
import { ContextValidator } from '@/lib/context-validator';
import { compressImage, validateImageFile } from '@/lib/image-compress';
import { QueryMonitor } from './query-monitor.service';
import { supabase } from '@/lib/supabase';

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
    gst_percentage?: number;
    cgst_percentage?: number;
    sgst_percentage?: number;
    restaurant_id?: string;
    menu_item_type: 'food' | 'alcohol';
    price_variants?: PriceVariant[];
    stock_ml?: number;
    is_popular: boolean;
    active: boolean;
    rating: number;
    is_today_special?: boolean;
    special_price?: number | null;
    special_expiry_datetime?: string | null;
    // Client-side only
    ingredients?: Array<{
        inventory_item_id: string;
        quantity_required: number;
        unit?: string;
    }>;
}

const dataCache = new BoundedCache<any>(500, 300000);
const activePromises = new Map<string, Promise<any>>();
const CACHE_TTL = 300000; // 5 minutes

export const MenuService = {
    /**
     * Clear specific or all cache
     */
    clearCache(keyPattern?: string, syncHomepage: boolean = true) {
        activePromises.clear();
        if (keyPattern) {
            dataCache.deletePattern(keyPattern);
        } else {
            dataCache.clear();
        }

        if (!syncHomepage) return;

        // Also clear HomepageBuilderService cache to keep homepage synced without circular recursion
        try {
            import('./homepage-builder.service').then(m => {
                if (m && typeof m.clearCache === 'function') {
                    m.clearCache(keyPattern, false);
                }
            }).catch(() => {});
        } catch (e) {
            // ignore
        }
    },

    /**
     * Fetch all categories
     */
    async fetchCategories(restaurantId: string, branchId?: string) {
        console.count('fetchCategories');
        const cacheKey = `categories-${restaurantId}-${branchId || 'default'}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('menu', true, 0);
                return cached as Category[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('menu', true, 0);
            return cached as Category[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const actualId = await resolveRestaurantId(restaurantId);
                let query = supabase
                    .from('categories')
                    .select('id, name, slug, image_url, sort_order, category_type, restaurant_id, branch_id')
                    .order('sort_order', { ascending: true })
                    .order('id', { ascending: true }); // Fallback

                query = query.eq('restaurant_id', actualId);
                if (branchId) query = query.eq('branch_id', branchId);

                const { data, error } = await query;
                if (error) throw error;

                const result = data as Category[];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('menu', false, Date.now() - startTime);
                return result;
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
    },

    /**
     * Fetch all subcategories for a category
     */
    async fetchSubCategories(categoryId: number, restaurantId: string, branchId?: string) {
        console.count('fetchSubCategories');
        const cacheKey = `subcategories-${restaurantId}-${categoryId}-${branchId || 'default'}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('menu', true, 0);
                return cached as SubCategory[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('menu', true, 0);
            return cached as SubCategory[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const actualId = await resolveRestaurantId(restaurantId);
                let query = supabase
                    .from('sub_categories')
                    .select('id, category_id, name, sort_order, restaurant_id, branch_id')
                    .eq('category_id', categoryId)
                    .order('sort_order', { ascending: true })
                    .order('id', { ascending: true });

                query = query.eq('restaurant_id', actualId);
                if (branchId) query = query.eq('branch_id', branchId);

                const { data, error } = await query;

                if (error) throw error;
                const result = data as SubCategory[];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('menu', false, Date.now() - startTime);
                return result;
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
    },

    /**
     * Fetch all subcategories for a restaurant
     */
    async fetchAllSubCategories(restaurantId: string, branchId?: string) {
        console.count('fetchAllSubCategories');
        const cacheKey = `all-subcategories-${restaurantId}-${branchId || 'default'}`;
        
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('menu', true, 0);
                return cached as SubCategory[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('menu', true, 0);
            return cached as SubCategory[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const actualId = await resolveRestaurantId(restaurantId);
                let query = supabase
                    .from('sub_categories')
                    .select('id, category_id, name, sort_order, restaurant_id, branch_id')
                    .order('sort_order', { ascending: true })
                    .order('id', { ascending: true });

                query = query.eq('restaurant_id', actualId);
                if (branchId) query = query.eq('branch_id', branchId);

                const { data, error } = await query;

                if (error) throw error;
                const result = data as SubCategory[];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('menu', false, Date.now() - startTime);
                return result;
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
    },

    /**
     * Fetch menu items (optionally filtered by category)
     */
    async fetchMenuItems(restaurantId: string, categoryId?: number | string, branchId?: string, isMinimal?: boolean) {
        console.count('fetchMenuItems');
        const cacheKey = `menu-items-${restaurantId}-${categoryId || 'all'}-${branchId || 'default'}-${isMinimal ? 'min' : 'full'}`;
        
        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('menu', true, 0);
                return cached as MenuItem[];
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('menu', true, 0);
            return cached as MenuItem[];
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const actualId = await resolveRestaurantId(restaurantId);
                const selectFields = isMinimal 
                    ? 'id, category_id, sub_category_id, name, price, image_url, is_available, item_type, is_popular, active, rating, is_today_special, special_price, special_expiry_datetime, tax_percent, gst_percentage, cgst_percentage, sgst_percentage'
                    : `
                        id, category_id, sub_category_id, name, description, price, 
                        image_url, is_available, item_type, is_veg, sort_order,
                        preparation_time, tax_percent, gst_percentage, cgst_percentage, sgst_percentage,
                        restaurant_id, menu_item_type,
                        price_variants, stock_ml, is_popular, active, rating,
                        is_today_special, special_price, special_expiry_datetime,
                        categories (name),
                        sub_categories (name)
                    `;

                let query = (supabase.from('menu_items') as any)
                    .select(selectFields)
                    .order('sort_order', { ascending: true })
                    .order('id', { ascending: true }); // Fallback

                query = query.eq('restaurant_id', actualId);
                if (categoryId) {
                    if (categoryId === 'SPECIALS' || categoryId === 'TODAY_SPECIALS') {
                        query = query.eq('is_today_special', true);
                    } else {
                        query = query.eq('category_id', categoryId);
                    }
                }
                if (branchId) query = query.eq('branch_id', branchId);

                const { data, error } = await query;

                if (error) throw error;
                const processed = data?.map((item: any) => ({
                    ...item,
                    category: (item as any).categories,
                    sub_category: (item as any).sub_categories
                })) as unknown as MenuItem[];

                dataCache.set(cacheKey, processed);
                QueryMonitor.track('menu', false, Date.now() - startTime);
                return processed;
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
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

        if (error) {
            console.error('save_menu_item_with_recipe RPC error:', error.message || error.details || error);
            throw new Error(error.message || error.details || 'Failed to save menu item');
        }
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
    /**
     * Delete a menu item
     */
    async deleteMenuItem(id: number, restaurantId: string) {
        const actualId = await resolveRestaurantId(restaurantId);

        // 1. Try ultra-fast atomic stored procedure (1 roundtrip)
        const { error: rpcError } = await supabase.rpc('delete_menu_item_safe', {
            p_item_id: id,
            p_restaurant_id: actualId
        });

        if (!rpcError) {
            this.clearCache();
            return;
        }

        // Fallback: Bulk delete operations
        await Promise.allSettled([
            supabase
                .from('menu_recipe_mapping')
                .delete()
                .eq('menu_item_id', id)
                .eq('restaurant_id', actualId),
            supabase
                .from('today_special_items')
                .delete()
                .eq('menu_item_id', id)
                .eq('restaurant_id', actualId)
        ]);

        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', actualId);

        if (error) {
            // Soft-delete if referenced in orders
            const { error: updateError } = await supabase
                .from('menu_items')
                .update({
                    active: false,
                    is_available: false,
                    category_id: null,
                    sub_category_id: null
                })
                .eq('id', id)
                .eq('restaurant_id', actualId);

            if (updateError) throw updateError;
        }
        this.clearCache();
    },

    /**
     * Delete a category and its items
     */
    async deleteCategory(id: number, restaurantId: string) {
        const actualId = await resolveRestaurantId(restaurantId);

        // 1. Try ultra-fast atomic stored procedure (1 roundtrip for entire category + all items)
        const { error: rpcError } = await supabase.rpc('delete_category_safe', {
            p_category_id: id,
            p_restaurant_id: actualId
        });

        if (!rpcError) {
            this.clearCache();
            return;
        }

        // Fallback: Bulk delete instead of sequential item-by-item loop
        const { data: items } = await supabase
            .from('menu_items')
            .select('id')
            .eq('category_id', id)
            .eq('restaurant_id', actualId);

        const itemIds = (items || []).map(i => i.id);

        if (itemIds.length > 0) {
            await Promise.allSettled([
                supabase
                    .from('menu_recipe_mapping')
                    .delete()
                    .in('menu_item_id', itemIds)
                    .eq('restaurant_id', actualId),
                supabase
                    .from('today_special_items')
                    .delete()
                    .in('menu_item_id', itemIds)
                    .eq('restaurant_id', actualId)
            ]);

            // Attempt bulk delete of unreferenced items
            await supabase
                .from('menu_items')
                .delete()
                .in('id', itemIds)
                .eq('restaurant_id', actualId);

            // Soft-delete any remaining items that were ordered
            await supabase
                .from('menu_items')
                .update({
                    category_id: null,
                    sub_category_id: null,
                    active: false,
                    is_available: false
                })
                .in('id', itemIds)
                .eq('restaurant_id', actualId);
        }

        // Unlink subcategory references and delete
        await supabase
            .from('menu_items')
            .update({ sub_category_id: null })
            .eq('category_id', id)
            .eq('restaurant_id', actualId);

        await supabase
            .from('sub_categories')
            .delete()
            .eq('category_id', id)
            .eq('restaurant_id', actualId);

        const { error: catDeleteError } = await supabase
            .from('categories')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', actualId);

        if (catDeleteError) throw catDeleteError;

        this.clearCache();
    },

    /**
     * Delete a subcategory
     */
    async deleteSubCategory(id: number, restaurantId: string) {
        const actualId = await resolveRestaurantId(restaurantId);

        // 1. Try ultra-fast atomic stored procedure
        const { error: rpcError } = await supabase.rpc('delete_subcategory_safe', {
            p_subcategory_id: id,
            p_restaurant_id: actualId
        });

        if (!rpcError) {
            this.clearCache();
            return;
        }

        // Fallback
        await supabase
            .from('menu_items')
            .update({ sub_category_id: null })
            .eq('sub_category_id', id)
            .eq('restaurant_id', actualId);

        const { error } = await supabase
            .from('sub_categories')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', actualId);

        if (error) throw error;
        
        this.clearCache();
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
     * Upload menu item image to Cloudflare R2 via centralized upload API
     */
    async uploadMenuImage(file: File, itemId?: number | string, restaurantId?: string): Promise<string> {
        let targetRestaurantId: string | undefined = restaurantId;

        // Support (file, restaurantId) where restaurantId was passed as 2nd arg
        if (!targetRestaurantId && typeof itemId === 'string' && itemId.trim() !== '') {
            targetRestaurantId = itemId.trim();
        }

        // Check browser URL path if available (e.g. /[restaurantCode]/admin/...)
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

        // Fall back to current user profile
        if (!targetRestaurantId) {
            try {
                const { UserService } = await import('@/services/users.service');
                const profile = await UserService.getCurrentProfile();
                targetRestaurantId = profile?.restaurant_id;

                // If user is owner or admin without a restaurant_id on the employee record, look up their owned restaurant
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
                console.warn('[MenuService] Failed to retrieve current user profile for restaurantId:', e);
            }
        }

        if (!targetRestaurantId) {
            throw new Error('Restaurant ID is required for image upload');
        }

        // Resolve slug/code to canonical restaurant ID
        targetRestaurantId = await resolveRestaurantId(targetRestaurantId);

        const validationError = validateImageFile(file);
        if (validationError) throw new Error(validationError);

        let uploadFile = file;
        try {
            const compressed = await compressImage(file);
            uploadFile = compressed.file;
        } catch (e) {
            console.warn('[MenuService] Image compression failed, falling back to original:', e);
        }

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('restaurantId', targetRestaurantId);
        formData.append('type', 'menu');

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
     * Delete a menu image from Cloudflare R2 or legacy Supabase storage
     */
    async deleteMenuImage(imageUrl: string) {
        if (!imageUrl) return;

        // Try to identify if R2 URL
        let key = '';
        if (imageUrl.includes('restaurants/')) {
            const idx = imageUrl.indexOf('restaurants/');
            key = imageUrl.slice(idx);
        }

        if (!key) {
            // Fallback to legacy Supabase deletion
            const parts = imageUrl.split('/menu-images/');
            if (parts.length >= 2) {
                const fileName = parts[1];
                await supabase.storage
                    .from('menu-images')
                    .remove([fileName]);
            }
            return;
        }

        try {
            await fetch(`/api/upload?key=${encodeURIComponent(key)}`, {
                method: 'DELETE',
            });
        } catch (e) {
            console.warn('[MenuService] Failed to delete image from R2:', e);
        }
    }
};
