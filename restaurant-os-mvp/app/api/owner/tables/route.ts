import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const scope = await resolveOwnerScope(auth, branchFilter);

        if (!scope.restaurantIds || scope.restaurantIds.length === 0) {
            return NextResponse.json({
                tables: [],
                totalTables: 0,
                occupiedCount: 0,
                availableCount: 0
            });
        }

        let tablesQuery = supabaseAdmin
            .from('tables')
            .select('*')
            .in('restaurant_id', scope.restaurantIds)
            .order('table_number', { ascending: true });

        if (scope.targetBranchId) {
            tablesQuery = tablesQuery.eq('branch_id', scope.targetBranchId);
        }

        const [tablesRes, restsRes] = await Promise.all([
            tablesQuery,
            supabaseAdmin.from('restaurants').select('id, name').in('id', scope.restaurantIds)
        ]);

        if (tablesRes.error) return NextResponse.json({ error: tablesRes.error.message }, { status: 500 });

        const tables = tablesRes.data || [];
        const restMap = new Map((restsRes.data || []).map(r => [r.id, r.name]));

        const enrichedTables = tables.map(t => ({
            ...t,
            restaurant_name: restMap.get(t.restaurant_id) || 'Restaurant'
        }));

        return NextResponse.json({
            tables: enrichedTables,
            totalTables: enrichedTables.length,
            occupiedCount: enrichedTables.filter(t => (t.status || '').toUpperCase() === 'OCCUPIED').length,
            availableCount: enrichedTables.filter(t => (t.status || '').toUpperCase() !== 'OCCUPIED').length
        });
    } catch (err: any) {
        console.error('[API /owner/tables GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
