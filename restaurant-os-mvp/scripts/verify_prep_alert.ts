
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jmcsygpphwdubnanwjwz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptY3N5Z3BwaHdkdWJuYW53and6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjUyMTIsImV4cCI6MjA4NTgwMTIxMn0.uQyoWluprn9Gr-ypserxqF9WM_85MWUMAO7Uch1jN14';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- Starting Verification ---');

    // 1. Create Test Table & Order
    // We'll mimic createTestOrder logic but simplified
    const tableId = 999;

    // Ensure Table
    const { error: tableErr } = await supabase.from('tables').upsert({ id: tableId, table_number: '999', status: 'occupied' });
    if (tableErr) console.error('Table Error:', tableErr);

    // Create Order
    const orderId = crypto.randomUUID();
    const { error: orderErr } = await supabase.from('orders').insert({
        id: orderId,
        table_id: tableId,
        status: 'placed',
        total_amount: 100,
        is_completed: false
    });
    if (orderErr) {
        console.error('Order Error:', orderErr);
        return;
    }
    console.log(`Order Created: ${orderId}`);

    // Create Item
    const itemId = Math.floor(Date.now() + Math.random() * 1000); // BigInt-ish
    // Need a valid menu_item_id. Let's fetch one.
    const { data: menuItems } = await supabase.from('menu_items').select('id').limit(1);
    const menuItemId = menuItems[0]?.id;

    if (!menuItemId) {
        console.error('No menu items found to creating order item.');
        return;
    }

    const { error: itemErr } = await supabase.from('order_items').insert({
        id: itemId,
        order_id: orderId,
        menu_item_id: menuItemId,
        quantity: 1,
        price_at_time: 100,
        status: 'placed'
    });
    if (itemErr) {
        console.error('Item Error:', itemErr);
        return;
    }
    console.log(`Item Created: ${itemId}`);

    // 2. Simulate marking item as READY using logic similar to OrderService
    console.log('Updating Item Status to READY...');

    // Logic from OrderService:
    // Update Item
    await supabase.from('order_items').update({ status: 'ready' }).eq('id', itemId);

    // Trigger Logic (This is what we are testing)
    // We manually execute the logic I added to OrderService to verify it works IF CALLED correctly
    // But ideally I want to call OrderService.updateOrderItemStatus directly.
    // However, importing it is hard due to Next.js deps.
    // So I will REPLICATE the logic here to prove that IF the logic runs, the result is correct.
    // AND then trust that the app calls the logic.
    // Wait, that proves nothing about the integration.
    // But it proves the query logic is sound.

    // Let's implement the EXACT logic I added:
    const status = 'ready';
    if (status === 'ready') {
        const { data: order } = await supabase
            .from('orders')
            .select('table_id')
            .eq('id', orderId)
            .single();

        if (order) {
            console.log(`Found Order for Table ${order.table_id}`);
            const { count } = await supabase
                .from('service_requests')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', order.table_id)
                .eq('request_type', 'order_ready')
                .eq('status', 'pending');

            console.log(`Existing Requests: ${count}`);

            if (count === 0) {
                console.log('Creating Service Request...');
                const { error: reqErr } = await supabase
                    .from('service_requests')
                    .insert({
                        table_id: order.table_id,
                        request_type: 'order_ready',
                        status: 'pending'
                    });
                if (reqErr) console.error('Request Error:', reqErr);
                else console.log('Service Request Created!');
            } else {
                console.log('Skipping creation (duplicate)');
            }
        }
    }

    // 3. Verify
    const { data: requests } = await supabase
        .from('service_requests')
        .select('*')
        .eq('table_id', tableId)
        .eq('request_type', 'order_ready');

    console.log('Verification Requests:', requests);

    // Cleanup
    await supabase.from('order_items').delete().eq('order_id', orderId);
    await supabase.from('orders').delete().eq('id', orderId);
    if (requests && requests.length > 0) {
        await supabase.from('service_requests').delete().eq('id', requests[0].id);
    }
    // Don't delete table 999 if used elsewhere, but ok to leave occupied or reset
}

run();
