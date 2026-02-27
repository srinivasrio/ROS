
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
// Load env from .env.local
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

const MINERVA_MENU = [
    {
        id: 1,
        name: 'Soups',
        items: [
            { id: 1, name: "Tomato Basil Soup", type: "Veg", price: 120, available: true },
            { id: 2, name: "Sweet Corn Veg Soup", type: "Veg", price: 130, available: true },
            { id: 3, name: "Sweet Corn Chicken Soup", type: "Non-Veg", price: 150, available: true },
            { id: 4, name: "Hot & Sour Soup", type: "Veg", price: 130, available: true },
            { id: 5, name: "Manchow Soup", type: "Veg", price: 140, available: true },
            { id: 6, name: "Cream of Mushroom Soup", type: "Veg", price: 140, available: true },
            { id: 7, name: "Lemon Coriander Soup", type: "Veg", price: 130, available: true },
            { id: 8, name: "Cream of Chicken Soup", type: "Non-Veg", price: 160, available: true }
        ]
    },
    {
        id: 2,
        name: 'Starters-Veg',
        items: [
            { id: 9, name: "Paneer Tikka", type: "Veg", price: 220, available: true },
            { id: 10, name: "Gobi 65", type: "Veg", price: 180, available: true },
            { id: 11, name: "Crispy Corn", type: "Veg", price: 170, available: true },
            { id: 12, name: "Veg Spring Rolls", type: "Veg", price: 190, available: true },
            { id: 13, name: "Hara Bhara Kebab", type: "Veg", price: 200, available: true },
            { id: 14, name: "Veg Manchurian (Dry)", type: "Veg", price: 200, available: true },
            { id: 15, name: "Chilli Paneer", type: "Veg", price: 230, available: true },
            { id: 16, name: "Baby Corn Fry", type: "Veg", price: 190, available: true },
            { id: 17, name: "Mushroom 65", type: "Veg", price: 210, available: true },
            { id: 18, name: "Veg Pakora Platter", type: "Veg", price: 180, available: true },
            { id: 19, name: "Cheese Balls", type: "Veg", price: 220, available: true },
            { id: 20, name: "Tandoori Aloo", type: "Veg", price: 200, available: true }
        ]
    },
    {
        id: 3,
        name: 'Starters-NonVeg',
        items: [
            { id: 21, name: "Chicken Tikka", type: "Non-Veg", price: 260, available: true },
            { id: 22, name: "Tandoori Chicken", type: "Non-Veg", price: 320, available: true },
            { id: 23, name: "Chilli Chicken (Dry)", type: "Non-Veg", price: 240, available: true },
            { id: 24, name: "Chicken 65", type: "Non-Veg", price: 230, available: true },
            { id: 25, name: "Pepper Chicken", type: "Non-Veg", price: 260, available: true },
            { id: 26, name: "Fish Fry", type: "Non-Veg", price: 300, available: true },
            { id: 27, name: "Apollo Fish", type: "Non-Veg", price: 320, available: true },
            { id: 28, name: "Prawn 65", type: "Non-Veg", price: 360, available: true },
            { id: 29, name: "Chicken Lollipop", type: "Non-Veg", price: 250, available: true },
            { id: 30, name: "Mutton Seekh Kebab", type: "Non-Veg", price: 340, available: true },
            { id: 31, name: "Grilled Chicken Wings", type: "Non-Veg", price: 260, available: true },
            { id: 32, name: "Chicken Malai Tikka", type: "Non-Veg", price: 280, available: true }
        ]
    },
    {
        id: 4,
        name: 'MainCourse-Veg',
        items: [
            { id: 33, name: "Paneer Butter Masala", type: "Veg", price: 260, available: true },
            { id: 34, name: "Kadai Paneer", type: "Veg", price: 260, available: true },
            { id: 35, name: "Palak Paneer", type: "Veg", price: 250, available: true },
            { id: 36, name: "Dal Tadka", type: "Veg", price: 180, available: true },
            { id: 37, name: "Dal Makhani", type: "Veg", price: 220, available: true },
            { id: 38, name: "Malai Kofta", type: "Veg", price: 260, available: true },
            { id: 39, name: "Veg Korma", type: "Veg", price: 240, available: true },
            { id: 40, name: "Mixed Veg Curry", type: "Veg", price: 220, available: true },
            { id: 41, name: "Chole Masala", type: "Veg", price: 200, available: true },
            { id: 42, name: "Aloo Gobi", type: "Veg", price: 200, available: true },
            { id: 43, name: "Bhindi Masala", type: "Veg", price: 220, available: true },
            { id: 44, name: "Matar Paneer", type: "Veg", price: 240, available: true },
            { id: 45, name: "Veg Kolhapuri", type: "Veg", price: 240, available: true },
            { id: 46, name: "Kaju Masala", type: "Veg", price: 280, available: true }
        ]
    },
    {
        id: 5,
        name: 'MainCourse-NonVeg',
        items: [
            { id: 47, name: "Butter Chicken", type: "Non-Veg", price: 320, available: true },
            { id: 48, name: "Chicken Tikka Masala", type: "Non-Veg", price: 320, available: true },
            { id: 49, name: "Kadai Chicken", type: "Non-Veg", price: 300, available: true },
            { id: 50, name: "Chicken Chettinad", type: "Non-Veg", price: 320, available: true },
            { id: 51, name: "Mutton Rogan Josh", type: "Non-Veg", price: 380, available: true },
            { id: 52, name: "Mutton Curry", type: "Non-Veg", price: 360, available: true },
            { id: 53, name: "Fish Curry", type: "Non-Veg", price: 340, available: true },
            { id: 54, name: "Prawn Masala", type: "Non-Veg", price: 400, available: true },
            { id: 55, name: "Egg Curry", type: "Egg", price: 220, available: true },
            { id: 56, name: "Andhra Chicken Curry", type: "Non-Veg", price: 330, available: true },
            { id: 57, name: "Pepper Mutton", type: "Non-Veg", price: 400, available: true },
            { id: 58, name: "Chicken Handi", type: "Non-Veg", price: 310, available: true }
        ]
    },
    {
        id: 6,
        name: 'Rice-Biryani',
        items: [
            { id: 59, name: "Veg Biryani", type: "Veg", price: 220, available: true },
            { id: 60, name: "Paneer Biryani", type: "Veg", price: 260, available: true },
            { id: 61, name: "Mushroom Biryani", type: "Veg", price: 250, available: true },
            { id: 62, name: "Chicken Biryani", type: "Non-Veg", price: 300, available: true },
            { id: 63, name: "Mutton Biryani", type: "Non-Veg", price: 380, available: true },
            { id: 64, name: "Prawn Biryani", type: "Non-Veg", price: 420, available: true },
            { id: 65, name: "Egg Biryani", type: "Egg", price: 240, available: true },
            { id: 66, name: "Jeera Rice", type: "Veg", price: 150, available: true },
            { id: 67, name: "Veg Pulao", type: "Veg", price: 200, available: true },
            { id: 68, name: "Ghee Rice", type: "Veg", price: 190, available: true },
            { id: 69, name: "Curd Rice", type: "Veg", price: 140, available: true },
            { id: 70, name: "Schezwan Fried Rice", type: "Veg", price: 210, available: true }
        ]
    },
    {
        id: 7,
        name: 'IndoChinese',
        items: [
            { id: 71, name: "Veg Hakka Noodles", type: "Veg", price: 200, available: true },
            { id: 72, name: "Chicken Hakka Noodles", type: "Non-Veg", price: 240, available: true },
            { id: 73, name: "Schezwan Noodles", type: "Veg", price: 210, available: true },
            { id: 74, name: "Egg Noodles", type: "Egg", price: 220, available: true },
            { id: 75, name: "Veg Fried Rice", type: "Veg", price: 190, available: true },
            { id: 76, name: "Chicken Fried Rice", type: "Non-Veg", price: 240, available: true },
            { id: 77, name: "Veg Manchurian (Gravy)", type: "Veg", price: 220, available: true },
            { id: 78, name: "Chicken Manchurian (Gravy)", type: "Non-Veg", price: 260, available: true }
        ]
    },
    {
        id: 8,
        name: 'Breads',
        items: [
            { id: 79, name: "Butter Naan", type: "Veg", price: 50, available: true },
            { id: 80, name: "Garlic Naan", type: "Veg", price: 60, available: true },
            { id: 81, name: "Tandoori Roti", type: "Veg", price: 30, available: true },
            { id: 82, name: "Lachha Paratha", type: "Veg", price: 60, available: true },
            { id: 83, name: "Kulcha", type: "Veg", price: 70, available: true },
            { id: 84, name: "Rumali Roti", type: "Veg", price: 40, available: true }
        ]
    },
    {
        id: 9,
        name: 'Desserts',
        items: [
            { id: 85, name: "Gulab Jamun", type: "Veg", price: 100, available: true },
            { id: 86, name: "Rasmalai", type: "Veg", price: 120, available: true },
            { id: 87, name: "Double Ka Meetha", type: "Veg", price: 130, available: true },
            { id: 88, name: "Brownie with Ice Cream", type: "Veg", price: 180, available: true },
            { id: 89, name: "Ice Cream (3 Flavours)", type: "Veg", price: 90, available: true },
            { id: 90, name: "Carrot Halwa", type: "Veg", price: 130, available: true }
        ]
    }
];

