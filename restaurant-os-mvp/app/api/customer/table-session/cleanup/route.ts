import { NextRequest, NextResponse } from 'next/server';
import { TableSessionLifecycleService } from '@/services/table-session-lifecycle.service';

/**
 * POST /api/customer/table-session/cleanup
 * Runs scheduled or on-demand cleanup of idle abandoned sessions older than 10 minutes.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const restaurantId = body?.restaurantId?.trim() || null;

        const result = await TableSessionLifecycleService.runScheduledCleanup(restaurantId);
        return NextResponse.json({
            success: true,
            cleanedCount: result.cleanedCount,
            message: `Cleaned up ${result.cleanedCount} expired table sessions`,
        });
    } catch (err: any) {
        console.error('[table-session/cleanup] Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
