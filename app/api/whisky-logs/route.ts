import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'

// GET /api/whisky-logs                 → all logs (visible to everyone)
// GET /api/whisky-logs?user_id=<uuid>  → logs of a specific user
// GET /api/whisky-logs?mine=1          → current user's logs only
export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const userId = req.nextUrl.searchParams.get('user_id')
    const mine = req.nextUrl.searchParams.get('mine')

    let query = supabase.from('whisky_logs').select('*').order('created_at', { ascending: false })
    if (mine) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ data: [] })
      query = query.eq('user_id', user.id)
    } else if (userId) {
      query = query.eq('user_id', userId)
    }
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const body = await req.json()
    const { data: { user } } = await supabase.auth.getUser()
    const log = {
      ...body,
      user_id: user?.id || 'anonymous',
      date: body.date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('whisky_logs').insert(log).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const body = await req.json()
    const { id, ...fields } = body
    const { data: { user } } = await supabase.auth.getUser()

    const updatePayload = { ...fields, updated_at: new Date().toISOString() }

    // 1차: 본인 소유 레코드 업데이트 시도
    if (user) {
      const { data, error } = await supabase
        .from('whisky_logs')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (data) return NextResponse.json({ data })

      // 2차: user_id가 'anonymous'인 레코드도 허용 (기존 데이터 호환)
      const { data: data2, error: error2 } = await supabase
        .from('whisky_logs')
        .update({ ...updatePayload, user_id: user.id })
        .eq('id', id)
        .in('user_id', ['anonymous', ''])
        .select()
        .maybeSingle()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
      if (data2) return NextResponse.json({ data: data2 })
    }

    // 3차: 비로그인 상태 fallback
    const { data, error } = await supabase
      .from('whisky_logs')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: '수정할 노트를 찾을 수 없어요' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { id } = await req.json() as { id: string }
    const { data: { user } } = await supabase.auth.getUser()
    let query = supabase.from('whisky_logs').delete().eq('id', id)
    if (user) query = query.eq('user_id', user.id)
    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
