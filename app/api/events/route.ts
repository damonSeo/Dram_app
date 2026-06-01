import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'
import type { TastingEvent } from '@/types'

// GET /api/events            — 전체 이벤트 (다가올 + 지난)
// POST /api/events           — 이벤트 생성 (호스트 = 로그인 유저)
export async function GET() {
  try {
    const supabase = await getServerClient()
    const { data, error } = await supabase
      .from('tasting_events')
      .select('*')
      .order('event_date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 호스트 닉네임 병합
    const hostIds = [...new Set((data || []).map(e => e.host_user_id).filter(Boolean))]
    let nameMap = new Map<string, string>()
    if (hostIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, nickname').in('id', hostIds)
      nameMap = new Map((profiles || []).map(p => [p.id, p.nickname]))
    }
    const hydrated = (data || []).map(e => ({
      ...e,
      host_nickname: e.host_user_id ? (nameMap.get(e.host_user_id) || '게스트') : '익명',
    }))
    return NextResponse.json({ data: hydrated })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    const body = await req.json() as Partial<TastingEvent>
    if (!body.title || !body.event_date) {
      return NextResponse.json({ error: 'title, event_date 필요' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('tasting_events')
      .insert({
        title: body.title,
        event_date: body.event_date,
        description: body.description || '',
        featured_bottles: body.featured_bottles || [],
        host_user_id: user.id,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
