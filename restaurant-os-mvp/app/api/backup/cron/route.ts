import { NextResponse } from 'next/server';
import { BackupService } from '@/services/backup.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'daily';
        
        // Authorization check
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.split(' ')[1];
        const cronSecret = process.env.CRON_SECRET || 'dine-in-one-cron-secret-key-2026';
        
        if (token !== cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!['daily', 'weekly', 'monthly'].includes(type)) {
            return NextResponse.json({ error: 'Invalid backup type' }, { status: 400 });
        }

        const result = await BackupService.createSnapshot(type as 'daily' | 'weekly' | 'monthly');
        
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Backup failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true, filename: result.filename });
    } catch (err: any) {
        console.error('Backup cron route error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
