import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from './utils';
import { MenuService } from './menu';

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

// ─── Service ─────────────────────────────────────────────
export const SpecialsService = {

    /**
     * Fetch all active specials.
     */
    async fetchActiveSpecials(restaurantId: string): Promise<TodaySpecial[]> {
        const rid = await resolveRestaurantId(restaurantId);
        const now = new Date().toISOString();

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
            .eq('is_active', true)
            .or(`valid_to.is.null,valid_to.gt.${now}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[SPECIALS] fetchActiveSpecials error:', error);
            return [];
        }

        return (data || []) as unknown as TodaySpecial[];
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

        return this.fetchAllSpecials(rid).then(list => list.find(s => s.id === special.id) || null);
    },

    async updateSpecial(id: string, restaurantId: string, updates: Partial<TodaySpecial>): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);
        
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
        return true;
    },

    /**
     * Update the items linked to a special.
     */
    async updateSpecialItems(specialId: string, restaurantId: string, items: any[]): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);

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

        return true;
    },

    /**
     * Toggle the active status of a special.
     */
    async toggleSpecialActive(id: string, restaurantId: string, isActive: boolean): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);
        const { error } = await supabase
            .from('today_specials')
            .update({ is_active: isActive })
            .eq('id', id)
            .eq('restaurant_id', rid);

        if (error) {
            console.error('[SPECIALS] toggleSpecialActive error:', error);
            return false;
        }
        return true;
    },

    /**
     * Delete a special.
     */
    async deleteSpecial(id: string, restaurantId: string): Promise<boolean> {
        const rid = await resolveRestaurantId(restaurantId);
        
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
        return true;
    },
};

