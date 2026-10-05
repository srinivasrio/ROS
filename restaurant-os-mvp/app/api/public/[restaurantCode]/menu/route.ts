import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { formatAddress } from '@/lib/utils';
import { handleConditionalResponse, API_CACHE_POLICIES } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ restaurantCode: string }> }
) {
    try {
        const { restaurantCode } = await context.params;
        if (!restaurantCode) {
            return NextResponse.json({ error: 'Restaurant code is required' }, { status: 400 });
        }

        const actualId = await resolveRestaurantId(restaurantCode);
        if (!actualId) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Fetch all public menu components in parallel with minimal, explicit column projections
        const [catsRes, itemsRes, specialsRes, profileRes, stylesRes, restRes] = await Promise.all([
            supabaseAdmin
                .from('categories')
                .select('id, name, slug, image_url, sort_order, category_type, restaurant_id, branch_id')
                .eq('restaurant_id', actualId)
                .order('sort_order', { ascending: true })
                .order('id', { ascending: true }),

            supabaseAdmin
                .from('menu_items')
                .select(`
                    id, category_id, sub_category_id, name, description, price, 
                    image_url, is_available, item_type, is_veg, sort_order,
                    preparation_time, tax_percent, gst_percentage, cgst_percentage, sgst_percentage,
                    restaurant_id, menu_item_type,
                    price_variants, stock_ml, is_popular, active, rating,
                    is_today_special, special_price, special_expiry_datetime,
                    categories (name),
                    sub_categories (name)
                `)
                .eq('restaurant_id', actualId)
                .eq('active', true)
                .order('sort_order', { ascending: true })
                .order('id', { ascending: true }),

            supabaseAdmin
                .from('today_specials')
                .select(`
                    id, restaurant_id, title, description, special_price, original_price,
                    special_type, is_combo, is_active, valid_to, image_url, created_at,
                    items:today_special_items(
                        id, today_special_id, menu_item_id, quantity,
                        menu_item:menu_items(
                            id, name, price, item_type, image_url, is_available,
                            tax_percent, gst_percentage, cgst_percentage, sgst_percentage,
                            category:categories(name)
                        )
                    )
                `)
                .eq('restaurant_id', actualId)
                .eq('is_active', true),

            supabaseAdmin
                .from('restaurant_profile')
                .select('restaurant_id, restaurant_info, address, logo_url, slug')
                .eq('restaurant_id', actualId)
                .maybeSingle(),

            supabaseAdmin
                .from('section_style_settings')
                .select('id, restaurant_id, section_name, page_bg_color, card_bg_color, section_bg_color, border_color, title_color, subtitle_color, button_color, button_text_color, badge_color, title_font_size, border_radius, padding, margin, shadow, opacity')
                .eq('restaurant_id', actualId),

            supabaseAdmin
                .from('restaurants')
                .select('id, name, logo_url, address, phone, email, operating_hours')
                .eq('id', actualId)
                .maybeSingle()
        ]);

        if (catsRes.error) throw catsRes.error;
        if (itemsRes.error) throw itemsRes.error;

        // Process categories (deduplicate by name)
        const rawCats = catsRes.data || [];
        const uniqueCats = rawCats.filter((cat: { name?: string }, index: number, self: { name?: string }[]) =>
            index === self.findIndex((c) => c.name === cat.name)
        );

        // Process menu items
        const processedItems = (itemsRes.data || []).map((item) => ({
            ...item,
            category: item.categories,
            sub_category: item.sub_categories
        }));

        // Format clean public restaurant profile (Strictly NO private data)
        const profileData = profileRes.data as { restaurant_info?: Record<string, string>; address?: string; logo_url?: string } | null;
        const restData = restRes.data as { name?: string; logo_url?: string; address?: string; phone?: string; operating_hours?: string } | null;
        const rawInfo = profileData?.restaurant_info || {};
        const rawAddress = rawInfo.address || profileData?.address || restData?.address;

        const publicProfile = {
            restaurant_id: actualId,
            name: rawInfo.name || restData?.name || 'Restaurant',
            logo_url: rawInfo.logo_url || profileData?.logo_url || restData?.logo_url || '',
            address: formatAddress(rawAddress) || (typeof rawAddress === 'string' ? rawAddress : ''),
            phone: rawInfo.phone || restData?.phone || '',
            operating_hours: rawInfo.operating_hours || restData?.operating_hours || null
        };

        // Format section styles
        const stylesMap: Record<string, unknown> = {};
        (stylesRes.data || []).forEach((style: { section_name?: string }) => {
            if (style.section_name) {
                stylesMap[style.section_name] = style;
            }
        });

        // Return conditional response with ETag and edge cache policy (P2-02, P2-03)
        return handleConditionalResponse(request, {
            success: true,
            restaurant_id: actualId,
            profile: publicProfile,
            categories: uniqueCats,
            menu_items: processedItems,
            specials: specialsRes.data || [],
            section_styles: stylesMap
        }, {
            policy: API_CACHE_POLICIES.PUBLIC_RESTAURANT_CONTENT,
            extraHeaders: {
                'Vary': 'Accept-Encoding',
                'x-restaurant-id': actualId
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch public menu';
        console.error('Error in /api/public/[restaurantCode]/menu:', error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
