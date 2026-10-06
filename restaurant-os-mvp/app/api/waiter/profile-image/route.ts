import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { uploadToR2 } from '@/lib/r2';

export const maxDuration = 60;

/**
 * POST /api/waiter/profile-image
 * Uploads waiter profile picture to Cloudflare R2 and persists avatar_url in the employees table.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const waiterId = formData.get('waiterId') as string | null;
        const mobile = formData.get('mobile') as string | null;
        const restaurantId = formData.get('restaurantId') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
        }

        if (!waiterId && !mobile) {
            return NextResponse.json({ error: 'Waiter ID or mobile number is required' }, { status: 400 });
        }

        const cleanMobile = mobile ? mobile.replace(/[^0-9]/g, '').slice(-10) : '';

        // Locate employee record
        let empQuery = supabaseAdmin
            .from('employees')
            .select('id, restaurant_id, mobile, name')
            .limit(1);

        if (waiterId) {
            empQuery = empQuery.or(`id.eq.${waiterId},employee_id.eq.${waiterId}`);
        } else if (cleanMobile) {
            empQuery = empQuery.ilike('mobile', `%${cleanMobile}%`);
        }

        if (restaurantId) {
            empQuery = empQuery.eq('restaurant_id', restaurantId);
        }

        const { data: employeeList, error: empErr } = await empQuery;
        const employee = employeeList?.[0];

        if (empErr || !employee) {
            return NextResponse.json({ error: 'Staff member record not found' }, { status: 404 });
        }

        const targetRestaurantId = restaurantId || employee.restaurant_id || 'default';
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let avatarUrl = '';

        // 1. Upload to Cloudflare R2
        try {
            const ext = file.name?.split('.').pop()?.toLowerCase() || 'webp';
            const cleanFileName = `waiter-${employee.id}-${Date.now()}.${ext}`;
            const key = `restaurants/${targetRestaurantId}/staff/${cleanFileName}`;
            const contentType = file.type || 'image/webp';

            await uploadToR2(key, buffer, contentType);

            const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
            if (publicUrlBase) {
                avatarUrl = `${publicUrlBase.replace(/\/$/, '')}/${key}`;
            }
        } catch (r2Err: any) {
            console.warn('[WaiterProfileImage] Cloudflare R2 upload warning:', r2Err);
        }

        // 2. Resilient fallback to data URL if public R2 CDN url is missing
        if (!avatarUrl) {
            const base64 = buffer.toString('base64');
            avatarUrl = `data:${file.type || 'image/webp'};base64,${base64}`;
        }

        // 3. Persist avatar_url in the employees record
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({ 
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString() 
            })
            .eq('id', employee.id);

        if (updateErr) {
            console.error('[WaiterProfileImage] Failed to update avatar_url:', updateErr);
            return NextResponse.json({ error: updateErr.message || 'Database update failed' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            avatarUrl,
            employeeId: employee.id,
            message: 'Waiter profile picture updated successfully'
        });
    } catch (err: any) {
        console.error('[WaiterProfileImage] Exception in POST:', err);
        return NextResponse.json({ error: err.message || 'Server error processing profile image' }, { status: 500 });
    }
}
