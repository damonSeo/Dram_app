import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'

// GET /api/personal-notes?log_id=<uuid>  — all notes on a log (with author nicknames)
// GET /api/personal-notes?mine=1         — current user's all personal notes
export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const logId = req.nextUrl.searchParams.get('log_id')
    const mine = req.nextUrl.searchParams.get('mine')

    if (mine) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ data: [] })
      const { data, error } = await supabase
        .from('personal_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (logId) {
      const { data, error } = await supabase
        .from('personal_notes')
        .select('id, user_id, log_id, content, selected_keys, created_at, updated_at')
        .eq('log_id', logId)
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Hydrate with nicknames
      const userIds = [...new Set((data || []).map((n) => n.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, nickname').in('id', userIds)
      const nameMap = new Map((profiles || []).map((p) => [p.id, p.nickname]))
      const hydrated = (data || []).map((n) => ({ ...n, author_nickname: nameMap.get(n.user_id) || '익명' }))
      return NextResponse.json({ data: hydrated })
    }

    return NextResponse.json({ error: 'log_id or mine required' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// POST /api/personal-notes { log_id, content, selected_keys[] } — add or update
export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    const body = await req.json() as { log_id?: string; content?: string; selected_keys?: string[] }
    if (!body.log_id) return NextResponse.json({ error: 'log_id required' }, { status: 400 })
    const content = (body.content || '').trim()
    if (!content && !(body.selected_keys?.length)) {
      return NextResponse.json({ error: '내용 또는 키워드를 입력해주세요' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('personal_notes')
      .upsert({
        user_id: user.id,
        log_id: body.log_id,
        content,
        selected_keys: body.selected_keys || [],
        updated_at: now,
      }, { onConflict: 'user_id,log_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// DELETE /api/personal-notes { id }
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    const { id } = await req.json() as { id: string }
    const { error } = await supabase.from('personal_notes').delete().eq('id', id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
