import { NextResponse } from 'next/server';

// The legacy /portal route has been removed.
// All authentication flows now go through the unified /login page.
export async function GET(request: Request) {
    const { origin: rawOrigin } = new URL(request.url);
    const origin = rawOrigin.replace('0.0.0.0', 'localhost');
    return NextResponse.redirect(`${origin}/login`);
}
