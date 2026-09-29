import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { uploadToR2 } from '@/lib/r2';

export async function POST(req: NextRequest) {
    try {
        // Authenticate the user session
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const restaurantId = formData.get('restaurantId') as string | null;
        const type = formData.get('type') as string | null; // menu, combos, banners, staff, customers, invoices

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }
        if (!type) {
            return NextResponse.json({ error: 'type is required' }, { status: 400 });
        }

        // Validate type against allowed folders
        const allowedTypes = ['menu', 'combos', 'banners', 'staff', 'customers', 'invoices', 'branding', 'compliance', 'documents'];
        if (!allowedTypes.includes(type)) {
            return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 });
        }

        // Validate that restaurant exists in the database
        const cleanRid = restaurantId.trim();
        const { data: restaurantRecord } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', cleanRid)
            .maybeSingle();

        let validRestaurantId = restaurantRecord?.id;

        if (!validRestaurantId) {
            const { data: profileRecord } = await supabaseAdmin
                .from('restaurant_profile')
                .select('restaurant_id')
                .eq('slug', cleanRid.toLowerCase())
                .maybeSingle();

            if (profileRecord?.restaurant_id) {
                validRestaurantId = profileRecord.restaurant_id;
            }
        }

        if (!validRestaurantId) {
            return NextResponse.json(
                { error: `Cannot upload file: restaurant "${restaurantId}" does not exist` },
                { status: 400 }
            );
        }

        // Security: Private files require active session
        if (['staff', 'invoices'].includes(type) && !session) {
            return NextResponse.json({ error: 'Unauthorized for private uploads' }, { status: 401 });
        }

        // Read file into Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
        const cleanFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const key = `restaurants/${validRestaurantId}/${type}/${cleanFileName}`;

        // Upload to R2
        await uploadToR2(key, buffer, file.type || 'application/octet-stream');

        // Check if public or private URL should be returned
        let url = '';
        if (['staff', 'invoices'].includes(type)) {
            // Private: Route via the secure private media endpoint
            const origin = req.nextUrl.origin;
            url = `${origin}/api/media/private?path=${encodeURIComponent(key)}`;
        } else {
            // Public: Retrieve from public CDN URL
            const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
            url = `${publicUrlBase}/${key}`;
        }

        return NextResponse.json({
            success: true,
            url,
            key,
            size: file.size,
            name: file.name
        });
    } catch (error: any) {
        console.error('Error in /api/upload:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        // Authenticate the user session
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 });
        }

        // Security: Prevent accessing path outside restaurants/
        if (!key.startsWith('restaurants/')) {
            return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
        }

        // Delete from R2
        const { deleteFromR2 } = await import('@/lib/r2');
        await deleteFromR2(key);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DELETE /api/upload:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export const maxDuration = 60; // Allow enough time for larger file uploads
