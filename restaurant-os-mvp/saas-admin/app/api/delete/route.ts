import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Use server-side service role keys (not available in browser)
    const primaryAdmin = createClient(
      process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL!,
      process.env.PRIMARY_SUPABASE_SERVICE_ROLE_KEY!
    );

    const saasAdmin = createClient(
      process.env.NEXT_PUBLIC_SAAS_SUPABASE_URL!,
      process.env.SAAS_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SAAS_SUPABASE_ANON_KEY!
    );

    // 1. Fetch user details to get email and restaurant_id
    const { data: user, error: fetchError } = await primaryAdmin
      .from('users')
      .select('email, restaurant_id')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user for deletion:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 2. Delete from SaaS DB (using restaurant_id or email)
    if (user.restaurant_id) {
      const { error: saasDeleteError } = await saasAdmin
        .from('restaurants')
        .delete()
        .eq('id', user.restaurant_id);

      if (saasDeleteError) {
        console.error('SaaS DB delete by id error:', saasDeleteError);
      }
    } else if (user.email) {
      const { error: saasDeleteError } = await saasAdmin
        .from('restaurants')
        .delete()
        .eq('email', user.email);

      if (saasDeleteError) {
        console.error('SaaS DB delete by email error:', saasDeleteError);
      }
    }

    // 3. Delete from Primary DB users table
    const { error: primaryDeleteError } = await primaryAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (primaryDeleteError) {
      console.error('Primary DB delete error:', primaryDeleteError);
      return NextResponse.json({ error: primaryDeleteError.message }, { status: 500 });
    }

    // 4. Delete user from Supabase Auth
    const { error: authDeleteError } = await primaryAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Auth delete error (non-fatal for profile delete):', authDeleteError);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Deletion error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
