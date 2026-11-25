import { isCloudflareWorkers } from './runtime';

export interface CloudflareRateLimitBinding {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CloudflareDoStub {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareDoNamespace {
    idFromName(name: string): unknown;
    get(id: unknown): CloudflareDoStub;
}

export interface CloudflareSecurityEnv {
    RL_LOOKUP_PHONE?: CloudflareRateLimitBinding;
    RL_ACTIVE_ORDER?: CloudflareRateLimitBinding;
    RL_ORDER_STATUS?: CloudflareRateLimitBinding;
    RL_UPLOAD?: CloudflareRateLimitBinding;
    SECURITY_DO?: CloudflareDoNamespace;
}

let testEnvOverride: CloudflareSecurityEnv | null = null;

/** Testing helper to inject mock Cloudflare Rate Limit / SECURITY_DO bindings outside workerd. */
export function setCloudflareSecurityEnvForTest(env: CloudflareSecurityEnv | null): void {
    testEnvOverride = env;
}

/**
 * Resolves native Cloudflare security bindings (`RL_*` and `SECURITY_DO`) when running
 * inside Workers (or when explicitly injected in unit tests). Returns null in standard Node dev.
 */
export async function getCloudflareSecurityEnv(): Promise<CloudflareSecurityEnv | null> {
    if (testEnvOverride) return testEnvOverride;
    if (!isCloudflareWorkers()) return null;

    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext({ async: true });
        return (env as unknown as CloudflareSecurityEnv) ?? null;
    } catch {
        return null;
    }
}
