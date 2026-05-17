import { NextRequest, NextResponse } from 'next/server'
import { generateWithImage, generateText } from '@/lib/gemini'
import { getServerClient } from '@/lib/supabaseServer'
import { searchWhiskySources } from '@/lib/whiskySources'

export const maxDuration = 45

const OCR_PROMPT_BASE = `You are an expert whisky label analyst with 20+ years of experience. Your task is to extract every piece of information from this whisky bottle label with maximum accuracy.

STEP 1 — READ ALL TEXT: Carefully examine the entire label including the main panel, neck label, back label, and any tax stamps. Note all text, numbers, and symbols you can see.

STEP 2 — EXTRACT FIELDS: Based on what you read, fill this JSON. Return ONLY the raw JSON object, no markdown fences, no explanation text.

JSON schema:
{
  "brand": "distillery name only (e.g. Glenfarclas, Macallan, Ardbeg) — NOT 'Highland Park 12' — just the distillery",
  "region": "one of: Speyside / Islay / Highland / Lowland / Campbeltown / Island / Irish / Japanese / American / Taiwanese / Indian / Other",
  "age": "age statement with yr suffix (e.g. 12yr, 25yr) OR 'NAS' if non-age statement",
  "vintage": "four-digit distillation year if shown (e.g. 2005)",
  "abv": "alcohol content with % suffix (e.g. 46%, 56.8%, 58.3%)",
  "cask": "cask type(s) from label (e.g. Oloroso Sherry Cask, Ex-Bourbon Hogshead, Port Pipe)",
  "bottler": "OB if official bottling by the distillery; or the independent bottler name (e.g. Gordon & MacPhail, Signatory, Berry Bros)",
  "distilled": "distillation date if present (e.g. Nov 1995, May 2008)",
  "bottled": "bottling date if present (e.g. Mar 2023, September 2019)",
  "cask_no": "cask number or barrel number if shown (e.g. #1234, Cask 42, Barrel 007)"
}

RULES:
- Use null for any field not clearly visible or readable
- brand = distillery only, NOT the full product name
- Always include % in abv and yr in age (or NAS)
- If bottler is the same as the distillery, use "OB"
- For region: infer from distillery name if label doesn't state it (e.g. Ardbeg → Islay, Glenfarclas → Speyside, Nikka → Japanese)
- Return ONLY the JSON object starting with { and ending with }`

// 사용자의 저장된 북마크에서 라벨 추론에 도움되는 컨텍스트 생성
async function buildBookmarkContext(): Promise<string> {
  try {
    const supabase = await getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    const { data } = await supabase
      .from('news_bookmarks')
      .select('title, description, source')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (!data || data.length === 0) return ''
    const lines = data.map(b => `- [${b.source || 'Saved'}] ${b.title}${b.description ? ' — ' + b.description.slice(0, 120) : ''}`).join('\n')
    return `\n\nADDITIONAL REFERENCE — User's saved whisky news/notes:\n${lines}\n`
  } catch {
    return ''
  }
}

// 위스키 뉴스 피드 전체에서 최신 정보 참고 (라벨 식별 보조)
async function buildNewsFeedContext(req: NextRequest): Promise<string> {
  try {
    const origin = req.nextUrl.origin
    const res = await fetch(`${origin}/api/whisky-news`, {
      // 캐시 활용
      next: { revalidate: 1800 },
    })
    if (!res.ok) return ''
    const json = await res.json() as { data?: Array<{ title: string; description?: string; source?: string }> }
    if (!json.data || json.data.length === 0) return ''
    // 최신 25개의 제목·요약만 컨텍스트로 사용
    const lines = json.data.slice(0, 25)
      .map(n => `- [${n.source || ''}] ${n.title}${n.description ? ' — ' + n.description.slice(0, 100) : ''}`)
      .join('\n')
    return `\n\nWHISKY NEWS REFERENCE — Recent releases and reviews (WhiskyNotes, Whisky Hoop, Kanpaikai, Spirits Business, etc.):\n${lines}\n`
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 추가하세요.' },
      { status: 500 }
    )
  }
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const [bookmarkContext, newsContext] = await Promise.all([
      buildBookmarkContext(),
      buildNewsFeedContext(req),
    ])
    const fullPrompt = OCR_PROMPT_BASE + bookmarkContext + newsContext

    let raw: string
    try {
      raw = await generateWithImage(fullPrompt, base64, mimeType)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Gemini vision error:', msg)
      return NextResponse.json({ error: `Gemini 호출 실패: ${msg}` }, { status: 500 })
    }

    let parsed: Record<string, string | null> = {}
    try {
      // strip any markdown fences and find the JSON object
      const cleaned = raw.replace(/```(?:json)?/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch {
      // ignore parse errors — return empty object
    }

    // Normalise: trim whitespace, replace empty strings with null
    const normalised: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(parsed)) {
      normalised[k] = typeof v === 'string' && v.trim() !== '' ? v.trim() : null
    }

    // ── 경량 검증 단계: Whiskybase·리테일러·옥션에서 교차 확인 ──
    // brand가 있으면 1회 site-targeted 검색 → Gemini로 빠른 보정
    if (normalised.brand && process.env.SERPER_API_KEY) {
      try {
        const queryName = [normalised.brand, normalised.age, normalised.vintage, normalised.cask]
          .filter(Boolean).join(' ')
        const hits = await searchWhiskySources(queryName, {
          groups: ['databases', 'retailers', 'auctions', 'japanese'],
          num: 6,
        })
        if (hits.length > 0) {
          const snippetBlock = hits
            .slice(0, 6)
            .map(h => `• ${h.title} (${h.displayLink || ''})\n  ${h.snippet || ''}`)
            .join('\n')

          const refinePrompt = `You are a whisky label verification expert. Below is an initial OCR extraction and search results from whisky databases (Whiskybase), retailers, and auction sites.

[Initial OCR Extraction]
${JSON.stringify(normalised, null, 2)}

[Search Results from Whiskybase / Retailers / Auctions]
${snippetBlock}

TASK: Cross-check the OCR fields against the search results. Correct any field where the search results strongly contradict the OCR (e.g. wrong age, wrong bottler, wrong cask, wrong ABV). Keep OCR values when search is silent or ambiguous. Do NOT invent data not supported by either source.

Return ONLY the corrected JSON with the same schema (brand, region, age, vintage, abv, cask, bottler, distilled, bottled, cask_no). null for unknown. No markdown, no explanation.`

          const refinedRaw = await generateText(refinePrompt)
          const rc = refinedRaw.replace(/```(?:json)?/g, '').trim()
          const rm = rc.match(/\{[\s\S]*\}/)
          if (rm) {
            const refined = JSON.parse(rm[0]) as Record<string, unknown>
            for (const [k, v] of Object.entries(refined)) {
              normalised[k] = typeof v === 'string' && v.trim() !== '' ? v.trim() : (v == null ? null : normalised[k])
            }
          }
        }
      } catch (e) {
        console.warn('[OCR] verification step skipped:', e)
      }
    }

    return NextResponse.json({ data: normalised })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OCR error'
    console.error('OCR error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
