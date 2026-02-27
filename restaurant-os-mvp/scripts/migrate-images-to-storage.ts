
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

// Use Service Role Key if available for bypassing RLS, otherwise Anon
const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY || supabaseKey);

const BUCKET_NAME = 'menu-items';
const PUBLIC_DIR = path.resolve(__dirname, '../public');

async function migrateImages() {
    console.log('Starting migration to Supabase Storage...');

    // 1. Fetch all items with local images
    const { data: items, error } = await supabase
        .from('menu_items')
        .select(`
            id, 
            name, 
            image_url, 
            categories (name), 
            sub_categories (name)
        `)
        .like('image_url', '/menu/%');

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log(`Found ${items.length} items to migrate.`);

    for (const item of items) {
        const localPath = path.join(PUBLIC_DIR, item.image_url);

        if (!fs.existsSync(localPath)) {
            console.warn(`File not found: ${localPath} for item ${item.name}`);
            continue;
        }

        const fileBuffer = fs.readFileSync(localPath);
        // Fix: categories is returned as an array by Supabase sometimes
        const categoryName = Array.isArray(item.categories)
            ? item.categories[0]?.name
            : (item.categories as any)?.name || 'Uncategorized';

        // Sanitize names for storage path
        const safeCategory = (categoryName || 'Uncategorized').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const safeName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const extension = path.extname(localPath);
        const storagePath = `${safeCategory}/${safeName}${extension}`;

        console.log(`Uploading ${item.name} to ${storagePath}...`);

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) {
            console.error(`Failed to upload ${item.name}:`, uploadError);
            continue;
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

        console.log(`Updating DB for ${item.name} -> ${publicUrl}`);

        const { error: updateError } = await supabase
            .from('menu_items')
            .update({ image_url: publicUrl })
            .eq('id', item.id);

        if (updateError) {
            console.error(`Failed to update DB for ${item.name}:`, updateError);
        }
    }

    console.log('Migration complete!');
}

migrateImages();
