import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'

// GET /api/profile               → current user's profile
// GET /api/profile?id=<uuid>     → another user's profile
// GET /api/profile?list=1        → all profiles (for archive switcher)
export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const list = req.nextUrl.searchParams.get('list')
    const id = req.nextUrl.searchParams.get('id')

    if (list) {
      const { data, error } = await supabase.from('profiles').select('id, nickname').order('nickname')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    let targetId = id
    let currentUser = null
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ data: null })
      targetId = user.id
      currentUser = user
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 본인 프로필인데 없으면 자동 생성 (이메일 로그인 직후 대비)
    if (!data && currentUser && targetId === currentUser.id) {
      const nickname =
        (currentUser.user_metadata?.nickname as string) ||
        (currentUser.user_metadata?.name as string) ||
        (currentUser.user_metadata?.preferred_username as string) ||
        (currentUser.email?.split('@')[0]) ||
        '사용자'
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: currentUser.id, nickname })
        .select()
        .single()
      return NextResponse.json({ data: created })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// PATCH /api/profile { nickname } — update current user's nickname
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const body = await req.json() as { nickname?: string }
    const nickname = (body.nickname || '').trim()
    if (!nickname) return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 })
    // [...str] spreads by Unicode code point — Korean chars count as 1
    if ([...nickname].length > 20) return NextResponse.json({ error: '닉네임은 20자 이내로 입력해주세요' }, { status: 400 })

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, nickname, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
