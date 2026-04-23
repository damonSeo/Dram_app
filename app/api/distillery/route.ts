import { NextRequest, NextResponse } from 'next/server'
import { generateText as geminiText } from '@/lib/gemini'

interface SerperOrganic {
  title: string
  link: string
  snippet?: string
  displayLink?: string
}
interface SerperKG {
  title?: string
  type?: string
  description?: string
  descriptionSource?: string
  attributes?: Record<string, string>
  website?: string
}
interface SerperResponse {
  organic?: SerperOrganic[]
  knowledgeGraph?: SerperKG
}

const FIRST_PASS_PROMPT = (brand: string, region: string) => `당신은 위스키 증류소 전문가입니다. 아래 증류소에 대한 핵심 정보를 정리해주세요.

증류소: ${brand}
${region ? `지역 힌트: ${region}` : ''}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운/코드블록 없이 순수 JSON):
{
  "name": "증류소 공식 이름 (영문 원어 + 한글 병기 가능, 예: Glenfarclas (글렌파클라스))",
  "country": "국가 (영문 또는 한글)",
  "region": "세부 지역 (예: Speyside / 스페이사이드)",
  "founded": "설립 연도 (예: 1836)",
  "owner": "현재 소유 그룹 (영문/한글 병기 가능)",
  "style": "위스키 스타일 한 줄 요약 (영문 위스키 용어 + 한글 자유롭게 혼용)",
  "signature": "시그니처 풍미 노트 (영문/한글 혼용 허용, 예: Sherry-driven, dried fruits / 셰리 중심, 건과일)",
  "flagships": ["대표 제품명 (영문 권장, 예: Glenfarclas 25, Macallan Sherry Oak 18)", "..."],
  "history": "200자 내외의 역사 요약 (영문/한글 혼용 자유)",
  "trivia": "흥미로운 한 가지 사실 (영문/한글 자유)"
}

규칙:
- 영문과 한글을 자유롭게 혼용 가능 (위스키 고유명사·공식 명칭은 영문 그대로 두는 것이 더 정확함)
- 모르는 항목은 null
- 추측하지 말고 확실한 사실만 작성
- JSON 외 다른 텍스트 절대 출력 금지`

const VERIFY_PROMPT = (brand: string, draft: string, snippets: string) => `당신은 위스키 증류소 정보를 검증하는 팩트체커입니다.

대상 증류소: ${brand}

[1차 AI 응답 초안]
${draft}

[Google 검색 결과 발췌 (사실 근거)]
${snippets}

작업:
1. 검색 결과를 사실의 근거로 삼아 1차 초안의 오류를 수정하세요
2. 검색 결과로 확인된 새로운 정보가 있으면 반영하세요
3. 검색 결과에 없고 1차 초안에서도 불확실한 항목은 null로 두세요
4. 자신 있는 정보만 남기고, 추측·환각으로 보이는 내용은 제거하세요

다음 JSON 스키마를 그대로 유지해서 검증된 최종본만 출력하세요 (마크다운/코드블록/설명 없이 JSON만):
{
  "name": "...",
  "country": "...",
  "region": "...",
  "founded": "...",
  "owner": "...",
  "style": "...",
  "signature": "...",
  "flagships": ["..."],
  "history": "...",
  "trivia": "...",
  "sources": ["참고한 검색 결과 도메인 1~3개"]
}

규칙:
- 영문과 한글 자유롭게 혼용 (고유명사는 영문 권장)
- 검색 결과와 모순되는 내용은 반드시 수정 또는 null 처리
- JSON 외 어떤 텍스트도 출력 금지`

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
}

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('name')?.trim()
  const region = req.nextUrl.searchParams.get('region')?.trim() || ''
  if (!brand) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  try {
    // 1단계: Gemini 1차 응답
    const draftRaw = await geminiText(FIRST_PASS_PROMPT(brand, region))
    const draftJson = extractJson(draftRaw)

    // 2단계: Google 검색으로 근거 수집 (Serper 키 있으면)
    let snippets = '(검색 결과 없음 — Serper API 키가 설정되지 않아 1차 AI 응답만 반환합니다)'
    let sourceDomains: string[] = []
    const serperKey = process.env.SERPER_API_KEY
    if (serperKey) {
      try {
        const sRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: `${brand} whisky distillery history founded owner region`,
            gl: 'us',
            num: 6,
          }),
        })
        const sData = await sRes.json() as SerperResponse
        const parts: string[] = []
        if (sData.knowledgeGraph) {
          const kg = sData.knowledgeGraph
          parts.push(`[Knowledge Graph] ${kg.title || ''} — ${kg.type || ''}`)
          if (kg.description) parts.push(`설명: ${kg.description}`)
          if (kg.attributes) {
            for (const [k, v] of Object.entries(kg.attributes)) parts.push(`- ${k}: ${v}`)
          }
        }
        if (sData.organic) {
          for (const r of sData.organic.slice(0, 6)) {
            parts.push(`• ${r.title} (${r.displayLink || ''})\n  ${r.snippet || ''}`)
            if (r.displayLink) sourceDomains.push(r.displayLink)
          }
        }
        if (parts.length) snippets = parts.join('\n')
        sourceDomains = Array.from(new Set(sourceDomains)).slice(0, 5)
      } catch (e) {
        console.warn('[Distillery] Serper 검색 실패:', e)
      }
    }

    // 3단계: 검색 결과로 검증된 최종본 생성 (검색 데이터 있을 때만)
    let finalJson: Record<string, unknown> | null = draftJson
    if (serperKey && snippets && !snippets.startsWith('(검색 결과 없음')) {
      try {
        const verifiedRaw = await geminiText(
          VERIFY_PROMPT(brand, JSON.stringify(draftJson ?? {}, null, 2), snippets)
        )
        const verified = extractJson(verifiedRaw)
        if (verified) finalJson = verified
      } catch (e) {
        console.warn('[Distillery] 검증 단계 실패, 1차 응답 사용:', e)
      }
    }

    if (!finalJson) {
      return NextResponse.json({ error: '증류소 정보 파싱 실패', raw: draftRaw }, { status: 500 })
    }

    // sources 보강 (검증 단계에서 누락된 경우)
    if (!finalJson.sources && sourceDomains.length) {
      finalJson.sources = sourceDomains
    }

    return NextResponse.json({ data: finalJson, verified: !!serperKey })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Distillery info failed'
    console.error('[Distillery] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
