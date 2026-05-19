import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  // Fix: replace 0.0.0.0 with localhost to avoid Safari/browser restrictions
  const origin = rawOrigin.replace('0.0.0.0', 'localhost')
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam !== '/portal' ? nextParam : null

    if (code) {
    const supabase = await createClient()
    const { error, data: { user } } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // Fetch user profile to get restaurant_id
      const { data: profile } = await supabase
        .from('users')
        .select('restaurant_id')
        .eq('id', user.id)
        .single();

      let targetPath = next || '/';
      if (profile?.restaurant_id) {
        targetPath = `/${profile.restaurant_id}/portal`;
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // Hello, Vercel
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${targetPath}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetPath}`)
      } else {
        return NextResponse.redirect(`${origin}${targetPath}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
