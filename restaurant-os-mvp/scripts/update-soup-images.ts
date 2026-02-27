
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
    'Cream of Chicken Soup': '/menu/cream-of-chicken-soup.jpeg',
    'Hot & Sour Soup': '/menu/hot-and-sour-soup.jpeg',
    'Lemon Coriander Soup': '/menu/lemon-coriander-soup.jpeg',
    'Sweet Corn Chicken Soup': '/menu/sweet-corn-chicken-soup.jpeg',
    'Sweet Corn Veg Soup': '/menu/sweet-corn-veg-soup.jpeg',
    'Cream of Mushroom Soup': '/menu/cream-of-mushroom-soup.jpeg',
    'Manchow Soup': '/menu/manchow-soup.jpeg'
};

async function updateImages() {
    console.log('Updating images for Soups...');

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
