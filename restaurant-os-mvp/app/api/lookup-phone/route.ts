import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { mobile } = await req.json();
    if (!mobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    // Use the service role key server-side to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .or(`phone.eq.${mobile},phone.eq.+91${mobile}`)
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
