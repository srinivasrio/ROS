import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';
import { revalidatePublicMenuCache } from '@/lib/public-menu-cache';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const scope = await resolveOwnerScope(auth, branchFilter);

        if (!scope.restaurantIds || scope.restaurantIds.length === 0) {
            return NextResponse.json({
                categories: [],
                items: [],
                totalCategories: 0,
                totalItems: 0,
                vegCount: 0,
                nonVegCount: 0,
                availableCount: 0
            });
        }

        let catQuery = supabaseAdmin
            .from('categories')
            .select('*')
            .in('restaurant_id', scope.restaurantIds)
            .order('sort_order', { ascending: true });

        let itemQuery = supabaseAdmin
            .from('menu_items')
            .select('*')
            .in('restaurant_id', scope.restaurantIds)
            .order('sort_order', { ascending: true });

        if (scope.targetBranchId) {
            itemQuery = itemQuery.or(`branch_id.eq.${scope.targetBranchId},branch_id.is.null`);
            catQuery = catQuery.or(`branch_id.eq.${scope.targetBranchId},branch_id.is.null`);
        }

        const [categoriesRes, itemsRes, restsRes] = await Promise.all([
            catQuery,
            itemQuery,
            supabaseAdmin.from('restaurants').select('id, name').in('id', scope.restaurantIds)
        ]);

        const restMap = new Map((restsRes.data || []).map(r => [r.id, r.name]));
        const catMap = new Map((categoriesRes.data || []).map(c => [c.id, c.name]));

        const enrichedItems = (itemsRes.data || []).map(item => ({
            ...item,
            restaurant_name: restMap.get(item.restaurant_id) || 'Restaurant',
            category_name: catMap.get(item.category_id) || item.category || 'General'
        }));

        return NextResponse.json({
            categories: categoriesRes.data || [],
            items: enrichedItems,
            totalCategories: (categoriesRes.data || []).length,
            totalItems: enrichedItems.length,
            vegCount: enrichedItems.filter(i => i.is_veg).length,
            nonVegCount: enrichedItems.filter(i => !i.is_veg).length,
            availableCount: enrichedItems.filter(i => i.is_available !== false).length
        });
    } catch (err: any) {
        console.error('[API /owner/menu GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, is_available } = body;
        if (!id) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });

        const scope = await resolveOwnerScope(auth, null);

        const { data: item, error } = await supabaseAdmin
            .from('menu_items')
            .update({ is_available })
            .eq('id', id)
            .in('restaurant_id', scope.restaurantIds)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Trigger on-demand cache revalidation for the affected restaurant only (P2-09)
        if (item?.restaurant_id) {
            revalidatePublicMenuCache(item.restaurant_id).catch(() => {});
        }

        return NextResponse.json({ success: true, item });
    } catch (err: any) {
        console.error('[API /owner/menu PATCH] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

