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
