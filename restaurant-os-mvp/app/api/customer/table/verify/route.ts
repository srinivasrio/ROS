import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { parseTableQrCode, TableVerifyResponse } from '@/lib/table-qr-utils';

/**
 * Shared verification logic for validating table QR and enforcing visited restaurant isolation.
 */
async function verifyTableForRestaurant(
    rawRestaurantId: string | null,
    rawTableOrQr: string | null,
    explicitScannedRestaurant?: string | null
): Promise<{ status: number; body: TableVerifyResponse }> {
    if (!rawRestaurantId || !rawTableOrQr) {
        return {
            status: 400,
            body: {
                valid: false,
                reason: 'invalid_format',
                message: 'Restaurant ID and Table / QR code are required.',
            },
        };
    }

    const parsed = parseTableQrCode(rawTableOrQr);
    const scannedRestaurantCode = explicitScannedRestaurant || parsed.restaurantCode;
    const tableStr = decodeURIComponent(parsed.table || rawTableOrQr).trim();

    // 1. Resolve Visited Restaurant
    const visitedId = (await resolveRestaurantId(rawRestaurantId)) || rawRestaurantId;
    const { data: visitedRest } = await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .eq('id', visitedId)
        .maybeSingle();

    const visitedName = visitedRest?.name || 'This Restaurant';

    // 2. Cross-Restaurant Check if QR code carries a restaurant identifier
    if (scannedRestaurantCode) {
        const resolvedScannedId = (await resolveRestaurantId(scannedRestaurantCode)) || scannedRestaurantCode;

        if (resolvedScannedId && visitedId && resolvedScannedId.toLowerCase() !== visitedId.toLowerCase()) {
            const { data: scannedRest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name')
                .eq('id', resolvedScannedId)
                .maybeSingle();

            const scannedName = scannedRest?.name || scannedRestaurantCode;

            return {
                status: 200,
                body: {
                    valid: false,
                    reason: 'different_restaurant',
                    message: `This table QR belongs to ${scannedName}, not ${visitedName}.`,
                    visitedRestaurant: {
                        id: visitedId,
                        code: rawRestaurantId,
                        name: visitedName,
                    },
                    scannedRestaurant: {
                        id: resolvedScannedId,
                        code: scannedRestaurantCode,
                        name: scannedName,
                    },
                    scannedTable: tableStr,
                },
            };
        }
    }

    // 3. Table Lookup within the Visited Restaurant (by table_number, table_token, or ID)
    let { data: tableData, error } = await supabaseAdmin
        .from('tables')
        .select('id, table_number, status, restaurant_id, table_token')
        .eq('restaurant_id', visitedId)
        .or(`table_number.eq.${tableStr},table_token.eq.${tableStr}`)
        .maybeSingle();

    // Check by table_token across all restaurants if token was scanned without explicit restaurant code
    if (!tableData && tableStr.length >= 16) {
        const { data: byToken } = await supabaseAdmin
            .from('tables')
            .select('id, table_number, status, restaurant_id, table_token')
            .eq('table_token', tableStr)
            .maybeSingle();
        if (byToken) {
            if (byToken.restaurant_id && visitedId && byToken.restaurant_id.toLowerCase() !== visitedId.toLowerCase()) {
                const { data: scannedRest } = await supabaseAdmin
                    .from('restaurants')
                    .select('id, name')
                    .eq('id', byToken.restaurant_id)
                    .maybeSingle();
                const scannedName = scannedRest?.name || byToken.restaurant_id;
                return {
                    status: 200,
                    body: {
                        valid: false,
                        reason: 'different_restaurant',
                        message: `This table QR belongs to ${scannedName}, not ${visitedName}.`,
                        visitedRestaurant: {
                            id: visitedId,
                            code: rawRestaurantId,
                            name: visitedName,
                        },
                        scannedRestaurant: {
                            id: byToken.restaurant_id,
                            code: byToken.restaurant_id,
                            name: scannedName,
                        },
                        scannedTable: byToken.table_number || tableStr,
                    },
                };
            }
            tableData = byToken;
        }
    }

    // Try numeric id match if table_number not matched directly
    const num = parseInt(tableStr, 10);
    if (!tableData && !isNaN(num)) {
        const { data: byId } = await supabaseAdmin
            .from('tables')
            .select('id, table_number, status, restaurant_id, table_token')
            .eq('restaurant_id', visitedId)
            .eq('id', num)
            .maybeSingle();
        if (byId) tableData = byId;
    }

    // Strip prefix (e.g., "Table 2" -> "2" or "T-2" -> "2")
    if (!tableData) {
        const cleanStr = tableStr.replace(/[^0-9]/g, '');
        if (cleanStr) {
            const { data: byClean } = await supabaseAdmin
                .from('tables')
                .select('id, table_number, status, restaurant_id, table_token')
                .eq('restaurant_id', visitedId)
                .eq('table_number', cleanStr)
                .maybeSingle();
            if (byClean) tableData = byClean;
        }
    }

    // Check merged groups
    if (error || !tableData) {
        const { data: groupData } = await supabaseAdmin
            .from('table_merge_groups')
            .select('id, display_name, status, restaurant_id')
            .eq('restaurant_id', visitedId)
            .ilike('display_name', `%${tableStr}%`)
            .maybeSingle();

        if (groupData) {
            const groupStatus = (groupData.status || '').toLowerCase();
            if (['cleaning', 'dirty', 'to_clean'].includes(groupStatus)) {
                return {
                    status: 200,
                    body: {
                        valid: false,
                        reason: 'table_cleaning',
                        message: `Table ${groupData.display_name} is currently being cleaned. Please wait for staff to clear the table.`,
                        visitedRestaurant: {
                            id: visitedId,
                            code: rawRestaurantId,
                            name: visitedName,
                        },
                        scannedTable: tableStr,
                    },
                };
            }

            return {
                status: 200,
                body: {
                    valid: true,
                    tableId: groupData.id,
                    tableNumber: groupData.display_name,
                    isMerged: true,
                    visitedRestaurant: {
                        id: visitedId,
                        code: rawRestaurantId,
                        name: visitedName,
                    },
                },
            };
        }

        return {
            status: 200,
            body: {
                valid: false,
                reason: 'table_not_found',
                message: `Table "${tableStr}" does not exist in ${visitedName}.`,
                visitedRestaurant: {
                    id: visitedId,
                    code: rawRestaurantId,
                    name: visitedName,
                },
                scannedTable: tableStr,
            },
        };
    }

    const tableStatus = (tableData.status || '').toLowerCase();
    if (['cleaning', 'dirty', 'to_clean'].includes(tableStatus)) {
        return {
            status: 200,
            body: {
                valid: false,
                reason: 'table_cleaning',
                message: `Table ${tableData.table_number || tableStr} is currently being cleaned. Please wait for staff to clear the table.`,
                visitedRestaurant: {
                    id: visitedId,
                    code: rawRestaurantId,
                    name: visitedName,
                },
                scannedTable: tableStr,
            },
        };
    }

    return {
        status: 200,
        body: {
            valid: true,
            tableId: tableData.id,
            tableNumber: String(tableData.table_number || tableData.id),
            visitedRestaurant: {
                id: visitedId,
                code: rawRestaurantId,
                name: visitedName,
            },
        },
    };
}

/**
 * GET /api/customer/table/verify?restaurantId=xxx&table=yyy&scannedRestaurantId=zzz
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const rawRestaurantId = searchParams.get('restaurantId') || searchParams.get('restaurantCode');
        const rawTable = searchParams.get('table') || searchParams.get('qr') || searchParams.get('qrData');
        const explicitScannedRestaurant = searchParams.get('scannedRestaurantId') || searchParams.get('scannedRestaurantCode');

        const { status, body } = await verifyTableForRestaurant(
            rawRestaurantId,
            rawTable,
            explicitScannedRestaurant
        );

        return NextResponse.json(body, { status });
    } catch (err: any) {
        return NextResponse.json(
            { valid: false, reason: 'server_error', message: err?.message || 'Verification failed.' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/customer/table/verify
 * Body: { restaurantId, table, qrData, scannedRestaurantId }
 */
export async function POST(request: NextRequest) {
    try {
        const bodyData = await request.json().catch(() => ({}));
        const rawRestaurantId = bodyData.restaurantId || bodyData.restaurantCode;
        const rawTable = bodyData.table || bodyData.qrData || bodyData.qr;
        const explicitScannedRestaurant = bodyData.scannedRestaurantId || bodyData.scannedRestaurantCode;

        const { status, body } = await verifyTableForRestaurant(
            rawRestaurantId,
            rawTable,
            explicitScannedRestaurant
        );

        return NextResponse.json(body, { status });
    } catch (err: any) {
        return NextResponse.json(
            { valid: false, reason: 'server_error', message: err?.message || 'Verification failed.' },
            { status: 500 }
        );
    }
}
