
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
    // IndoChinese
    'Chicken Fried Rice': '/menu/chicken-fried-rice.jpeg',
    'Chicken Hakka Noodles': '/menu/chicken-hakka-noodles.jpeg',
    'Chicken Manchurian (Gravy)': '/menu/chicken-manchurian-gravy.jpeg',
    'Egg Noodles': '/menu/egg-noodles.jpeg',
    'Schezwan Noodles': '/menu/schezwan-noodles.jpeg',
    'Veg Fried Rice': '/menu/veg-fried-rice.jpeg',
    'Veg Hakka Noodles': '/menu/veg-hakka-noodles.jpeg',
    'Veg Manchurian (Gravy)': '/menu/veg-manchurian-gravy.jpeg',

    // Breads
    'Garlic Naan': '/menu/garlic-naan.jpeg',
    'Kulcha': '/menu/kulcha.jpeg',
    'Lachha Paratha': '/menu/lachha-paratha.jpeg',
    'Tandoori Roti': '/menu/tandoori-roti.jpeg',
    'Butter Naan': '/menu/butter-naan.jpeg',
    'Rumali Roti': '/menu/rumali-roti.jpeg',

    // Desserts
    'Brownie with Ice Cream': '/menu/brownie-with-ice-cream.jpeg',
    'Double Ka Meetha': '/menu/double-ka-meetha.jpeg',
    'Ice Cream (3 Flavours)': '/menu/ice-cream-3-flavours.jpeg',
    'Rasmalai': '/menu/rasmalai.jpeg',
    'Carrot Halwa': '/menu/carrot-halwa.jpeg',
    'Gulab Jamun': '/menu/gulab-jamun.jpeg'
};

async function updateImages() {
    console.log('Updating images for IndoChinese, Breads, and Desserts...');

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
