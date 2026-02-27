
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const IMAGE_UPDATES = {
    'Tomato Basil Soup': '/menu/tomato-basil-soup.png',
    'Paneer Tikka': '/menu/paneer-tikka.png',
    'Chicken Tikka': '/menu/chicken-tikka.png',
    'Paneer Butter Masala': '/menu/paneer-butter-masala.png',
    'Butter Chicken': '/menu/butter-chicken.png',
    'Veg Biryani': '/menu/veg-biryani.png'
};

async function updateImages() {
    console.log('Updating menu images...');

    for (const [name, url] of Object.entries(IMAGE_UPDATES)) {
        const { error } = await supabase
            .from('menu_items')
            .update({ image_url: url })
            .eq('name', name);

        if (error) {
            console.error(`Failed to update ${name}:`, error);
        } else {
            console.log(`Updated ${name} with ${url}`);
        }
    }
}

updateImages();
