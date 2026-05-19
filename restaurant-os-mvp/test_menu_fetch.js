require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID || 'd0637b58-8b77-4404-9469-805152865715';
    console.time('fetchMenuItems');
    const { data, error } = await supabase
        .from('menu_items')
        .select(`*, categories (name), sub_categories (name)`)
        .eq('restaurant_id', restaurantId);
    console.timeEnd('fetchMenuItems');
    if (error) console.error(error);
    else console.log(`Fetched ${data.length} items`);
}
run();
