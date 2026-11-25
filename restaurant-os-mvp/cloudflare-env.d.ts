import type { CloudflareDoNamespace, CloudflareRateLimitBinding } from './lib/cloudflare-bindings';

declare global {
    interface CloudflareEnv {
        RL_LOOKUP_PHONE?: CloudflareRateLimitBinding;
        RL_ACTIVE_ORDER?: CloudflareRateLimitBinding;
        RL_ORDER_STATUS?: CloudflareRateLimitBinding;
        RL_UPLOAD?: CloudflareRateLimitBinding;
        SECURITY_DO?: CloudflareDoNamespace;
        AUTH_HASH?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
    }
}

export {};
