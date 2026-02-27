import { createClient } from '@/lib/supabase';

export interface Category {
    id: number;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    count?: number; // Virtual count
    sort_order?: number;
    sub_categories?: SubCategory[]; // Virtual field
}

export interface SubCategory {
    id: number;
    category_id: number;
    name: string;
    sort_order?: number;
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
}
const supabase = createClient();

export const MenuService = {
    /**
     * Fetch all categories
     */
    async fetchCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // Fallback

        if (error) throw error;
        return data as Category[];
    },

    /**
     * Fetch all subcategories for a category
     */
    async fetchSubCategories(categoryId: number) {
        const { data, error } = await supabase
            .from('sub_categories')
            .select('*')
            .eq('category_id', categoryId)
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        return data as SubCategory[];
    },

    /**
     * Fetch all menu items
     */
    async fetchMenuItems() {
        const { data, error } = await supabase
            .from('menu_items')
            .select(`
                *,
                categories (name),
                sub_categories (name)
            `)
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true }); // Fallback

        if (error) throw error;
        return data?.map(item => ({
            ...item,
            category: item.categories,
            sub_category: item.sub_categories
        })) as MenuItem[];
    },

    /**
     * Create a new menu item
     */
    async createMenuItem(item: Omit<MenuItem, 'id'>) {
        const id = Math.floor(Date.now() / 1000);

        const { data, error } = await supabase
            .from('menu_items')
            .insert({
                id: id,
                name: item.name,
                category_id: item.category_id,
                sub_category_id: item.sub_category_id,
                price: item.price,
                description: item.description,
                is_available: item.is_available,
                item_type: item.item_type,
                // is_veg: item.item_type === 'Veg', // Sync legacy column if we kept it? Plan didn't say to drop.
                image_url: item.image_url,
                preparation_time: item.preparation_time,
                sort_order: 9999 // Default to end
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },
    // ...
    /**
     * Create a new category
     */
    async createCategory(name: string) {
        const id = Math.floor(Date.now() / 1000);
        const slug = name.toLowerCase().replace(/ /g, '-');

        const { data, error } = await supabase
            .from('categories')
            .insert({
                id,
                name,
                slug,
                sort_order: 9999 // Default to end
            })
            .select()
            .single();

        if (error) throw error;

        // Create default "General" subcategory for new category
        try {
            await this.createSubCategory(id, 'General');
        } catch (e) {
            console.error('Failed to create default subcategory', e);
        }

        return data;
    },

    /**
     * Create a new subcategory
     */
    async createSubCategory(categoryId: number, name: string) {
        const id = Math.floor(Date.now() / 1000);

        const { data, error } = await supabase
            .from('sub_categories')
            .insert({
                id,
                category_id: categoryId,
                name,
                sort_order: 9999
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },
    /**
     * Toggle availability or update item
     */
    async updateMenuItem(id: number, updates: Partial<MenuItem>) {
        const { error } = await supabase
            .from('menu_items')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Delete a menu item
     */
    async deleteMenuItem(id: number) {
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Delete a category
     */
    async deleteCategory(id: number) {
        // Manual cascade delete items
        const { error: itemsError } = await supabase
            .from('menu_items')
            .delete()
            .eq('category_id', id);

        if (itemsError) throw itemsError;

        // Manual cascade delete subcategories
        const { error: subError } = await supabase
            .from('sub_categories')
            .delete()
            .eq('category_id', id);

        if (subError) throw subError;

        // Then delete the category
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Delete a subcategory
     */
    async deleteSubCategory(id: number) {
        // Warning: This will set items' sub_category_id to NULL due to DB constraint (SET NULL)
        // OR we should delete them? 
        // User didn't specify. Usually we delete or warn.
        // Given we put "General" as default, maybe we shouldn't allow deleting the last subcategory?
        // For now, let's just delete the subcategory. The items will be "orphaned" from a subcategory perspective
        // but still in the category. They might disappear from UI if filtered by subcategory.
        // Better: Manual cascade or move to another?
        // Let's rely on DB 'SET NULL' for now and UI will show "Uncategorized" or we ensure at least one exists.

        const { error } = await supabase
            .from('sub_categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Reorder categories
     */
    async reorderCategories(items: Partial<Category>[]) {
        const { error } = await supabase
            .from('categories')
            .upsert(items as any, { onConflict: 'id' });

        if (error) throw error;
    },

    /**
     * Reorder subcategories
     */
    async reorderSubCategories(items: Partial<SubCategory>[]) {
        const { error } = await supabase
            .from('sub_categories')
            .upsert(items as any, { onConflict: 'id' });

        if (error) throw error;
    },

    /**
     * Reorder menu items
     */
    async reorderMenuItems(items: Partial<MenuItem>[]) {
        // Remove joined objects
        const cleanItems = items.map(({ category, sub_category, ...rest }) => rest);

        const { error } = await supabase
            .from('menu_items')
            .upsert(cleanItems as any, { onConflict: 'id' });

        if (error) throw error;
    }
};
