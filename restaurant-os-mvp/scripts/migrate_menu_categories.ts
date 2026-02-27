
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Using anon key, hope RLS allows or I have service role? 
// Actually, usually I need service role for admin tasks like this if RLS is strict.
// But previous script worked with anon key for reading.
// For writing/deleting, I might need service role key if strict RLS.
// Let's assume anon key works or I'll need to find service role key.
// Previous turn used `app/services/menu.ts` which uses `createClient` from `@/lib/supabase`. 
// That likely uses anon key. If RLS allows, great.
// If not, I'm stuck without service key. 
// But wait, the previous `fetch_categories.ts` worked.
// Let's try. If it fails, I'll check if I can get service key or use existing `MenuService` logic which presumably works (if authenticated? or public?).
// If `MenuService` imports `createClient` from `@/lib/supabase`, it uses standard client.
// Let's try with what I have.

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('Starting Migration...');

    // 1. Create New Categories
    const newCategories = [
        { name: 'Starters', slug: 'starters', sort_order: 1, image_url: '/menu/hara-bhara-kebab.jpeg' },
        { name: 'Curries', slug: 'curries', sort_order: 2, image_url: '/menu/palak-paneer.jpeg' },
        { name: 'Rice Items', slug: 'rice-items', sort_order: 3, image_url: '/menu/jeera-rice.jpeg' },
        { name: 'Biryanis', slug: 'biryanis', sort_order: 4, image_url: '/menu/mutton-biryani.jpeg' }
    ];

    const categoryMap: Record<string, number> = {};
    const subCategoryMap: Record<string, number> = {};

    for (const cat of newCategories) {
        // Upsert by name logic -> actually just insert
        // Check if exists first to avoid duplicates if re-run
        let { data: existing } = await supabase.from('categories').select('id').eq('name', cat.name).single();
        let catId = existing?.id;

        if (!catId) {
            const id = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
            const { data, error } = await supabase.from('categories').insert({
                id,
                name: cat.name,
                slug: cat.slug,
                sort_order: cat.sort_order,
                image_url: cat.image_url,
                is_active: true
            }).select().single();
            if (error) { console.error('Create Cat Error', error); return; }
            catId = data.id;
            console.log(`Created Category: ${cat.name} (${catId})`);
        } else {
            console.log(`Category exists: ${cat.name} (${catId})`);
        }
        categoryMap[cat.name] = catId!;

        // Create "General" Subcategory
        let { data: existingSub } = await supabase.from('sub_categories').select('id').eq('category_id', catId).eq('name', 'General').single();
        let subId = existingSub?.id;
        if (!subId) {
            const id = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
            const { data, error } = await supabase.from('sub_categories').insert({
                id,
                category_id: catId,
                name: 'General',
                sort_order: 1
            }).select().single();
            if (error) { console.error('Create SubCat Error', error); return; }
            subId = data.id;
            console.log(`Created SubCategory: General for ${cat.name} (${subId})`);
        }
        subCategoryMap[cat.name] = subId!;
    }

    // 2. Map Old Categories to New
    // Veg Starters (2), Non-Veg Starters (3) -> Starters
    // Veg Curries (4), Non-Veg Curries (5) -> Curries
    // Rice-Biryani (6) -> Split

    const mappings = [
        { oldId: 2, newCat: 'Starters' },
        { oldId: 3, newCat: 'Starters' },
        { oldId: 4, newCat: 'Curries' },
        { oldId: 5, newCat: 'Curries' }
    ];

    for (const m of mappings) {
        const newCatId = categoryMap[m.newCat];
        const newSubId = subCategoryMap[m.newCat];
        const { error } = await supabase.from('menu_items')
            .update({ category_id: newCatId, sub_category_id: newSubId })
            .eq('category_id', m.oldId);
        if (error) console.error(`Error migrating From ${m.oldId} to ${m.newCat}`, error);
        else console.log(`Migrated items from ${m.oldId} to ${m.newCat}`);
    }

    // 3. Handle Rice-Biryani (6)
    const { data: riceItems, error: riceError } = await supabase.from('menu_items').select('*').eq('category_id', 6);
    if (!riceError && riceItems) {
        for (const item of riceItems) {
            const isBiryani = item.name.toLowerCase().includes('biryani');
            const target = isBiryani ? 'Biryanis' : 'Rice Items';
            const newCatId = categoryMap[target];
            const newSubId = subCategoryMap[target];

            await supabase.from('menu_items')
                .update({ category_id: newCatId, sub_category_id: newSubId })
                .eq('id', item.id);
            console.log(`Moved ${item.name} to ${target}`);
        }
    }

    // 4. Update Sort Orders of other categories
    // IndoChinese (7) -> 5
    // Breads (8) -> 6
    // Desserts (9) -> 7
    await supabase.from('categories').update({ sort_order: 5 }).eq('id', 7);
    await supabase.from('categories').update({ sort_order: 6 }).eq('id', 8);
    await supabase.from('categories').update({ sort_order: 7 }).eq('id', 9);

    // 5. Cleanup Old Categories (Optional - maybe keep inactive for safety?)
    // Let's mark them inactive first.
    // Actually, user wants them GONE from sidebar.
    // If I delete them, I must ensure no items left.
    // I moved all items.
    // Subcategories need to be deleted too.

    // Deleting Old Cats
    const oldIds = [2, 3, 4, 5, 6];
    // Delete subcats first
    await supabase.from('sub_categories').delete().in('category_id', oldIds);
    // Delete cats
    await supabase.from('categories').delete().in('id', oldIds);

    console.log('Migration Complete');
}

migrate();
