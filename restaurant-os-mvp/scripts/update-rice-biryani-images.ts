
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
    'Chicken Biryani': '/menu/chicken-biryani.jpeg',
    'Jeera Rice': '/menu/jeera-rice.jpeg',
    'Mutton Biryani': '/menu/mutton-biryani.jpeg',
    'Prawn Biryani': '/menu/prawn-biryani.jpeg',
    'Curd Rice': '/menu/curd-rice.jpeg',
    'Egg Biryani': '/menu/egg-biryani.jpeg',
    'Ghee Rice': '/menu/ghee-rice.jpeg',
    'Mushroom Biryani': '/menu/mushroom-biryani.jpeg',
    'Schezwan Fried Rice': '/menu/schezwan-fried-rice.jpeg',
    'Veg Pulao': '/menu/veg-pulao.jpeg'
};

async function updateImages() {
    console.log('Updating images for Rice-Biryani...');

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
