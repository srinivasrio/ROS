import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  const origin = rawOrigin.replace('0.0.0.0', 'localhost')
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')

  // Ignore legacy portal paths in 'next' param
  const invalidPaths = ['/portal', '/login/admin', '/login/waiter', '/login/kds'];
  const next = nextParam && !invalidPaths.some(p => nextParam.startsWith(p)) ? nextParam : null;

  if (code) {
    const supabase = await createClient()
    const { error, data: { user } } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // After Supabase OAuth code exchange, redirect to unified login
      // The custom JWT auth system will handle role detection
      const targetPath = next || '/login';

      const forwardedHost = request.headers.get('x-forwarded-host')
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

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
