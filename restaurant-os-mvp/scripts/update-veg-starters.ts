
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
    'Baby Corn Fry': '/menu/baby-corn-fry.jpeg',
    'Cheese Balls': '/menu/cheese-balls.jpeg',
    'Chilli Paneer': '/menu/chilli-paneer.jpeg',
    'Crispy Corn': '/menu/crispy-corn.jpeg',
    'Gobi 65': '/menu/gobi-65.jpg',
    'Hara Bhara Kebab': '/menu/hara-bhara-kebab.jpeg',
    'Mushroom 65': '/menu/mushroom-65.jpeg',
    'Tandoori Aloo': '/menu/tandoori-aloo.jpeg',
    'Veg Manchurian (Dry)': '/menu/veg-manchurian-dry.jpeg',
    'Veg Pakora Platter': '/menu/veg-pakora-platter.jpeg',
    'Veg Spring Rolls': '/menu/veg-spring-rolls.jpeg'
};

async function updateImages() {
    console.log('Updating Veg Starter images...');

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