const BASE_IMAGES: Record<string, string> = {
    'Soups': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop',
    'Starters-Veg': 'https://images.unsplash.com/photo-1585937421612-70a008356f36?q=80&w=800&auto=format&fit=crop',
    'Starters-NonVeg': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?q=80&w=800&auto=format&fit=crop',
    'MainCourse-Veg': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=800&auto=format&fit=crop',
    'MainCourse-NonVeg': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?q=80&w=800&auto=format&fit=crop',
    'Rice-Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop',
    'IndoChinese': 'https://images.unsplash.com/photo-1585032226651-759b368d72b7?q=80&w=800&auto=format&fit=crop',
    'Breads': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?q=80&w=800&auto=format&fit=crop',
    'Desserts': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=800&auto=format&fit=crop',
};

async function seed() {
    console.log('Seeding Minerva Menu...');

    // 1. Clear existing data
    console.log('Clearing old data...');

    // Clear dependent tables first
    const { error: errOrderItems } = await supabase.from('order_items').delete().neq('id', 0);
    if (errOrderItems) console.error('Error deleting order_items:', errOrderItems);

    const { error: errOrders } = await supabase.from('orders').delete().neq('id', 0);
    if (errOrders) console.error('Error deleting orders:', errOrders);

    const { error: err1 } = await supabase.from('menu_items').delete().neq('id', 0);
    if (err1) console.error('Error deleting items:', err1);

    // Deleting subcategories first
    const { error: err2 } = await supabase.from('sub_categories').delete().neq('id', 0);
    if (err2) console.error('Error deleting sub-categories:', err2);

    const { error: err3 } = await supabase.from('categories').delete().neq('id', 0);
    if (err3) console.error('Error deleting categories:', err3);

    // 2. Insert Categories and Items
    for (const cat of MINERVA_MENU) {
        console.log(`Inserting category: ${cat.name}`);

        // Insert Category
        const { error: catError } = await supabase.from('categories').insert({
            id: cat.id,
            name: cat.name,
            slug: cat.name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
            sort_order: cat.id,
            image_url: BASE_IMAGES[cat.name] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
        });

        if (catError) {
            console.error(`Failed to insert category ${cat.name}`, catError);
            continue;
        }

        // Insert "General" subcategory for now, or just link items to category
        // The service code creates a default "General" subcat. Let's create one explicitly.
        const subCatId = cat.id * 100; // unique enough
        const { error: subError } = await supabase.from('sub_categories').insert({
            id: subCatId,
            category_id: cat.id,
            name: 'General',
            sort_order: 1
        });

        if (subError) console.error(`Failed to insert subcat for ${cat.name}`, subError);

        // Insert Items
        const itemsToInsert = cat.items.map(item => ({
            id: item.id,
            category_id: cat.id,
            sub_category_id: subCatId,
            name: item.name,
            price: item.price,
            item_type: item.type,
            is_available: item.available,
            image_url: BASE_IMAGES[cat.name], // Use category image as placeholder for now, or fetch specific?
            sort_order: item.id
        }));

        const { error: itemsError } = await supabase.from('menu_items').insert(itemsToInsert);
        if (itemsError) {
            console.error(`Failed to insert items for ${cat.name}`, itemsError);
        } else {
            console.log(`Included ${itemsToInsert.length} items for ${cat.name}`);
        }
    }

    console.log('Seeding complete!');
    process.exit(0);
}

seed();
