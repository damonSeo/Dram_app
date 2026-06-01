import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'
import type { TastingEvent, WhiskyLog } from '@/types'

// GET /api/events/[id] — 이벤트 + 연결된 모든 시음 로그 + 호스트 닉네임 + 작성자 닉네임
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const supabase = await getServerClient()
    const { data: ev, error } = await supabase
      .from('tasting_events')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!ev) return NextResponse.json({ error: '이벤트를 찾을 수 없어요' }, { status: 404 })

    // 연결된 모든 로그 (참여자 노트들)
    const { data: logs } = await supabase
      .from('whisky_logs')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    // 닉네임 병합 (호스트 + 모든 작성자)
    const userIds = new Set<string>()
    if (ev.host_user_id) userIds.add(ev.host_user_id)
    for (const l of logs || []) if (l.user_id) userIds.add(l.user_id)
    let nameMap = new Map<string, string>()
    if (userIds.size) {
      const { data: profiles } = await supabase.from('profiles').select('id, nickname').in('id', [...userIds])
      nameMap = new Map((profiles || []).map(p => [p.id, p.nickname]))
    }
    const hydratedEv: TastingEvent = {
      ...ev,
      host_nickname: ev.host_user_id ? (nameMap.get(ev.host_user_id) || '게스트') : '익명',
    }
    const hydratedLogs = (logs || []).map((l: WhiskyLog & { user_id: string }) => ({
      ...l,
      author_nickname: nameMap.get(l.user_id) || '게스트',
    }))
    return NextResponse.json({ data: hydratedEv, logs: hydratedLogs })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// PATCH — 호스트만 (RLS)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    const body = await req.json() as Partial<TastingEvent>
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) update.title = body.title
    if (body.event_date !== undefined) update.event_date = body.event_date
    if (body.description !== undefined) update.description = body.description
    if (body.featured_bottles !== undefined) update.featured_bottles = body.featured_bottles
    const { data, error } = await supabase
      .from('tasting_events').update(update).eq('id', id)
      .select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: '수정 권한이 없거나 이벤트가 없습니다' }, { status: 403 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    const { error } = await supabase.from('tasting_events').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
