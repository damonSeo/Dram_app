import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const next = req.nextUrl.searchParams.get('next') || '/'
  if (!code) return NextResponse.redirect(new URL('/?auth_error=no_code', req.url))

  try {
    const supabase = await getServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchange failed:', error.message)
      return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error.message)}`, req.url))
    }
    // Ensure profile row exists
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (!existing) {
        const fallbackName =
          (user.user_metadata?.nickname as string) ||
          (user.user_metadata?.name as string) ||
          (user.user_metadata?.preferred_username as string) ||
          (user.email?.split('@')[0]) ||
          '익명 사용자'
        await supabase.from('profiles').insert({ id: user.id, nickname: fallbackName })
      }
    }
    return NextResponse.redirect(new URL(next, req.url))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'auth error'
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(msg)}`, req.url))
  }
}
