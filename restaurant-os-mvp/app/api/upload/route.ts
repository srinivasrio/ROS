import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { uploadToR2 } from '@/lib/r2';
import { extractTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';
import sharp from 'sharp';
import { RateLimiter } from '@/lib/rate-limiter';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE_BYTES = MAX_FILE_SIZE_BYTES + 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ['menu', 'combos', 'banners', 'staff', 'customers', 'invoices', 'branding', 'compliance', 'documents'] as const;
const PRIVATE_UPLOAD_TYPES = new Set(['staff', 'invoices', 'compliance', 'documents']);

type AuthResult = { authenticated: boolean; authorized: boolean };
type CustomJwtPayload = {
    userId?: string;
    role?: string;
    restaurantId?: string;
    restaurant_id?: string;
};

function canManageUploads(role?: string): boolean {
    return ['owner', 'restaurant_owner', 'restaurant_admin', 'admin', 'manager', 'super_admin', 'superadmin']
        .includes(String(role || '').toLowerCase().trim());
}

function getBearerToken(req: NextRequest): string | null {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() || null : null;
}

async function hasRestaurantAccess(userId: string, restaurantId: string, role?: string): Promise<boolean> {
    const normalizedRole = String(role || '').toLowerCase().trim();

    // Platform administrators still need a real restaurant target, but may
    // operate on any non-deleted restaurant selected by the request.
    if (normalizedRole === 'super_admin' || normalizedRole === 'superadmin') {
        const { data: restaurant } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', restaurantId)
            .is('deleted_at', null)
            .maybeSingle();
        return Boolean(restaurant?.id);
    }

    const [employeeResult, userResult, ownerResult, membershipResult] = await Promise.all([
        supabaseAdmin
            .from('employees')
            .select('id')
            .eq('id', userId)
            .eq('restaurant_id', restaurantId)
            .eq('is_deleted', false)
            .maybeSingle(),
        supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', userId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle(),
        supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', restaurantId)
            .eq('owner_id', userId)
            .is('deleted_at', null)
            .maybeSingle(),
        supabaseAdmin
            .from('restaurant_users')
            .select('restaurant_id')
            .eq('restaurant_id', restaurantId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle(),
    ]);

    return Boolean(
        employeeResult.data?.id ||
        userResult.data?.id ||
        ownerResult.data?.id ||
        membershipResult.data?.restaurant_id
    );
}

async function authorizeRestaurantScope(req: NextRequest, restaurantId: string): Promise<AuthResult> {
    const bearerToken = getBearerToken(req);
    const cookieToken = bearerToken ? null : extractTokenForRestaurant(req.cookies, restaurantId);
    const customToken = bearerToken || cookieToken;

    if (customToken) {
        let payload: CustomJwtPayload | null = null;
        try {
            payload = await verifyJwt(customToken);
        } catch {
            payload = null;
        }

        if (!payload?.userId || String(payload.role || '').toLowerCase() === 'customer') {
            return { authenticated: false, authorized: false };
        }

        if (!canManageUploads(payload.role)) {
            return { authenticated: true, authorized: false };
        }

        const tokenRestaurantId = payload.restaurantId || payload.restaurant_id;
        if (tokenRestaurantId && String(tokenRestaurantId) !== String(restaurantId)) {
            return { authenticated: true, authorized: false };
        }

        return {
            authenticated: true,
            authorized: await hasRestaurantAccess(String(payload.userId), restaurantId, payload.role),
        };
    }

    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return { authenticated: false, authorized: false };

        return {
            authenticated: true,
            authorized: canManageUploads(session.user.app_metadata?.role)
                && await hasRestaurantAccess(session.user.id, restaurantId, session.user.app_metadata?.role),
        };
    } catch {
        return { authenticated: false, authorized: false };
    }
}

function detectContentType(buffer: Buffer): string | null {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
        return 'image/jpeg';
    }
    if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) {
        return 'image/gif';
    }
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
    }
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return 'application/pdf';
    }
    return null;
}

