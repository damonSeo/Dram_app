import { NextRequest, NextResponse } from 'next/server'
import { generateText as geminiText, generateWithImage } from '@/lib/gemini'
import { serperSearch as serperRaw, searchWhiskySources, sortByPriority } from '@/lib/whiskySources'

// 본문 fetch + 2번의 Gemini 호출이 필요해 시간 여유 둠
export const maxDuration = 60

interface OcrFields {
  brand?: string
  region?: string
  age?: string
  vintage?: string
  abv?: string
  bottler?: string
  cask?: string
}

export interface BottleProfile {
  identified_name: string
  confidence: 'high' | 'medium' | 'low'
  distillery: string | null
  bottler: string | null
  age: string | null
  vintage: string | null
  abv: string | null
  cask: string | null
  region: string | null
  release_info: string | null
  description: string
  flavor_profile: {
    nose: string
    palate: string
    finish: string
  } | null
  price_estimate: string | null
  rarity: 'standard' | 'limited' | 'rare' | null
  references: Array<{ title: string; link: string; source: string }>
  news_matches: Array<{ title: string; link: string; source: string }>
  ai_note: string
  // 검증 결과
  verification: {
    confirmed: boolean
    distillery_bottler_match: 'confirmed' | 'likely' | 'conflicting' | 'unverified'
    note: string
    conflicts: string[]
  }
  // 외부 자료에서 발견된 테이스팅 노트
  tasting_notes_found: Array<{
    source: string
    link?: string
    nose?: string
    palate?: string
    finish?: string
    overall?: string
    rating?: string
  }>
  // 실제 본문을 읽은 사이트들
  articles_fetched: Array<{ source: string; link: string }>
  // Whiskybase 매칭 결과
  whiskybase: {
    status: 'exact' | 'similar' | 'none'
    matched_name: string | null
    link: string | null
    note: string
    candidates: Array<{ name: string; link: string }>
  }
}

interface SerperOrganic {
  title: string
  link: string
  snippet?: string
  displayLink?: string
}
interface SerperResponse {
  organic?: SerperOrganic[]
  knowledgeGraph?: { description?: string; attributes?: Record<string, string> }
}

interface NewsItemLite {
  title: string
  link: string
  description?: string
  source?: string
}

function buildQuery(ocr: OcrFields): string {
  const parts = [
    ocr.brand,
    ocr.age,
    ocr.vintage,
    ocr.cask,
    ocr.bottler && ocr.bottler !== 'OB' ? ocr.bottler : null,
    'whisky review',
  ].filter(Boolean)
  return parts.join(' ').slice(0, 200)
}

async function serperSearch(query: string): Promise<{ snippets: string; references: BottleProfile['references'] }> {
  const key = process.env.SERPER_API_KEY
  if (!key) return { snippets: '', references: [] }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'us', num: 8 }),
    })
    if (!res.ok) return { snippets: '', references: [] }
    const data = await res.json() as SerperResponse
    const parts: string[] = []
    const refs: BottleProfile['references'] = []
    if (data.knowledgeGraph) {
      if (data.knowledgeGraph.description) parts.push(`[KG] ${data.knowledgeGraph.description}`)
      if (data.knowledgeGraph.attributes) {
        for (const [k, v] of Object.entries(data.knowledgeGraph.attributes)) parts.push(`- ${k}: ${v}`)
      }
    }
    if (data.organic) {
      for (const o of data.organic.slice(0, 8)) {
        parts.push(`• ${o.title}\n  ${o.snippet || ''}`)
        refs.push({ title: o.title, link: o.link, source: o.displayLink || '' })
      }
    }
    return { snippets: parts.join('\n'), references: refs.slice(0, 6) }
  } catch {
    return { snippets: '', references: [] }
  }
}

