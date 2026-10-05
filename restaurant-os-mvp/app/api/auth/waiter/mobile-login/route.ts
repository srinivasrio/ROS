import { POST as waiterLoginPOST } from '../login/route';
import type { NextRequest } from 'next/server';

/**
 * /api/auth/waiter/mobile-login delegates directly to /api/auth/waiter/login
 * ensuring unified PIN authentication, rate limiting, and role enforcement.
 */
export async function POST(req: NextRequest) {
    return waiterLoginPOST(req);
}
