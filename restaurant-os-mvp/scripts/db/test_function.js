require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.rpc('get_function_def', { func_name: 'save_menu_item_with_recipe' });
    console.log(data || error);
}
run();