async function fetchNewsMatches(brand: string, origin: string): Promise<BottleProfile['news_matches']> {
  try {
    const res = await fetch(`${origin}/api/whisky-news`, { next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json() as { data?: NewsItemLite[] }
    if (!json.data) return []
    const q = brand.toLowerCase()
    return json.data
      .filter(n => `${n.title} ${n.description || ''}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map(n => ({ title: n.title, link: n.link, source: n.source || '' }))
  } catch {
    return []
  }
}

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
}

// 실제 기사 HTML을 가져와서 본문 텍스트만 추출
async function fetchArticleText(url: string, maxChars = 3000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OakTheRecord/1.0; +https://dram-app.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.7,ko;q=0.5',
      },
      signal: AbortSignal.timeout(4500),
      redirect: 'follow',
    })
    if (!res.ok) return ''
    let html = await res.text()
    if (!html || html.length < 200) return ''

    // 불필요한 영역 제거
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<head[\s\S]*?<\/head>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')

    // 본문 영역 우선 추출
    const candidates = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
      /<div[^>]*?class=["'][^"']*(?:post-content|entry-content|article-content|article-body|post-body|content-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*?id=["'](?:content|main|post)["'][^>]*>([\s\S]*?)<\/div>/i,
    ]
    for (const re of candidates) {
      const m = html.match(re)
      if (m && m[1].length > 300) { html = m[1]; break }
    }

    // 태그 제거 + 엔티티 변환
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&hellip;/g, '…')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&#\d+;/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return text.slice(0, maxChars)
  } catch {
    return ''
  }
}

interface FetchedArticle {
  source: string
  link: string
  title: string
  text: string
}

// 여러 URL 병렬 fetch (타임아웃 보호)
async function fetchArticles(targets: Array<{ link: string; source: string; title: string }>, limit = 6): Promise<FetchedArticle[]> {
  const top = targets.slice(0, limit)
  const results = await Promise.allSettled(
    top.map(async t => {
      const text = await fetchArticleText(t.link, 2800)
      return text.length > 200 ? { source: t.source, link: t.link, title: t.title, text } : null
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<FetchedArticle | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((x): x is FetchedArticle => x !== null)
}

// Whiskybase 전용 검색 — 라벨이 Whiskybase DB에 등재돼 있는지 확인
async function searchWhiskybase(name: string): Promise<Array<{ name: string; link: string; snippet: string }>> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const hits = await serperRaw(`site:whiskybase.com/whiskies ${name}`, 8)
    return hits
      .filter(h => h.link.includes('whiskybase.com/whiskies/'))
      .slice(0, 6)
      .map(h => ({
        name: h.title.replace(/\s*[-|]\s*Whiskybase.*$/i, '').trim(),
        link: h.link,
        snippet: h.snippet || '',
      }))
  } catch {
    return []
  }
}

// 2차 검색: 일반 리뷰 검색 + Whiskybase/옥션/리테일러/일본 site 타겟 검색 병렬
async function deepSearchByName(name: string): Promise<{ snippets: string; refs: BottleProfile['references'] }> {
  const key = process.env.SERPER_API_KEY
  if (!key) return { snippets: '', refs: [] }
  try {
    const [general, dbHits, jpHits] = await Promise.all([
      // 1) 일반 리뷰/테이스팅 노트 검색
      serperRaw(`"${name}" tasting notes review`, 8),
      // 2) Whiskybase·옥션·리테일러 타겟 (정식명·캐스크·도수 정확도)
      searchWhiskySources(name, { groups: ['databases', 'auctions', 'retailers'], num: 7 }),
      // 3) 일본 소스 (재패니즈/일본 한정판 대응)
      searchWhiskySources(name, { groups: ['japanese', 'community'], num: 5 }),
    ])

    const seen = new Set<string>()
    const refs: BottleProfile['references'] = []
    const parts: string[] = []
    for (const o of [...dbHits, ...general, ...jpHits]) {
      if (!o.link || seen.has(o.link)) continue
      seen.add(o.link)
      parts.push(`• ${o.title} (${o.displayLink || ''})\n  ${o.snippet || ''}`)
      refs.push({ title: o.title, link: o.link, source: o.displayLink || '' })
    }
    return { snippets: parts.slice(0, 14).join('\n'), refs: sortByPriority(refs).slice(0, 12) }
  } catch {
    return { snippets: '', refs: [] }
  }
}

// 3차: 증류소-보틀러 조합 검증 + 노트 추출 (실제 기사 본문 포함)
const VERIFY_PROMPT = (
  candidateName: string,
  distillery: string,
  bottler: string,
  age: string,
  draft: string,
  deepSnippets: string,
  newsLines: string,
  articleTexts: string,
  whiskybaseList: string,
  lang: 'en' | 'ko' | 'auto',
) => {
  const langText = lang === 'ko'
    ? 'Write narrative text in KOREAN (keep whisky proper nouns in English).'
    : 'Write narrative text in NATURAL ENGLISH using standard whisky terminology.'

  return `You are a whisky fact-checker and tasting-note archivist.

CANDIDATE BOTTLE: ${candidateName}
- Distillery: ${distillery || '(unknown)'}
- Bottler: ${bottler || '(unknown)'}
- Age: ${age || '(unknown)'}

[Initial Analysis Draft]
${draft}

[Deep Search Results — "${candidateName} tasting notes review"]
${deepSnippets || '(none)'}

[News / Review Matches — titles only]
${newsLines || '(none)'}

[FULL ARTICLE TEXTS — fetched directly from review/news sites]
${articleTexts || '(no article bodies fetched)'}

[WHISKYBASE DATABASE CANDIDATES — entries indexed on whiskybase.com/whiskies]
${whiskybaseList || '(no Whiskybase entries found)'}

TASKS:
1. VERIFY the distillery + bottler + age combination is real and consistent.
   Use the FULL ARTICLE TEXTS as the primary truth source — quotes from these articles are concrete evidence.
   - If "${bottler}" is OB and the distillery actually bottles its own ${age} release → confirmed
   - If "${bottler}" is an independent bottler and articles mention they released a ${age} ${distillery} → confirmed
   - If sources contradict (e.g. ${bottler} never bottled ${distillery}, or wrong age) → conflicting
   - If you can't find it but it's plausible → likely
   - If totally absent from articles → unverified

2. EXTRACT actual tasting notes — PRIORITISE THE FULL ARTICLE TEXTS over snippets.
   For each source that has clear nose/palate/finish/rating, create an entry.
   Quote the reviewer's actual wording where possible (translate to target language).
   Look for ratings like 87/100, 4/5, ★★★★, 92, etc.

3. UPDATE the draft with corrected info from the article bodies (better cask info, abv, vintage, release details).

4. WHISKYBASE MATCH — using ONLY the WHISKYBASE DATABASE CANDIDATES list, decide:
   - "exact": a candidate clearly is THIS exact bottle (same distillery, age, bottler, vintage/release) → return its name + link
   - "similar": no exact entry, but candidate(s) for the same distillery/expression exist (different age, year, or batch) → note what differs, return the closest candidate link
   - "none": no relevant Whiskybase candidate at all
   Be conservative: only say "exact" when distillery AND (age or vintage) AND bottler align.

${langText}

Respond ONLY with this JSON (no markdown):
{
  "verification": {
    "confirmed": true | false,
    "distillery_bottler_match": "confirmed | likely | conflicting | unverified",
    "note": "Short explanation of the verification outcome (1-2 sentences)",
    "conflicts": ["list specific conflicts found, empty array if none"]
  },
  "tasting_notes_found": [
    {
      "source": "Source name (e.g. WhiskyFun, Serge Valentin, WhiskyNotes)",
      "link": "URL if available or null",
      "nose": "nose notes from the source (or null)",
      "palate": "palate notes (or null)",
      "finish": "finish notes (or null)",
      "overall": "overall verdict/comment (or null)",
      "rating": "rating mentioned (or null)"
    }
  ],
  "updated_fields": {
    "identified_name": "corrected name if needed",
    "distillery": "corrected distillery",
    "bottler": "corrected bottler",
    "age": "corrected age",
    "abv": "corrected abv",
    "cask": "corrected cask",
    "vintage": "corrected vintage",
    "release_info": "corrected release info",
    "rarity": "standard | limited | rare"
  },
  "whiskybase": {
    "status": "exact | similar | none",
    "matched_name": "the Whiskybase entry name if exact/similar, else null",
    "link": "the Whiskybase URL if exact/similar, else null",
    "note": "1 sentence: confirm it's on Whiskybase, or what is similar/different (in target language)"
  }
}

Rules:
- For tasting_notes_found: extract verbatim style notes when possible, only include entries where at least nose, palate, finish, or overall is non-null
- If no tasting notes found anywhere, return empty array
- updated_fields: only include fields you have stronger evidence for; pass through unchanged otherwise
- Output ONLY the JSON`
}

type Lang = 'en' | 'ko' | 'auto'

const ANALYSIS_PROMPT = (ocr: OcrFields, snippets: string, newsLines: string, lang: Lang) => {
  const langInstruction = lang === 'en'
    ? `OUTPUT LANGUAGE: Write all narrative text (description, flavor notes, release_info, price_estimate, ai_note) in NATURAL ENGLISH. Use standard whisky terminology (Sherry, Oloroso, Hogshead, NAS, etc.). Be detailed and expressive.`
    : lang === 'ko'
    ? `OUTPUT LANGUAGE: Write all narrative text in KOREAN. Keep whisky proper nouns in English (Macallan, Sherry Oak, etc.). Be natural and expressive.`
    : `OUTPUT LANGUAGE: Use the language that fits the source material best. If most search/news context is English, write narrative in English. If sources are mostly Korean/Japanese, mirror that. Default to English for whisky terms, country/distillery names, and tasting notes — these read more naturally in English.`

  return `You are a 30-year veteran whisky expert and bottle identification specialist.

[Label OCR Result — may contain inaccuracies]
${JSON.stringify(ocr, null, 2)}

[Google Search Results]
${snippets || '(no results)'}

[Related Whisky News / Reviews]
${newsLines || '(no matches)'}

TASK:
Identify this whisky from the attached bottle photo combined with the information above, and provide rich details.
If OCR is ambiguous or inaccurate, trust the photo and search results more.

${langInstruction}

Respond ONLY in this JSON format (no markdown / code fences / explanations):
{
  "identified_name": "Full proper bottle name (e.g. Glenfarclas 25 Year Old, Macallan Sherry Oak 18 2023 Release)",
  "confidence": "high | medium | low",
  "distillery": "Distillery name",
  "bottler": "OB or independent bottler name",
  "age": "Age statement (e.g. 12yr, NAS)",
  "vintage": "Vintage year or null",
  "abv": "ABV with % (e.g. 46%, 56.8%)",
  "cask": "Cask type(s)",
  "region": "Region",
  "release_info": "One line about the release (e.g. 2023 Annual Release, Discontinued, 1500 bottles)",
  "description": "200-300 character overview covering history, characteristics, and reputation",
  "flavor_profile": {
    "nose": "Nose notes, 1-2 sentences",
    "palate": "Palate notes, 1-2 sentences",
    "finish": "Finish notes, 1 sentence"
  },
  "price_estimate": "Price estimate one-line (e.g. ~$200-280 USD, ~25-35만원 KRW, discontinued—volatile)",
  "rarity": "standard | limited | rare",
  "ai_note": "Anything unclear or where OCR and photo disagree (or note alignment)"
}

Rules:
- Use null for any field you're not confident about
- Always mark prices as estimates ("approx", "약", "~")
- Output ONLY the JSON object`
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 없습니다.' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const ocrRaw = formData.get('ocr') as string | null
    const langRaw = (formData.get('lang') as string | null) || 'auto'
    const lang: Lang = (['en','ko','auto'].includes(langRaw) ? langRaw : 'auto') as Lang
    const ocr: OcrFields = ocrRaw ? JSON.parse(ocrRaw) : {}

    const brand = ocr.brand || ''
    if (!brand && !file) {
      return NextResponse.json({ error: '이미지 또는 브랜드 정보가 필요해요' }, { status: 400 })
    }

    // 병렬 수집
    const query = buildQuery(ocr)
    const [{ snippets, references }, newsMatches] = await Promise.all([
      serperSearch(query),
      fetchNewsMatches(brand, req.nextUrl.origin),
    ])

    const newsLines = newsMatches
      .map(n => `- [${n.source}] ${n.title}`)
      .join('\n')

    const prompt = ANALYSIS_PROMPT(ocr, snippets, newsLines, lang)

    let raw: string
    if (file) {
      // 이미지 + 텍스트로 분석
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const mimeType = file.type || 'image/jpeg'
      // 1차 추출은 빠른 모델 — 이후 검색·검증 단계에서 보정됨 (타임아웃 방지)
      raw = await generateWithImage(prompt, base64, mimeType, false)
    } else {
      // 텍스트만으로 분석
      raw = await geminiText(prompt)
    }

    const parsed = extractJson(raw) as Partial<BottleProfile> | null
    if (!parsed) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw }, { status: 500 })
    }

    const initial: BottleProfile = {
      identified_name: String(parsed.identified_name || brand || '식별 불가'),
      confidence: (parsed.confidence as BottleProfile['confidence']) || 'low',
      distillery: (parsed.distillery as string) || null,
      bottler: (parsed.bottler as string) || null,
      age: (parsed.age as string) || null,
      vintage: (parsed.vintage as string) || null,
      abv: (parsed.abv as string) || null,
      cask: (parsed.cask as string) || null,
      region: (parsed.region as string) || null,
      release_info: (parsed.release_info as string) || null,
      description: String(parsed.description || ''),
      flavor_profile: parsed.flavor_profile as BottleProfile['flavor_profile'] || null,
      price_estimate: (parsed.price_estimate as string) || null,
      rarity: (parsed.rarity as BottleProfile['rarity']) || null,
      references,
      news_matches: newsMatches,
      ai_note: String(parsed.ai_note || ''),
      verification: { confirmed: false, distillery_bottler_match: 'unverified', note: '', conflicts: [] },
      tasting_notes_found: [],
      articles_fetched: [],
      whiskybase: { status: 'none', matched_name: null, link: null, note: '', candidates: [] },
    }

    // ── PHASE 2 & 3: 식별된 이름으로 재검색 + 실제 본문 fetch + 검증 + 노트 추출 ──
    let allReferences = [...references]
    let fetchedArticleSources: Array<{ source: string; link: string }> = []

    const runDeepPhase = async () => {
      const [deep, wbCandidates] = await Promise.all([
        deepSearchByName(initial.identified_name),
        searchWhiskybase(initial.identified_name),
      ])
      initial.whiskybase.candidates = wbCandidates.map(c => ({ name: c.name, link: c.link }))
      // 중복 제거하고 합치기
      const seenLinks = new Set(allReferences.map(r => r.link))
      for (const r of deep.refs) {
        if (!seenLinks.has(r.link)) { allReferences.push(r); seenLinks.add(r.link) }
      }
      allReferences = sortByPriority(allReferences).slice(0, 12)

      // PHASE 2.5: 뉴스 + 딥서치 결과를 실제로 fetch해서 본문 추출
      // Whiskybase·옥션·리뷰 사이트 우선 (공유 PRIORITY_FETCH_DOMAINS 기준)
      const fetchTargets = sortByPriority([
        ...deep.refs.map(r => ({ link: r.link, source: r.source, title: r.title })),
        ...newsMatches.map(n => ({ link: n.link, source: n.source, title: n.title })),
      ])

      const articles = await fetchArticles(fetchTargets, 4)
      fetchedArticleSources = articles.map(a => ({ source: a.source, link: a.link }))

      // Gemini에 전달할 본문 텍스트
      const articleTextBlock = articles.length > 0
        ? articles.map((a, i) => `
─── ARTICLE ${i + 1} ───
SOURCE: ${a.source}
URL: ${a.link}
TITLE: ${a.title}
BODY:
${a.text}
`).join('\n')
        : '(no articles fetched)'

      try {
        const verifyRaw = await geminiText(
          VERIFY_PROMPT(
            initial.identified_name,
            initial.distillery || '',
            initial.bottler || '',
            initial.age || '',
            JSON.stringify({
              identified_name: initial.identified_name,
              distillery: initial.distillery,
              bottler: initial.bottler,
              age: initial.age,
              abv: initial.abv,
              cask: initial.cask,
              vintage: initial.vintage,
              release_info: initial.release_info,
              rarity: initial.rarity,
            }, null, 2),
            deep.snippets || snippets,
            newsLines,
            articleTextBlock,
            wbCandidates.length > 0
              ? wbCandidates.map((c, i) => `${i + 1}. ${c.name}\n   ${c.link}\n   ${c.snippet}`).join('\n')
              : '',
            lang,
          )
        )
        const verifyJson = extractJson(verifyRaw) as {
          verification?: BottleProfile['verification']
          tasting_notes_found?: BottleProfile['tasting_notes_found']
          updated_fields?: Partial<BottleProfile>
          whiskybase?: { status?: string; matched_name?: string; link?: string; note?: string }
        } | null

        if (verifyJson?.verification) initial.verification = verifyJson.verification
        if (Array.isArray(verifyJson?.tasting_notes_found)) initial.tasting_notes_found = verifyJson.tasting_notes_found
        if (verifyJson?.whiskybase) {
          const wb = verifyJson.whiskybase
          const st = wb.status === 'exact' || wb.status === 'similar' ? wb.status : 'none'
          initial.whiskybase = {
            status: st,
            matched_name: wb.matched_name || null,
            link: wb.link || null,
            note: wb.note || '',
            candidates: initial.whiskybase.candidates,
          }
        }
        // 검증 단계에서 업데이트된 필드 반영
        if (verifyJson?.updated_fields) {
          const u = verifyJson.updated_fields
          if (u.identified_name) initial.identified_name = u.identified_name
          if (u.distillery) initial.distillery = u.distillery
          if (u.bottler) initial.bottler = u.bottler
          if (u.age) initial.age = u.age
          if (u.abv) initial.abv = u.abv
          if (u.cask) initial.cask = u.cask
          if (u.vintage) initial.vintage = u.vintage
          if (u.release_info) initial.release_info = u.release_info
          if (u.rarity) initial.rarity = u.rarity
        }
      } catch (e) {
        console.warn('[bottle-research] verification failed:', e)
        initial.verification = { confirmed: false, distillery_bottler_match: 'unverified', note: 'Verification step failed.', conflicts: [] }
      }
    }

    // Phase 2/3은 시간 예산(35초) 내에서만 — 초과 시 1차 결과라도 반환
    if (initial.identified_name && initial.identified_name !== '식별 불가' && initial.distillery) {
      const budget = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 35000))
      const result = await Promise.race([runDeepPhase().then(() => 'done' as const), budget])
      if (result === 'timeout') {
        console.warn('[bottle-research] deep phase budget exceeded — returning phase-1 result')
        if (!initial.verification.note) {
          initial.verification = {
            confirmed: false,
            distillery_bottler_match: 'unverified',
            note: '심층 검증이 시간 내 완료되지 않아 1차 분석 결과를 표시합니다.',
            conflicts: [],
          }
        }
      }
    }

    initial.references = allReferences
    initial.articles_fetched = fetchedArticleSources
    return NextResponse.json({ data: initial })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[bottle-research] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
