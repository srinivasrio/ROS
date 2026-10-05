import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
    try {
        const { mobile } = await req.json();
        if (!mobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        const cleanMobile = String(mobile).replace(/[^0-9]/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
          return NextResponse.json({ error: 'A valid mobile number is required' }, { status: 400 });
        }

        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const lookupLimit = await RateLimiter.check(`phone_lookup:${clientIp}`, 5, 300);
        if (!lookupLimit.success) {
          return NextResponse.json({ error: 'Too many lookup attempts. Please try again later.' }, { status: 429 });
        }

    // Use the service role key server-side to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .or(`phone.eq.${cleanMobile},phone.eq.+91${cleanMobile}`)
      .maybeSingle();

    if (error) {
      console.error('Phone lookup error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.email) {
      return NextResponse.json({ email: null });
    }

    return NextResponse.json({ email: data.email });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
