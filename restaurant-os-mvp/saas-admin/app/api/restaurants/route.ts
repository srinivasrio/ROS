import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    // Use server-side service role key (not available in browser)
    const primaryAdmin = createClient(
      process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL!,
      process.env.PRIMARY_SUPABASE_SERVICE_ROLE_KEY!
    );

    const saasAdmin = createClient(
      process.env.NEXT_PUBLIC_SAAS_SUPABASE_URL!,
      process.env.SAAS_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SAAS_SUPABASE_ANON_KEY!
    );

    const isApproved = status === 'approved';

    // 1. Fetch users from Primary DB (bypassing RLS)
    const { data: users, error: primaryError } = await primaryAdmin
      .from('users')
      .select('*')
      .eq('role', 'restaurant_admin')
      .eq('is_approved', isApproved)
      .order('created_at', { ascending: false });

    if (primaryError) {
      console.error('Primary DB fetch error:', primaryError);
      return NextResponse.json({ error: primaryError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Enrich with SaaS DB data for the "pending" view
    // Or even for approved view to show more details
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      let business = null;

      if (user.email) {
        const { data } = await saasAdmin
          .from('restaurants')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
        business = data;
      }

      if (!business && user.restaurant_name) {
        const { data } = await saasAdmin
          .from('restaurants')
          .select('*')
          .ilike('name', user.restaurant_name)
          .maybeSingle();
        business = data;
      }

      if (business) {
        const { data: legal } = await saasAdmin
          .from('restaurant_legal')
          .select('*')
          .eq('restaurant_ref', business.id)
          .maybeSingle();
        
        return { ...user, business_details: business, legal_details: legal };
      }
      return user;
    }));

    return NextResponse.json(enrichedUsers);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fetch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
