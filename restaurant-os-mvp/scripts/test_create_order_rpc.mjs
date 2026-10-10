import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
            let v = (m[2] || '').trim();
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
            process.env[m[1]] = v;
        }
    }
}

const VPS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://72.61.250.231:8010';
const VPS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const vps = createClient(VPS_URL, VPS_KEY);

async function testRpc() {
    console.log('Testing create_order_v2 RPC on VPS database...');

    // 1. Fetch any restaurant and any menu item to test with
    const { data: rest } = await vps.from('restaurants').select('id').limit(1).single();
    if (!rest) throw new Error('No restaurant found');

    const { data: menu } = await vps.from('menu_items').select('id, price').eq('restaurant_id', rest.id).limit(1).single();
    if (!menu) throw new Error('No menu item found');

    const testTx = 'TEST_TX_' + Date.now();
    const rpcParams = {
        p_restaurant_id: rest.id,
        p_transaction_id: testTx,
        p_items: [
            {
                menu_item_id: menu.id,
                quantity: 1,
                price: menu.price,
                notes: 'Automated RPC overload test'
            }
        ],
        p_table_id: null,
        p_merge_group_id: null,
        p_order_type: 'TAKEAWAY',
        p_status: 'placed',
        p_waiter_id: null,
        p_customer_id: null,
        p_customer_phone: null,
        p_branch_id: null,
        p_coupon_code: null,
        p_delivery_fee: 0,
        p_delivery_address: null,
        p_delivery_phone: null,
        p_delivery_notes: null,
        p_delivery_zone_id: null,
        p_delivery_lat: null,
        p_delivery_lng: null,
        p_customer_lat: null,
        p_customer_lng: null,
        p_active_order_id: null
    };

    const { data, error } = await vps.rpc('create_order_v2', rpcParams);

    if (error) {
        console.error('❌ RPC FAILED with error:', error);
        process.exit(1);
    } else {
        console.log('✅ RPC SUCCESS! Order created without candidate function error:', data);
        
        // Cleanup test order
        if (data?.id) {
            await vps.from('order_items').delete().eq('order_id', data.id);
            await vps.from('orders').delete().eq('id', data.id);
            console.log('Cleaned up test order:', data.id);
        }
    }
}

testRpc().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
