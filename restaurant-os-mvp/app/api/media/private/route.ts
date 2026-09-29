import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getPrivatePresignedUrl } from '@/lib/r2';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const path = searchParams.get('path');

        if (!path) {
            return NextResponse.json({ error: 'Path is required' }, { status: 400 });
        }

        // Authenticate the user session using Supabase
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in to access this document.' }, { status: 401 });
        }

        // Security: Prevent accessing path outside restaurants/
        if (!path.startsWith('restaurants/')) {
            return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
        }

        // Generate the pre-signed URL (expires in 15 minutes)
        const presignedUrl = await getPrivatePresignedUrl(path, 900);

        // Redirect user to the pre-signed URL
        return NextResponse.redirect(presignedUrl);
    } catch (error: any) {
        console.error('Error serving private file:', error);
        return NextResponse.json({ error: error.message || 'Failed to access file' }, { status: 500 });
    }
}
