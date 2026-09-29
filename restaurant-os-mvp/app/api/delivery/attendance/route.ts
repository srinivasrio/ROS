import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDeliveryOrAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/delivery/attendance?deliveryBoyId=xxx&restaurantId=xxx
 * Retrieves today's attendance status and the past 30 days attendance history.
 */
export async function GET(request: NextRequest) {
    try {
        const queryRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        const auth = await getDeliveryOrAdminUserFromRequest(request, queryRestaurantId);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const deliveryBoyId = request.nextUrl.searchParams.get('deliveryBoyId') || auth.user.deliveryBoyId;
        if (!deliveryBoyId) {
            return NextResponse.json({ error: 'Delivery boy ID required' }, { status: 400 });
        }

        // Fetch delivery boy & employee record
        const { data: boyRecord } = await supabaseAdmin
            .from('delivery_boys')
            .select('id, employee_id, restaurant_id, status')
            .eq('id', deliveryBoyId)
            .maybeSingle();

        if (!boyRecord?.employee_id) {
            return NextResponse.json({ error: 'Delivery employee not found' }, { status: 404 });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        const { data: records, error } = await supabaseAdmin
            .from('attendance')
            .select('id, date, status, created_at, updated_at')
            .eq('employee_id', boyRecord.employee_id)
            .order('date', { ascending: false })
            .limit(31);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const history = records || [];
        const todayRecord = history.find(r => r.date === todayStr) || null;

        return NextResponse.json({
            success: true,
            todayStatus: todayRecord?.status || (boyRecord.status === 'active' ? 'present' : 'not_checked_in'),
            checkInTime: todayRecord?.created_at || null,
            checkOutTime: boyRecord.status === 'offline' && todayRecord ? todayRecord.updated_at : null,
            isOnline: boyRecord.status === 'active',
            history
        });

    } catch (err: any) {
        console.error('[DeliveryAttendance] GET Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/delivery/attendance
 * Handles check_in, check_out, and break actions for salaried delivery staff.
 * Body: { deliveryBoyId, restaurantId, action: 'check_in' | 'check_out' | 'break' }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { deliveryBoyId, restaurantId, restaurantCode, action } = body;

        const targetRid = restaurantId || restaurantCode;
        const auth = await getDeliveryOrAdminUserFromRequest(request, targetRid);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const targetBoyId = deliveryBoyId || auth.user.deliveryBoyId;
        if (!targetBoyId) {
            return NextResponse.json({ error: 'Delivery boy ID required' }, { status: 400 });
        }

        const { data: boyRecord, error: boyErr } = await supabaseAdmin
            .from('delivery_boys')
            .select('id, employee_id, restaurant_id, status')
            .eq('id', targetBoyId)
            .maybeSingle();

        if (boyErr || !boyRecord) {
            return NextResponse.json({ error: 'Delivery boy not found' }, { status: 404 });
        }

        const rid = (await resolveRestaurantId(targetRid || boyRecord.restaurant_id)) || boyRecord.restaurant_id;
        const todayStr = new Date().toISOString().split('T')[0];
        const nowIso = new Date().toISOString();

        if (action === 'check_in') {
            // 1. Mark attendance for today as 'present'
            await supabaseAdmin
                .from('attendance')
                .upsert({
                    restaurant_id: rid,
                    employee_id: boyRecord.employee_id,
                    date: todayStr,
                    status: 'present',
                    updated_at: nowIso,
                }, { onConflict: 'employee_id,date' });

            // 2. Set delivery boy status to active
            await supabaseAdmin
                .from('delivery_boys')
                .update({ status: 'active', updated_at: nowIso })
                .eq('id', targetBoyId);

            return NextResponse.json({
                success: true,
                message: 'Checked in successfully. You are now on duty.',
                checkInTime: nowIso,
                status: 'active'
            });

        } else if (action === 'check_out') {
            // 1. Update attendance record timestamp
            await supabaseAdmin
                .from('attendance')
                .update({ updated_at: nowIso })
                .eq('employee_id', boyRecord.employee_id)
                .eq('date', todayStr);

            // 2. Set delivery boy status to offline
            await supabaseAdmin
                .from('delivery_boys')
                .update({ status: 'offline', updated_at: nowIso })
                .eq('id', targetBoyId);

            return NextResponse.json({
                success: true,
                message: 'Checked out successfully. Shift ended.',
                checkOutTime: nowIso,
                status: 'offline'
            });

        } else if (action === 'break') {
            const nextStatus = boyRecord.status === 'active' ? 'offline' : 'active';
            await supabaseAdmin
                .from('delivery_boys')
                .update({ status: nextStatus, updated_at: nowIso })
                .eq('id', targetBoyId);

            return NextResponse.json({
                success: true,
                message: nextStatus === 'offline' ? 'Break started. Status set to offline.' : 'Break ended. Welcome back on duty.',
                status: nextStatus
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (err: any) {
        console.error('[DeliveryAttendance] POST Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
