
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load env vars

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Categories:', JSON.stringify(data, null, 2));

    // Also fetch a sample of items to check item_type
    const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, category_id, item_type')
        .limit(20);
    console.log('Sample Items:', JSON.stringify(items, null, 2));
}

fetchCategories();
