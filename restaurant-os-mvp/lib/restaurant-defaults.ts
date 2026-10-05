import { supabaseAdmin } from './supabase-admin';

export const DEFAULT_HOMEPAGE_SECTIONS = [
    { type: 'header', title: 'Header', order: 1, active: true },
    { type: 'hero_banners', title: 'Hero Banners', order: 2, active: true },
    { type: 'popular', title: 'Popular Items', order: 3, active: true },
    { type: 'categories', title: 'Categories', order: 4, active: true },
    { type: 'services', title: 'Services', order: 5, active: true },
    { type: 'specials', title: 'Today Specials', order: 6, active: true },
    { type: 'combos', title: 'Combo Offers', order: 7, active: true },
    { type: 'offers', title: 'Coupons & Offers', order: 8, active: true },
    { type: 'reorder', title: 'Reorder Section', order: 9, active: false },
    { type: 'footer', title: 'Footer', order: 10, active: true }
];

export const DEFAULT_SERVICE_OPTIONS = [
    { service_key: 'call_waiter', label: 'Call Waiter', sub_label: 'General Help', image_url: '/services/Waiter.webm', gradient: 'from-orange-400/20 to-orange-600/20', border_class: 'border-orange-200/50', text_class: 'text-orange-900', countable: false, sort_order: 1, is_active: true },
    { service_key: 'bill_requested', label: 'Request Bill', sub_label: 'Ready to Pay', image_url: '/services/Bill.png', gradient: 'from-violet-400/20 to-violet-600/20', border_class: 'border-violet-200/50', text_class: 'text-violet-900', countable: false, sort_order: 2, is_active: true },
    { service_key: 'water_requested', label: 'Water', sub_label: 'Refill Please', image_url: '/services/Water.png', gradient: 'from-blue-400/20 to-blue-600/20', border_class: 'border-blue-200/50', text_class: 'text-blue-900', countable: false, sort_order: 3, is_active: true },
    { service_key: 'cutlery_requested', label: 'Cutlery', sub_label: 'Extras', image_url: '/services/Cutlery.webp', gradient: 'from-emerald-400/20 to-emerald-600/20', border_class: 'border-emerald-200/50', text_class: 'text-emerald-900', countable: true, sort_order: 4, is_active: true },
    { service_key: 'glass_requested', label: 'Extra Glass', sub_label: 'Drinkware', image_url: '/services/Glass.jpg', gradient: 'from-sky-400/20 to-sky-600/20', border_class: 'border-sky-200/50', text_class: 'text-sky-900', countable: true, sort_order: 5, is_active: true },
    { service_key: 'straw_requested', label: 'Straw', sub_label: 'Drinkware', image_url: '/services/Straw.png', gradient: 'from-yellow-400/20 to-yellow-600/20', border_class: 'border-yellow-200/50', text_class: 'text-yellow-900', countable: true, sort_order: 6, is_active: true },
    { service_key: 'plate_requested', label: 'Extra Plate', sub_label: 'Dinnerware', image_url: '/services/Plate.png', gradient: 'from-zinc-400/20 to-zinc-600/20', border_class: 'border-zinc-200/50', text_class: 'text-zinc-900', countable: true, sort_order: 7, is_active: true },
    { service_key: 'bowl_requested', label: 'Finger Bowl', sub_label: 'Cleaning', image_url: '/services/Finger bowl.jpg', gradient: 'from-blue-400/20 to-blue-600/20', border_class: 'border-blue-200/50', text_class: 'text-blue-900', countable: true, sort_order: 8, is_active: true },
    { service_key: 'salt_requested', label: 'Salt', sub_label: 'Seasoning', image_url: '/services/Salt.jpg', gradient: 'from-stone-400/20 to-stone-600/20', border_class: 'border-stone-200/50', text_class: 'text-stone-900', countable: false, sort_order: 9, is_active: true },
    { service_key: 'pepper_requested', label: 'Pepper', sub_label: 'Seasoning', image_url: '/services/Pepper.jpg', gradient: 'from-neutral-400/20 to-neutral-600/20', border_class: 'border-neutral-200/50', text_class: 'text-neutral-900', countable: false, sort_order: 10, is_active: true },
    { service_key: 'sauce_requested', label: 'Ketchup', sub_label: 'Sauce', image_url: '/services/Ketchup.jpg', gradient: 'from-red-400/20 to-red-600/20', border_class: 'border-red-200/50', text_class: 'text-red-900', countable: false, sort_order: 11, is_active: true },
    { service_key: 'tissue_requested', label: 'Tissue', sub_label: 'Tissue', image_url: '/services/Tissue.png', gradient: 'from-red-400/20 to-red-600/20', border_class: 'border-red-200/50', text_class: 'text-red-900', countable: true, sort_order: 12, is_active: true }
];

