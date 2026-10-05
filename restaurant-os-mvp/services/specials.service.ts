import { createClient } from '@/lib/supabase';
import { resolveRestaurantId, BoundedCache } from './utils.service';
import { MenuService } from './menu.service';
import { QueryMonitor } from './query-monitor.service';

const supabase = createClient();

// ─── Types ───────────────────────────────────────────────
export interface TodaySpecial {
    id: string;
    restaurant_id: string;
    title: string;
    description?: string;
    original_price?: number;
    special_price?: number;
    is_combo: boolean;
    special_type?: 'single' | 'combo';
    is_active: boolean;
    valid_from: string;
    valid_to?: string;
    created_at: string;
    items?: TodaySpecialItem[];
    image_url?: string;
}

export interface TodaySpecialItem {
    id: string;
    today_special_id: string;
    menu_item_id: number;
    quantity: number;
    menu_item?: {
        id: number;
        name: string;
        price: number;
        item_type?: string;
        image_url?: string;
        is_available: boolean;
        category?: { name: string };
        tax_percent?: number;
        gst_percentage?: number;
        cgst_percentage?: number;
        sgst_percentage?: number;
    };
}

export interface CreateSpecialInput {
    restaurant_id?: string;
    title: string;
    description?: string;
    special_price?: number;
    is_combo: boolean;
    special_type?: 'single' | 'combo';
    is_active?: boolean;
    valid_from?: string;
    valid_to?: string;
    items: Array<{ menu_item_id: number; quantity: number }>;
    image_url?: string;
}

const CACHE_TTL = process.env.NODE_ENV === 'development' ? 2000 : 60000;
const dataCache = new BoundedCache<any>(100, CACHE_TTL);
const activePromises = new Map<string, Promise<any>>();

