import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'

type Payload = Record<string, string | number | string[] | undefined | null>

function buildPrompt(action: string, payload: Payload): string {
  switch (action) {
    case 'expand_note': {
      const { field, raw, brand, age, abv, casks, region } = payload
      const fieldNames: Record<string, string> = {
        nose: '향(Nose)',
        palate: '맛(Palate)',
        finish: '피니시(Finish)',
      }
      const fk = fieldNames[field as string] ?? String(field ?? '')
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      return `위스키 테이스팅 전문가. 아래 ${fk} 메모를 감각적으로 확장하세요.
위스키: ${brand} ${age} / ${abv} / ${caskStr} / ${region}
원본: "${raw}"
지시: 원본 핵심 유지, 전문 용어+시적 묘사, 150~220자 한국어, 서술체, 내용만.`
    }
    case 'compress_note': {
      const { field, raw } = payload
      const fieldNames: Record<string, string> = { nose: '향', palate: '맛', finish: '피니시' }
      const fk = fieldNames[field as string] ?? String(field ?? '')
      return `위스키 ${fk} 노트에서 핵심 키워드만 추출해 간결하게 나열하세요.
원본: "${raw}"
형식: 쉼표로 구분된 키워드 5~8개. 한국어. 앞뒤 설명 없이 키워드만.`
    }
    case 'extract_keys': {
      const { longText, brand, age, abv, casks } = payload
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      return `위스키 테이스팅 전문가. 아래 시음 코멘트에서 Nose(향), Palate(맛), Finish(여운)에 해당하는 핵심 키워드를 각각 추출하세요.

코멘트: "${longText}"
위스키 정보 (참고): ${brand} ${age} / ${abv} / ${caskStr}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{"nose":["키워드1","키워드2","키워드3"],"palate":["키워드1","키워드2","키워드3"],"finish":["키워드1","키워드2"]}

규칙: 각 섹션 2~4개 키워드, 한국어, JSON만 출력`
    }
    case 'gen_insta_from_keys': {
      const { selectedNose, selectedPalate, selectedFinish, longText, brand, age, abv, casks, region, score } = payload
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      const scoreNum = typeof score === 'number' ? score : parseFloat(String(score ?? 4))
      return `위스키 인스타그램 전문가. 아래 키워드와 원본 코멘트를 바탕으로 Instagram 캡션을 작성하세요.
위스키 정보: ${brand} ${age} / ${abv} / ${caskStr} / ${region} / Score ★${scoreNum.toFixed(1)}/5.0
선택된 키워드:
- Nose(향): ${selectedNose || '—'}
- Palate(맛): ${selectedPalate || '—'}
- Finish(여운): ${selectedFinish || '—'}
원본 코멘트 (참고): "${longText}"
작성 규칙:
1. 첫 문장: 기억에 남을 한 줄평
2. 위 키워드를 자연스럽게 녹인 2~3문장
3. 스코어: ★ ${scoreNum.toFixed(1)} / 5.0
4. 이모지 2~4개
5. 마지막 줄: 해시태그 정확히 5개
6. 전체 300자 이내, 한국어, 내용만 출력`
    }
    case 'gen_blog_post': {
      const { brand, age, vintage, abv, casks, region, color, score, nose, palate, finish, comment } = payload
      const caskStr = Array.isArray(casks) ? casks.join(' + ') : String(casks ?? '')
      const scoreNum = typeof score === 'number' ? score : parseFloat(String(score ?? 4))
      const info = [
        brand, age, vintage ? `Vintage ${vintage}` : null,
        abv, caskStr, region, `Color: ${color}`, `Score: ${scoreNum.toFixed(1)}/5.0`,
      ].filter(Boolean).join(' / ')
      return `위스키 전문 블로거. 아래 정보로 블로그 포스트 작성.
위스키 정보: ${info}
Nose: ${nose || '—'} / Palate: ${palate || '—'} / Finish: ${finish || '—'}
Comment: ${comment || '—'}
형식: 감성적 도입부 (2~3문장) → Color / Nose / Palate / Finish 섹션 → 총평 + 추천 → 해시태그 5개
분량: 500~600자, 한국어, 일반 텍스트`
    }
    case 'gen_insta_post': {
      const { brand, age, vintage, abv, casks, region, score, nose, palate, finish, comment_insta, comment } = payload
      const caskStr = Array.isArray(casks) ? casks.join(' + ') : String(casks ?? '')
      const scoreNum = typeof score === 'number' ? score : parseFloat(String(score ?? 4))
      const info = [
        brand, age, vintage ? `Vintage ${vintage}` : null,
        abv, caskStr, region, `Score: ★${scoreNum.toFixed(1)}/5.0`,
      ].filter(Boolean).join(' / ')
      return `위스키 인스타그램 전문가. 아래 정보로 Instagram 캡션 작성.
위스키 정보: ${info}
Nose: ${nose || '—'} / Palate: ${palate || '—'} / Finish: ${finish || '—'}
Comment: ${String(comment_insta ?? comment ?? '—')}
형식: 기본 정보 포함 / 첫 줄: 임팩트 한 줄평 / 핵심 향·맛 2~3가지 / 스코어 ★ X.X / 5.0 / 이모지 3~5개 / 해시태그 정확히 5개 / 총 300자 이내 / 한국어`
    }
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { action: string; payload: Payload }
    const { action, payload } = body
    const prompt = buildPrompt(action, payload)
    const text = await generateText(prompt)
    return NextResponse.json({ text })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI failed'
    console.error('AI error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
