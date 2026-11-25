import { DurableObject } from 'cloudflare:workers';
import {
    handleSecurityAlarm,
    handleSecurityOtpClear,
    handleSecurityOtpIsVerified,
    handleSecurityOtpSet,
    handleSecurityOtpVerify,
    handleSecurityRateLimit,
    type OtpSetInput,
    type OtpVerifyInput,
    type RateLimitCheckInput,
} from './security-core.ts';

function jsonResponse(payload: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Strongly consistent Durable Object handling global auth/OTP rate limits and temporary OTP state.
 * Hosted inside dine-in-one-realtime and bound into app Workers via SECURITY_DO.
 */
export class SecurityRoom extends DurableObject {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method Not Allowed' }, 405);
        }

        let body: Record<string, unknown> = {};
        try {
            const text = await request.text();
            if (text) body = JSON.parse(text) as Record<string, unknown>;
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        switch (url.pathname) {
            case '/rate-limit':
                return jsonResponse(
                    await handleSecurityRateLimit(this.ctx.storage, body as unknown as RateLimitCheckInput)
                );
            case '/otp/set':
                return jsonResponse(
                    await handleSecurityOtpSet(this.ctx.storage, body as unknown as OtpSetInput)
                );
            case '/otp/verify':
                return jsonResponse(
                    await handleSecurityOtpVerify(this.ctx.storage, body as unknown as OtpVerifyInput)
                );
            case '/otp/is-verified':
                return jsonResponse(await handleSecurityOtpIsVerified(this.ctx.storage));
            case '/otp/clear':
                return jsonResponse(await handleSecurityOtpClear(this.ctx.storage));
            default:
                return jsonResponse({ error: 'Not Found' }, 404);
        }
    }

    async alarm(): Promise<void> {
        await handleSecurityAlarm(this.ctx.storage);
    }
}
