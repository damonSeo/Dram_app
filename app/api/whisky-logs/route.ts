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
    // Only allow update if user owns the log (RLS will enforce, but we filter explicitly)
    const { data: { user } } = await supabase.auth.getUser()
    let query = supabase.from('whisky_logs').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    if (user) query = query.eq('user_id', user.id)
    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
