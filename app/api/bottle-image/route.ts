import { NextRequest, NextResponse } from 'next/server'
import { generateWithImages } from '@/lib/gemini'

export const revalidate = 86400  // 24h 캐시
export const maxDuration = 30

/**
 * GET /api/bottle-image?q=<query>&name=<>&distillery=<>&age=<>&abv=<>
 *
 * 1) Serper Images 로 후보 12장 검색
 * 2) 도메인 신뢰도 정렬 (Whiskybase·TWE·MoM·Distiller... 우선)
 * 3) 상위 4장 다운로드 (병렬, 5초 타임아웃, 2MB 제한)
 * 4) Gemini Vision 으로 라벨 텍스트를 읽어 증류소·숙성연수·도수 모두 일치 검증
 * 5) ✅ 셋 다 일치한 경우만 verified=true. 하나라도 불일치/판독 불가면 verified=false
 *    EventPage에서는 verified=true만 보여주므로 부정확한 사진은 노출 안 됨.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const expected = (req.nextUrl.searchParams.get('name') || q || '').trim()
  const reqDistillery = req.nextUrl.searchParams.get('distillery')?.trim() || ''
  const reqAge = req.nextUrl.searchParams.get('age')?.trim() || ''
  const reqAbv = req.nextUrl.searchParams.get('abv')?.trim() || ''
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

  // ── 4) Gemini Vision으로 라벨 텍스트 추출 + 엄격 검증 ──
  let bestIdx = -1
  let verified = false
  let foundText = ''
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let matchDetail = ''

  if (process.env.GEMINI_API_KEY) {
    const targetDistillery = reqDistillery || expected
    const prompt = `당신은 위스키 라벨 검증 전문가입니다. 아래 ${list.length}장의 이미지 (인덱스 0~${list.length - 1}) 중 다음 조건을 모두 만족하는 보틀을 찾아주세요.

목표 보틀
- 증류소: "${targetDistillery}"
- 숙성연수: "${reqAge || '(미지정)'}"
- 도수(ABV): "${reqAbv || '(미지정)'}"

각 이미지에 대해 다음을 판단합니다 (라벨이 부분적으로 가려져도 보이는 글자로 추론하세요).
- distillery_match: 라벨에서 읽은 증류소가 목표 증류소와 같은가?
- age_match: 라벨의 숙성연수(예: 18, 18 YEARS, 18 YO, 18年)가 목표 숙성과 같은가? 목표가 미지정이면 true.
- abv_match: 라벨의 도수(예: 43%, 46% ABV)가 목표 도수와 같은가? 목표가 미지정이면 true.

오직 distillery_match·age_match·abv_match가 모두 true인 인덱스를 best_index로 선택하세요.
하나라도 false거나 라벨을 명확히 읽지 못한 경우 best_index = -1.

판정 기준
- 글라스·박스·광고·완전히 다른 보틀 → -1
- 같은 증류소지만 숙성·도수가 다르면 → -1
- 모두 일치하는 후보가 여러 개면 라벨이 가장 선명한 것을 선택

다음 JSON 형식만 반환 (마크다운 없이):
{
  "best_index": 0~${list.length - 1} 사이 정수 또는 -1,
  "confidence": "high" | "low",
  "found_text": "선택한 이미지에서 읽은 라벨 핵심 텍스트 (증류소·연수·도수 포함)",
  "match_detail": "distillery=Y/N, age=Y/N, abv=Y/N 한 줄 요약"
}`
    try {
      const raw = await generateWithImages(prompt, list.map(c => ({ base64: c.base64!, mimeType: c.mime! })))
      const cleaned = raw.replace(/```(?:json)?/g, '').trim()
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0]) as { best_index?: number; confidence?: string; found_text?: string; match_detail?: string }
        const idx = typeof parsed.best_index === 'number' ? parsed.best_index : -1
        if (idx >= 0 && idx < list.length) {
          bestIdx = idx
          verified = true                  // 모델이 셋 다 일치한다고 판정한 경우만 도달
          foundText = String(parsed.found_text || '')
          matchDetail = String(parsed.match_detail || '')
          confidence = parsed.confidence === 'high' ? 'high' : 'low'
        }
      }
    } catch (e) {
      console.warn('[bottle-image] verification failed:', e)
    }
  }

  // 검증 통과한 이미지가 없으면 null 반환 → EventPage는 placeholder 유지
  if (bestIdx === -1) {
    return NextResponse.json({
      data: null,
      reason: 'no verified candidate',
      checked: list.length,
      match_detail: matchDetail || undefined,
    })
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
      match_detail: matchDetail,
    },
  })
}
