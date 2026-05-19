require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const rid = '202603180001'; // we can use a resolved restaurant id
    console.log("Running query for restaurant_id:", rid);
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
            )
        `)
        .eq('restaurant_id', rid)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Query failed with error:", error);
    } else {
        console.log("Query succeeded! Total orders fetched:", data.length);
        if (data.length > 0) {
            console.log("Sample order:", JSON.stringify(data[0], null, 2));
        }
    }
}
run();
