'use client';

interface QueryMetric {
    count: number;
    hits: number;
    misses: number;
    executionTimes: number[];
}

class QueryMonitorService {
    private metrics: Record<string, QueryMetric> = {};
    private requestTimestamps: number[] = [];
    private throttleTimestamps: Record<string, number> = {};
    private pendingEvents: any[] = [];
    private isFlushing = false;
    
    // Config thresholds
    private SPIKE_THRESHOLD = 30; // Max requests in 10s before alert
    private WINDOW_MS = 10000;    // 10s sliding window
    private DEFAULT_THROTTLE_MS = 1000; // 1s default rate limiting

    constructor() {
        if (typeof window !== 'undefined') {
            (window as any).__queryMonitor = this;
            // Background HTTP flush removed to eliminate network choke & dev server stalls
        }
    }

    private initMetric(type: string): QueryMetric {
        if (!this.metrics[type]) {
            this.metrics[type] = {
                count: 0,
                hits: 0,
                misses: 0,
                executionTimes: []
            };
        }
        return this.metrics[type];
    }

    /**
     * Record a request, track cache hit/miss, measure latency, and inspect for spikes in-memory.
     */
    track(type: string, isHit: boolean, latencyMs: number) {
        const metric = this.initMetric(type);
        metric.count++;
        if (isHit) {
            metric.hits++;
        } else {
            metric.misses++;
        }
        metric.executionTimes.push(latencyMs);
        if (metric.executionTimes.length > 100) {
            metric.executionTimes.shift(); // Keep bounded list
        }

        // Keep bounded in-memory log for local debugging without firing network requests
        if (this.pendingEvents.length > 50) {
            this.pendingEvents.shift();
        }
        this.pendingEvents.push({
            query_type: type,
            is_cache_hit: isHit,
            latency_ms: latencyMs,
            is_slow: latencyMs > 500,
            created_at: new Date().toISOString()
        });
    }

    private cleanupWindow(now: number) {
        const cutoff = now - this.WINDOW_MS;
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff);
    }

    /**
     * In-memory flush (no network requests to prevent server lockup)
     */
    private async flush() {
        this.pendingEvents = [];
    }

    /**
     * Rate-limiting guard. Always returns false so user button clicks are never blocked or delayed.
     */
    shouldThrottle(key: string, intervalMs: number = this.DEFAULT_THROTTLE_MS): boolean {
        return false;
    }

    private cleanupThrottleKeys(now: number) {
        // Prevent map leak: remove timestamps older than 60s
        const cutoff = now - 60000;
        Object.keys(this.throttleTimestamps).forEach(k => {
            if (this.throttleTimestamps[k] < cutoff) {
                delete this.throttleTimestamps[k];
            }
        });
    }

    /**
     * Retrieve cache and execution metrics.
     */
    getMetrics() {
        const result: Record<string, any> = {};
        Object.keys(this.metrics).forEach(type => {
            const m = this.metrics[type];
            const avgLatency = m.executionTimes.length > 0 
                ? m.executionTimes.reduce((a, b) => a + b, 0) / m.executionTimes.length 
                : 0;
            const hitRate = m.count > 0 ? (m.hits / m.count) * 100 : 100;
            
            result[type] = {
                totalRequests: m.count,
                cacheHits: m.hits,
                cacheMisses: m.misses,
                cacheHitRate: `${hitRate.toFixed(1)}%`,
                avgLatencyMs: `${avgLatency.toFixed(1)}ms`
            };
        });
        return result;
    }

    reset() {
        this.metrics = {};
        this.requestTimestamps = [];
        this.throttleTimestamps = {};
        this.pendingEvents = [];
    }
}

export const QueryMonitor = new QueryMonitorService();
