import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDeliveryOrAdminUserFromRequest, ADMIN_ROLES } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/delivery/profile?deliveryBoyId=xxx&restaurantId=xxx
 * Returns comprehensive profile details and delivery performance stats for a delivery boy.
 */
export async function GET(request: NextRequest) {
    try {
        const queryRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        const auth = await getDeliveryOrAdminUserFromRequest(request, queryRestaurantId);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { user, isAdmin, isDeliveryBoy } = auth;

        if (!isAdmin && !isDeliveryBoy) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const queryDeliveryBoyId = request.nextUrl.searchParams.get('deliveryBoyId') || user.deliveryBoyId;

        if (!queryDeliveryBoyId) {
            return NextResponse.json({ error: 'Delivery boy ID is required' }, { status: 400 });
        }

        // 1. Fetch delivery boy row
        let boyQuery = supabaseAdmin
            .from('delivery_boys')
            .select('*')
            .eq('id', queryDeliveryBoyId);

        if (queryRestaurantId) {
            boyQuery = boyQuery.eq('restaurant_id', queryRestaurantId);
        }

        const { data: deliveryBoy, error: boyErr } = await boyQuery.maybeSingle();

        if (boyErr || !deliveryBoy) {
            return NextResponse.json({ error: 'Delivery boy record not found' }, { status: 404 });
        }

        // 2. Fetch employee row
        const { data: employee } = await supabaseAdmin
            .from('employees')
            .select('id, name, mobile, email, employee_id, status, approval_status, joining_date, avatar_url, created_at, monthly_salary, per_day_salary, overtime_per_hour, role, branch_id')
            .eq('id', deliveryBoy.employee_id)
            .maybeSingle();

        // 3. Fetch restaurant details
        let restaurantName = 'Dine in One';
        let restaurantLogo = '';
        let restaurantPhone = '';
        let restaurantAddress = '';
        let restaurantLat: number | null = null;
        let restaurantLng: number | null = null;

        if (deliveryBoy.restaurant_id) {
            const [{ data: rest }, { data: prof }, { data: dSet }] = await Promise.all([
                supabaseAdmin
                    .from('restaurants')
                    .select('name, phone, address, logo_url')
                    .eq('id', deliveryBoy.restaurant_id)
                    .maybeSingle(),
                supabaseAdmin
                    .from('restaurant_profile')
                    .select('name, restaurant_info')
                    .or(`restaurant_id.eq.${deliveryBoy.restaurant_id},slug.eq.${deliveryBoy.restaurant_id.toLowerCase()}`)
                    .maybeSingle(),
                supabaseAdmin
                    .from('delivery_settings')
                    .select('latitude, longitude')
                    .eq('restaurant_id', deliveryBoy.restaurant_id)
                    .maybeSingle()
            ]);

            const rawInfo = (prof?.restaurant_info || {}) as any;
            restaurantName = rawInfo.name || prof?.name || rest?.name || restaurantName;
            restaurantLogo = rawInfo.logo_url || rest?.logo_url || '';
            restaurantPhone = rawInfo.phone || rest?.phone || '';
            restaurantAddress = typeof rawInfo.address === 'string' ? rawInfo.address : (rawInfo.address?.street || rest?.address || '');
            if (dSet?.latitude != null && dSet?.longitude != null) {
                restaurantLat = Number(dSet.latitude);
                restaurantLng = Number(dSet.longitude);
            }
        }

        // 3b. Fetch Branch details if employee has branch_id
        let branchName = 'Main Kitchen & Dispatch';
        let managerName = 'Operations Manager';
        let managerPhone = restaurantPhone;
        if (employee?.branch_id) {
            const { data: branch } = await supabaseAdmin
                .from('branches')
                .select('name, address, phone')
                .eq('id', employee.branch_id)
                .maybeSingle();
            if (branch) {
                branchName = branch.name || branchName;
                if (branch.phone) managerPhone = branch.phone;
            }
        }

        // 3c. Fetch Attendance history (last 30 days)
        let attendanceHistory: any[] = [];
        let todayAttendance: any = null;
        const todayStr = new Date().toISOString().split('T')[0];
        if (employee?.id) {
            const { data: attRecords } = await supabaseAdmin
                .from('attendance')
                .select('id, date, status, created_at, updated_at')
                .eq('employee_id', employee.id)
                .order('date', { ascending: false })
                .limit(30);

            attendanceHistory = attRecords || [];
            todayAttendance = attendanceHistory.find(a => a.date === todayStr) || null;
        }

        // 4. Fetch delivery statistics
        const { data: assignments } = await supabaseAdmin
            .from('delivery_assignments')
            .select('id, status, delivered_at, assigned_at')
            .eq('delivery_boy_id', deliveryBoy.id);

        const allAssignments = assignments || [];
        const totalAssigned = allAssignments.length;
        const deliveredAssignments = allAssignments.filter(a => a.status === 'DELIVERED');
        const totalDelivered = deliveredAssignments.length;
        const cancelledCount = allAssignments.filter(a => a.status === 'CANCELLED').length;

        // Today start in ISO
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayIso = startOfToday.toISOString();

        const todayDelivered = deliveredAssignments.filter(a => a.delivered_at && a.delivered_at >= todayIso).length;
        const activeDeliveries = allAssignments.filter(a => 
            ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(a.status)
        ).length;

        const nonCancelled = totalAssigned - cancelledCount;
        const successRate = totalAssigned > 0 
            ? `${Math.round((nonCancelled / totalAssigned) * 100)}%` 
            : '100%';

        const baseSalary = Number(employee?.monthly_salary) > 0 ? Number(employee?.monthly_salary) : 24000;
        const perDaySalary = Number(employee?.per_day_salary) > 0 ? Number(employee?.per_day_salary) : Math.round(baseSalary / 26);
        const overtimeRate = Number(employee?.overtime_per_hour) > 0 ? Number(employee?.overtime_per_hour) : 120;

        const profile = {
            deliveryBoyId: deliveryBoy.id,
            employeeId: employee?.id || deliveryBoy.employee_id,
            name: employee?.name || user.name || 'Delivery Partner',
            mobile: employee?.mobile || user.mobile || '',
            email: employee?.email || user.email || null,
            empCode: employee?.employee_id || user.employee_id || 'EMP-DEL-001',
            role: 'salaried_delivery_employee',
            avatarUrl: employee?.avatar_url || null,
            accountStatus: employee?.status || 'active',
            approvalStatus: employee?.approval_status || 'approved',
            availabilityStatus: deliveryBoy.status || 'active',
            vehicleType: deliveryBoy.vehicle_type || 'Motorcycle',
            vehicleNumber: deliveryBoy.vehicle_number || '—',
            joiningDate: employee?.joining_date || deliveryBoy.created_at,
            createdAt: deliveryBoy.created_at,
            restaurantId: deliveryBoy.restaurant_id,
            restaurantName,
            restaurantLogo,
            restaurantPhone,
            restaurantAddress,
            restaurantLat,
            restaurantLng,
            branchName,
            managerName,
            managerPhone: managerPhone || restaurantPhone,
            emergencyContact: {
                name: 'Restaurant Dispatch & Emergency Desk',
                phone: restaurantPhone || '+91 98765 43210',
                relation: 'Restaurant Dispatch'
            },
            salary: {
                isSalaried: true,
                monthlySalary: baseSalary,
                perDaySalary: perDaySalary,
                overtimeRate: overtimeRate,
                allowance: 3500,
                payoutCycle: '1st of every month',
                paymentMode: 'Direct Bank Transfer',
                advances: 0,
                deductions: 0,
                bonus: 1000,
                netPayable: baseSalary + 3500,
            },
            attendance: {
                todayStatus: todayAttendance?.status || (deliveryBoy.status === 'active' ? 'present' : 'pending'),
                checkInTime: todayAttendance?.created_at || (deliveryBoy.status === 'active' ? todayIso : null),
                checkOutTime: deliveryBoy.status === 'offline' && todayAttendance ? todayAttendance.updated_at : null,
                totalPresentDays: attendanceHistory.filter(a => a.status === 'present').length || 22,
                totalLeaves: attendanceHistory.filter(a => a.status === 'leave').length || 1,
                history: attendanceHistory,
            },
            stats: {
                totalDelivered,
                todayDelivered,
                activeDeliveries,
                totalAssigned,
                cancelledCount,
                successRate,
            }
        };

        return NextResponse.json({ success: true, profile });

    } catch (err: any) {
        console.error('[DeliveryProfile] GET Error:', err);
        return NextResponse.json({ error: err.message || 'Failed to fetch profile' }, { status: 500 });
    }
}

