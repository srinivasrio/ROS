import { createClient } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type OrderStatus = 'queued' | 'placed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export interface OrderItem {
    id: string; // Cast BigInt to string for frontend
    name: string;
    quantity: number;
    notes?: string;
    price: number;
    status: OrderStatus; // Added status
    served_at?: string; // Timestamptz
    image_url?: string;
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
    waiter_id?: string | null; // UUID from staff
    waiter_name?: string; // Mapped from staff join
    created_at: string;
    completed_at?: string; // Timestamptz
    items?: OrderItem[]; // Populated via join and mapping
}

export interface TableMergeGroup {
    id: string;
    display_name: string;
    total_capacity: number;
    status: 'available' | 'occupied';
    created_at: string;
}

// ... UUID helper ...

const supabase = createClient();

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
     * Fetch all active orders (placed, preparing, ready) with their items.
     */
    async fetchActiveOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (name, image_url)
                ),
                staff!waiter_id (name)
            `)
            .eq('is_completed', false) // Only active orders
            .in('status', ['placed', 'preparing', 'ready', 'served', 'paid'])
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }

        // Transform for easier consumption
        return data?.map((order: any) => ({
            ...order,
            waiter_name: order.staff?.name,
            items: order.order_items
                .filter((item: any) => item.status !== 'queued') // Filter out queued items from KDS/Active view
                .map((item: any) => ({
                    ...item,
                    id: String(item.id), // Ensure string for frontend
                    name: item.menu_items?.name || 'Unknown Item',
                    quantity: item.quantity,
                    notes: item.notes,
                    price: item.price_at_time, // CORRECT COLUMN
                    status: item.status || order.status, // Fallback to order status if null
                    served_at: item.served_at,
                    image_url: item.menu_items?.image_url
                }))
        })) as Order[];
    },

    /**
     * Fetch completed/history orders (served, paid, cancelled).
     */
    async fetchHistoryOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (name, image_url)
                )
            `)
            .eq('is_completed', true) // Only archived orders
            .in('status', ['served', 'paid', 'cancelled'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching history:', error);
            throw error;
        }

        return data?.map(order => ({
            ...order,
            items: order.order_items.map((item: any) => ({
                ...item,
                id: String(item.id),
                name: item.menu_items?.name || 'Unknown Item',
                quantity: item.quantity,
                notes: item.notes,
                price: item.price_at_time,
                served_at: item.served_at,
                image_url: item.menu_items?.image_url
            }))
        })) as Order[];
    },

    /**
     * Fetch all tables.
     */
    async fetchTables() {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching tables:', error);
            throw error;
        }
        if (error) {
            console.error('Error fetching tables:', error);
            throw error;
        }
        return data;
    },

    /**
     * Verify if a table exists.
     */
    async verifyTableExists(tableId: number | string) {
        if (typeof tableId === 'string' && isNaN(Number(tableId))) {
            const { count, error } = await supabase
                .from('table_merge_groups')
                .select('*', { count: 'exact', head: true })
                .eq('id', tableId);
            if (error) {
                console.error('Error verifying merge group:', error);
                return false;
            }
            return count !== null && count > 0;
        }

        const numId = Number(tableId);
        const { count, error } = await supabase
            .from('tables')
            .select('*', { count: 'exact', head: true })
            .eq('id', numId);

        if (error) {
            console.error('Error verifying table:', error);
            return false;
        }
        return count !== null && count > 0;
    },

    /**
     * Add a new table to the database.
     */
    async addTable(tableNumber: string, capacity: number) {
        // 1. Check if table_number already exists
        const { data: existingTable } = await supabase
            .from('tables')
            .select('id')
            .eq('table_number', tableNumber)
            .maybeSingle();

        if (existingTable) {
            throw new Error(`Table '${tableNumber}' already exists.`);
        }

        // 2. Generate a unique ID
        const { data: maxTable } = await supabase
            .from('tables')
            .select('id')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        const newId = (maxTable?.id || 0) + 1;

        const { data, error } = await supabase
            .from('tables')
            .insert({
                id: newId,
                table_number: tableNumber,
                capacity: capacity,
                status: 'free'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch all active table merge groups.
     */
    async fetchMergeGroups() {
        const { data, error } = await supabase
            .from('table_merge_groups')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching merge groups:', error);
            throw error;
        }
        return data as TableMergeGroup[];
    },

    /**
     * Merge multiple free tables into a single virtual group.
     */
    async mergeTables(tableIds: number[]) {
        if (!tableIds || tableIds.length < 2) throw new Error('Need at least 2 tables to merge.');

        // 1. Verify all tables are free and not already merged
        const { data: tablesToMerge, error: fetchError } = await supabase
            .from('tables')
            .select('id, table_number, capacity, status, is_merged')
            .in('id', tableIds);

        if (fetchError) throw fetchError;
        if (!tablesToMerge || tablesToMerge.length !== tableIds.length) {
            throw new Error('Some tables could not be found.');
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
                status: 'occupied' // Treat merged group as logically occupied immediately to avoid race conditions
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
    async unmergeTables(mergeGroupId: string) {
        // 1. Ensure no active orders for this merge group
        const { count, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merge_group_id', mergeGroupId)
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
            .eq('merged_group_id', mergeGroupId);

        if (tablesError) throw tablesError;

        // 3. Delete the merge group
        const { error: deleteError } = await supabase
            .from('table_merge_groups')
            .delete()
            .eq('id', mergeGroupId);

        if (deleteError) throw deleteError;
    },

    /**
     * Subscribe to real-time changes on the 'orders' table.
     */
    subscribeToOrders(onChange: (payload: RealtimePostgresChangesPayload<Order>) => void) {
        return supabase
            .channel(`global-orders-channel-${Math.random()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => onChange(payload as unknown as RealtimePostgresChangesPayload<Order>)
            )
            .subscribe((status) => {
                console.log('Supabase Realtime Status:', status);
            });
    },

    /**
     * Subscribe to real-time changes on the 'order_items' table.
     * Essential for KDS to know when items are added to an order.
     */
    subscribeToOrderItems(onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        return supabase
            .channel(`global-order-items-channel-${Math.random()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                (payload) => onChange(payload)
            )
            .subscribe();
    },

    subscribeToMenuItems(onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        return supabase
            .channel('menu_items_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'menu_items' },
                onChange
            )
            .subscribe();
    },

    /**
     * Subscribe to real-time changes on the 'tables' table.
     */
    subscribeToTables(onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        return supabase
            .channel(`global-tables-channel-${Math.random()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tables' },
                (payload) => onChange(payload)
            )
            .subscribe();
    },

    /**
     * Subscribe to real-time changes on table_merge_groups.
     */
    subscribeToMergeGroups(onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        return supabase
            .channel(`global-merge-groups-channel-${Math.random()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'table_merge_groups' },
                (payload) => onChange(payload)
            )
            .subscribe();
    },

    /**
     * Update the status of a specific order.
     */
    async updateOrderStatus(orderId: string, status: OrderStatus) {
        // 1. Cascade update to all items FIRST
        // This ensures that when the "Order Updated" realtime event fires (step 2),
        // the items are ALREADY in the correct state for any listeners fetching full details.
        let query = supabase.from('order_items').update({ status }).eq('order_id', orderId);

        if (status === 'preparing') {
            // Only update placed items (or null)
            query = query.or('status.eq.placed,status.eq.queued,status.is.null');
        } else if (status === 'ready') {
            // Update placed or preparing items (or null). PROTECT 'served'.
            query = query.or('status.eq.placed,status.eq.preparing,status.is.null');
        } else if (status === 'served') {
            // Update everything except paid (though paid items are usually closed)
            query = query.neq('status', 'paid');
        } else if (status === 'placed') {
            // If moving from queued -> placed, update queued items
            query = query.eq('status', 'queued');
        }

        const { error: itemsError } = await query;

        if (itemsError) {
            console.error('Failed to cascade status to items', itemsError);
            throw itemsError; // Fail fast if items fail
        }

        // 2. Update Order Status (Second)
        // This triggers the main "Order Updated" event for dashboards
        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .select('table_id') // Fetch table_id for cleanup
            .single();

        if (error) throw error;

        // 3. Cleanup Alerts if Served/Paid/Cancelled
        if (['served', 'paid', 'cancelled'].includes(status)) {
            // Retrieve table_id from the update result or fetch it if .update() doesn't return it easily without select()
            // Supabase update returns data if .select() is chained.
            // We need to fetch table_id to clean up service_requests.
            // Since we chained .select('table_id') above, 'error' would have caught it, but we need 'data'.
            // Let's refactor slightly to get data.
        }
    },

    /**
     * Temporary: Helper to create a test order for verification
     * Auto-seeds menu_items and tables if empty.
     */
    async createTestOrder(tableId: number) {
        // 0. Ensure Table exists (for FK)
        const { data: table } = await supabase.from('tables').select('id').eq('id', tableId).single();
        if (!table) {
            console.log('Seeding Table', tableId);
            const { error: tableErr } = await supabase.from('tables').insert({
                id: tableId,
                table_number: String(tableId),
                status: 'free'
            });
            if (tableErr) console.error('Table Seed Error', tableErr);
        }

        // 1. Ensure a Menu Item exists to link to
        let { data: menuItem } = await supabase.from('menu_items').select('id').limit(1).single();

        if (!menuItem) {
            console.log('Seeding Menu Items...');
            let { data: cat } = await supabase.from('categories').select('id').limit(1).single();
            if (!cat) {
                const catId = generateId();
                const { data: newCat, error: catErr } = await supabase.from('categories').insert({
                    id: catId,
                    name: 'Starters',
                    slug: 'starters'
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
                is_available: true
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
                is_completed: false
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
                    notes: 'Spicy'
                }
            ]);

        if (itemsError) throw itemsError;
        return order;
    },

    /**
     * Create a real order from the Waiter Panel or Customer Panel.
     */
    async createOrder(tableIdentifier: number | string, items: { menu_item_id: number; quantity: number; notes?: string; price: number }[], initialStatus: OrderStatus = 'placed', waiterId?: string) {
        const isMerged = typeof tableIdentifier === 'string';
        const identifierColumn = isMerged ? 'merge_group_id' : 'table_id';

        // 1. Calculate Total of NEW items
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = Math.round(subtotal * 0.05);
        const newItemsTotal = subtotal + tax;

        // 2. Check for existing active order (placed/preparing/ready/served) - NOT paid
        // If status is 'queued', we typically want to attach to 'queued' order or create new?
        // Customer flow: usually one active queued order.
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('*')
            .eq(identifierColumn, tableIdentifier)
            .eq('is_completed', false) // Ensure we don't pick up old orders
            // Removed .neq('status', 'paid') to allow adding to paid orders
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let orderId = existingOrder?.id;
        let finalTotal = newItemsTotal;

        if (existingOrder) {
            orderId = existingOrder.id;
            finalTotal = existingOrder.total_amount + newItemsTotal;
            // If existing order is 'queued', we just add to it.
            // If existing order is 'placed'/'cooking', adding 'queued' items might be complex?
            // For MVP: If adding to existing, we probably adopt existing status OR if customer app specifically requests queued, we might need mixed states?
            // Simplified: If 'queued' requested, ensure Order is 'queued' or handling via item status?
            // For now, if 'queued' is requested, we treat it as adding to cart-like state.
        } else {
            // Create New Order
            orderId = generateUUID();
            const orderInsert: any = {
                id: orderId,
                status: initialStatus, // Use requested status
                total_amount: finalTotal, // Set initial total
                amount_paid: 0, // Initial paid amount
                is_completed: false,
                waiter_id: waiterId
            };
            orderInsert[identifierColumn] = tableIdentifier;

            const { error: orderError } = await supabase
                .from('orders')
                .insert(orderInsert);

            if (orderError) throw orderError;
        }

        // 3. Prepare Order Items
        const orderItems = items.map(item => ({
            id: generateId(),
            order_id: orderId, // Use existing or new ID
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            price_at_time: item.price,
            notes: item.notes,
            status: initialStatus // Explicitly set item status
        }));

        // 4. Insert Items (First!)
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('Error creating order items:', itemsError);
            throw itemsError;
        }

        // 5. Update Order Total & Status (Last!)
        if (existingOrder) {
            await supabase
                .from('orders')
                .update({
                    total_amount: finalTotal,
                    // Only update status if we are NOT 'queued' or if we want to reset?
                    // If we add 'queued' items to a 'placed' order, order remains 'placed' but items are 'queued'?
                    // For MVP simplicity: If initialStatus is 'queued', we assume it's a new order or we are explicitly queueing.
                    // If existing order is 'placed', maybe we shouldn't be 'queueing' new items into it?
                    // Actually, let's keep it simple: Update status to 'placed' if we are adding immediate items.
                    // If initialStatus is 'queued', we probably shouldn't change existing order status if it's already advanced?
                    // Prevent downgrading status if adding queued items to an active order
                    status: initialStatus === 'placed' ? 'placed' : existingOrder.status
                })
                .eq('id', orderId);
        }

        // 6. Update Table Status to 'occupied' (if not already)
        if (initialStatus !== 'queued') { // Only occupy if actually placed? Or occupy on queue too? Queue implies intent.
            if (isMerged) {
                const { error: groupError } = await supabase
                    .from('table_merge_groups')
                    .update({ status: 'occupied' })
                    .eq('id', tableIdentifier);
                if (groupError) console.error('Error updating merge group status:', groupError);
            } else {
                const { error: tableError } = await supabase
                    .from('tables')
                    .update({ status: 'occupied' })
                    .eq('id', tableIdentifier);
                if (tableError) console.error('Error updating table status:', tableError);
            }
        }

        return { id: orderId };
    },

    /**
     * Delete an entire order (Cancellation).
     */
    async deleteOrder(orderId: string) {
        // 1. Delete items first (Cascade usually handles this, but good to be explicit)
        await supabase.from('order_items').delete().eq('order_id', orderId);

        // 2. Delete Order
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
    },

    /**
     * Delete a specific order item.
     */
    async deleteOrderItem(itemId: string) {
        // 1. Get Item details for price calculation
        const { data: item } = await supabase
            .from('order_items')
            .select('price_at_time, quantity, order_id')
            .eq('id', itemId)
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
                    await this.deleteOrder(item.order_id);
                    return;
                }
            }

            // Update total
            await supabase
                .from('orders')
                .update({ total_amount: order.total_amount - amountDeduction })
                .eq('id', item.order_id);
        }
    },

    /**
     * Fetch full details for a specific order by ID.
     */
    async getOrderDetails(orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (name, image_url)
                )
            `)
            .eq('id', orderId)
            .single();

        if (error) {
            console.error('Error fetching order details:', error);
            // return null or throw? For notification context, null is safer to avoid crashing
            return null;
        }

        // Transform
        return {
            ...data,
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
    async getActiveOrderForTable(tableIdentifier: number | string) {
        let actualIdentifier = tableIdentifier;
        let isMerged = typeof tableIdentifier === 'string';

        // Auto-resolve merged group if a standard table ID is passed
        if (typeof tableIdentifier === 'number') {
            const { data: tableData } = await supabase
                .from('tables')
                .select('is_merged, merged_group_id')
                .eq('id', tableIdentifier)
                .single();

            if (tableData?.is_merged && tableData?.merged_group_id) {
                actualIdentifier = tableData.merged_group_id;
                isMerged = true;
            }
        }

        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (name, image_url, preparation_time)
                ),
                tables (
                    status
                ),
                table_merge_groups (
                    status
                )
            `)
            .eq(isMerged ? 'merge_group_id' : 'table_id', actualIdentifier)
            .eq('is_completed', false) // Only active
            // .in('status', ['placed', 'preparing', 'ready', 'served', 'paid']) // Removed status filter as is_completed covers it

            .order('created_at', { ascending: false }) // Get latest
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching order for table:', error);
            throw error;
        }

        // Fix: If table is explicitly marked 'free', do not return a stale order (even if 'served')
        // This solves "Empty tables showing ordered details"
        if (!data) return null;

        // Check table status
        const tableStatus = isMerged ? (data.table_merge_groups as any)?.status : (data.tables as any)?.status;
        if ((tableStatus === 'free' || tableStatus === 'available') && ['served', 'paid'].includes(data.status)) {
            return null;
        }

        // Transform
        return {
            ...data,
            items: data.order_items.map((item: any) => ({
                ...item,
                id: String(item.id),
                name: item.menu_items?.name || 'Unknown Item',
                quantity: item.quantity,
                notes: item.notes,
                price: item.price_at_time,
                status: item.status || data.status, // Fallback to order status
                served_at: item.served_at,
                image_url: item.menu_items?.image_url
            }))
        } as Order;
    },

    /**
     * Settle the bill for an order.
     * Marks order as 'paid' AND updates amount_paid.
     */
    async settleBill(orderId: string, _frontendTotal?: number, paidBy: string = 'System') {
        // 1. Fetch latest total from DB to ensure we don't use stale frontend data
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) throw fetchError || new Error('Order not found');

        // 2. Settle fully based on DB total AND set completed_at
        const { error } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                amount_paid: order.total_amount,
                paid_by: paidBy,
                completed_at: new Date().toISOString() // Set completed time
            })
            .eq('id', orderId);

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
    async updateOrderItemStatus(itemId: string, status: OrderStatus) {
        // 1. Update the Item
        const updateData: any = { status };
        if (status === 'served') {
            updateData.served_at = new Date().toISOString(); // Set served_at timestamp
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
                .select('table_id')
                .eq('id', item.order_id)
                .single();

            if (order) {
                // Always create a FRESH alert to notify the waiter again.
                // 1. Remove ANY existing pending 'order_ready' requests for this table
                //    This ensures we don't have duplicates and we get a NEW ID for the frontend to track.
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
                //    This generates a new ID, bypassing the frontend's "Dismissed IDs" filter.
                await this.submitServiceRequest(order.table_id, 'order_ready');
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
     * Free a table manually.
     * Sets table status to 'free' AND archives the current order.
     */
    async clearTable(tableId: number | string) {
        if (typeof tableId === 'string' && isNaN(Number(tableId))) {
            // First archive the active order for the merge group
            const { error: orderError } = await supabase
                .from('orders')
                .update({ is_completed: true })
                .eq('merge_group_id', tableId)
                .eq('is_completed', false);

            if (orderError) console.error('Failed to archive merged order:', orderError);

            // Unmerge tables to free them up individually
            await this.unmergeTables(tableId);
            return;
        }

        const numericTableId = Number(tableId);
        // 1. Set Table to Free
        const { error: tableError } = await supabase
            .from('tables')
            .update({ status: 'free' })
            .eq('id', numericTableId);

        if (tableError) throw tableError;

        // 2. Archive the Active Order (Mark as Completed)
        // Find the latest non-completed order for this table
        // (Ideally should be 'paid', but force complete whatever is there)
        // Ensure completed_at is set if it wasn't already (e.g. if settled but not marked)
        // We use coalesce to redundant update but safe.
        // Actually best to set updated timestamp if null.

        const { error: orderError } = await supabase
            .from('orders')
            .update({ is_completed: true }) // Completed_at likely set by settleBill, but can force check
            .eq('table_id', numericTableId)
            .eq('is_completed', false);

        if (orderError) console.error('Failed to archive order:', orderError);
    },

    /**
     * Set table alert status (Call Waiter, Bill Requested).
     * Now delegates to submitServiceRequest or dismissTableAlert for persistence.
     */
    async setTableAlert(tableId: number | string, status: 'call_waiter' | 'bill_requested' | null) {
        if (status) {
            await this.submitServiceRequest(tableId, status);
        } else {
            await this.dismissTableAlert(tableId);
        }
    },

    /**
     * Complete/Resolve a specific service request.
     */
    async completeServiceRequest(requestId: number) {
        const { error } = await supabase
            .from('service_requests')
            .delete()
            .eq('id', requestId);

        if (error) {
            console.error('Error completing service request:', error);
        }
    },

    /**
     * Accept a service request (Mark as in-progress/accepted).
     */
    async acceptServiceRequest(requestId: number) {
        const { error } = await supabase
            .from('service_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (error) {
            console.error('Error accepting service request:', error);
        }
    },

    /**
     * Mark a service request as delivered.
     */
    async markRequestDelivered(requestId: number) {
        const { error } = await supabase
            .from('service_requests')
            .update({ status: 'delivered' })
            .eq('id', requestId);

        if (error) {
            console.error('Error marking request delivered:', error);
        }
    },

    /**
     * Dismiss a table alert.
     * Clears the table alert status AND resolves all pending service requests for the table.
     */
    async dismissTableAlert(tableId: number | string) {
        if (typeof tableId === 'string' && isNaN(Number(tableId))) {
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', tableId);
            if (!tables || tables.length === 0) return;
            const tableIds = tables.map(t => t.id);

            const { error: reqError } = await supabase
                .from('service_requests')
                .delete()
                .in('table_id', tableIds)
                .eq('status', 'pending');
            if (reqError) console.error('Failed to resolve pending requests:', reqError);

            const { error: tableError } = await supabase
                .from('tables')
                .update({ alert_status: null })
                .in('id', tableIds);
            if (tableError) console.error('Failed to dismiss table alert:', tableError);
            return;
        }

        const numericTableId = Number(tableId);

        // 1. Clear Table Alert
        const { error: tableError } = await supabase
            .from('tables')
            .update({ alert_status: null })
            .eq('id', numericTableId);

        if (tableError) {
            console.error('Failed to dismiss table alert:', tableError);
            throw tableError;
        }

        // 2. Resolve ALL pending service requests for this table (Hard Delete)
        // This ensures the "Dismiss" action on the dashboard effectively handles all outstanding calls
        const { error: reqError } = await supabase
            .from('service_requests')
            .delete()
            .eq('table_id', numericTableId)
            .eq('status', 'pending');

        if (reqError) {
            console.error('Failed to resolve pending requests:', reqError);
        }
    },

    /**
     * Submit a new service request (Water, Bill, etc.)
     * Supports multiple active requests per table.
     * persisted in service_requests AND updates table alert_status.
     */
    async submitServiceRequest(tableId: number | string, type: string, quantity: number = 1) {
        let actualTableId = Number(tableId);

        // If string UUID, find the first table in the merge group to attach the request
        if (typeof tableId === 'string' && isNaN(actualTableId)) {
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', tableId)
                .order('id', { ascending: true })
                .limit(1);

            if (tables && tables.length > 0) {
                actualTableId = tables[0].id;
            } else {
                console.error('No tables found in merge group to attach request.');
                return;
            }
        }

        // 1. Insert Service Request
        const { error } = await supabase
            .from('service_requests')
            .insert({
                table_id: actualTableId,
                request_type: type,
                status: 'pending',
                quantity: quantity
            });

        if (error) {
            console.error('Failed to submit service request:', error);
            throw error;
        }

        // 2. Update Table Alert Status (Show latest)
        // We only update if it's a "visual" alert type usually, but strictly mapping type to status is fine for now.
        // The Table view handles valid types.
        const { error: tableError } = await supabase
            .from('tables')
            .update({ alert_status: type })
            .eq('id', actualTableId);

        if (tableError) {
            console.error('Failed to update table alert status:', tableError);
        }
    },

    /**
     * Fetch active service requests (Pending + Recently Resolved).
     * Includes resolved requests from the last 1 hour to keep them visible.
     */
    async fetchActiveServiceRequests() {
        const { data, error } = await supabase
            .from('service_requests')
            .select(`
                *,
                tables (table_number)
            `)
            .in('status', ['pending', 'accepted', 'delivered'])
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Failed to fetch service requests:', error);
            throw error;
        }
        return data;
    },

    /**
     * Fetch active service requests for a specific table.
     */
    async fetchServiceRequestsForTable(tableId: number | string) {
        if (typeof tableId === 'string' && isNaN(Number(tableId))) {
            // Service requests are currently table-centric, so for merge groups we can fetch for all tables in group
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', tableId);

            if (!tables || tables.length === 0) return [];

            const tableIds = tables.map(t => t.id);
            const { data, error } = await supabase
                .from('service_requests')
                .select('*')
                .in('table_id', tableIds)
                .in('status', ['pending', 'accepted', 'delivered'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Failed to fetch table service requests:', error);
                throw error;
            }
            return data;
        }

        const numericTableId = Number(tableId);
        const { data, error } = await supabase
            .from('service_requests')
            .select('*')
            .eq('table_id', numericTableId)
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
    subscribeToServiceRequests(onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        return supabase
            .channel(`service-requests-channel-${Math.random()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'service_requests' },
                (payload) => onChange(payload)
            )
            .subscribe();
    }
};
