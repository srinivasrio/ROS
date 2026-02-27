
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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

const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY || supabaseKey);
const BUCKET_NAME = 'menu-items';

async function migrateExternalImage() {
    console.log('Migrating Paneer Biryani...');

    const unsplashUrl = 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop';

    try {
        const response = await fetch(unsplashUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const storagePath = 'rice-biryani/paneer-biryani.jpeg';

        const { data, error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(storagePath, buffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.error('Upload failed:', error);
            return;
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

        console.log(`Uploaded to ${publicUrl}`);

        const { error: updateError } = await supabase
            .from('menu_items')
            .update({ image_url: publicUrl })
            .eq('name', 'Paneer Biryani');

        if (updateError) {
            console.error('DB Update failed:', updateError);
        } else {
            console.log('DB Updated successfully.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

migrateExternalImage();
