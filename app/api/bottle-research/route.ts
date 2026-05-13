import { NextRequest, NextResponse } from 'next/server'
import { generateText as geminiText, generateWithImage } from '@/lib/gemini'

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

const ANALYSIS_PROMPT = (ocr: OcrFields, snippets: string, newsLines: string) => `당신은 30년 경력의 위스키 전문가이자 보틀 식별 전문가입니다.

[라벨 OCR 결과 — 일부는 부정확할 수 있음]
${JSON.stringify(ocr, null, 2)}

[Google 검색 결과]
${snippets || '(검색 결과 없음)'}

[관련 위스키 뉴스/리뷰]
${newsLines || '(매칭 없음)'}

작업:
첨부된 보틀 사진과 위 정보를 종합하여, 이 위스키가 무엇인지 식별하고 풍부한 정보를 제공하세요.
OCR 결과가 모호하거나 부정확하면 사진과 검색 결과를 더 신뢰하세요.

다음 JSON 형식으로만 응답 (마크다운/코드블록 없이 순수 JSON):
{
  "identified_name": "추정 정식 보틀명 (예: Glenfarclas 25 Year Old, Macallan Sherry Oak 18 2023 Release)",
  "confidence": "high | medium | low",
  "distillery": "증류소 이름 (영문 권장)",
  "bottler": "OB 또는 독립 보틀러 이름",
  "age": "숙성연수 (예: 12yr, NAS)",
  "vintage": "빈티지 연도 또는 null",
  "abv": "도수 (예: 46%, 56.8%)",
  "cask": "캐스크 타입 (영문 권장)",
  "region": "지역",
  "release_info": "릴리즈 정보 한 줄 (예: 2023 연례 출시, 단종, 1500병 한정)",
  "description": "이 보틀에 대한 200~300자 한국어 개요 (역사·특징·평가 포함)",
  "flavor_profile": {
    "nose": "향 노트 한국어 1~2문장",
    "palate": "맛 노트 한국어 1~2문장",
    "finish": "여운 한국어 1문장"
  },
  "price_estimate": "한국 시장 추정 가격 한 줄 (예: 약 25-35만원, 단종으로 시세 변동)",
  "rarity": "standard | limited | rare",
  "ai_note": "OCR과 사진 사이에 불일치가 있거나 추가 확인이 필요한 부분 (없으면 'OCR과 사진이 일치합니다.')"
}

규칙:
- 확실하지 않은 항목은 null
- description은 반드시 한국어, 영문 고유명사는 그대로 두기 (Macallan, Sherry Oak 등)
- 가격이나 시세는 추정치임을 명시 ("약", "추정")
- JSON 외 어떤 텍스트도 출력 금지`

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 없습니다.' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const ocrRaw = formData.get('ocr') as string | null
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

    const prompt = ANALYSIS_PROMPT(ocr, snippets, newsLines)

    let raw: string
    if (file) {
      // 이미지 + 텍스트로 분석
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const mimeType = file.type || 'image/jpeg'
      raw = await generateWithImage(prompt, base64, mimeType)
    } else {
      // 텍스트만으로 분석
      raw = await geminiText(prompt)
    }

    const parsed = extractJson(raw) as Partial<BottleProfile> | null
    if (!parsed) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw }, { status: 500 })
    }

    const profile: BottleProfile = {
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
    }

    return NextResponse.json({ data: profile })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    console.error('[bottle-research] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
