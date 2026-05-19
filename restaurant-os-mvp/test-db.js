import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'ey...';

async function main() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: menu_items, error } = await supabase.from('menu_items').select('*');
    if (error) {
        console.error('Error fetching menu items:', error);
        return;
    }
    console.log(`Found ${menu_items.length} menu items.`);
    menu_items.forEach(item => {
        console.log(`- [${item.id}] ${item.name} | item_type: ${item.item_type} | is_available: ${item.is_available}`);
    });
}

main();
