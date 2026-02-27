
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
    'Chicken Tikka': '/menu/chicken-tikka.jpeg',
    'Fish Fry': '/menu/fish-fry.jpeg',
    'Grilled Chicken Wings': '/menu/grilled-chicken-wings.jpeg',
    'Pepper Chicken': '/menu/pepper-chicken.jpeg',
    'Prawn 65': '/menu/prawn-65.jpeg',
    'Apollo Fish': '/menu/apollo-fish.jpeg',
    'Chicken 65': '/menu/chicken-65.jpeg',
    'Chicken Lollipop': '/menu/chicken-lollipop.jpeg',
    'Chicken Malai Tikka': '/menu/chicken-malai-tikka.jpeg',
    'Chilli Chicken (Dry)': '/menu/chilli-chicken-dry.jpeg',
    'Mutton Seekh Kebab': '/menu/mutton-seekh-kebab.jpeg',
    'Tandoori Chicken': '/menu/tandoori-chicken.jpeg'
};

async function updateImages() {
    console.log('Updating images for Starters - Non Veg...');

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
