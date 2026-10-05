/**
 * Centralized Observability & Health Monitoring Service (P1-06)
 * 
 * Features:
 * - Structured JSON logging with request_id, route, status, duration
 * - Automatic redaction of sensitive credentials, OTPs, JWTs, keys, and PII
 * - Real-time metrics tracking: request count, 5xx rate, p50/p95/p99 latency, DB latency
 * - Specific operational failure tracking: order failures, Realtime failures, auth failures, OTP failures, rate-limit blocks
 * - Threshold-based anomaly alerts
 */

export interface StructuredLog {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'security';
    message: string;
    requestId?: string;
    route?: string;
    method?: string;
    status?: number;
    durationMs?: number;
    meta?: Record<string, any>;
}

export type OperationalEvent = 
    | 'order_failure'
    | 'realtime_failure'
    | 'auth_failure'
    | 'otp_failure'
    | 'rate_limit_block';

interface AnomalyAlert {
    id: string;
    type: string;
    severity: 'warning' | 'critical';
    message: string;
    timestamp: string;
}

// Global in-memory metrics window
const LATENCY_SAMPLE_MAX = 500;
const DB_LATENCY_SAMPLE_MAX = 200;

interface MetricsState {
    totalRequests: number;
    requestsByStatus: { [statusGroup: string]: number };
    latencies: number[];
    dbLatencies: number[];
    orderFailures: number;
    realtimeFailures: number;
    authFailures: number;
    otpFailures: number;
    rateLimitBlocks: number;
    alerts: AnomalyAlert[];
    startTime: number;
}

const g = global as unknown as { __rosMetricsState?: MetricsState };
if (!g.__rosMetricsState) {
    g.__rosMetricsState = {
        totalRequests: 0,
        requestsByStatus: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
        latencies: [],
        dbLatencies: [],
        orderFailures: 0,
        realtimeFailures: 0,
        authFailures: 0,
        otpFailures: 0,
        rateLimitBlocks: 0,
        alerts: [],
        startTime: Date.now(),
    };
}
const state = g.__rosMetricsState;

const SENSITIVE_KEY_REGEX = /password|secret|token|jwt|otp|hash|authorization|cookie|card|credit|cvv|api[_-]?key|service[_-]?role/i;

/**
 * Deep redaction of sensitive fields
 */
