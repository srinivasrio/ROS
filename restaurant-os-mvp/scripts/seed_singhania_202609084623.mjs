import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const restaurantId = '202609084623';

const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    },
});

const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIME_MAP = {
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
};

async function uploadFileToR2(localPath, r2Key, contentType = 'image/jpeg') {
    if (!fs.existsSync(localPath)) {
        console.warn(`File not found: ${localPath}`);
        return null;
    }
    const buffer = fs.readFileSync(localPath);
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
        Body: buffer,
        ContentType: contentType,
    });
    await r2Client.send(command);
    const publicUrl = `${publicUrlBase}/${r2Key}`;
    console.log(`Uploaded to R2: ${publicUrl}`);
    return publicUrl;
}

async function uploadMenuImage(filename) {
    const localPath = path.join(process.cwd(), 'public', 'menu', filename);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || 'image/jpeg';
    const key = `restaurants/${restaurantId}/menu/${filename}`;
    return uploadFileToR2(localPath, key, contentType);
}

async function uploadOptimizedBanner(localImagePath, bannerName) {
    if (!fs.existsSync(localImagePath)) {
        console.warn(`Banner source not found: ${localImagePath}`);
        return null;
    }
    // Resize & convert to 16:9 WebP with sharp
    const webpBuffer = await sharp(localImagePath)
        .resize(1200, 675, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();

    const timestamp = Date.now();
    const key = `restaurants/${restaurantId}/banners/${timestamp}-${bannerName}.webp`;
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: webpBuffer,
        ContentType: 'image/webp',
    });
    await r2Client.send(command);
    const publicUrl = `${publicUrlBase}/${key}`;
    console.log(`Uploaded optimized banner -> ${publicUrl}`);
    return publicUrl;
}