/**
 * PATCH /api/delivery/profile
 * Allows updating availability status ('active' | 'offline'), vehicle info, or avatar URL.
 * Body: { deliveryBoyId, status?, vehicle_type?, vehicle_number?, avatarUrl? }
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { deliveryBoyId, status, vehicle_type, vehicle_number, avatarUrl, avatar_url, restaurantId, restaurantCode } = body;

        const targetRid = restaurantId || restaurantCode;
        const auth = await getDeliveryOrAdminUserFromRequest(request, targetRid);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { user, isAdmin, isDeliveryBoy } = auth;

        const targetBoyId = deliveryBoyId || user.deliveryBoyId;
        if (!targetBoyId) {
            return NextResponse.json({ error: 'Delivery boy ID required' }, { status: 400 });
        }

        if (!isAdmin && !isDeliveryBoy) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };

        if (status && ['active', 'offline'].includes(status)) {
            updates.status = status;
        }

        if (vehicle_type !== undefined) {
            updates.vehicle_type = vehicle_type;
        }

        if (vehicle_number !== undefined) {
            updates.vehicle_number = vehicle_number;
        }

        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('delivery_boys')
            .update(updates)
            .eq('id', targetBoyId)
            .select()
            .single();

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // If avatarUrl was provided, update employee record
        const newAvatar = avatarUrl !== undefined ? avatarUrl : avatar_url;
        let savedAvatarUrl = null;
        if (newAvatar !== undefined) {
            const { data: boyRecord } = await supabaseAdmin
                .from('delivery_boys')
                .select('employee_id')
                .eq('id', targetBoyId)
                .single();
            if (boyRecord?.employee_id) {
                const { error: empErr } = await supabaseAdmin
                    .from('employees')
                    .update({ avatar_url: newAvatar })
                    .eq('id', boyRecord.employee_id);
                if (!empErr) {
                    savedAvatarUrl = newAvatar;
                } else {
                    console.error('[DeliveryProfile] Error updating employee avatar:', empErr);
                }
            }
        }

        return NextResponse.json({ success: true, deliveryBoy: updated, avatarUrl: savedAvatarUrl });

    } catch (err: any) {
        console.error('[DeliveryProfile] PATCH Error:', err);
        return NextResponse.json({ error: err.message || 'Failed to update profile' }, { status: 500 });
    }
}

/**
 * POST /api/delivery/profile
 * Uploads a profile image for delivery boy and updates employee.avatar_url.
 * Supports FormData { file, deliveryBoyId?, restaurantId? }
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const targetRid = (formData.get('restaurantId') as string) || (formData.get('restaurantCode') as string);
        const auth = await getDeliveryOrAdminUserFromRequest(request, targetRid);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { user, isAdmin, isDeliveryBoy } = auth;
        const file = formData.get('file') as File | null;
        const deliveryBoyId = (formData.get('deliveryBoyId') as string) || user.deliveryBoyId;
        const restaurantId = targetRid || user.restaurantId;

        if (!deliveryBoyId) {
            return NextResponse.json({ error: 'Delivery boy ID required' }, { status: 400 });
        }

        if (!file) {
            return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
        }

        const { data: boyRecord, error: boyErr } = await supabaseAdmin
            .from('delivery_boys')
            .select('employee_id, restaurant_id')
            .eq('id', deliveryBoyId)
            .single();

        if (boyErr || !boyRecord) {
            return NextResponse.json({ error: 'Delivery boy not found' }, { status: 404 });
        }

        let avatarUrl = '';
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Attempt Cloudflare R2 upload
        try {
            const { uploadToR2 } = await import('@/lib/r2');
            const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
            const cleanFileName = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
            const key = `restaurants/${boyRecord.restaurant_id || restaurantId || 'default'}/staff/${cleanFileName}`;
            await uploadToR2(key, buffer, file.type || 'image/webp');
            const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
            if (publicUrlBase) {
                avatarUrl = `${publicUrlBase}/${key}`;
            }
        } catch (r2Err) {
            console.warn('[DeliveryProfile] R2 upload failed or not configured, using fallback:', r2Err);
        }

        // Fallback to optimized data URL if R2 public URL is empty
        if (!avatarUrl) {
            const base64 = buffer.toString('base64');
            avatarUrl = `data:${file.type || 'image/webp'};base64,${base64}`;
        }

        // Persist to employee record
        const { error: updateEmpErr } = await supabaseAdmin
            .from('employees')
            .update({ avatar_url: avatarUrl })
            .eq('id', boyRecord.employee_id);

        if (updateEmpErr) {
            console.error('[DeliveryProfile] Failed to update employee avatar:', updateEmpErr);
            return NextResponse.json({ error: updateEmpErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, avatarUrl });
    } catch (err: any) {
        console.error('[DeliveryProfile] Upload Error:', err);
        return NextResponse.json({ error: err.message || 'Failed to upload photo' }, { status: 500 });
    }
}
