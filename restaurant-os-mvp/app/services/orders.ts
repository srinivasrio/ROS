import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { ContextValidator } from '@/app/lib/context-validator';

export type OrderStatus = 'queued' | 'placed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export interface OrderItem {
    id: string; // Cast BigInt to string for frontend
    name: string;
    quantity: number;
    notes?: string;
    price: number;
    status: OrderStatus; // Added status
    served_at?: string; // Timestamptz
    preparing_at?: string;
    estimated_end_at?: string;
    ready_at?: string;
    extended_minutes?: number;
    image_url?: string;
    item_type?: string;
    combo_id?: string;
    combo_name?: string;
    combo_image?: string;
    combo_items?: any;
}

export interface Order {
    id: string;
    order_number: number; // Sequential Order Number
    table_id?: number | null; // Can be null if it's a merged order
    merge_group_id?: string | null; // UUID from table_merge_groups
    status: OrderStatus;
    total_amount: number; // numeric
    amount_paid?: number; // Added to track partial payments
    paid_by?: string; // Track who settled the bill
    coupon_code?: string | null;
    discount_amount?: number;
    waiter_id?: string | null; // UUID from staff
    waiter_name?: string; // Mapped from staff join
    table_number?: string; // Mapped from tables join
    created_at: string;
    completed_at?: string; // Timestamptz
    items?: OrderItem[]; // Populated via join and mapping
    associated_table_ids?: number[]; // Physical table IDs associated with this order/group
}

export interface TableMergeGroup {
    id: string;
    display_name: string;
    total_capacity: number;
    status: 'available' | 'occupied';
    created_at: string;
}

// ... UUID helper ...