export function redactSensitiveData(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(item => redactSensitiveData(item));
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
            clean[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
            clean[key] = redactSensitiveData(value);
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

function calculatePercentile(samples: number[], p: number): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[index];
}

export const Observability = {
    /**
     * Write structured log with automatic redaction
     */
    log(
        level: 'info' | 'warn' | 'error' | 'security',
        message: string,
        meta?: {
            requestId?: string;
            route?: string;
            method?: string;
            status?: number;
            durationMs?: number;
            [key: string]: any;
        }
    ): void {
        const { requestId, route, method, status, durationMs, ...extra } = meta || {};
        const safeMeta = Object.keys(extra).length > 0 ? redactSensitiveData(extra) : undefined;

        const payload: StructuredLog = {
            timestamp: new Date().toISOString(),
            level,
            message,
            requestId,
            route,
            method,
            status,
            durationMs,
            meta: safeMeta,
        };

        const jsonStr = JSON.stringify(payload);
        if (level === 'error' || level === 'security') {
            console.error(jsonStr);
        } else if (level === 'warn') {
            console.warn(jsonStr);
        } else {
            console.log(jsonStr);
        }
    },

    info(message: string, meta?: any) {
        this.log('info', message, meta);
    },

    warn(message: string, meta?: any) {
        this.log('warn', message, meta);
    },

    error(message: string, meta?: any) {
        this.log('error', message, meta);
    },

    security(message: string, meta?: any) {
        this.log('security', message, meta);
    },

    /**
     * Record an incoming HTTP request completion
     */
    recordRequest(route: string, method: string, status: number, durationMs: number, requestId?: string) {
        state.totalRequests++;

        const group = `${Math.floor(status / 100)}xx`;
        state.requestsByStatus[group] = (state.requestsByStatus[group] || 0) + 1;

        state.latencies.push(durationMs);
        if (state.latencies.length > LATENCY_SAMPLE_MAX) {
            state.latencies.shift();
        }

        // Check for 5xx spike alert
        const total = state.totalRequests;
        const total5xx = state.requestsByStatus['5xx'] || 0;
        if (total >= 20 && total5xx / total > 0.05) {
            this.triggerAlert('elevated_5xx_rate', 'critical', `5xx rate is ${((total5xx / total) * 100).toFixed(1)}% (${total5xx}/${total})`);
        }

        if (status >= 500) {
            this.error(`HTTP 5xx Server Error on ${method} ${route}`, { route, method, status, durationMs, requestId });
        }
    },

    /**
     * Record database query duration and status
     */
    recordDbQuery(durationMs: number, success: boolean) {
        state.dbLatencies.push(durationMs);
        if (state.dbLatencies.length > DB_LATENCY_SAMPLE_MAX) {
            state.dbLatencies.shift();
        }

        if (durationMs > 1000) {
            this.triggerAlert('slow_db_query', 'warning', `High DB latency detected: ${durationMs}ms`);
        }

        if (!success) {
            this.warn('DB query execution failed', { durationMs });
        }
    },

    /**
     * Record specific operational and security events
     */
    recordEvent(event: OperationalEvent, details?: any) {
        switch (event) {
            case 'order_failure':
                state.orderFailures++;
                this.error('Order creation failed', details);
                break;
            case 'realtime_failure':
                state.realtimeFailures++;
                this.warn('Realtime event dispatch or subscription failure', details);
                break;
            case 'auth_failure':
                state.authFailures++;
                this.security('Authentication failure', details);
                break;
            case 'otp_failure':
                state.otpFailures++;
                this.security('Customer OTP verification failure', details);
                break;
            case 'rate_limit_block':
                state.rateLimitBlocks++;
                this.security('Rate limit threshold exceeded', details);
                break;
        }
    },

    /**
     * Trigger a system alert with deduplication
     */
    triggerAlert(type: string, severity: 'warning' | 'critical', message: string) {
        const now = Date.now();
        const recent = state.alerts.find(a => a.type === type && (now - new Date(a.timestamp).getTime()) < 60000);
        if (!recent) {
            const alert: AnomalyAlert = {
                id: Math.random().toString(36).slice(2, 9),
                type,
                severity,
                message,
                timestamp: new Date().toISOString(),
            };
            state.alerts.unshift(alert);
            if (state.alerts.length > 20) state.alerts.pop();
            this.log(severity === 'critical' ? 'error' : 'warn', `[ALERT] ${message}`, { alertType: type, severity });
        }
    },

    /**
     * Get real-time metrics summary for health endpoints and dashboards
     */
    getMetricsSnapshot() {
        const total = state.totalRequests;
        const total5xx = state.requestsByStatus['5xx'] || 0;
        const rate5xx = total > 0 ? (total5xx / total) * 100 : 0;

        const dbAvg = state.dbLatencies.length > 0
            ? Math.round(state.dbLatencies.reduce((a, b) => a + b, 0) / state.dbLatencies.length)
            : 0;

        return {
            uptimeSeconds: Math.floor((Date.now() - state.startTime) / 1000),
            requests: {
                total,
                byStatus: { ...state.requestsByStatus },
                errorRate5xxPercent: Number(rate5xx.toFixed(2)),
            },
            latencyMs: {
                p50: calculatePercentile(state.latencies, 50),
                p95: calculatePercentile(state.latencies, 95),
                p99: calculatePercentile(state.latencies, 99),
            },
            database: {
                samples: state.dbLatencies.length,
                avgLatencyMs: dbAvg,
                p95LatencyMs: calculatePercentile(state.dbLatencies, 95),
            },
            counters: {
                orderFailures: state.orderFailures,
                realtimeFailures: state.realtimeFailures,
                authFailures: state.authFailures,
                otpFailures: state.otpFailures,
                rateLimitBlocks: state.rateLimitBlocks,
            },
            activeAlerts: [...state.alerts],
        };
    },

    /**
     * Reset metrics for testing
     */
    resetMetrics() {
        state.totalRequests = 0;
        state.requestsByStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
        state.latencies = [];
        state.dbLatencies = [];
        state.orderFailures = 0;
        state.realtimeFailures = 0;
        state.authFailures = 0;
        state.otpFailures = 0;
        state.rateLimitBlocks = 0;
        state.alerts = [];
        state.startTime = Date.now();
    },
};