export interface RestaurantSeedDetails {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    businessType?: string;
    slug?: string;
    gstPercentage?: number;
    cgstPercentage?: number;
    sgstPercentage?: number;
}

/**
 * Seeds all baseline configuration tables for a restaurant.
 * Idempotent: safely uses ON CONFLICT / existence checks to prevent duplicates.
 */
export async function seedRestaurantDefaults(restaurantId: string, details?: RestaurantSeedDetails) {
    if (!restaurantId) return;

    try {
        const cleanName = details?.name?.trim() || 'Restaurant';
        const cleanSlug = details?.slug?.trim() || 
            (cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + restaurantId.slice(-4));

        const gst = details?.gstPercentage ?? 5.0;
        const cgst = details?.cgstPercentage ?? (gst / 2.0);
        const sgst = details?.sgstPercentage ?? (gst / 2.0);

        // 1. Ensure restaurant_profile exists
        const { data: existingProfile } = await supabaseAdmin
            .from('restaurant_profile')
            .select('restaurant_id')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (!existingProfile) {
            await supabaseAdmin.from('restaurant_profile').insert({
                restaurant_id: restaurantId,
                name: cleanName,
                business_type: details?.businessType || 'Restaurant',
                address: details?.address || '',
                phone: details?.phone || '',
                email: details?.email || '',
                slug: cleanSlug,
                tax_percentage: gst,
                gst_percentage: gst,
                cgst_percentage: cgst,
                sgst_percentage: sgst,
                restaurant_info: {
                    name: cleanName,
                    phone: details?.phone || '',
                    email: details?.email || '',
                    address: details?.address || ''
                }
            });
        }

        // 2. Ensure restaurant_theme exists
        const { data: existingTheme } = await supabaseAdmin
            .from('restaurant_theme')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (!existingTheme) {
            await supabaseAdmin.from('restaurant_theme').insert({
                restaurant_id: restaurantId,
                bg_color: '#F9FAFB',
                webpage_bg_color: '#ffffff',
                header_bg_color: '#ffffff',
                text_color: '#000000',
                primary_button_color: '#F97316',
                secondary_button_color: '#000000',
                font_style: 'Inter',
                card_radius: '16px'
            });
        }

        // 3. Ensure homepage_sections exist
        const { data: existingSections } = await supabaseAdmin
            .from('homepage_sections')
            .select('section_type')
            .eq('restaurant_id', restaurantId);

        const existingTypes = new Set(existingSections?.map(s => s.section_type) || []);
        const sectionsToInsert = DEFAULT_HOMEPAGE_SECTIONS
            .filter(s => !existingTypes.has(s.type))
            .map(s => ({
                restaurant_id: restaurantId,
                section_type: s.type,
                section_title: s.title,
                display_order: s.order,
                active: s.active,
                layout: {},
                elements: []
            }));

        if (sectionsToInsert.length > 0) {
            await supabaseAdmin.from('homepage_sections').insert(sectionsToInsert);
        }

        // 4. Ensure service_options exist
        const { count: serviceCount } = await supabaseAdmin
            .from('service_options')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId);

        if (!serviceCount || serviceCount === 0) {
            const optionsToInsert = DEFAULT_SERVICE_OPTIONS.map(opt => ({
                restaurant_id: restaurantId,
                ...opt
            }));
            await supabaseAdmin.from('service_options').insert(optionsToInsert);
        }

        // 5. Ensure default branch exists
        const { data: existingBranch } = await supabaseAdmin
            .from('branches')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (!existingBranch) {
            const branchId = `BR-${restaurantId.slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
            await supabaseAdmin.from('branches').insert({
                id: branchId,
                restaurant_id: restaurantId,
                name: 'Main Branch',
                address: details?.address || '',
                phone: details?.phone || '',
                email: details?.email || '',
                is_main_branch: true,
                status: 'pending_approval'
            });
        }
    } catch (err) {
        console.warn(`[seedRestaurantDefaults] Non-fatal seeding warning for ${restaurantId}:`, err);
    }
}
