import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { uploadToR2 } from '@/lib/r2';

export async function POST(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const folder = (formData.get('folder') as string) || 'compliance';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop() || 'dat';
        const cleanName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const key = `${folder}/${cleanName}`;

        let publicUrl = '';
        try {
            await uploadToR2(key, buffer, file.type || 'application/octet-stream');
            const r2PublicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
            publicUrl = `${r2PublicDomain}/${key}`;
        } catch (r2Err) {
            console.warn('R2 upload failed, using data URI fallback:', r2Err);
            const base64 = buffer.toString('base64');
            publicUrl = `data:${file.type || 'application/octet-stream'};base64,${base64}`;
        }

        return NextResponse.json({
            success: true,
            url: publicUrl,
            fileName: file.name,
            sizeKb: Math.round(file.size / 1024)
        });

    } catch (err: any) {
        console.error('Super Admin upload error:', err);
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
    }
}
