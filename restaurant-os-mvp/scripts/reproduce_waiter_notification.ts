
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified OrderService for the script
const OrderService = {
    async getActiveOrderForTable(tableId: number) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (name)
                ),
                tables (
                    status
                )
            `)
            .eq('table_id', tableId)
            .eq('is_completed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    async updateOrderItemStatus(itemId: string, status: string) {
        console.log(`Updating item ${itemId} to ${status}...`);
        const { data: item, error } = await supabase
            .from('order_items')
            .update({ status })
            .eq('id', itemId)
            .select('order_id')
            .single();

        if (error) throw error;
        if (!item) return;

        if (status === 'ready') {
            const { data: order } = await supabase
                .from('orders')
                .select('table_id')
                .eq('id', item.order_id)
                .single();

            if (order) {
                console.log(`Triggering order_ready alert for table ${order.table_id}...`);
                // Check for existing
                await supabase
                    .from('service_requests')
                    .delete()
                    .eq('table_id', order.table_id)
                    .eq('request_type', 'order_ready')
                    .eq('status', 'pending');

                // Create new
                const { data: req, error: reqError } = await supabase
                    .from('service_requests')
                    .insert({
                        table_id: order.table_id,
                        request_type: 'order_ready',
                        status: 'pending',
                        quantity: 1
                    })
                    .select()
                    .single();

                if (reqError) console.error('Failed to create request:', reqError);
                else console.log('Service request created:', req);
            }
        }
    }
};

async function runTest() {
    console.log('Starting Waiter Notification Reproduction Test...');

    // 1. Setup: Use Table 1 (assuming it exists or catch error)
    const tableId = 1;

    // 2. Create a test order manually
    console.log('Creating test order...');

    // Get a menu item first
    const { data: menuItem } = await supabase.from('menu_items').select('id, price').limit(1).single();
    if (!menuItem) {
        console.error('No menu items found. Please seed DB.');
        return;
    }

    const orderId = crypto.randomUUID();
    const { error: orderError } = await supabase.from('orders').insert({
        id: orderId,
        table_id: tableId,
        status: 'preparing',
        total_amount: menuItem.price,
        is_completed: false
    });

    if (orderError) {
        console.error('Failed to create test order:', orderError);
        return;
    }

    // Create item
    const itemId = Math.floor(Date.now() + Math.random() * 1000).toString();
    const { error: itemError } = await supabase.from('order_items').insert({
        id: itemId,
        order_id: orderId,
        menu_item_id: menuItem.id,
        quantity: 1,
        price_at_time: menuItem.price,
        status: 'preparing'
    });

    if (itemError) {
        console.error('Failed to create order item:', itemError);
        return;
    }

    console.log('Test order created with ID:', orderId);
    console.log('Item created with ID:', itemId);

    // 3. Simulate Kitchen Update (Preparing -> Ready)
    await OrderService.updateOrderItemStatus(itemId, 'ready');

    // 4. Verification Check
    console.log('Verifying state...');

    // Check Service Request
    const { data: requests } = await supabase
        .from('service_requests')
        .select('*')
        .eq('table_id', tableId)
        .eq('request_type', 'order_ready')
        .eq('status', 'pending');

    console.log('Active Service Requests:', requests);

    if (!requests || requests.length === 0) {
        console.error('FAIL: No order_ready service request found!');
    } else {
        console.log('PASS: Service request found.');
    }

    // Check Order Fetch (simulating Waiter Dashboard)
    const activeOrder = await OrderService.getActiveOrderForTable(tableId);
    const readyItems = activeOrder?.order_items.filter((i: any) => i.status === 'ready');

    console.log('Active Order Item Statuses:', activeOrder?.order_items.map((i: any) => i.status));

    if (!readyItems || readyItems.length === 0) {
        console.error('FAIL: getActiveOrderForTable did not return the ready item!');
        console.log('This would cause the WaiterAlertSystem to auto-dismiss the alert.');
    } else {
        console.log('PASS: getActiveOrderForTable returned the ready item.');
    }

    // Cleanup
    console.log('Cleaning up...');
    await supabase.from('order_items').delete().eq('order_id', orderId);
    await supabase.from('orders').delete().eq('id', orderId);
    await supabase.from('service_requests').delete().eq('table_id', tableId).eq('request_type', 'order_ready');
}

runTest().catch(console.error);
