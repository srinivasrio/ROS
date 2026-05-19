import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId, restaurantName } = await req.json();

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

    // 1. Update Primary DB - set is_approved = true
    const { data: primaryUser, error: primaryError } = await primaryAdmin
      .from('users')
      .update({ is_approved: true })
      .eq('id', userId)
      .select('email')
      .single();

    if (primaryError) {
      console.error('Primary DB update error:', primaryError);
      return NextResponse.json({ error: primaryError.message }, { status: 500 });
    }

    // 2. Update SaaS DB - try email first, then restaurant name
    let saasRestaurant = null;

    if (primaryUser?.email) {
      const { data } = await saasAdmin
        .from('restaurants')
        .update({ status: 'active' })
        .eq('email', primaryUser.email)
        .select()
        .maybeSingle();
      saasRestaurant = data;
    }

    if (!saasRestaurant && restaurantName) {
      const { data } = await saasAdmin
        .from('restaurants')
        .update({ status: 'active' })
        .ilike('name', restaurantName)
        .select()
        .maybeSingle();
      saasRestaurant = data;
    }

    if (saasRestaurant) {
      await saasAdmin
        .from('restaurant_legal')
        .update({ status: 'approved' })
        .eq('restaurant_ref', saasRestaurant.id);

      // Link the approved restaurant ID to the user in Primary DB
      const { error: linkError } = await primaryAdmin
        .from('users')
        .update({ restaurant_id: saasRestaurant.id })
        .eq('id', userId);

      if (linkError) {
        console.error('Failed to link restaurant_id to user during approval:', linkError);
      }
    }

    return NextResponse.json({ success: true, email: primaryUser?.email });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Approval error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
