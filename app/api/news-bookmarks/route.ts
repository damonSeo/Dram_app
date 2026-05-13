import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabaseServer'

export interface NewsBookmark {
  id: string
  user_id: string
  title: string
  link: string
  description?: string
  source?: string
  source_url?: string
  image?: string
  pub_date?: string
  user_note?: string
  created_at: string
}

// GET — 내 북마크 목록
export async function GET() {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ data: [] })
    const { data, error } = await supabase
      .from('news_bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// POST — 북마크 저장
export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

    const body = await req.json() as Partial<NewsBookmark>
    if (!body.title || !body.link) {
      return NextResponse.json({ error: 'title과 link는 필수예요' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('news_bookmarks')
      .upsert({
        user_id: user.id,
        title: body.title,
        link: body.link,
        description: body.description || null,
        source: body.source || null,
        source_url: body.source_url || null,
        image: body.image || null,
        pub_date: body.pub_date || null,
        user_note: body.user_note || null,
      }, { onConflict: 'user_id,link' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// PATCH — 북마크에 메모 추가/수정
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

    const body = await req.json() as { id: string; user_note?: string }
    const { data, error } = await supabase
      .from('news_bookmarks')
      .update({ user_note: body.user_note || null })
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// DELETE — 북마크 삭제
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const link = url.searchParams.get('link')
    if (!id && !link) return NextResponse.json({ error: 'id 또는 link 필요' }, { status: 400 })

    let q = supabase.from('news_bookmarks').delete().eq('user_id', user.id)
    if (id) q = q.eq('id', id)
    else if (link) q = q.eq('link', link)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
