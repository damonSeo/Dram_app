import { NextRequest, NextResponse } from 'next/server'
import { generateWithImages } from '@/lib/gemini'

export const revalidate = 86400  // 24h 캐시
export const maxDuration = 30

/**
 * GET /api/bottle-image?q=<query>&name=<expected_label>
 *
 * 1) Serper Images 로 후보 이미지 6장 검색
 * 2) 도메인 신뢰도 정렬 (Whiskybase·TWE·MoM·Distiller... 우선)
 * 3) 상위 4장 다운로드 (병렬, 5초 타임아웃, 2MB 제한)
 * 4) Gemini Vision 으로 모든 후보를 한 번에 보여주고 라벨 검증
 *    → "어느 후보가 expected 라벨과 일치하는가?" JSON 반환
 * 5) 검증된 후보 반환 / 검증 실패면 최상위 후보를 unverified로 반환
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const expected = (req.nextUrl.searchParams.get('name') || q || '').trim()
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const key = process.env.SERPER_API_KEY
  if (!key) return NextResponse.json({ data: null, reason: 'SERPER_API_KEY 미설정' })

  // ── 1) Serper 이미지 검색 ──
  let images: Array<{ imageUrl: string; thumbnailUrl?: string; source?: string; link?: string; title?: string }> = []
  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `${q} whisky bottle`, gl: 'us', num: 12 }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json() as { images?: typeof images }
      images = data.images || []
    }
  } catch { /* fall through */ }
  if (images.length === 0) return NextResponse.json({ data: null, reason: 'no images' })

  // ── 2) 도메인 신뢰도 정렬 ──
  const PRIORITY = [
    'whiskybase', 'thewhiskyexchange', 'masterofmalt', 'distiller',
    'whiskyhoop', 'whiskyauctioneer', 'scotchwhiskyauctions', 'whiskyfun',
    'royalmilewhiskies', 'whiskynotes', 'dekanta',
  ]
  const rankDomain = (host: string) => {
    const h = host.toLowerCase()
    const i = PRIORITY.findIndex(d => h.includes(d))
    return i === -1 ? 999 : i
  }
  const sorted = [...images].sort((a, b) => {
    const ah = (a.source || a.link || '').toLowerCase()
    const bh = (b.source || b.link || '').toLowerCase()
    return rankDomain(ah) - rankDomain(bh)
  })

  // ── 3) 상위 4장 다운로드 ──
  type Candidate = (typeof sorted)[number] & { base64?: string; mime?: string }
  const top: Candidate[] = sorted.slice(0, 4)

  const fetched = await Promise.all(top.map(async c => {
    try {
      const r = await fetch(c.imageUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 OakBot/1.0' },
      })
      if (!r.ok) return null
      const buf = await r.arrayBuffer()
      if (buf.byteLength > 2_000_000 || buf.byteLength < 1024) return null
      const ct = r.headers.get('content-type') || 'image/jpeg'
      if (!ct.startsWith('image/')) return null
      return { ...c, base64: Buffer.from(buf).toString('base64'), mime: ct.split(';')[0].trim() }
    } catch { return null }
  }))
  const valid: Required<Pick<Candidate, 'base64' | 'mime'>> & Candidate[] = [] as never
  const list: Candidate[] = []
  for (const f of fetched) if (f && f.base64 && f.mime) list.push(f)

  if (list.length === 0) {
    // 다운로드 다 실패 → 최상위 url만 unverified로
    const c = sorted[0]
    return NextResponse.json({
      data: { image_url: c.imageUrl, thumbnail_url: c.thumbnailUrl || c.imageUrl, source: c.source || '', link: c.link || '', verified: false, reason: 'download failed' },
    })
  }

  // ── 4) Gemini Vision으로 라벨 검증 ──
  let bestIdx = 0
  let verified = false
  let foundText = ''
  let confidence: 'high' | 'medium' | 'low' = 'low'

  if (process.env.GEMINI_API_KEY) {
    const prompt = `다음은 위스키 보틀 이미지 ${list.length}장입니다 (인덱스 0~${list.length - 1}).
이 중 라벨이 "${expected}"와 가장 잘 일치하는 보틀을 골라주세요.

판단 기준:
- 라벨에 적힌 증류소·제품명·숙성연수(yr/Y.O.)·도수·캐스크 표기를 종합
- "${expected}"에 포함된 핵심 단어들과 라벨 텍스트를 매칭
- 글라스·박스·광고·완전히 다른 보틀은 제외
- 정확히 같은 라인업이면 high, 같은 증류소지만 다른 연수/릴리즈면 medium, 무관하면 low

다음 JSON 형식만 반환 (마크다운 없이):
{
  "best_index": 0~${list.length - 1} 사이의 정수, 일치하는 것 없으면 -1,
  "confidence": "high" | "medium" | "low",
  "found_text": "선택된 이미지에서 읽은 핵심 라벨 텍스트(없으면 빈 문자열)"
}`
    try {
      const raw = await generateWithImages(prompt, list.map(c => ({ base64: c.base64!, mimeType: c.mime! })))
      const cleaned = raw.replace(/```(?:json)?/g, '').trim()
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0]) as { best_index?: number; confidence?: string; found_text?: string }
        const idx = typeof parsed.best_index === 'number' ? parsed.best_index : -1
        if (idx >= 0 && idx < list.length) {
          bestIdx = idx
          verified = parsed.confidence === 'high' || parsed.confidence === 'medium'
          foundText = String(parsed.found_text || '')
          confidence = (parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low')
            ? parsed.confidence : 'low'
        } else {
          // -1: 일치하는 것 없음 — 최상위 도메인 후보를 unverified로 반환
          bestIdx = 0
          verified = false
          confidence = 'low'
        }
      }
    } catch (e) {
      console.warn('[bottle-image] verification failed:', e)
      // 검증 실패 시 도메인 1순위로 폴백
    }
  }

  const best = list[bestIdx]
  return NextResponse.json({
    data: {
      image_url: best.imageUrl,
      thumbnail_url: best.thumbnailUrl || best.imageUrl,
      source: best.source || '',
      link: best.link || '',
      title: best.title || '',
      verified,
      confidence,
      found_text: foundText,
    },
  })
}
