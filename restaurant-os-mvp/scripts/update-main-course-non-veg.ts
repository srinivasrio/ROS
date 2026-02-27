
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
    'Andhra Chicken Curry': '/menu/andhra-chicken-curry.jpeg',
    'Chicken Handi': '/menu/chicken-handi.jpeg',
    'Kadai Chicken': '/menu/kadai-chicken.jpeg',
    'Mutton Curry': '/menu/mutton-curry.jpeg',
    'Chicken Chettinad': '/menu/chicken-chettinad.jpeg',
    'Chicken Tikka Masala': '/menu/chicken-tikka-masala.jpeg',
    'Egg Curry': '/menu/egg-curry.jpeg',
    'Fish Curry': '/menu/fish-curry.jpeg',
    'Mutton Rogan Josh': '/menu/mutton-rogan-josh.jpeg',
    'Pepper Mutton': '/menu/pepper-mutton.jpeg',
    'Prawn Masala': '/menu/prawn-masala.jpeg'
};

async function updateImages() {
    console.log('Updating images for Main Course Non-Veg...');

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