async function main() {
    console.log(`\n======================================================`);
    console.log(`Seeding Menu, Specials, Combos & Banners for [${restaurantId}]`);
    console.log(`======================================================\n`);

    // ----------------------------------------------------
    // STEP 1: Categories & Subcategories
    // ----------------------------------------------------
    const { data: existingCats } = await supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('restaurant_id', restaurantId);

    const catMap = {};
    for (const c of existingCats || []) {
        catMap[c.name.toLowerCase()] = c.id;
    }

    const categoriesToEnsure = [
        { name: 'Biryanis', slug: 'biryanis', imageFile: 'chicken-biryani.jpeg' },
        { name: 'Starters', slug: 'starters', imageFile: 'chicken-65.jpeg' },
        { name: 'Main Course', slug: 'main-course', imageFile: 'butter-chicken.png' },
        { name: 'Chinese', slug: 'chinese', imageFile: 'chicken-fried-rice.jpeg' },
        { name: 'Desserts', slug: 'desserts', imageFile: 'gulab-jamun.jpeg' },
        { name: 'Breads', slug: 'breads', imageFile: 'butter-naan.jpeg' },
    ];

    for (const catDef of categoriesToEnsure) {
        let catId = catMap[catDef.name.toLowerCase()];
        if (!catId) {
            console.log(`Creating category: "${catDef.name}"...`);
            const imageUrl = await uploadMenuImage(catDef.imageFile);
            const { data: res, error: catErr } = await supabase.rpc('create_category_sequential', {
                p_name: catDef.name,
                p_restaurant_id: restaurantId,
                p_image_url: imageUrl,
                p_category_type: 'food'
            });
            if (catErr) {
                console.error(`Error creating category ${catDef.name}:`, catErr);
            } else {
                console.log(`Created category ${catDef.name} (id: ${res.id})`);
                catMap[catDef.name.toLowerCase()] = res.id;
            }
        } else {
            console.log(`Category "${catDef.name}" already exists (id: ${catId}). Updating image if missing.`);
            const existingCat = existingCats.find(c => c.id === catId);
            if (!existingCat?.image_url) {
                const imageUrl = await uploadMenuImage(catDef.imageFile);
                await supabase.from('categories').update({ image_url: imageUrl }).eq('id', catId);
            }
        }
    }

    // Refresh subcategory mapping
    const { data: allSubs } = await supabase
        .from('sub_categories')
        .select('id, category_id, name')
        .eq('restaurant_id', restaurantId);

    const subMap = {};
    for (const s of allSubs || []) {
        subMap[s.category_id] = s.id;
    }

    // ----------------------------------------------------
    // STEP 2: Update existing items & Add New Menu Items
    // ----------------------------------------------------
    // Update existing Butter Naan and Roti images if needed
    const naanImg = await uploadMenuImage('butter-naan.jpeg');
    const rotiImg = await uploadMenuImage('tandoori-roti.jpeg');
    await supabase.from('menu_items')
        .update({ image_url: naanImg, is_popular: true })
        .eq('restaurant_id', restaurantId)
        .ilike('name', '%butter naan%');
    await supabase.from('menu_items')
        .update({ image_url: rotiImg })
        .eq('restaurant_id', restaurantId)
        .ilike('name', '%roti%');

    // Menu items to add
    const itemsToAdd = [
        // Biryanis
        {
            category: 'biryanis',
            name: 'Chicken Dum Biryani',
            description: 'Fragrant long-grain basmati layered with tender spiced chicken, saffron, mint and caramelized onions.',
            price: 299,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'chicken-biryani.jpeg',
            preparation_time: 15,
        },
        {
            category: 'biryanis',
            name: 'Mutton Dum Biryani',
            description: 'Succulent cuts of fresh tender mutton slow-cooked with basmati rice in sealed handi with rich spices.',
            price: 389,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'mutton-biryani.jpeg',
            preparation_time: 20,
        },
        {
            category: 'biryanis',
            name: 'Veg Dum Biryani',
            description: 'Garden fresh vegetables, paneer cubes and fragrant spices dum cooked with royal basmati rice.',
            price: 219,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'veg-biryani.png',
            preparation_time: 15,
        },
        {
            category: 'biryanis',
            name: 'Prawns Biryani',
            description: 'Juicy coastal fresh prawns tossed in spiced masala and layered with aromatic ghee rice.',
            price: 369,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: false,
            is_today_special: false,
            imageFile: 'prawn-biryani.jpeg',
            preparation_time: 18,
        },

        // Starters
        {
            category: 'starters',
            name: 'Chicken 65',
            description: 'Crispy fried chicken chunks tossed with spicy red chili curd paste and aromatic curry leaves.',
            price: 249,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'chicken-65.jpeg',
            preparation_time: 12,
        },
        {
            category: 'starters',
            name: 'Paneer Tikka',
            description: 'Char-grilled cottage cheese cubes marinated in spiced hung curd with bell peppers and onions.',
            price: 229,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'paneer-tikka.png',
            preparation_time: 15,
        },
        {
            category: 'starters',
            name: 'Chicken Lollipop',
            description: 'Crispy frenched chicken drumettes tossed with sweet and tangy hot garlic sauce.',
            price: 279,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'chicken-lollipop.jpeg',
            preparation_time: 15,
        },
        {
            category: 'starters',
            name: 'Crispy Corn',
            description: 'Crispy golden fried sweet corn kernels tossed with chopped onions, green chilies and chaat masala.',
            price: 189,
            item_type: 'Veg',
            is_veg: true,
            is_popular: false,
            is_today_special: false,
            imageFile: 'crispy-corn.jpeg',
            preparation_time: 10,
        },
        {
            category: 'starters',
            name: 'Tandoori Chicken (Half)',
            description: 'Whole chicken bone-in pieces marinated overnight in tandoori masala and roasted over charcoal.',
            price: 289,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'tandoori-chicken.jpeg',
            preparation_time: 20,
        },
        {
            category: 'starters',
            name: 'Apollo Fish',
            description: 'Boneless fish fillets batter fried and stir-fried with green chillies, garlic and yogurt tempering.',
            price: 319,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'apollo-fish.jpeg',
            preparation_time: 15,
        },

        // Main Course
        {
            category: 'main course',
            name: 'Butter Chicken',
            description: 'Tandoori boneless chicken simmered in rich creamy tomato and cashew butter gravy with kasuri methi.',
            price: 289,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'butter-chicken.png',
            preparation_time: 15,
        },
        {
            category: 'main course',
            name: 'Paneer Butter Masala',
            description: 'Tender cottage cheese cubes cooked in a velvety tomato makhani gravy enriched with fresh cream and butter.',
            price: 239,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'paneer-butter-masala.jpeg',
            preparation_time: 15,
        },
        {
            category: 'main course',
            name: 'Mutton Rogan Josh',
            description: 'Tender Kashmiri mutton cooked in a deeply flavorful aromatic curry with fennel, ginger and Kashmiri chilies.',
            price: 369,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: true,
            special_price: 299,
            imageFile: 'mutton-rogan-josh.jpeg',
            preparation_time: 20,
        },
        {
            category: 'main course',
            name: 'Dal Makhani',
            description: 'Slow-cooked whole black lentils and red kidney beans simmered overnight with butter and fresh cream.',
            price: 199,
            item_type: 'Veg',
            is_veg: true,
            is_popular: false,
            is_today_special: false,
            imageFile: 'dal-makhani.jpeg',
            preparation_time: 12,
        },
        {
            category: 'main course',
            name: 'Kadai Paneer',
            description: 'Paneer cubes and crunchy bell peppers stir fried with freshly ground coriander and cumin kadai spices.',
            price: 229,
            item_type: 'Veg',
            is_veg: true,
            is_popular: false,
            is_today_special: false,
            imageFile: 'kadai-paneer.jpeg',
            preparation_time: 15,
        },

        // Chinese
        {
            category: 'chinese',
            name: 'Chicken Fried Rice',
            description: 'Wok-tossed basmati rice with scrambled egg, shredded chicken, garlic and scallions in light soy sauce.',
            price: 219,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'chicken-fried-rice.jpeg',
            preparation_time: 12,
        },
        {
            category: 'chinese',
            name: 'Veg Hakka Noodles',
            description: 'Classic stir-fried noodles with crisp julienned bell peppers, shredded cabbage and fragrant spring onions.',
            price: 169,
            item_type: 'Veg',
            is_veg: true,
            is_popular: false,
            is_today_special: false,
            imageFile: 'veg-hakka-noodles.jpeg',
            preparation_time: 12,
        },
        {
            category: 'chinese',
            name: 'Chilli Chicken Dry',
            description: 'Crispy batter-fried chicken bites tossed with garlic, ginger, green chillies and dark soya glaze.',
            price: 259,
            item_type: 'Non-Veg',
            is_veg: false,
            is_popular: true,
            is_today_special: false,
            imageFile: 'chilli-chicken-dry.jpeg',
            preparation_time: 14,
        },

        // Desserts
        {
            category: 'desserts',
            name: 'Gulab Jamun (2 pcs)',
            description: 'Warm, soft mawa dumplings deeply soaked in cardamom and saffron infused rose sugar syrup.',
            price: 89,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'gulab-jamun.jpeg',
            preparation_time: 5,
        },
        {
            category: 'desserts',
            name: 'Rasmalai (2 pcs)',
            description: 'Pillow-soft cottage cheese discs immersed in sweet saffron milk topped with crushed pistachios.',
            price: 119,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'rasmalai.jpeg',
            preparation_time: 5,
        },
        {
            category: 'desserts',
            name: 'Sizzling Brownie with Ice Cream',
            description: 'Fudgy walnut brownie served on a smoking hot sizzler plate with vanilla ice cream and warm chocolate ganache.',
            price: 159,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'brownie-with-ice-cream.jpeg',
            preparation_time: 8,
        },

        // Breads
        {
            category: 'breads',
            name: 'Garlic Naan',
            description: 'Clay-oven baked refined flour flatbread stuffed with roasted garlic and brushed with fresh butter and coriander.',
            price: 65,
            item_type: 'Veg',
            is_veg: true,
            is_popular: true,
            is_today_special: false,
            imageFile: 'garlic-naan.jpeg',
            preparation_time: 8,
        },
        {
            category: 'breads',
            name: 'Rumali Roti',
            description: 'Ultra-thin, soft handkerchief bread cooked expertly over an inverted hot wok.',
            price: 40,
            item_type: 'Veg',
            is_veg: true,
            is_popular: false,
            is_today_special: false,
            imageFile: 'rumali-roti.jpeg',
            preparation_time: 8,
        },
    ];

    // Check existing items to avoid duplicates
    const { data: currentItems } = await supabase
        .from('menu_items')
        .select('id, name')
        .eq('restaurant_id', restaurantId);

    const existingNames = new Set((currentItems || []).map(i => i.name.toLowerCase()));
    const itemMapByName = {};
    for (const item of currentItems || []) {
        itemMapByName[item.name.toLowerCase()] = item.id;
    }

    const uploadedUrlMap = {};

    for (const item of itemsToAdd) {
        if (existingNames.has(item.name.toLowerCase())) {
            console.log(`Item "${item.name}" already exists. Skipping.`);
            continue;
        }

        const catId = catMap[item.category.toLowerCase()];
        if (!catId) {
            console.warn(`Category "${item.category}" not found. Skipping "${item.name}".`);
            continue;
        }
        const subCatId = subMap[catId] || null;

        let imgUrl = uploadedUrlMap[item.imageFile];
        if (!imgUrl) {
            imgUrl = await uploadMenuImage(item.imageFile);
            if (imgUrl) uploadedUrlMap[item.imageFile] = imgUrl;
        }

        const payload = {
            restaurant_id: restaurantId,
            name: item.name,
            description: item.description,
            price: item.price,
            category_id: catId,
            sub_category_id: subCatId,
            item_type: item.item_type,
            is_veg: item.is_veg,
            is_available: true,
            is_popular: item.is_popular,
            active: true,
            rating: 4.8,
            preparation_time: item.preparation_time,
            tax_percent: 5,
            menu_item_type: 'food',
            image_url: imgUrl,
            is_today_special: item.is_today_special || false,
            special_price: item.special_price || null,
        };

        const { data: saved, error: saveErr } = await supabase.rpc('save_menu_item_with_recipe', {
            p_menu_item: payload,
            p_ingredients: []
        });

        if (saveErr) {
            console.error(`Failed to save "${item.name}":`, saveErr.message || saveErr);
        } else {
            console.log(`✅ Added menu item: "${item.name}" (id: ${saved.id}, ₹${item.price})`);
            itemMapByName[item.name.toLowerCase()] = saved.id;
        }
    }

    // Refresh all menu items for linking
    const { data: allMenuItems } = await supabase
        .from('menu_items')
        .select('id, name, price, image_url')
        .eq('restaurant_id', restaurantId);

    for (const item of allMenuItems || []) {
        itemMapByName[item.name.toLowerCase()] = item.id;
    }

    // ----------------------------------------------------
    // STEP 3: Create Today's Special (Single item)
    // ----------------------------------------------------
    console.log(`\n--- Creating Today Special ---`);
    const muttonRoganJoshId = itemMapByName['mutton rogan josh'];
    const muttonItem = allMenuItems.find(i => i.id === muttonRoganJoshId);

    let specialRecord = null;
    if (muttonRoganJoshId) {
        // Check if special already exists
        const { data: existingSpecial } = await supabase
            .from('today_specials')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('special_type', 'single')
            .maybeSingle();

        if (existingSpecial) {
            console.log('Today Special already exists (id:', existingSpecial.id, ')');
            specialRecord = existingSpecial;
        } else {
            const { data: newSpecial, error: specErr } = await supabase
                .from('today_specials')
                .insert({
                    restaurant_id: restaurantId,
                    title: "Chef's Special Mutton Rogan Josh",
                    description: "Slow-simmered tender Kashmiri mutton in authentic copper pot with saffron, cardamom and whole spices.",
                    special_price: 299,
                    original_price: muttonItem ? muttonItem.price : 369,
                    is_combo: false,
                    special_type: 'single',
                    is_active: true,
                    image_url: muttonItem ? muttonItem.image_url : null,
                })
                .select()
                .single();

            if (specErr) {
                console.error('Error creating today special:', specErr);
            } else {
                console.log('✅ Created Today Special:', newSpecial.id, newSpecial.title);
                specialRecord = newSpecial;

                // Insert into today_special_items
                await supabase.from('today_special_items').insert({
                    today_special_id: newSpecial.id,
                    menu_item_id: muttonRoganJoshId,
                    quantity: 1,
                    restaurant_id: restaurantId
                });

                // Sync menu_items table
                await supabase.from('menu_items')
                    .update({ is_today_special: true, special_price: 299 })
                    .eq('id', muttonRoganJoshId);
            }
        }
    }

    // ----------------------------------------------------
    // STEP 4: Create Combo with linked items
    // ----------------------------------------------------
    console.log(`\n--- Creating Combo ---`);
    const comboItemsConfig = [
        { name: 'chicken dum biryani', quantity: 1 },
        { name: 'chicken 65', quantity: 1 },
        { name: 'butter naan', quantity: 2 },
        { name: 'gulab jamun (2 pcs)', quantity: 1 },
    ];

    const resolvedComboItems = [];
    let comboOriginalPrice = 0;

    for (const c of comboItemsConfig) {
        const mId = itemMapByName[c.name.toLowerCase()];
        const mObj = allMenuItems.find(i => i.id === mId);
        if (mId && mObj) {
            resolvedComboItems.push({
                menu_item_id: mId,
                quantity: c.quantity,
                price: mObj.price
            });
            comboOriginalPrice += mObj.price * c.quantity;
        } else {
            console.warn(`Could not find combo item "${c.name}"!`);
        }
    }

    const { data: existingGrandCombo } = await supabase
        .from('today_specials')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('title', 'Singhania Grand Feast Combo')
        .maybeSingle();

    let grandComboRecord = null;
    if (existingGrandCombo) {
        console.log('Grand Feast Combo already exists (id:', existingGrandCombo.id, ')');
        grandComboRecord = existingGrandCombo;
    } else {
        // Upload combo image
        const comboCoverUrl = uploadedUrlMap['chicken-biryani.jpeg'] || await uploadMenuImage('chicken-biryani.jpeg');

        const { data: newCombo, error: comboErr } = await supabase
            .from('today_specials')
            .insert({
                restaurant_id: restaurantId,
                title: 'Singhania Grand Feast Combo',
                description: 'The ultimate royal banquet: Chicken Dum Biryani, Chicken 65, 2 Butter Naans, and warm Gulab Jamun dessert.',
                special_price: 549,
                original_price: comboOriginalPrice || 747,
                is_combo: true,
                special_type: 'combo',
                is_active: true,
                image_url: comboCoverUrl,
            })
            .select()
            .single();

        if (comboErr) {
            console.error('Error creating combo:', comboErr);
        } else {
            console.log('✅ Created Grand Feast Combo:', newCombo.id, newCombo.title);
            grandComboRecord = newCombo;

            // Link items in today_special_items
            const itemsToInsert = resolvedComboItems.map(item => ({
                today_special_id: newCombo.id,
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                restaurant_id: restaurantId
            }));

            const { error: itemsErr } = await supabase
                .from('today_special_items')
                .insert(itemsToInsert);

            if (itemsErr) console.error('Error linking combo items:', itemsErr);
            else console.log(`Linked ${itemsToInsert.length} items to combo!`);
        }
    }

    // Also link items into the other 2 combos if they have 0 items
    const { data: emptyCombos } = await supabase
        .from('today_specials')
        .select('id, title, today_special_items(count)')
        .eq('restaurant_id', restaurantId)
        .eq('is_combo', true);

    for (const ec of emptyCombos || []) {
        if (ec.id !== grandComboRecord?.id && (!ec.today_special_items || ec.today_special_items.length === 0 || ec.today_special_items[0]?.count === 0)) {
            console.log(`Fixing empty combo items for: "${ec.title}"...`);
            if (ec.title.includes('Tandoori')) {
                const tandooriId = itemMapByName['tandoori chicken (half)'];
                const naanId = itemMapByName['butter naan'];
                if (tandooriId && naanId) {
                    await supabase.from('today_special_items').insert([
                        { today_special_id: ec.id, menu_item_id: tandooriId, quantity: 1, restaurant_id: restaurantId },
                        { today_special_id: ec.id, menu_item_id: naanId, quantity: 2, restaurant_id: restaurantId }
                    ]);
                }
            } else if (ec.title.includes('Biryani')) {
                const biryaniId = itemMapByName['chicken dum biryani'];
                const starterId = itemMapByName['chicken lollipop'];
                if (biryaniId && starterId) {
                    await supabase.from('today_special_items').insert([
                        { today_special_id: ec.id, menu_item_id: biryaniId, quantity: 1, restaurant_id: restaurantId },
                        { today_special_id: ec.id, menu_item_id: starterId, quantity: 1, restaurant_id: restaurantId }
                    ]);
                }
            }
        }
    }

    // ----------------------------------------------------
    // STEP 5: Create 3 High-Impact Banners
    // ----------------------------------------------------
    console.log(`\n--- Creating 3 Banners ---`);

    const artifactDir = '/Users/srinivaskumar/.gemini/antigravity-ide/brain/2afed0f6-0782-44ea-b9b7-37b650fc9aa4';
    const banner1Source = path.join(artifactDir, 'singhania_grand_combo_banner_1789721095250.jpg');
    const banner2Source = path.join(artifactDir, 'singhania_special_curry_banner_1789721128885.jpg');
    const banner3Source = path.join(artifactDir, 'singhania_biryani_fest_banner_1789721160010.jpg');

    const banner1Url = await uploadOptimizedBanner(banner1Source, 'grand-combo-banner');
    const banner2Url = await uploadOptimizedBanner(banner2Source, 'chef-special-banner');
    const banner3Url = await uploadOptimizedBanner(banner3Source, 'biryani-festival-banner');

    const biryaniCatId = catMap['biryanis'] || catMap['starters'];

    const bannersToInsert = [
        {
            restaurant_id: restaurantId,
            image_url: banner1Url,
            heading: 'Grand Feast Combo',
            subheading: '4-Course Royal Banquet: Biryani, Starter, Naans & Sweet at ₹549',
            cta_text: 'View Combo',
            redirect_type: 'combo',
            redirect_target: grandComboRecord?.id || null,
            display_order: 0,
            active: true,
        },
        {
            restaurant_id: restaurantId,
            image_url: banner2Url,
            heading: "Chef's Special Mutton Rogan Josh",
            subheading: 'Kashmiri slow-simmered delicacy now at special price ₹299',
            cta_text: 'View Special',
            redirect_type: 'special',
            redirect_target: specialRecord?.id || null,
            display_order: 1,
            active: true,
        },
        {
            restaurant_id: restaurantId,
            image_url: banner3Url,
            heading: 'Royal Dum Biryani Festival',
            subheading: 'Flavors of royalty dum-cooked with fragrant long-grain basmati',
            cta_text: 'Explore Biryanis',
            redirect_type: 'category',
            redirect_target: String(biryaniCatId || ''),
            display_order: 2,
            active: true,
        },
    ];

    // Clear existing banners for this restaurant and insert the 3 new ones
    console.log('Replacing existing banners for 202609084623...');
    await supabase.from('homepage_banners').delete().eq('restaurant_id', restaurantId);

    const { data: insertedBanners, error: bannerErr } = await supabase
        .from('homepage_banners')
        .insert(bannersToInsert)
        .select();

    if (bannerErr) {
        console.error('Error inserting banners:', bannerErr);
    } else {
        console.log(`✅ Successfully inserted ${insertedBanners.length} banners:`);
        insertedBanners.forEach(b => console.log(`  - [Order ${b.display_order}] ${b.heading} -> ${b.redirect_type}:${b.redirect_target}`));
    }

    console.log(`\n======================================================`);
    console.log(`🎉 ALL TASKS COMPLETE FOR RESTAURANT 202609084623 🎉`);
    console.log(`======================================================\n`);
}

main().catch(console.error);
