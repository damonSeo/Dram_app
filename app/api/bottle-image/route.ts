import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 86400  // 24h 캐시

/**
 * GET /api/bottle-image?q=<query>
 * Serper 이미지 검색으로 보틀 사진 1장 URL 반환.
 * 우선순위: 공식·리테일러 도메인 → 그 외
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const key = process.env.SERPER_API_KEY
  if (!key) return NextResponse.json({ data: null, reason: 'SERPER_API_KEY 미설정' })

  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `${q} whisky bottle`, gl: 'us', num: 12 }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ data: null, reason: `serper ${res.status}` })
    const data = await res.json() as {
      images?: Array<{ imageUrl: string; thumbnailUrl?: string; source?: string; link?: string; title?: string }>
    }
    const imgs = data.images || []
    if (imgs.length === 0) return NextResponse.json({ data: null })

    // 도메인 신뢰도 정렬 — 공식·리테일러·DB 우선
    const PRIORITY = [
      'whiskybase', 'thewhiskyexchange', 'masterofmalt', 'distiller',
      'whiskyhoop', 'whiskyauctioneer', 'scotchwhiskyauctions', 'whiskyfun',
      'royalmilewhiskies', 'whiskynotes',
    ]
    const rank = (host: string) => {
      const h = host.toLowerCase()
      const i = PRIORITY.findIndex(d => h.includes(d))
      return i === -1 ? 999 : i
    }
    const sorted = [...imgs].sort((a, b) => {
      const ah = (a.source || a.link || '').toLowerCase()
      const bh = (b.source || b.link || '').toLowerCase()
      return rank(ah) - rank(bh)
    })

    const best = sorted[0]
    return NextResponse.json({
      data: {
        image_url: best.imageUrl,
        thumbnail_url: best.thumbnailUrl || best.imageUrl,
        source: best.source || '',
        link: best.link || '',
        title: best.title || '',
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ data: null, reason: e instanceof Error ? e.message : 'error' })
  }
}
