import { createClient } from '@/lib/supabase';

export interface InventoryCategory {
    id: string;
    restaurant_id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
}

export interface InventoryItem {
    id: string;
    restaurant_id: string;
    name: string;
    category?: string; // Legacy field
    category_id?: string | null;
    inventory_categories?: InventoryCategory;
    item_type?: string;
    unit: string;
    current_stock: number;
    min_threshold: number;
    max_capacity: number | null;
    cost_per_unit: number;
    supplier_id: string | null;
    expiry_date: string | null;
}

export interface InventoryAlert {
    id: string;
    restaurant_id: string;
    inventory_item_id: string | null;
    alert_type: string;
    message: string;
    status: string;
    created_at: string;
    inventory_item?: InventoryItem;
}

const supabase = createClient();

export const InventoryService = {
    async fetchCategories(restaurantId: string) {
        const { data, error } = await supabase
            .from('inventory_categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name');
        if (error) throw error;
        return data as InventoryCategory[];
    },

    async createCategory(name: string, restaurantId: string) {
        const { data, error } = await supabase
            .from('inventory_categories')
            .insert({ name, restaurant_id: restaurantId })
            .select()
            .single();
        if (error) throw error;
        return data as InventoryCategory;
    },

    async updateCategory(id: string, restaurantId: string, name: string) {
        const { data, error } = await supabase
            .from('inventory_categories')
            .update({ name })
            .eq('id', id)
            .eq('restaurant_id', restaurantId)
            .select()
            .single();
        if (error) throw error;
        return data as InventoryCategory;
    },

    async deleteCategory(id: string, restaurantId: string) {
        const { error } = await supabase
            .from('inventory_categories')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    },

    async fetchItems(restaurantId: string) {
        const { data, error } = await supabase
            .from('inventory_items')
            .select('*, inventory_categories(*)')
            .eq('restaurant_id', restaurantId)
            .order('name');
        if (error) throw error;
        return data as InventoryItem[];
    },

    async createItem(item: Partial<InventoryItem>, restaurantId: string) {
        const { data, error } = await supabase
            .from('inventory_items')
            .insert({ ...item, restaurant_id: restaurantId })
            .select()
            .single();
        if (error) throw error;
        return data as InventoryItem;
    },

    async updateItem(id: string, restaurantId: string, updates: Partial<InventoryItem>) {
        const { data, error } = await supabase
            .from('inventory_items')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId)
            .select()
            .single();
        if (error) throw error;
        return data as InventoryItem;
    },

    async deleteItem(id: string, restaurantId: string) {
        const { error } = await supabase
            .from('inventory_items')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    },

    async adjustStock(id: string, newStock: number, restaurantId: string, reason: string = 'manual') {
        const { data: item } = await supabase
            .from('inventory_items')
            .select('current_stock')
            .eq('id', id)
            .eq('restaurant_id', restaurantId)
            .single();
        if (!item) throw new Error("Item not found");

        const difference = newStock - item.current_stock;

        // 1. Update stock
        const { error: updateErr } = await supabase
            .from('inventory_items')
            .update({ current_stock: newStock })
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (updateErr) throw updateErr;

        // 2. Log adjustment
        await supabase.from('inventory_adjustment_log').insert({
            restaurant_id: restaurantId,
            inventory_item_id: id,
            adjustment_type: reason,
            quantity: difference,
            reason: `Adjusted to ${newStock}`
        });
    },

    async fetchDashboardStats(restaurantId: string) {
        const { data: items } = await supabase.from('inventory_items').select('*').eq('restaurant_id', restaurantId);
        const { data: alerts } = await supabase.from('inventory_alerts').select('*').eq('restaurant_id', restaurantId).eq('status', 'unread');

        const totalValue = items?.reduce((sum, item) => sum + (item.current_stock * item.cost_per_unit), 0) || 0;
        const lowStockCount = items?.filter(item => item.current_stock <= item.min_threshold).length || 0;
        const predictedShortageCount = alerts?.filter(a => a.alert_type === 'shortage_predicted').length || 0;

        // Mock Wastage % for visual as we don't have enough historical logic to calculate full shrinkage % yet in this MVP
        const wastagePercent = 2.4;

        return {
            totalValue,
            lowStockCount,
            predictedShortageCount,
            wastagePercent
        };
    },

    async fetchActiveAlerts(restaurantId: string) {
        const { data, error } = await supabase
            .from('inventory_alerts')
            .select('*, inventory_item:inventory_items(*)')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'unread')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as InventoryAlert[];
    },

    async markAlertRead(id: string, restaurantId: string) {
        const { error } = await supabase
            .from('inventory_alerts')
            .update({ status: 'read' })
            .eq('id', id)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    }
};