// ─── Service ─────────────────────────────────────────────
export const SpecialsService = {

    /**
     * Clear active specials cache.
     */
    clearCache(restaurantId?: string) {
        activePromises.clear();
        if (restaurantId) {
            dataCache.delete(`active-specials-${restaurantId}`);
            MenuService.triggerPublicMenuRevalidation(restaurantId);
        } else {
            dataCache.clear();
        }
    },

    /**
     * Fetch all active specials.
     */
    async fetchActiveSpecials(restaurantId: string): Promise<TodaySpecial[]> {
        console.count('fetchActiveSpecials');
        const rid = await resolveRestaurantId(restaurantId);
        const cacheKey = `active-specials-${rid}`;

        // 1. Rate limiting check
        if (QueryMonitor.shouldThrottle(cacheKey, 1000)) {
            const cached = dataCache.get(cacheKey);
            if (cached) {
                QueryMonitor.track('special', true, 0);
                return cached;
            }
        }

        if (activePromises.has(cacheKey)) {
            return activePromises.get(cacheKey)!;
        }

        const cached = dataCache.get(cacheKey);
        if (cached) {
            QueryMonitor.track('special', true, 0);
            return cached;
        }

        const startTime = Date.now();
        const promise = (async () => {
            try {
                const { data, error } = await supabase
                    .from('today_specials')
                    .select(`
                        id,
                        restaurant_id,
                        title,
                        description,
                        special_price,
                        original_price,
                        special_type,
                        is_combo,
                        is_active,
                        valid_to,
                        image_url,
                        created_at,
                        items:today_special_items(
                            id,
                            today_special_id,
                            menu_item_id,
                            quantity,
                            menu_item:menu_items(
                                id,
                                name,
                                price,
                                image_url,
                                is_available,
                                active,
                                description,
                                tax_percent,
                                gst_percentage,
                                cgst_percentage,
                                sgst_percentage
                            )
                        )
                    `)
                    .eq('restaurant_id', rid)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (error) {
                    const cached = dataCache.get(cacheKey);
                    if (cached) {
                        return cached;
                    }
                    console.error('[SPECIALS] fetchActiveSpecials error:', error?.message || error);
                    return [];
                }

                const now = new Date();
                const filtered = (data || []).filter((sp: any) => {
                    if (!sp.valid_to) return true;
                    try {
                        return new Date(sp.valid_to) > now;
                    } catch (_) {
                        return true;
                    }
                });

                const result = filtered as unknown as TodaySpecial[];
                dataCache.set(cacheKey, result);
                QueryMonitor.track('special', false, Date.now() - startTime);
                return result;
            } catch (err: any) {
                const cached = dataCache.get(cacheKey);
                if (cached) {
                    return cached;
                }
                console.error('[SPECIALS] fetchActiveSpecials error:', err?.message || err);
                return [];
            } finally {
                activePromises.delete(cacheKey);
            }
        })();

        activePromises.set(cacheKey, promise);
        return promise;
    },

    /**
     * Fetch ALL specials for admin management.
     */
    async fetchAllSpecials(restaurantId: string): Promise<TodaySpecial[]> {
        const rid = await resolveRestaurantId(restaurantId);
        
        const { data, error } = await supabase
            .from('today_specials')
            .select(`
                *,
                items:today_special_items(
                    *,
                    menu_item:menu_items(*)
                )
            `)
            .eq('restaurant_id', rid)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[SPECIALS] fetchAllSpecials error:', error);
            return [];
        }

        return (data || []) as unknown as TodaySpecial[];
    },

    /**
     * Create a new special.
     */
    async createSpecial(restaurantId: string, input: Omit<CreateSpecialInput, 'restaurant_id'>): Promise<TodaySpecial | null> {
        const rid = await resolveRestaurantId(restaurantId);
        console.log('[SPECIALS] Creating special for restaurant ID:', rid);

        // 1. Insert into today_specials
        const { data: special, error: specialError } = await supabase
            .from('today_specials')
            .insert({
                restaurant_id: rid,
                title: input.title,
                description: input.description || null,
                special_price: input.special_price || null,
                is_combo: input.is_combo,
                special_type: input.is_combo ? 'combo' : 'single',
                is_active: true,
                valid_to: input.valid_to || null,
                image_url: input.image_url || null,
                original_price: (input.items || []).reduce((acc: number, curr: any) => acc + (curr.price || 0) * (curr.quantity || 1), 0)
            })
            .select()
            .single();

        if (specialError || !special) {
            console.error('[SPECIALS] createSpecial error:', specialError);
            return null;
        }

        // 2. Insert items into today_special_items if any
        if (input.items && input.items.length > 0) {
            const itemsToInsert = input.items.map(item => ({
                today_special_id: special.id,
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                restaurant_id: rid
            }));

            const { error: itemsError } = await supabase
                .from('today_special_items')
                .insert(itemsToInsert);

            if (itemsError) {
                console.error('[SPECIALS] Error inserting special items:', itemsError);
            }
        }

        // 3. If it's a single special, sync to menu_items table
        if (!input.is_combo && input.items && input.items.length > 0) {
            const menuItemId = input.items[0].menu_item_id;
            const { error: syncError } = await supabase
                .from('menu_items')
                .update({
                    is_today_special: true,
                    special_price: input.special_price || null,
                    special_expiry_datetime: input.valid_to || null
                })
                .eq('id', menuItemId);

            if (syncError) {
                console.error('[SPECIALS] Error syncing menu_item today_special columns:', syncError);
            }
        }

        this.clearCache(rid);
        return this.fetchAllSpecials(rid).then(list => list.find(s => s.id === special.id) || null);
    },

    async updateSpecial(id: string, restaurantId: string, updates: Partial<TodaySpecial>): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);

        // Fetch existing special first to get type and items for menu_items sync
        const { data: existing } = await supabase
            .from('today_specials')
            .select('*, items:today_special_items(*)')
            .eq('id', id)
            .single();
        
        const mappedUpdates: any = {};
        if (updates.title !== undefined) mappedUpdates.title = updates.title;
        if (updates.description !== undefined) mappedUpdates.description = updates.description;
        if (updates.special_price !== undefined) mappedUpdates.special_price = updates.special_price;
        if (updates.is_combo !== undefined) {
            mappedUpdates.is_combo = updates.is_combo;
            mappedUpdates.special_type = updates.is_combo ? 'combo' : 'single';
        }
        if (updates.is_active !== undefined) mappedUpdates.is_active = updates.is_active;
        if (updates.valid_to !== undefined) mappedUpdates.valid_to = updates.valid_to;
        if (updates.image_url !== undefined) mappedUpdates.image_url = updates.image_url;

        const { error } = await supabase
            .from('today_specials')
            .update(mappedUpdates)
            .eq('id', id)
            .eq('restaurant_id', rid);

        if (error) {
            console.error('[SPECIALS] updateSpecial error:', error);
            return false;
        }

        // Reconcile menu_items sync if single special
        if (existing && (!existing.is_combo && existing.special_type !== 'combo') && existing.items && existing.items.length > 0) {
            const menuItemId = existing.items[0].menu_item_id;
            const updatedActive = updates.is_active !== undefined ? updates.is_active : existing.is_active;
            const updatedPrice = updates.special_price !== undefined ? updates.special_price : existing.special_price;
            const updatedExpiry = updates.valid_to !== undefined ? updates.valid_to : existing.valid_to;

            const { error: syncError } = await supabase
                .from('menu_items')
                .update({
                    is_today_special: updatedActive,
                    special_price: updatedPrice,
                    special_expiry_datetime: updatedExpiry
                })
                .eq('id', menuItemId);

            if (syncError) {
                console.error('[SPECIALS] Error syncing menu_item on updateSpecial:', syncError);
            }
        }

        this.clearCache(rid);
        return true;
    },

    /**
     * Update the items linked to a special.
     */
    async updateSpecialItems(specialId: string, restaurantId: string, items: any[]): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);

        // Fetch existing special first to get details for menu_items sync
        const { data: special } = await supabase
            .from('today_specials')
            .select('*, items:today_special_items(*)')
            .eq('id', specialId)
            .single();

        const isSingle = special && (!special.is_combo && special.special_type !== 'combo');
        const oldMenuItemId = isSingle && special.items && special.items.length > 0 ? special.items[0].menu_item_id : null;

        // Delete existing items
        const { error: deleteError } = await supabase
            .from('today_special_items')
            .delete()
            .eq('today_special_id', specialId)
            .eq('restaurant_id', rid);

        if (deleteError) {
            console.error('[SPECIALS] updateSpecialItems delete error:', deleteError);
            return false;
        }

        // Insert new items
        const itemsToInsert = items.map(item => ({
            today_special_id: specialId,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            restaurant_id: rid
        }));

        const { error: insertError } = await supabase
            .from('today_special_items')
            .insert(itemsToInsert);

        if (insertError) {
            console.error('[SPECIALS] updateSpecialItems insert error:', insertError);
            return false;
        }

        // Reconcile menu_items sync
        if (isSingle) {
            const newMenuItemId = items.length > 0 ? items[0].menu_item_id : null;
            if (oldMenuItemId && oldMenuItemId !== newMenuItemId) {
                // Remove special status from old item
                await supabase
                    .from('menu_items')
                    .update({
                        is_today_special: false,
                        special_price: null,
                        special_expiry_datetime: null
                    })
                    .eq('id', oldMenuItemId);
            }
            if (newMenuItemId) {
                // Apply special status to new item
                await supabase
                    .from('menu_items')
                    .update({
                        is_today_special: special.is_active,
                        special_price: special.special_price,
                        special_expiry_datetime: special.valid_to
                    })
                    .eq('id', newMenuItemId);
            }
        }

        this.clearCache(rid);
        return true;
    },

    /**
     * Toggle the active status of a special.
     */
    async toggleSpecialActive(id: string, restaurantId: string, isActive: boolean): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);

        // Fetch to check if single
        const { data: special } = await supabase
            .from('today_specials')
            .select('*, items:today_special_items(*)')
            .eq('id', id)
            .single();

        const { error } = await supabase
            .from('today_specials')
            .update({ is_active: isActive })
            .eq('id', id)
            .eq('restaurant_id', rid);

        if (error) {
            console.error('[SPECIALS] toggleSpecialActive error:', error);
            return false;
        }

        // Sync to menu_items if single
        if (special && (!special.is_combo && special.special_type !== 'combo') && special.items && special.items.length > 0) {
            const menuItemId = special.items[0].menu_item_id;
            await supabase
                .from('menu_items')
                .update({ is_today_special: isActive })
                .eq('id', menuItemId);
        }

        this.clearCache(rid);
        return true;
    },

    /**
     * Delete a special.
     */
    async deleteSpecial(id: string, restaurantId: string): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);

        // Fetch to check if single
        const { data: special } = await supabase
            .from('today_specials')
            .select('*, items:today_special_items(*)')
            .eq('id', id)
            .single();

        // Items should be deleted by cascade, but let's be safe if cascade isn't set
        await supabase
            .from('today_special_items')
            .delete()
            .eq('today_special_id', id)
            .eq('restaurant_id', rid);

        const { error } = await supabase
            .from('today_specials')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', rid);

        if (error) {
            console.error('[SPECIALS] deleteSpecial error:', error);
            return false;
        }

        // Sync to menu_items if single
        if (special && (!special.is_combo && special.special_type !== 'combo') && special.items && special.items.length > 0) {
            const menuItemId = special.items[0].menu_item_id;
            await supabase
                .from('menu_items')
                .update({
                    is_today_special: false,
                    special_price: null,
                    special_expiry_datetime: null
                })
                .eq('id', menuItemId);
        }

        this.clearCache(rid);
        return true;
    },

    /**
     * Fetch custom category images for combos & specials.
     */
    async getSpecialCategoryImages(restaurantId: string): Promise<{ combos?: string; specials?: string }> {
        try {
            const rid = await resolveRestaurantId(restaurantId);
            const { data } = await supabase
                .from('restaurant_profile')
                .select('restaurant_info, meta_info')
                .eq('restaurant_id', rid)
                .maybeSingle();

            const info = (data?.restaurant_info || {}) as Record<string, any>;
            const meta = (data?.meta_info || {}) as Record<string, any>;

            return {
                combos: info.combo_category_image || meta.combo_category_image || meta.special_category_images?.combos || '',
                specials: info.specials_category_image || meta.specials_category_image || meta.special_category_images?.specials || ''
            };
        } catch (e) {
            console.warn('[SPECIALS] getSpecialCategoryImages error:', e);
            return {};
        }
    },

    /**
     * Update custom category image for combos or specials.
     */
    async updateSpecialCategoryImage(
        restaurantId: string,
        type: 'combos' | 'specials',
        imageUrl: string
    ): Promise<boolean> {
        try {
            const rid = await resolveRestaurantId(restaurantId);
            const { data: existing } = await supabase
                .from('restaurant_profile')
                .select('name, restaurant_info, meta_info')
                .eq('restaurant_id', rid)
                .maybeSingle();

            const info = (existing?.restaurant_info || {}) as Record<string, any>;
            const meta = (existing?.meta_info || {}) as Record<string, any>;

            const fieldName = type === 'combos' ? 'combo_category_image' : 'specials_category_image';
            const updatedInfo = {
                ...info,
                [fieldName]: imageUrl
            };
            const updatedMeta = {
                ...meta,
                [fieldName]: imageUrl,
                special_category_images: {
                    ...(meta.special_category_images || {}),
                    [type]: imageUrl
                }
            };

            const { error } = await supabase
                .from('restaurant_profile')
                .upsert({
                    restaurant_id: rid,
                    name: existing?.name || 'Restaurant',
                    restaurant_info: updatedInfo,
                    meta_info: updatedMeta
                }, { onConflict: 'restaurant_id' });

            if (error) {
                console.error('[SPECIALS] updateSpecialCategoryImage error:', error);
                return false;
            }

            // Invalidate caches
            try {
                const { clearCache } = await import('./homepage-builder.service');
                clearCache(`homepage-full-${rid}`);
                clearCache(`homepage-full-${restaurantId}`);
            } catch (e) {}

            return true;
        } catch (e) {
            console.error('[SPECIALS] updateSpecialCategoryImage error:', e);
            return false;
        }
    },
};

