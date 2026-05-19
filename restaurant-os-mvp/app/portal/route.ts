import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { origin: rawOrigin } = new URL(request.url)
  const origin = rawOrigin.replace('0.0.0.0', 'localhost')
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  let targetPath = '/';
  if (profile?.restaurant_id) {
    targetPath = `/${profile.restaurant_id}/portal`;
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  
  let targetUrl: string;
  if (isLocalEnv) {
    targetUrl = `${origin}${targetPath}`;
  } else if (forwardedHost) {
    targetUrl = `https://${forwardedHost}${targetPath}`;
  } else {
    targetUrl = `${origin}${targetPath}`;
  }

  return NextResponse.redirect(targetUrl);
}