function extensionForContentType(contentType: string): string {
    switch (contentType) {
        case 'image/png': return 'png';
        case 'image/jpeg': return 'jpg';
        case 'image/gif': return 'gif';
        case 'image/webp': return 'webp';
        case 'application/pdf': return 'pdf';
        default: return 'bin';
    }
}

function parseStorageKey(key: string): { restaurantId: string; type: string } | null {
    const parts = key.split('/');
    if (parts.length !== 4 || parts[0] !== 'restaurants') return null;
    if (parts.some((part, index) => !part || part === '.' || part === '..' || (index !== 3 && !/^[A-Za-z0-9_-]+$/.test(part)) || (index === 3 && !/^[A-Za-z0-9._-]+$/.test(part)))) {
        return null;
    }
    if (!ALLOWED_UPLOAD_TYPES.includes(parts[2] as typeof ALLOWED_UPLOAD_TYPES[number])) return null;
    return { restaurantId: parts[1], type: parts[2] };
}

export async function POST(req: NextRequest) {
    try {
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const rateCheck = await RateLimiter.checkUpload(clientIp, clientIp);
        if (!rateCheck.success) {
            return RateLimiter.createRateLimitResponse(rateCheck);
        }

        const contentLength = Number(req.headers.get('content-length') || 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE_BYTES) {
            return NextResponse.json({ error: 'File is too large. Maximum size is 10 MB.' }, { status: 413 });
        }

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
        if (!ALLOWED_UPLOAD_TYPES.includes(type as typeof ALLOWED_UPLOAD_TYPES[number])) {
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

        const auth = await authorizeRestaurantScope(req, validRestaurantId);
        if (!auth.authenticated) {
            return NextResponse.json({ error: 'Authentication is required for uploads' }, { status: 401 });
        }
        if (!auth.authorized) {
            return NextResponse.json({ error: 'You are not authorized for this restaurant' }, { status: 403 });
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: 'File is too large. Maximum size is 10 MB.' }, { status: 413 });
        }

        // Read file into Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: 'File is empty or exceeds the 10 MB limit.' }, { status: 413 });
        }

        const detectedContentType = detectContentType(buffer);
        const isPrivateType = PRIVATE_UPLOAD_TYPES.has(type);
        if (!detectedContentType || (!isPrivateType && !detectedContentType.startsWith('image/'))) {
            return NextResponse.json({ error: isPrivateType ? 'Only valid images or PDF documents are allowed.' : 'Only valid image files are allowed.' }, { status: 415 });
        }

        // P1 SM-02: Optimize images (downscale large photos to max 1200px width and convert to WebP)
        let finalBuffer = buffer;
        let finalContentType = detectedContentType;

        if (detectedContentType.startsWith('image/') && detectedContentType !== 'image/gif') {
            try {
                const optimized = await sharp(buffer)
                    .rotate() // auto-orient based on EXIF
                    .resize({ width: 1200, withoutEnlargement: true })
                    .webp({ quality: 80, effort: 4 })
                    .toBuffer();
                finalBuffer = Buffer.from(optimized);
                finalContentType = 'image/webp';
            } catch (sharpErr) {
                console.warn('Image optimization fallback to original buffer:', sharpErr);
                finalBuffer = buffer;
                finalContentType = detectedContentType;
            }
        }

        // Generate unique filename
        const ext = extensionForContentType(finalContentType);
        const cleanFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const key = `restaurants/${validRestaurantId}/${type}/${cleanFileName}`;

        // Upload to R2
        await uploadToR2(key, finalBuffer, finalContentType);

        // Check if public or private URL should be returned
        let url = '';
        if (isPrivateType) {
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
            size: finalBuffer.length,
            name: file.name
        });
    } catch (error: any) {
        console.error('Error in /api/upload:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 });
        }

        const parsedKey = parseStorageKey(key);
        if (!parsedKey) {
            return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
        }

        const auth = await authorizeRestaurantScope(req, parsedKey.restaurantId);
        if (!auth.authenticated) {
            return NextResponse.json({ error: 'Authentication is required' }, { status: 401 });
        }
        if (!auth.authorized) {
            return NextResponse.json({ error: 'You are not authorized for this restaurant' }, { status: 403 });
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
