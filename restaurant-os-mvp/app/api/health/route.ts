import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Observability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * 
 * Production health and observability probe.
 * Checks application runtime, database connectivity, and provides
 * real-time operational metrics (latencies, failure rates, alerts).
 */
export async function GET(req: NextRequest) {
    const startTime = Date.now();
    const requestId = req.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let dbConnected = false;
    let dbLatencyMs = 0;
    let dbErrorMsg: string | null = null;

    try {
        const dbStart = Date.now();
        const { error } = await supabaseAdmin
            .from('restaurants')
            .select('id', { count: 'exact', head: true })
            .limit(1);

        dbLatencyMs = Date.now() - dbStart;

        if (error) {
            dbErrorMsg = error.message;
            Observability.recordDbQuery(dbLatencyMs, false);
        } else {
            dbConnected = true;
            Observability.recordDbQuery(dbLatencyMs, true);
        }
    } catch (err: any) {
        dbLatencyMs = Date.now() - startTime;
        dbErrorMsg = err?.message || 'Database ping error';
        Observability.recordDbQuery(dbLatencyMs, false);
    }

    const metrics = Observability.getMetricsSnapshot();
    const totalDuration = Date.now() - startTime;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let httpStatusCode = 200;

    if (!dbConnected) {
        overallStatus = 'unhealthy';
        httpStatusCode = 503;
    } else if (dbLatencyMs > 1000 || metrics.requests.errorRate5xxPercent > 10) {
        overallStatus = 'degraded';
        httpStatusCode = 200;
    }

    Observability.recordRequest('/api/health', 'GET', httpStatusCode, totalDuration, requestId);

    const responseBody = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptimeSeconds: metrics.uptimeSeconds,
        service: 'dine-in-one-api',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        database: {
            status: dbConnected ? 'connected' : 'disconnected',
            latencyMs: dbLatencyMs,
            ...(dbErrorMsg ? { error: dbErrorMsg } : {}),
        },
        metrics: {
            requests: metrics.requests,
            latency: metrics.latencyMs,
            database: metrics.database,
            operationalCounters: metrics.counters,
            activeAlerts: metrics.activeAlerts,
        },
    };

    return NextResponse.json(responseBody, {
        status: httpStatusCode,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Health-Status': overallStatus,
        },
    });
}
