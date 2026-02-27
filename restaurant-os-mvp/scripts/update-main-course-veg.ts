
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
    'Aloo Gobi': '/menu/aloo-gobi.jpeg',
    'Bhindi Masala': '/menu/bhindi-masala.jpeg',
    'Dal Makhani': '/menu/dal-makhani.jpeg',
    'Dal Tadka': '/menu/dal-tadka.jpeg',
    'Kadai Paneer': '/menu/kadai-paneer.jpeg',
    'Malai Kofta': '/menu/malai-kofta.jpeg',
    'Matar Paneer': '/menu/matar-paneer.jpeg',
    'Mixed Veg Curry': '/menu/mixed-veg-curry.jpeg',
    'Veg Kolhapuri': '/menu/veg-kolhapuri.jpeg',
    'Veg Korma': '/menu/veg-korma.jpeg',
    'Chole Masala': '/menu/chole-masala.jpeg',
    'Kaju Masala': '/menu/kaju-masala.jpeg',
    'Palak Paneer': '/menu/palak-paneer.jpeg',
    'Paneer Butter Masala': '/menu/paneer-butter-masala.jpeg'
};

async function updateImages() {
    console.log('Updating images for Main Course Veg...');

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
