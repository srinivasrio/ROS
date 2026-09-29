import { NextResponse } from 'next/server';
import { POST as mobileLoginPOST } from '../mobile-login/route';
import type { NextRequest } from 'next/server';

/**
 * Legacy /api/auth/waiter/login forwards to /api/auth/waiter/mobile-login
 * ensuring password verification and active status are strictly enforced.
 */
export async function POST(req: Request) {
    return mobileLoginPOST(req as NextRequest);
}
