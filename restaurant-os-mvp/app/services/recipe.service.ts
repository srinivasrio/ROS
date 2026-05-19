import { createClient } from '@/lib/supabase';

export interface RecipeMapping {
    id: string;
    restaurant_id: string;
    menu_item_id: number;
    inventory_item_id: string;
    quantity_required: number;
    inventory_item?: {
        name: string;
        unit: string;
    };
}

const supabase = createClient();

export const RecipeService = {
    async fetchMappingsForMenuItem(menuItemId: number, restaurantId: string) {
        const { data, error } = await supabase
            .from('menu_recipe_mapping')
            .select(`
                *,
                inventory_item:inventory_items (name, unit)
            `)
            .eq('menu_item_id', menuItemId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
        return data as RecipeMapping[];
    },

    async saveMapping(menuItemId: number, inventoryItemId: string, quantity: number, restaurantId: string) {
        const { data, error } = await supabase
            .from('menu_recipe_mapping')
            .upsert({
                restaurant_id: restaurantId,
                menu_item_id: menuItemId,
                inventory_item_id: inventoryItemId,
                quantity_required: quantity
            }, { onConflict: 'menu_item_id, inventory_item_id' })
            .select()
            .single();

        if (error) {
            // If the unique constraint doesn't exist, upsert might fail. We can manually check and update/insert
            const { data: existing } = await supabase.from('menu_recipe_mapping').select('id').eq('menu_item_id', menuItemId).eq('inventory_item_id', inventoryItemId).eq('restaurant_id', restaurantId).single();
            if (existing) {
                const { error: updErr } = await supabase.from('menu_recipe_mapping').update({ quantity_required: quantity }).eq('id', existing.id).eq('restaurant_id', restaurantId);
                if (updErr) throw updErr;
                return;
            } else {
                const { error: insErr } = await supabase.from('menu_recipe_mapping').insert({
                    restaurant_id: restaurantId,
                    menu_item_id: menuItemId,
                    inventory_item_id: inventoryItemId,
                    quantity_required: quantity
                });
                if (insErr) throw insErr;
                return;
            }
        }
        return data;
    },

    async deleteMapping(id: string, restaurantId: string) {
        const { error } = await supabase
            .from('menu_recipe_mapping')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    }
};