// Helper to generate BigInt-ish IDs (since DB is bigint and no serial)
const generateId = () => Math.floor(Date.now() + Math.random() * 1000);

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const OrderService = {
    /**
     * Resolve restaurant slug to actual ID if needed.
     */
    async resolveRestaurantId(idOrSlug: string) {
        if (!idOrSlug) return null;
        // If it's already a UUID or number-like ID, return it
        if (/^\d+$/.test(idOrSlug) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)) {
            return idOrSlug;
        }

        const { data: slugData } = await supabase
            .from('restaurant_profile')
            .select('restaurant_id')
            .eq('slug', idOrSlug.toLowerCase())
            .maybeSingle();
        
        return slugData?.restaurant_id || idOrSlug;
    },

    async getStaffByMobile(mobile: string, restaurantId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        if (!actualRestaurantId) return null;

        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('mobile', mobile)
            .eq('restaurant_id', actualRestaurantId);

        if (error) {
            console.error('Error fetching staff by mobile:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            return null;
        }

        // If multiple exist, prioritize the one with 'waiter' role since this is mainly used in waiter contexts
        const waiterStaff = data.find(s => s.role?.toLowerCase() === 'waiter');
        if (waiterStaff) {
            return waiterStaff;
        }

        return data[0];
    },

    /**
     * Fetch all active orders (placed, preparing, ready) with their items.
     */
    async fetchActiveOrders(restaurantId: string, waiterId?: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        
        let query = supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                ),
                staff:waiter_id (name),
                tables:table_id (table_number)
            `)
            .eq('is_completed', false) // Only active orders
            .in('status', ['placed', 'preparing', 'ready', 'served', 'paid'])
            .order('created_at', { ascending: true });

        query = query.eq('restaurant_id', actualId);

        if (waiterId) {
            // Either assigned to me or unassigned
            query = query.or(`waiter_id.eq.${waiterId},waiter_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }

        // Transform for easier consumption
        return data?.map((order: any) => ({
            ...order,
            waiter_name: order.staff?.name,
            table_number: order.tables?.table_number,
            items: order.order_items
                .filter((item: any) => item.status !== 'queued') // Filter out queued items from KDS/Active view
                .map((item: any) => ({
                    ...item,
                    id: String(item.id), // Ensure string for frontend
                    name: item.item_type === 'combo' ? item.combo_name : (item.menu_items?.name || 'Unknown Item'),
                    quantity: item.quantity,
                    notes: item.notes,
                    price: item.price_at_time, // CORRECT COLUMN
                    status: item.status || order.status, // Fallback to order status if null
                    served_at: item.served_at,
                    preparing_at: item.preparing_at,
                    estimated_end_at: item.estimated_end_at,
                    ready_at: item.ready_at,
                    extended_minutes: item.extended_minutes,
                    image_url: item.item_type === 'combo' ? item.combo_image : item.menu_items?.image_url,
                    item_type: item.item_type || 'standard',
                    combo_items: item.combo_items
                }))
        })) as Order[];
    },

    /**
     * Fetch completed/history orders (served, paid, cancelled).
     */
    async fetchHistoryOrders(restaurantId: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);

        let query = supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                ),
                tables:table_id (table_number)
            `)
            .eq('is_completed', true) // Only archived orders
            .in('status', ['served', 'paid', 'cancelled'])
            .order('created_at', { ascending: false });

        const { data, error } = await query.eq('restaurant_id', actualId);

        if (error) {
            console.error('Error fetching history:', error);
            throw error;
        }

        return data?.map(order => ({
            ...order,
            table_number: (order as any).tables?.table_number,
            items: order.order_items.map((item: any) => ({
                ...item,
                id: String(item.id),
                name: item.item_type === 'combo' ? item.combo_name : (item.menu_items?.name || 'Unknown Item'),
                quantity: item.quantity,
                notes: item.notes,
                price: item.price_at_time,
                served_at: item.served_at,
                image_url: item.item_type === 'combo' ? item.combo_image : item.menu_items?.image_url,
                item_type: item.item_type || 'standard',
                combo_items: item.combo_items
            }))
        })) as Order[];
    },

    /**
     * Fetch table information including restaurant_id.
     */
    async getTableInfo(tableId: number) {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('id', tableId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch merge group information including restaurant_id.
     */
    async getMergeGroupInfo(mergeGroupId: string) {
        const { data, error } = await supabase
            .from('table_merge_groups')
            .select('*')
            .eq('id', mergeGroupId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Find table and restaurant info from a table ID (used for redirection)
     */
    async findTableAnywhere(tableId: string | number, restaurantId?: string): Promise<any> {
        // 1. Check table_merge_groups (UUID or display_name like '1+2')
        if (typeof tableId === 'string' && isNaN(Number(tableId))) {
            const isUUID = tableId.includes('-');
            let query = supabase.from('table_merge_groups').select('*');
            if (restaurantId) query = query.eq('restaurant_id', restaurantId);

            if (isUUID) {
                query = query.eq('id', tableId);
            } else {
                query = query.eq('display_name', decodeURIComponent(tableId));
            }
            const { data } = await query.maybeSingle();
            if (data) return data;
        }

        const numId = Number(tableId);

        // 2. First try by table_number (this is what the URL/waiter passes — e.g. '1')
        if (tableId !== undefined && tableId !== null && tableId !== '') {
            let tableByNumberQuery = supabase
                .from('tables')
                .select('*')
                .eq('table_number', String(tableId));
            if (restaurantId) tableByNumberQuery = tableByNumberQuery.eq('restaurant_id', restaurantId);
            const { data: byNumber } = await tableByNumberQuery.maybeSingle();
            if (byNumber) {
                if (byNumber.is_merged && byNumber.merged_group_id) {
                    // Resolve to the merge group info
                    return this.findTableAnywhere(byNumber.merged_group_id, restaurantId);
                }
                return byNumber;
            }
        }

        // 3. Fallback: check physical tables by primary key ID (bigint)
        if (!isNaN(numId)) {
            let tableByIdQuery = supabase.from('tables').select('*').eq('id', numId);
            if (restaurantId) tableByIdQuery = tableByIdQuery.eq('restaurant_id', restaurantId);
            const { data } = await tableByIdQuery.maybeSingle();
            if (data) {
                if (data.is_merged && data.merged_group_id) {
                    return this.findTableAnywhere(data.merged_group_id, restaurantId);
                }
                return data;
            }
        }

        return null;
    },

    /**
     * Verify if a table exists and return its info.
     */
    async verifyTableExists(restaurantId: string, tableId: number | string) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        return this.findTableAnywhere(tableId, actualId);
    },

    /**
     * Add a new table to the database.
     */
    async addTable(tableNumber: string, capacity: number, restaurantId: string) {
        // 1. Check if table_number already exists for this restaurant
        const { data: existingTable } = await supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('table_number', tableNumber)
            .maybeSingle();

        if (existingTable) {
            throw new Error(`Table '${tableNumber}' already exists.`);
        }

        // 2. Insert into tables (Database auto-generates the ID)
        const { data, error } = await supabase
            .from('tables')
            .insert({
                table_number: tableNumber,
                capacity: capacity,
                status: 'free',
                restaurant_id: restaurantId
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a table (only empty/free tables).
     */
    async deleteTable(tableId: number, restaurantId: string) {
        const { error } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    },

    /**
     * Fetch all physical tables.
     */
    async fetchTables(restaurantId: string, waiterId?: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);

        let query = supabase
            .from('tables')
            .select('*')
            .order('table_number', { ascending: true });

        query = query.eq('restaurant_id', actualId);

        if (waiterId) {
            // Filter: Either assigned to me or unassigned
            query = query.or(`assigned_waiter_id.eq.${waiterId},assigned_waiter_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching tables:', error);
            throw error;
        }
        return data || [];
    },

    /**
     * Fetch all active table merge groups.
     */
    async fetchMergeGroups(restaurantId: string, waiterId?: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);

        let query = supabase
            .from('table_merge_groups')
            .select('*')
            .order('created_at', { ascending: false });

        query = query.eq('restaurant_id', actualId);

        if (waiterId) {
            query = query.or(`assigned_waiter_id.eq.${waiterId},assigned_waiter_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching merge groups:', error);
            throw error;
        }
        return data as TableMergeGroup[];
    },

    /**
     * Merge multiple free tables into a single virtual group.
     */
    async mergeTables(tableIds: number[], restaurantId: string, branchId?: string) {
        if (!tableIds || tableIds.length < 2) throw new Error('Need at least 2 tables to merge.');

        // 0. Validate Context (Basic)
        await ContextValidator.validateOwnership({ restaurantId, branchId });

        // 1. Verify all tables are free, not already merged, and belong to the same restaurant
        const { data: tablesToMerge, error: fetchError } = await supabase
            .from('tables')
            .select('id, table_number, capacity, status, is_merged, restaurant_id')
            .in('id', tableIds)
            .eq('restaurant_id', restaurantId);

        if (fetchError) throw fetchError;
        if (!tablesToMerge || tablesToMerge.length !== tableIds.length) {
            throw new Error('Some tables could not be found or do not belong to this restaurant.');
        }

        let totalCapacity = 0;
        const tableNumbers: string[] = [];
        for (const t of tablesToMerge) {
            if (t.status !== 'free' && t.status !== 'available') throw new Error(`Table ${t.table_number} is occupied.`);
            if (t.is_merged) throw new Error(`Table ${t.table_number} is already merged.`);
            totalCapacity += t.capacity || 0;
            tableNumbers.push(String(t.table_number));
        }

        // Generate friendly name: "Table 1 + 2 + 3"
        const displayName = `Table ` + tableNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(' + ');

        // 2. Create the Merge Group
        const mergeGroupId = generateUUID();
        const { data: newGroup, error: insertError } = await supabase
            .from('table_merge_groups')
            .insert({
                id: mergeGroupId,
                display_name: displayName,
                total_capacity: totalCapacity,
                status: 'occupied', // Treat merged group as logically occupied immediately to avoid race conditions
                restaurant_id: restaurantId
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 3. Update the physical tables
        const { error: updateError } = await supabase
            .from('tables')
            .update({
                status: 'occupied',
                is_merged: true,
                merged_group_id: mergeGroupId
            })
            .in('id', tableIds);

        if (updateError) {
            // Rollback group creation (basic compensation)
            await supabase.from('table_merge_groups').delete().eq('id', mergeGroupId);
            throw updateError;
        }

        return newGroup;
    },

    /**
     * Unmerge a merged table group.
     * Ensures all bills are settled before unmerging.
     */
    async unmergeTables(mergeGroupId: string, restaurantId: string, branchId?: string) {
        // 0. Validate Ownership
        await ContextValidator.validateOwnership({ restaurantId, branchId });
        // 1. Ensure no active orders for this merge group
        const { count, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merge_group_id', mergeGroupId)
            .eq('restaurant_id', restaurantId)
            .eq('is_completed', false);

        if (countError) throw countError;
        if (count && count > 0) {
            throw new Error('Cannot unmerge: there are still active orders (bill not closed).');
        }

        // 2. Clear tables back to free & unmerged
        const { error: tablesError } = await supabase
            .from('tables')
            .update({
                status: 'free',
                is_merged: false,
                merged_group_id: null
            })
            .eq('merged_group_id', mergeGroupId)
            .eq('restaurant_id', restaurantId);

        if (tablesError) throw tablesError;

        // 3. Delete the merge group
        const { error: deleteError } = await supabase
            .from('table_merge_groups')
            .delete()
            .eq('id', mergeGroupId)
            .eq('restaurant_id', restaurantId);

        if (deleteError) throw deleteError;
    },

    /**
     * Subscribe to real-time changes on the 'orders' table.
     * Support optional waiterId for waiter-specific channels.
     */
    subscribeToOrders(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<Order>) => void, waiterId?: string, branchId?: string) {
        let filter = `restaurant_id=eq.${restaurantId}`;
        if (branchId) {
            filter += `,branch_id=eq.${branchId}`;
        }
        if (waiterId) {
            filter += `,waiter_id=eq.${waiterId}`;
        }

        const channel = supabase
            .channel(`orders-channel-${restaurantId}-${branchId || 'main'}-${waiterId || 'all'}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'orders',
                    filter: filter
                },
                (payload) => onChange(payload as unknown as RealtimePostgresChangesPayload<Order>)
            );

        channel.subscribe();

        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    /**
     * Subscribe to real-time changes on the 'order_items' table.
     * Essential for KDS to know when items are added to an order.
     */
    subscribeToOrderItems(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let filter = `restaurant_id=eq.${restaurantId}`;
        if (branchId) {
            filter += `,branch_id=eq.${branchId}`;
        }

        const channel = supabase
            .channel(`order-items-channel-${restaurantId}-${branchId || 'main'}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'order_items',
                    filter: filter
                },
                (payload) => onChange(payload)
            );
        channel.subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    subscribeToMenuItems(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let filter = `restaurant_id=eq.${restaurantId}`;
        if (branchId) {
            filter += `,branch_id=eq.${branchId}`;
        }

        const channel = supabase
            .channel(`menu_items_channel-${restaurantId}-${branchId || 'main'}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'menu_items',
                    filter: filter
                },
                onChange
            );
        channel.subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    /**
     * Subscribe to real-time changes on the 'tables' table.
     */
    subscribeToTables(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let filter = `restaurant_id=eq.${restaurantId}`;
        if (branchId) {
            filter += `,branch_id=eq.${branchId}`;
        }

        const channel = supabase
            .channel(`tables-channel-${restaurantId}-${branchId || 'main'}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'tables',
                    filter: filter
                },
                (payload) => onChange(payload)
            );
        channel.subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    /**
     * Subscribe to real-time changes on table_merge_groups.
     */
    subscribeToMergeGroups(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let filter = `restaurant_id=eq.${restaurantId}`;
        if (branchId) {
            filter += `,branch_id=eq.${branchId}`;
        }

        const channel = supabase
            .channel(`merge-groups-channel-${restaurantId}-${branchId || 'main'}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'table_merge_groups',
                    filter: filter
                },
                (payload) => onChange(payload)
            );
        channel.subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    /**
     * Update the status of a specific order.
     */
    async updateOrderStatus(orderId: string, restaurantId: string, status: OrderStatus, staffId?: string, branchId?: string) {
        // 0. Validate Context Ownership
        await ContextValidator.validateOwnership({
            restaurantId,
            orderId,
            staffId,
            branchId
        });

        // 1. Cascade update to all items FIRST
        // This ensures that when the "Order Updated" realtime event fires (step 2),
        // the items are ALREADY in the correct state for any listeners fetching full details.
        let itemsQuery = supabase.from('order_items').update({ 
            status
        }).eq('order_id', orderId);

        if (status === 'preparing') {
            itemsQuery = itemsQuery.or('status.eq.placed,status.eq.queued,status.is.null') as any;
        } else if (status === 'ready') {
            itemsQuery = itemsQuery.or('status.eq.placed,status.eq.preparing,status.is.null') as any;
        } else if (status === 'served') {
            itemsQuery = supabase.from('order_items').update({ 
                status,
                served_at: new Date().toISOString()
            }).eq('order_id', orderId).neq('status', 'paid') as any;
        } else if (status === 'placed') {
            itemsQuery = supabase.from('order_items').update({
                status
            }).eq('order_id', orderId).eq('status', 'queued') as any;
        }

        const { error: itemsError } = await itemsQuery;

        if (itemsError) {
            console.error('Failed to cascade status to items', itemsError);
            throw itemsError; // Fail fast if items fail
        }

        // 2. Update Order Status (Second)
        // This triggers the main "Order Updated" event for dashboards
        const { data: updatedOrder, error } = await supabase
            .from('orders')
            .update({ 
                status
            })
            .eq('id', orderId)
            .select('table_id, merge_group_id') // Fetch IDs for cleanup
            .single();

        if (error) throw error;

        // 3. Cleanup Alerts if Served/Paid/Cancelled
        if (['served', 'paid', 'cancelled'].includes(status) && updatedOrder) {
            let tableIdsToClear: number[] = [];

            if (updatedOrder.merge_group_id) {
                // If it's a merged order, gather all table IDs in that merge group
                const { data: mergedTables } = await supabase
                    .from('tables')
                    .select('id')
                    .eq('merged_group_id', updatedOrder.merge_group_id);

                if (mergedTables) {
                    tableIdsToClear = mergedTables.map(t => t.id);
                }
            } else if (updatedOrder.table_id) {
                // Otherwise, just clear the specific table
                tableIdsToClear = [updatedOrder.table_id];
            }

            if (tableIdsToClear.length > 0) {
                await supabase
                    .from('service_requests')
                    .delete()
                    .in('table_id', tableIdsToClear)
                    .eq('request_type', 'order_ready')
                    .eq('status', 'pending');
            }
        }
    },

    /**
     * Temporary: Helper to create a test order for verification
     * Auto-seeds menu_items and tables if empty.
     */
    async createTestOrder(tableId: number, restaurantId: string) {
        // 0. Ensure Table exists (for FK)
        const { data: table } = await supabase.from('tables')
            .select('id')
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId)
            .single();
            
        if (!table) {
            console.log('Seeding Table', tableId);
            const { error: tableErr } = await supabase.from('tables').insert({
                id: tableId,
                table_number: String(tableId),
                status: 'free',
                restaurant_id: restaurantId
            });
            if (tableErr) console.error('Table Seed Error', tableErr);
        }

        // 1. Ensure a Menu Item exists to link to
        let { data: menuItem } = await supabase.from('menu_items')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .limit(1)
            .single();

        if (!menuItem) {
            console.log('Seeding Menu Items...');
            let { data: cat } = await supabase.from('categories')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .limit(1)
                .single();
            if (!cat) {
                const catId = generateId();
                const { data: newCat, error: catErr } = await supabase.from('categories').insert({
                    id: catId,
                    name: 'Starters',
                    slug: 'starters',
                    restaurant_id: restaurantId
                }).select().single();

                cat = newCat || { id: catId };
            }

            const menuId = generateId();
            const { data: newItem, error: menuErr } = await supabase.from('menu_items').insert({
                id: menuId,
                name: 'Test Biryani',
                price: 350,
                category_id: cat?.id,
                description: 'Delicious test item',
                is_available: true,
                restaurant_id: restaurantId
            }).select().single();

            if (menuErr) {
                console.error('Seeding error', menuErr);
                throw menuErr;
            }
            menuItem = newItem;
        }

        if (!menuItem) throw new Error('Failed to find or create menu item');

        // 2. Create Order
        const orderId = generateUUID();
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                id: orderId, // Manually Generate UUID
                table_id: tableId,
                status: 'placed',
                total_amount: 450,
                is_completed: false,
                restaurant_id: restaurantId
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 3. Create Order Items linked to Menu Item
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert([
                {
                    id: generateId(), // Manual ID
                    order_id: order.id,
                    menu_item_id: menuItem.id,
                    quantity: 1,
                    price_at_time: 350, // CORRECT COLUMN
                    notes: 'Spicy',
                    restaurant_id: restaurantId
                }
            ]);

        if (itemsError) throw itemsError;
        return order;
    },

    /**
     * Create a real order from the Waiter Panel or Customer Panel.
     */
    async createOrder(tableIdentifier: string | number, items: any[], restaurantId: string, initialStatus: OrderStatus = 'placed', waiterId?: string, couponCode?: string, discountAmount?: number) {
        // 0. Resolve restaurantId slug → actual ID
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        let identifierColumn = 'table_id';
        let identifierValue: string | number = tableIdentifier;
        let isMerged = false;

        // 1. Resolve the table identifier → actual DB row
        //    Pass restaurantId so we can scope table_number lookups correctly
        const physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
        if (physicalTable) {
            // Check if it's a merge group (from table_merge_groups)
            const isGroupRecord = 'display_name' in physicalTable;

            if (isGroupRecord || physicalTable.merged_group_id) {
                isMerged = true;
                identifierColumn = 'merge_group_id';
                identifierValue = isGroupRecord ? physicalTable.id : physicalTable.merged_group_id;
            } else {
                identifierColumn = 'table_id';
                identifierValue = physicalTable.id; // actual bigint DB id
            }
        } else if (isNaN(Number(tableIdentifier)) && String(tableIdentifier).includes('-')) {
            // Already a merge-group UUID
            isMerged = true;
            identifierColumn = 'merge_group_id';
            identifierValue = tableIdentifier;
        } else {
            console.warn(`[createOrder] Could not resolve table identifier: ${tableIdentifier} for restaurant: ${actualRestaurantId}`);
        }

        // 2. Calculate Total
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = Math.round(subtotal * 0.05);
        const newItemsTotal = subtotal + tax;

        // 3. Check for existing active (non-completed) order on this table
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('*')
            .eq(identifierColumn, identifierValue)
            .eq('restaurant_id', actualRestaurantId)
            .eq('is_completed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let orderId: string;
        let finalTotal = newItemsTotal;

        if (existingOrder) {
            orderId = existingOrder.id;
            finalTotal = existingOrder.total_amount + newItemsTotal;

            const { error: updateError } = await supabase
                .from('orders')
                .update({ total_amount: finalTotal })
                .eq('id', orderId);

            if (updateError) throw updateError;
        } else {
            // Create a brand-new order
            orderId = generateUUID();
            const orderInsert: any = {
                id: orderId,
                status: initialStatus,
                total_amount: finalTotal,
                amount_paid: 0,
                is_completed: false,
                waiter_id: waiterId || null,
                restaurant_id: actualRestaurantId,
                coupon_code: couponCode || null,
                discount_amount: discountAmount || 0,
            };
            orderInsert[identifierColumn] = identifierValue;

            const { error: orderError } = await supabase.from('orders').insert(orderInsert);
            if (orderError) throw orderError;
        }

        // 4. Insert Order Items
        const orderItems = items.map(item => ({
            id: generateId(),
            order_id: orderId,
            restaurant_id: actualRestaurantId,
            menu_item_id: item.item_type === 'combo' ? null : (item.menu_item_id || null),
            quantity: item.quantity,
            notes: item.notes || '',
            price_at_time: item.price,
            status: initialStatus === 'queued' ? 'queued' : 'placed',
            item_type: item.item_type || 'standard',
            combo_id: item.combo_id || null,
            combo_name: item.combo_name || null,
            combo_image: item.combo_image || null,
            combo_items: item.combo_items || null,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        // 5. Mark the table as occupied
        if (initialStatus !== 'queued') {
            if (isMerged) {
                await supabase
                    .from('table_merge_groups')
                    .update({ status: 'occupied' })
                    .eq('id', identifierValue)
                    .eq('restaurant_id', actualRestaurantId);
            } else {
                await supabase
                    .from('tables')
                    .update({ status: 'occupied' })
                    .eq('id', identifierValue)
                    .eq('restaurant_id', actualRestaurantId);
            }
        }

        return { id: orderId };
    },

    /**
     * Updates an existing order with a coupon code and discount amount.
     */
    async updateOrderCoupon(orderId: string, restaurantId: string, couponCode: string, discountAmount: number) {
        const { error } = await supabase
            .from('orders')
            .update({
                coupon_code: couponCode,
                discount_amount: discountAmount
            })
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);

        if (error) {
            console.error('Error updating order coupon:', error);
            throw error;
        }
        return true;
    },

    /**
     * Delete an entire order (Cancellation).
     */
    async deleteOrder(orderId: string, restaurantId: string) {
        // 1. Delete items first (Cascade usually handles this, but good to be explicit)
        // Note: items don't have restaurant_id, but the order does.
        await supabase.from('order_items').delete().eq('order_id', orderId);

        // 2. Delete Order
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    },

    /**
     * Delete a specific order item.
     */
    async deleteOrderItem(itemId: string, restaurantId: string) {
        // 1. Get Item details for price calculation
        // We join with orders to check restaurant_id
        const { data: item } = await supabase
            .from('order_items')
            .select('price_at_time, quantity, order_id, orders!inner(restaurant_id)')
            .eq('id', itemId)
            .eq('orders.restaurant_id', restaurantId)
            .single();

        if (!item) return;

        // 2. Delete Item
        const { error } = await supabase.from('order_items').delete().eq('id', itemId);
        if (error) throw error;

        // 3. Update Order Total
        const amountDeduction = item.price_at_time * item.quantity;

        // Get current total
        const { data: order } = await supabase
            .from('orders')
            .select('total_amount, order_items(id)')
            .eq('id', item.order_id)
            .single();

        if (order) {
            // If no items left, delete order?
            if (order.order_items.length === 0) { // Note: array might still contain the deleted one depending on fetch timing, but here we assume it returns current
                // Actually fetch active items count
                const { count } = await supabase.from('order_items').select('*', { count: 'exact', head: true }).eq('order_id', item.order_id);
                if (count === 0) {
                    await this.deleteOrder(item.order_id, restaurantId);
                    return;
                }
            }

            // Update total
            await supabase
                .from('orders')
                .update({ total_amount: order.total_amount - amountDeduction })
                .eq('id', item.order_id)
                .eq('restaurant_id', restaurantId);
        }
    },

    /**
     * Fetch full details for a specific order by ID.
     */
    async getOrderDetails(orderId: string, restaurantId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                ),
                tables:table_id (table_number),
                table_merge_groups:merge_group_id (display_name)
            `)
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching order details:', error);
            // return null or throw? For notification context, null is safer to avoid crashing
            return null;
        }

        if (!data) return null;

        // Transform
        return {
            ...data,
            table_number: (data as any).table_merge_groups?.display_name || (data as any).tables?.table_number,
            items: data.order_items.map((item: any) => ({
                ...item,
                id: String(item.id),
                name: item.menu_items?.name || 'Unknown Item',
                quantity: item.quantity,
                notes: item.notes,
                price: item.price_at_time,
                status: item.status || data.status,
                served_at: item.served_at,
                image_url: item.menu_items?.image_url
            }))
        } as Order;
    },

    /**
     * Fetch active order for a specific table or merge group.
     */
    async getActiveOrderForTable(tableIdentifier: number | string, restaurantId: string) {
        // Resolve the restaurant slug → actual ID
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Resolve the table identifier (display number OR DB id OR merge-group UUID)
        // by searching table_number first, then DB id — same logic as createOrder
        let identifierColumn = 'table_id';
        let identifierValue: number | string = tableIdentifier;
        let isMerged = false;

        const physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
        
        if (physicalTable) {
            // Check if it's a merge group (from table_merge_groups)
            // merge_groups have 'display_name', physical tables have 'table_number'
            const isGroupRecord = 'display_name' in physicalTable;
            
            if (isGroupRecord || physicalTable.merged_group_id) {
                isMerged = true;
                identifierColumn = 'merge_group_id';
                identifierValue = isGroupRecord ? physicalTable.id : physicalTable.merged_group_id;
            } else {
                identifierColumn = 'table_id';
                identifierValue = physicalTable.id; // actual bigint DB id
            }
        } else if (isNaN(Number(tableIdentifier)) && String(tableIdentifier).includes('-')) {
            // Already a merge-group UUID
            isMerged = true;
            identifierColumn = 'merge_group_id';
            identifierValue = tableIdentifier;
        } else {
            console.warn(`[getActiveOrderForTable] Could not resolve table: ${tableIdentifier} for restaurant: ${actualRestaurantId}`);
        }

        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url, preparation_time)
                ),
                tables (
                    status
                ),
                table_merge_groups (
                    status
                )
            `)
            .eq(identifierColumn, identifierValue)
            .eq('restaurant_id', actualRestaurantId)
            .eq('is_completed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching order for table:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                identifierColumn,
                identifierValue
            });
            throw error;
        }

        if (!data) return null;

        // Fetch associated physical table IDs if it's a merge group or a single table
        let associatedTableIds: number[] = [];
        if (isMerged && identifierColumn === 'merge_group_id') {
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', identifierValue)
                .eq('restaurant_id', actualRestaurantId);
            if (tables) associatedTableIds = tables.map(t => t.id);
        } else if (identifierColumn === 'table_id') {
            associatedTableIds = [Number(identifierValue)];
        }

        return {
            ...data,
            associated_table_ids: associatedTableIds,
            items: data.order_items.map((item: any) => ({
                ...item,
                id: String(item.id),
                name: item.item_type === 'combo' ? (item.combo_name || 'Combo') : (item.menu_items?.name || 'Unknown Item'),
                quantity: item.quantity,
                notes: item.notes,
                price: item.price_at_time,
                status: item.status || data.status,
                served_at: item.served_at,
                preparing_at: item.preparing_at,
                estimated_end_at: item.estimated_end_at,
                ready_at: item.ready_at,
                extended_minutes: item.extended_minutes,
                image_url: item.item_type === 'combo' ? item.combo_image : item.menu_items?.image_url
            }))
        } as Order;
    },

    /**
     * Settle the bill for an order.
     * Marks order as 'paid' AND updates amount_paid.
     */
    async settleBill(orderId: string, restaurantId: string, _frontendTotal?: number, paidBy: string = 'System', staffId?: string) {
        // 1. Fetch latest total from DB to ensure we don't use stale frontend data
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('total_amount, discount_amount')
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId)
            .single();

        if (fetchError || !order) throw fetchError || new Error('Order not found');

        // 2. Settle fully based on DB total minus discount AND set completed_at
        const payableAmount = (order.total_amount || 0) - (order.discount_amount || 0);
        const { error } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                amount_paid: payableAmount,
                paid_by: paidBy,
                completed_at: new Date().toISOString() // Set completed time
            })
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // 3. Mark all items as paid
        const { error: itemsError } = await supabase
            .from('order_items')
            .update({ status: 'paid' })
            .eq('order_id', orderId);

        if (itemsError) console.error('Failed to mark items as paid:', itemsError);
    },

    /**
     * Update the status of a specific order item.
     */
    async updateOrderItemStatus(itemId: string, restaurantId: string, status: OrderStatus, staffId?: string) {
        // 1. Update the Item
        const updateData: any = { status };
        
        if (status === 'preparing') {
            const now = new Date();
            updateData.preparing_at = now.toISOString();
            
            // Get preparation_time from associated menu_item
            const { data: itemData } = await supabase
                .from('order_items')
                .select('menu_items(preparation_time)')
                .eq('id', itemId)
                .single();
            
            const prepTime = (itemData as any)?.menu_items?.preparation_time || 15;
            const estimatedEnd = new Date(now.getTime() + prepTime * 60000);
            updateData.estimated_end_at = estimatedEnd.toISOString();
            updateData.extended_minutes = 0;
        } else if (status === 'ready') {
            updateData.ready_at = new Date().toISOString();
        } else if (status === 'served') {
            updateData.served_at = new Date().toISOString();
        }

        const { data: item, error } = await supabase
            .from('order_items')
            .update(updateData)
            .eq('id', itemId)
            .select('order_id')
            .single();

        if (error) throw error;
        if (!item) return;

        // Trigger "Order Ready" Alert if item is marked ready
        if (status === 'ready') {
            const { data: order } = await supabase
                .from('orders')
                .select('table_id, restaurant_id')
                .eq('id', item.order_id)
                .single();

            if (order && order.restaurant_id) {
                // Always create a FRESH alert to notify the waiter again.
                // 1. Remove ANY existing pending 'order_ready' requests for this table
                const { error: deleteError } = await supabase
                    .from('service_requests')
                    .delete()
                    .eq('table_id', order.table_id)
                    .eq('request_type', 'order_ready')
                    .eq('status', 'pending');

                if (deleteError) {
                    console.error('Failed to cleanup old order_ready alerts:', deleteError);
                }

                // 2. Create NEW 'order_ready' request
                await this.submitServiceRequest(order.table_id, 'order_ready', order.restaurant_id);
            }
        }

        // 2. Check siblings to sync Parent Order Status
        const { data: siblings } = await supabase
            .from('order_items')
            .select('status')
            .eq('order_id', item.order_id);

        if (!siblings) return;

        const allSiblings = siblings.map(s => s.status);
        const uniqueStatuses = new Set(allSiblings);

        let newOrderStatus: OrderStatus | null = null;

        // Logic:
        // - If ALL items are 'served', Order -> 'served'
        // - If ALL items are 'ready' (or served), Order -> 'ready'
        // - If ANY item is 'preparing' (or ready/served) but not all served, Order -> 'preparing'? 
        //   Actually KDS flow: 
        //   - Placed -> Preparing (if any item starts cooking)
        //   - Preparing -> Ready (if ALL items are ready)
        //   - Ready -> Served (if ALL items are served)

        const allServed = siblings.every(s => s.status === 'served');
        const allReadyOrServed = siblings.every(s => ['ready', 'served'].includes(s.status));
        const anyPreparing = siblings.some(s => ['preparing', 'ready', 'served'].includes(s.status)); // Any progress

        if (allServed) {
            newOrderStatus = 'served';
        } else if (allReadyOrServed) {
            newOrderStatus = 'ready';
        } else if (anyPreparing) {
            newOrderStatus = 'preparing';
        }

        // Only update if different and significant
        if (newOrderStatus) {
            await supabase
                .from('orders')
                .update({ status: newOrderStatus })
                .eq('id', item.order_id);
        }
    },

    /**
     * Extend the preparation timer for an order item.
     */
    async extendOrderItemTimer(itemId: string, additionalMinutes: number) {
        const { data: currentItem, error: fetchError } = await supabase
            .from('order_items')
            .select('estimated_end_at, extended_minutes')
            .eq('id', itemId)
            .single();

        if (fetchError || !currentItem) throw fetchError || new Error('Item not found');

        const currentEstimatedEnd = new Date(currentItem.estimated_end_at);
        const newEstimatedEnd = new Date(currentEstimatedEnd.getTime() + additionalMinutes * 60000);
        const totalExtended = (currentItem.extended_minutes || 0) + additionalMinutes;

        const { error: updateError } = await supabase
            .from('order_items')
            .update({
                estimated_end_at: newEstimatedEnd.toISOString(),
                extended_minutes: totalExtended
            })
            .eq('id', itemId);

        if (updateError) throw updateError;
        return { newEstimatedEnd, totalExtended };
    },

    /**
     * Free a table manually.
     * Sets table status to 'free' AND archives the current order.
     */
    async clearTable(tableId: number | string, restaurantId: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        
        if (!physicalTable) {
            console.warn(`[clearTable] Could not resolve table: ${tableId}`);
            // Fallback for direct UUID strings if findTableAnywhere fails
            if (typeof tableId === 'string' && tableId.includes('-')) {
                await this.unmergeTables(tableId, actualRestaurantId);
            }
            return;
        }

        // Remove all pending services for waiter after table is cleared
        await this.dismissTableAlert(tableId, actualRestaurantId);

        const isGroup = 'display_name' in physicalTable;
        const groupId = isGroup ? physicalTable.id : physicalTable.merged_group_id;

        if (groupId) {
            // Archive orders for the group
            const { error: orderError } = await supabase
                .from('orders')
                .update({ is_completed: true })
                .eq('merge_group_id', groupId)
                .eq('restaurant_id', actualRestaurantId)
                .eq('is_completed', false);

            if (orderError) console.error('Failed to archive merged order:', orderError);
            
            // Unmerge the tables
            await this.unmergeTables(groupId, actualRestaurantId);
        } else {
            // Normal table
            const actualTableId = physicalTable.id;

            const { error: tableError } = await supabase
                .from('tables')
                .update({ status: 'free' })
                .eq('id', actualTableId)
                .eq('restaurant_id', actualRestaurantId);

            if (tableError) throw tableError;

            const { error: orderError } = await supabase
                .from('orders')
                .update({ is_completed: true })
                .eq('table_id', actualTableId)
                .eq('restaurant_id', actualRestaurantId)
                .eq('is_completed', false);

            if (orderError) console.error('Failed to archive order:', orderError);
        }
    },

    /**
     * Set table alert status (Call Waiter, Bill Requested).
     * Now delegates to submitServiceRequest or dismissTableAlert for persistence.
     */
    async setTableAlert(tableId: number | string, status: 'call_waiter' | 'bill_requested' | null, restaurantId: string) {
        if (status) {
            await this.submitServiceRequest(tableId, status, restaurantId);
        } else {
            await this.dismissTableAlert(tableId, restaurantId);
        }
    },

    /**
     * Complete/Resolve a specific service request.
     */
    async completeServiceRequest(requestId: number, restaurantId: string) {
        const { error } = await supabase
            .from('service_requests')
            .delete()
            .eq('id', requestId)
            .eq('restaurant_id', restaurantId);

        if (error) {
            console.error('Error completing service request:', error);
        }
    },

    /**
     * Accept a service request (Mark as in-progress/accepted).
     */
    async acceptServiceRequest(requestId: number, restaurantId: string) {
        const { error } = await supabase
            .from('service_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId)
            .eq('restaurant_id', restaurantId);

        if (error) {
            console.error('Error accepting service request:', error);
        }
    },

    /**
     * Mark a service request as delivered.
     */
    async markRequestDelivered(requestId: number, restaurantId: string) {
        const { error } = await supabase
            .from('service_requests')
            .update({ status: 'delivered' })
            .eq('id', requestId)
            .eq('restaurant_id', restaurantId);

        if (error) {
            console.error('Error marking request delivered:', error);
        }
    },

    /**
     * Dismiss a table alert.
     * Clears the table alert status AND resolves all pending service requests for the table.
     */
    async dismissTableAlert(tableId: number | string, restaurantId?: string) {
        const actualRestaurantId = restaurantId ? ((await this.resolveRestaurantId(restaurantId)) || restaurantId) : undefined;

        // Resolve the table
        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        
        if (!physicalTable) {
            console.warn(`[dismissTableAlert] Could not resolve table: ${tableId}`);
            return;
        }

        const isGroup = 'display_name' in physicalTable;
        const groupId = isGroup ? physicalTable.id : physicalTable.merged_group_id;

        if (groupId) {
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', groupId);
            
            if (!tables || tables.length === 0) return;
            const tableIds = tables.map(t => t.id);

            await supabase.from('service_requests')
                .delete()
                .in('table_id', tableIds);

            await supabase.from('tables')
                .update({ alert_status: null })
                .in('id', tableIds);
            return;
        }

        // Plain physical table — use its actual DB id
        const actualTableId = physicalTable.id;
        
        await supabase.from('tables')
            .update({ alert_status: null })
            .eq('id', actualTableId);

        await supabase.from('service_requests')
            .delete()
            .eq('table_id', actualTableId);
    },



    /**
     * Submit a new service request (Water, Bill, etc.)
     * Supports multiple active requests per table.
     * persisted in service_requests AND updates table alert_status.
     */
    async submitServiceRequest(tableId: number | string, type: string, restaurantId: string, quantity: number = 1) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        let actualTableId: number;

        if (!physicalTable) {
            console.error('Table not found for service request:', tableId);
            return;
        }

        const isGroup = 'display_name' in physicalTable;
        if (isGroup) {
            // Pick first table in group for the database record
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', physicalTable.id)
                .order('id', { ascending: true })
                .limit(1);

            if (tables && tables.length > 0) {
                actualTableId = tables[0].id;
            } else {
                console.error('No physical tables found in merge group.');
                return;
            }
        } else {
            actualTableId = physicalTable.id;
        }

        const { error } = await supabase
            .from('service_requests')
            .insert({
                table_id: actualTableId,
                request_type: type,
                status: 'pending',
                quantity: quantity,
                restaurant_id: actualRestaurantId
            });

        if (error) {
            console.error('Failed to submit service request:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        await supabase
            .from('tables')
            .update({ alert_status: type })
            .eq('id', actualTableId);
    },

    /**
     * Bulk transfer all workload from one waiter to another.
     * Includes tables, merge groups, active orders, and pending service requests.
     */
    async transferEntireWorkload(fromWaiterId: string, toWaiterId: string, restaurantId: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);

        // 1. Update Tables
        const { error: tableError } = await supabase
            .from('tables')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('assigned_waiter_id', fromWaiterId);

        if (tableError) console.error('Bulk Transfer Error (Tables):', tableError);

        // 2. Update Merge Groups
        const { error: groupError } = await supabase
            .from('table_merge_groups')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('assigned_waiter_id', fromWaiterId);

        if (groupError) console.error('Bulk Transfer Error (Groups):', groupError);

        // 3. Update Active Orders
        const { error: orderError } = await supabase
            .from('orders')
            .update({ waiter_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('waiter_id', fromWaiterId)
            .neq('status', 'paid')
            .neq('status', 'cancelled');

        if (orderError) console.error('Bulk Transfer Error (Orders):', orderError);

        // 4. Update Pending Service Requests
        const { error: serviceError } = await supabase
            .from('service_requests')
            .update({ assigned_staff_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('assigned_staff_id', fromWaiterId)
            .eq('status', 'pending');

        if (serviceError) console.error('Bulk Transfer Error (Services):', serviceError);

        // 5. Update Staff Table Metrics (Optional if triggered by DB triggers)
        // We'll let the workload sync job or triggers handle the workload score updates.
        
        return { success: !tableError && !groupError && !orderError && !serviceError };
    },

    /**
     * Fetch active service requests (Pending + Recently Resolved).
     * Includes resolved requests from the last 1 hour to keep them visible.
     */
    async fetchActiveServiceRequests(restaurantId: string, waiterId?: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);

        let query = supabase
            .from('service_requests')
            .select(`
                *,
                tables (
                    table_number,
                    assigned_waiter_id
                )
            `)
            .eq('restaurant_id', actualId)
            .in('status', ['pending', 'accepted'])
            .order('created_at', { ascending: true });

        if (waiterId) {
            // Filter: Either specifically assigned to me, or unassigned but table belongs to me, or both unassigned
            // Actually, if waiterId is provided, we usually want to see what's assigned to us OR what is unassigned for OUR tables.
            // For now, let's keep it simple: assigned to me OR (unassigned AND table's waiter is me or null)
            query = query.or(`assigned_staff_id.eq.${waiterId},assigned_staff_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch service requests:', error);
            throw error;
        }

        // Post-filter if needed (Supabase .or across joined tables is tricky)
        if (waiterId) {
            return (data || []).filter(req => {
                // If it's specifically assigned to someone else, hide it
                if (req.assigned_staff_id && req.assigned_staff_id !== waiterId) return false;
                
                // If it's unassigned, check table ownership
                if (!req.assigned_staff_id) {
                    const tableWaiter = req.tables?.assigned_waiter_id;
                    if (tableWaiter && tableWaiter !== waiterId) return false;
                }
                
                return true;
            });
        }

        return data || [];
    },

    /**
     * Fetch active service requests for a specific table.
     */
    async fetchServiceRequestsForTable(tableId: number | string, restaurantId: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Resolve the table identifier to the actual DB id
        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);

        if (!physicalTable) {
            console.warn(`[fetchServiceRequestsForTable] Could not resolve table: ${tableId}`);
            return [];
        }

        // If it's a merged table group, fetch for all physical tables in the group
        if (physicalTable.merged_group_id || (physicalTable.id && typeof physicalTable.display_name === 'string')) {
            // It's a merge group row itself
            const groupId = physicalTable.merged_group_id || physicalTable.id;
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', groupId)
                .eq('restaurant_id', actualRestaurantId);

            if (!tables || tables.length === 0) return [];

            const tableIds = tables.map(t => t.id);
            const { data, error } = await supabase
                .from('service_requests')
                .select('*, tables(table_number)')
                .in('table_id', tableIds)
                .eq('restaurant_id', actualRestaurantId)
                .in('status', ['pending', 'accepted', 'delivered'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        }

        // Plain physical table — use its actual DB id
        const { data, error } = await supabase
            .from('service_requests')
            .select('*, tables(table_number)')
            .eq('table_id', physicalTable.id)
            .eq('restaurant_id', actualRestaurantId)
            .in('status', ['pending', 'accepted', 'delivered'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch table service requests:', error);
            throw error;
        }
        return data;
    },

    /**
     * Resolve a service request (Mark as Served).
     * Updates status to 'resolved'.
     */
    async resolveServiceRequest(requestId: number) {
        // 1. Get request details first to know table_id and type (needed for smart alert update)
        const { data: request } = await supabase
            .from('service_requests')
            .select('table_id, request_type')
            .eq('id', requestId)
            .single();

        if (!request) return;

        // 2. Delete Request (Hard Delete)
        const { error } = await supabase
            .from('service_requests')
            .delete()
            .eq('id', requestId);

        if (error) {
            console.error('Failed to resolve service request:', error);
            throw error;
        }

        // 3. Check for specific interactions (Bill/Water)
        if (request.request_type === 'bill_requested' || request.request_type === 'water_requested') {
            // We might want to keep the table alert status OR clear it if no other similar requests exist.
            // For now, let's keep the logic simple: specific requests are treated as resolved.
            // The "Call Waiter" logic below handles the generic alert status.
        }

        // 3. Smart Update Table Alert Status
        // If the resolved request was the one showing on the table, we should check if there are others.
        // Fetch current table alert status
        const { data: table } = await supabase
            .from('tables')
            .select('alert_status')
            .eq('id', request.table_id)
            .single();

        if (table && table.alert_status === request.request_type) {
            // The resolved request matches the current visual alert.
            // Check for other pending requests for this table
            const { data: nextRequest } = await supabase
                .from('service_requests')
                .select('request_type')
                .eq('table_id', request.table_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false }) // Get latest
                .limit(1)
                .maybeSingle();

            const nextStatus = nextRequest ? nextRequest.request_type : null;

            // Update table status
            await supabase
                .from('tables')
                .update({ alert_status: nextStatus })
                .eq('id', request.table_id);
        }
    },

    async resolveMultipleServiceRequests(requestIds: number[]) {
        if (!requestIds.length) return;

        // 1. Fetch tables associated with these requests BEFORE deleting to know what to update
        const { data: requests } = await supabase
            .from('service_requests')
            .select('table_id')
            .in('id', requestIds);

        // 2. Hard Delete as per user request
        const { error } = await supabase
            .from('service_requests')
            .delete()
            .in('id', requestIds);

        if (error) {
            console.error('Failed to delete multiple requests:', error);
            throw error;
        }

        // 3. Update Alert Status for each affected table
        if (requests && requests.length > 0) {
            const tableIds = [...new Set(requests.map(r => r.table_id))];

            for (const tableId of tableIds) {
                // Find the *next* active request for this table (latest one priority)
                const { data: nextRequest } = await supabase
                    .from('service_requests')
                    .select('request_type')
                    .eq('table_id', tableId)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const nextStatus = nextRequest ? nextRequest.request_type : null;

                // Update the table's alert status
                // We always update to ensure consistency between service_requests and tables
                await supabase
                    .from('tables')
                    .update({ alert_status: nextStatus })
                    .eq('id', tableId);
            }
        }
    },

    /**
     * Subscribe to real-time changes on service_requests.
     */
    subscribeToServiceRequests(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        const channel = supabase
            .channel(`service-requests-channel-${restaurantId}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'service_requests',
                    filter: `restaurant_id=eq.${restaurantId}`
                },
                (payload) => onChange(payload)
            );
        channel.subscribe();
        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    /**
     * Fetch the staff record for a specific user ID.
     */
    async getWaiterRecord(restaurantId: string, userId: string) {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('user_id', userId)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    },

    /**
     * Update a waiter's availability status.
     */
    async updateWaiterStatus(staffId: string, status: 'available' | 'busy' | 'break') {
        const { error } = await supabase
            .from('staff')
            .update({ availability_status: status })
            .eq('id', staffId);
        
        if (error) throw error;
    },

    /**
     * Manually reassign an order to a different waiter.
     */
    async reassignWaiter(orderId: string, restaurantId: string, newWaiterId: string) {
        const { error } = await supabase
            .from('orders')
            .update({ waiter_id: newWaiterId })
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);
        
        if (error) throw error;
    },

    /**
     * Fetch all staff for a restaurant.
     */
    async fetchStaff(restaurantId: string) {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('restaurant_id', restaurantId);
        
        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch staff members with their current workload status.
     */
    async fetchStaffWithWorkload(restaurantId: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('staff')
            .select(`
                id,
                name,
                role,
                availability_status,
                active_workload,
                mobile
            `)
            .eq('restaurant_id', actualId)
            .eq('role', 'waiter')
            .order('active_workload', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Assign a waiter to a table.
     */
    async assignWaiterToTable(tableId: number, waiterId: string | null, restaurantId: string) {
        const { error } = await supabase
            .from('tables')
            .update({ assigned_waiter_id: waiterId })
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // Also update any active orders for this table if they are unassigned
        if (waiterId) {
            await supabase
                .from('orders')
                .update({ waiter_id: waiterId })
                .eq('table_id', tableId)
                .eq('restaurant_id', restaurantId)
                .eq('is_completed', false)
                .is('waiter_id', null);

            // Log the assignment
            await supabase
                .from('waiter_assignments')
                .insert({
                    table_id: tableId,
                    waiter_id: waiterId,
                    assigned_by: (await supabase.auth.getUser()).data.user?.id,
                    restaurant_id: restaurantId
                });
        }
    },

    /**
     * Assign a waiter to a merge group.
     */
    async assignWaiterToMergeGroup(mergeGroupId: string, waiterId: string | null, restaurantId: string) {
        const { error } = await supabase
            .from('table_merge_groups')
            .update({ assigned_waiter_id: waiterId })
            .eq('id', mergeGroupId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // Also update all tables in this group
        await supabase
            .from('tables')
            .update({ assigned_waiter_id: waiterId })
            .eq('merged_group_id', mergeGroupId)
            .eq('restaurant_id', restaurantId);

        // Also update any active orders for this group if they are unassigned
        if (waiterId) {
            await supabase
                .from('orders')
                .update({ waiter_id: waiterId })
                .eq('merge_group_id', mergeGroupId)
                .eq('restaurant_id', restaurantId)
                .eq('is_completed', false)
                .is('waiter_id', null);

            // Log the assignment
            await supabase
                .from('waiter_assignments')
                .insert({
                    merge_group_id: mergeGroupId,
                    waiter_id: waiterId,
                    assigned_by: (await supabase.auth.getUser()).data.user?.id,
                    restaurant_id: restaurantId
                });
        }
    },

    /**
     * Transfer a specific service request to another waiter.
     */
    async transferServiceRequest(requestId: string, newWaiterId: string, restaurantId: string) {
        // Fetch current waiter to log who it was transferred from
        const { data: currentReq } = await supabase
            .from('service_requests')
            .select('assigned_staff_id')
            .eq('id', requestId)
            .single();

        const { error } = await supabase
            .from('service_requests')
            .update({ assigned_staff_id: newWaiterId })
            .eq('id', requestId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // Insert into history
        await supabase
            .from('service_assignments')
            .insert({
                service_request_id: requestId,
                from_waiter_id: currentReq?.assigned_staff_id,
                to_waiter_id: newWaiterId,
                restaurant_id: restaurantId,
                status: 'transferred'
            });
    },

    /**
     * Transfer all active work (tables, orders, services) from one waiter to another.
     */
    async transferFullWorkload(fromWaiterId: string, toWaiterId: string, restaurantId: string) {
        // 1. Update tables
        await supabase
            .from('tables')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('assigned_waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId);

        // 2. Update merge groups
        await supabase
            .from('table_merge_groups')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('assigned_waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId);

        // 3. Update active orders
        await supabase
            .from('orders')
            .update({ waiter_id: toWaiterId })
            .eq('waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId)
            .eq('is_completed', false);

        // 4. Update pending service requests
        await supabase
            .from('service_requests')
            .update({ assigned_staff_id: toWaiterId })
            .eq('assigned_staff_id', fromWaiterId)
            .eq('restaurant_id', restaurantId)
            .eq('status', 'pending');
    }
};
