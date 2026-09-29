import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/customer/table/verify?restaurantId=xxx&table=yyy
 * Secure server-side validation of restaurant table.
 * Ensures table exists and belongs to the given restaurant.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const rawRestaurantId = searchParams.get('restaurantId');
        const rawTable = searchParams.get('table');

        if (!rawRestaurantId || !rawTable) {
            return NextResponse.json({ valid: false, message: 'Restaurant and table are required' }, { status: 400 });
        }

        const restaurantId = (await resolveRestaurantId(rawRestaurantId)) || rawRestaurantId;
        const tableStr = decodeURIComponent(rawTable).trim();

        // 1. Try matching tables by table_number first
        let { data: tableData, error } = await supabaseAdmin
            .from('tables')
            .select('id, table_number, status, restaurant_id')
            .eq('restaurant_id', restaurantId)
            .eq('table_number', tableStr)
            .maybeSingle();

        // If not found and input is numeric, try matching by id
        const num = parseInt(tableStr, 10);
        if (!tableData && !isNaN(num)) {
            const { data: byId } = await supabaseAdmin
                .from('tables')
                .select('id, table_number, status, restaurant_id')
                .eq('restaurant_id', restaurantId)
                .eq('id', num)
                .maybeSingle();
            if (byId) tableData = byId;
        }

        // Strip prefix (e.g., "Table 2" -> "2")
        if (!tableData) {
            const cleanStr = tableStr.replace(/[^0-9]/g, '');
            if (cleanStr) {
                const { data: byClean } = await supabaseAdmin
                    .from('tables')
                    .select('id, table_number, status, restaurant_id')
                    .eq('restaurant_id', restaurantId)
                    .eq('table_number', cleanStr)
                    .maybeSingle();
                if (byClean) tableData = byClean;
            }
        }

        if (error || !tableData) {
            // Check merged groups
            const { data: groupData } = await supabaseAdmin
                .from('table_merge_groups')
                .select('id, display_name, restaurant_id')
                .eq('restaurant_id', restaurantId)
                .ilike('display_name', `%${tableStr}%`)
                .maybeSingle();

            if (groupData) {
                return NextResponse.json({
                    valid: true,
                    tableId: groupData.id,
                    tableNumber: groupData.display_name,
                    isMerged: true,
                });
            }

            return NextResponse.json({
                valid: false,
                message: `Table "${tableStr}" does not exist in this restaurant.`,
            });
        }

        return NextResponse.json({
            valid: true,
            tableId: tableData.id,
            tableNumber: String(tableData.table_number || tableData.id),
        });
    } catch (err: any) {
        return NextResponse.json({ valid: false, message: err.message }, { status: 500 });
    }
}
