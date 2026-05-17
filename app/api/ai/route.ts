import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/groq'

type Payload = Record<string, string | number | string[] | undefined | null>

// 점수를 /10 스케일로 정규화 (입력이 /100이든 /10이든 처리)
function normalizeScore(score: unknown): number {
  const n = typeof score === 'number' ? score : parseFloat(String(score ?? 7))
  if (isNaN(n)) return 7
  return n > 10 ? n / 10 : n
}

// 점수 + 사용자 코멘트에 따른 톤 가이드 블록
function buildToneBlock(score10: number, userComment: string): string {
  const low = score10 <= 7.0
  const veryLow = score10 <= 5.0
  const trimmedComment = (userComment || '').trim()
  const hasComment = trimmedComment.length > 0

  if (veryLow) {
    return `
[톤 지시 — 매우 중요]
이 위스키의 점수는 ★ ${score10.toFixed(1)}/10 (낮은 평가)입니다.
- 절대 과장된 칭찬·감탄·시적 미화 금지
- 솔직하고 담백하게, 부족한 점·아쉬운 점·실망스러운 부분을 있는 그대로 표현
- "기대 이하", "선뜻 권하기 어려운", "특정 취향에만 맞는" 등 정직한 표현 사용
- 작성자가 다시 사지 않을 만큼 별로였다는 뉘앙스 유지
${hasComment ? `- 작성자 코멘트의 감정과 어조를 그대로 따라가기: "${trimmedComment}"` : ''}`
  }

  if (low) {
    return `
[톤 지시 — 중요]
이 위스키의 점수는 ★ ${score10.toFixed(1)}/10 (평범~다소 아쉬움)입니다.
- 인플루언서식 감탄·과장 표현 절대 사용 금지 ("환상적", "최고의", "역대급" 등 금지)
- 좋은 점과 아쉬운 점을 균형 있게 — 솔직한 리뷰 톤
- 작성자가 느낀 그대로의 감정을 표현 (애매함, 그저 그럼, 평범함도 포함)
- 칭찬보다는 묘사·관찰 위주로
${hasComment ? `- 반드시 작성자 코멘트의 어조와 감정을 살려서 작성: "${trimmedComment}"` : ''}`
  }

  return `
[톤 지시]
이 위스키의 점수는 ★ ${score10.toFixed(1)}/10 (좋은 평가)입니다.
- 감성적이고 전문적인 어조로 매력 부각
${hasComment ? `- 작성자 코멘트의 어조와 감정을 살리기: "${trimmedComment}"` : ''}`
}

// Bottle Research 참고 노트가 있으면 작성자 노트와 비교하도록 안내
function buildCompareBlock(p: Payload): string {
  const rn = String(p.refNose ?? '').trim()
  const rp = String(p.refPalate ?? '').trim()
  const rf = String(p.refFinish ?? '').trim()
  const src = String(p.refSource ?? '전문가/AI 분석').trim()
  if (!rn && !rp && !rf) return ''
  return `

[참고 노트 — ${src}]
- 향: ${rn || '—'}
- 맛: ${rp || '—'}
- 여운: ${rf || '—'}

비교 지시:
- 위 참고 노트는 ${src}의 평가입니다. 작성자의 향/맛/여운과 자연스럽게 비교하세요.
- 작성자 인상이 참고와 일치하면 "공통적으로 ~", 다르면 "전문 평가와 달리 나는 ~" 식으로 한 문장 정도 비교를 본문에 녹이세요.
- 참고 노트를 그대로 베끼지 말고, 작성자 관점을 중심으로 대조만 하세요.`
}

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
      return `당신은 20년 경력의 위스키 마스터 블렌더이자 테이스팅 노트 전문 작가입니다.
아래 위스키의 ${fk} 메모를 감각적이고 풍부한 한국어 문장으로 확장해주세요.

위스키 정보:
- 증류소: ${brand}
- 숙성: ${age} / 캐스크: ${caskStr}
- 도수: ${abv} / 지역: ${region}

원본 메모: "${raw}"

작성 기준:
- 원본의 핵심 풍미를 반드시 살리되, 더 구체적이고 시적인 표현으로 확장
- 후각/미각/촉각적 묘사를 조화롭게 사용
- 전문 위스키 용어와 감성적 비유를 자연스럽게 혼합
- 250~350자 분량
- 반드시 순수한 한국어로만 작성 (영어 단어, 로마자, 외래어 표기 절대 금지 — 예: Sherry → 셰리, Bourbon → 버번, Cask → 캐스크)
- 마크다운 없이 본문 텍스트만 출력`
    }

    case 'compress_note': {
      const { field, raw } = payload
      const fieldNames: Record<string, string> = { nose: '향', palate: '맛', finish: '피니시' }
      const fk = fieldNames[field as string] ?? String(field ?? '')
      return `위스키 테이스팅 전문가로서, 아래 ${fk} 노트에서 가장 핵심적인 풍미 키워드를 추출해주세요.

원본 노트: "${raw}"

추출 기준:
- 가장 두드러지는 향·맛·질감 특성 중심
- 중복 표현 제거, 정확한 단어 선택
- 쉼표로 구분된 한국어 키워드 6~10개
- 모두 한국어로 작성 (영어·로마자 절대 금지)
- 키워드만 출력 (설명 없이)`
    }

    case 'extract_keys': {
      const { longText, brand, age, abv, casks } = payload
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      return `당신은 위스키 테이스팅 전문가입니다. 아래 시음 코멘트를 분석하여 향(Nose), 맛(Palate), 여운(Finish) 각 영역의 핵심 키워드를 추출해주세요.

위스키 정보: ${brand} ${age} / ${abv} / ${caskStr}

시음 코멘트:
"${longText}"

반드시 아래 JSON 형식으로만 응답하세요 (마크다운, 코드블록 없이 순수 JSON):
{"nose":["키워드1","키워드2","키워드3","키워드4"],"palate":["키워드1","키워드2","키워드3","키워드4"],"finish":["키워드1","키워드2","키워드3"]}

규칙:
- nose: 향기, 아로마 관련 키워드 3~5개
- palate: 맛, 질감 관련 키워드 3~5개
- finish: 여운, 끝맛 관련 키워드 2~4개
- 모든 키워드는 한국어로 작성 (영어·로마자 절대 금지)
- JSON 외 다른 텍스트 절대 출력 금지`
    }

    case 'gen_insta_from_keys': {
      const { selectedNose, selectedPalate, selectedFinish, longText, brand, age, abv, casks, region, score } = payload
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      const score10 = normalizeScore(score)
      const userComment = String(longText || '')
      const tone = buildToneBlock(score10, userComment)
      return `당신은 위스키 전문 인플루언서로 솔직하고 전문적인 인스타그램 콘텐츠를 제작합니다.
아래 테이스팅 정보와 점수, 작성자 코멘트를 바탕으로 인스타그램 캡션을 작성해주세요.

위스키 정보:
- 증류소: ${brand} ${age}
- 지역: ${region} / 도수: ${abv} / 캐스크: ${caskStr}
- 종합 점수: ★ ${score10.toFixed(1)} / 10.0

테이스팅 키워드:
- 향: ${selectedNose || '—'}
- 맛: ${selectedPalate || '—'}
- 여운: ${selectedFinish || '—'}

작성자 시음 코멘트: "${userComment || '(없음)'}"
${tone}${buildCompareBlock(payload)}

캡션 구성 (이 순서와 구조를 반드시 지킬 것):
1. 훅 문장: 이 위스키를 한 문장으로 압축한 한 줄평 (위 톤 가이드에 따라)

2. 테이스팅 노트 섹션 — 아래 형식으로 각 항목을 줄바꿈하여 작성:
🌸 향 | (향 키워드를 녹인 1~2문장 묘사)
🥃 맛 | (맛 키워드를 녹인 1~2문장 묘사)
✨ 여운 | (여운 키워드를 녹인 1문장 묘사)

3. 작성자 코멘트 반영 — 한 문장으로 정리 (코멘트가 부정적이면 부정적으로, 긍정적이면 긍정적으로)

4. 총점: ★ ${score10.toFixed(1)} / 10.0

5. 해시태그: 7~10개

작성 기준:
- 전체 500자 내외, 순수한 한국어
- 영어 단어·로마자 절대 사용 금지 (Nose → 향, Palate → 맛, Finish → 여운, Cask → 캐스크 등)
- 이모지 4~6개를 자연스럽게 배치
- 캡션 본문만 출력 (제목·설명 없이)`
    }

    case 'gen_blog_post': {
      const { brand, age, vintage, abv, casks, region, color, score, nose, palate, finish, comment } = payload
      const caskStr = Array.isArray(casks) ? casks.join(' + ') : String(casks ?? '')
      const score10 = normalizeScore(score)
      const userComment = String(comment || '')
      const tone = buildToneBlock(score10, userComment)
      const vintageStr = vintage ? `빈티지 ${vintage}` : null
      const info = [brand, age, vintageStr, abv, caskStr, region].filter(Boolean).join(' / ')

      const overallGuide = score10 <= 7
        ? `이 위스키가 어울리는 (혹은 추천하기 어려운) 사람과 상황, 총점(★ ${score10.toFixed(1)} / 10.0)과 함께 솔직한 평가 이유. 작성자 코멘트의 어조를 반영. 3~4문장.`
        : `이 위스키가 어울리는 사람과 상황, 총점(★ ${score10.toFixed(1)} / 10.0)과 함께 추천 이유. 3~4문장.`

      return `당신은 국내 최고의 위스키 전문 블로거입니다. 아래 테이스팅 정보를 바탕으로 독자가 실제로 이 위스키를 경험하는 듯한 생동감 있는 블로그 포스트를 작성해주세요.

위스키 정보: ${info}
색상: ${color} / 종합 점수: ${score10.toFixed(1)} / 10.0

테이스팅 노트:
- 향: ${nose || '기록 없음'}
- 맛: ${palate || '기록 없음'}
- 여운: ${finish || '기록 없음'}

작성자 시음 코멘트: "${userComment || '(없음)'}"
${tone}${buildCompareBlock(payload)}

블로그 포스트 구성 (아래 섹션 이름을 그대로 사용하고 각 섹션 사이에 빈 줄 추가):

[도입부]
이 위스키와의 첫 만남 또는 인상. 3~4문장. 위 톤 가이드에 따라 작성.

[외관]
잔에 담긴 색상과 점도를 감각적으로 묘사. 2~3문장.

[향]
첫 잔을 들었을 때 퍼지는 향의 레이어를 순서대로 묘사. 구체적인 비유 포함. 4~5문장.

[맛]
입 안에서 전개되는 맛의 변화와 질감. 음식 페어링 힌트 포함. 4~5문장.

[여운]
마신 후 남는 여운의 길이와 특성. 3~4문장.

[작성자 코멘트]
${userComment ? `작성자 본인의 시음 코멘트를 그대로 인용 + 1~2문장으로 살을 붙여 정리: "${userComment}"` : '(코멘트 없음 — 이 섹션 생략)'}

[총평]
${overallGuide}

[해시태그]
관련 해시태그 8~10개

작성 기준:
- 전체 1,000~1,200자 분량
- 반드시 순수한 한국어로만 작성 (영어 단어·로마자 절대 금지 — Nose → 향, Palate → 맛, Finish → 여운, Cask → 캐스크, Color → 색상, Overall → 총평)
- 마크다운 헤더(#) 없이 섹션 이름을 대괄호로 표기 ([향] 등)
- 본문만 출력`
    }

    case 'gen_insta_post': {
      const { brand, age, vintage, abv, casks, region, score, nose, palate, finish, comment_insta, comment } = payload
      const caskStr = Array.isArray(casks) ? casks.join(' + ') : String(casks ?? '')
      const score10 = normalizeScore(score)
      const vintageStr = vintage ? `빈티지 ${vintage}` : null
      const info = [brand, age, vintageStr, abv, caskStr, region].filter(Boolean).join(' / ')
      const userComment = String(comment_insta ?? comment ?? '')
      const tone = buildToneBlock(score10, userComment)

      const verdictGuide = score10 <= 7
        ? '이 위스키를 한마디로 표현한 솔직한 평가 1~2문장. 작성자 코멘트가 부정적이면 그 어조 그대로 (과장 칭찬 금지).'
        : '이 위스키를 한마디로 표현한 종합 소감 1~2문장.'

      return `당신은 팔로워 10만의 위스키 전문 인플루언서입니다. 아래 정보로 인스타그램 캡션을 작성해주세요.

위스키: ${info}
점수: ★ ${score10.toFixed(1)} / 10.0

테이스팅 노트:
- 향: ${nose || '—'}
- 맛: ${palate || '—'}
- 여운: ${finish || '—'}

작성자 시음 코멘트: "${userComment || '(없음)'}"
${tone}${buildCompareBlock(payload)}

캡션 구성 (이 순서와 형식을 반드시 지킬 것):

1. 훅 문장
첫 한 줄. 위 톤 가이드에 따라 작성 (낮은 점수면 솔직·담백, 높은 점수면 강렬).

2. 테이스팅 노트 섹션 (각 항목을 줄바꿈으로 구분)
🌸 향 | (향 노트를 바탕으로 한 1~2문장)
🥃 맛 | (맛 노트를 바탕으로 한 1~2문장)
✨ 여운 | (여운 노트를 바탕으로 한 1문장)
📝 총평 | ${verdictGuide}

3. 작성자 한 줄 코멘트 ${userComment ? '(반드시 포함 — 위 코멘트를 인용하거나 그 어조를 살려 정리)' : '(코멘트 없음 — 이 섹션 생략)'}
💬 ${userComment ? '(작성자 코멘트의 핵심을 1문장으로)' : ''}

4. 위스키 정보 (읽기 쉽게 줄바꿈 정리)
📌 ${brand} ${age}
지역: ${region} | 도수: ${abv} | 캐스크: ${caskStr}
점수: ★ ${score10.toFixed(1)} / 10.0

5. 참여 유도 문장 (CTA) — 1문장

6. 해시태그: 8~12개

작성 기준:
- 전체 600자 내외
- 반드시 순수한 한국어 (영어 단어·로마자 금지 — Nose → 향, Palate → 맛, Finish → 여운, Cask → 캐스크, Overall → 총평)
- 진짜 사람이 쓴 듯 자연스러운 구어체
- 이모지 5~7개를 자연스럽게 배치
- 본문만 출력 (제목·설명 없이)`
    }

    case 'gen_search_query': {
      const { brand, age, vintage, abv, cask, bottler, region } = payload
      const info = [
        brand && `증류소: ${brand}`,
        age && `숙성: ${age}`,
        vintage && `빈티지: ${vintage}`,
        abv && `도수: ${abv}`,
        cask && `캐스크: ${cask}`,
        bottler && `보틀러: ${bottler}`,
        region && `지역: ${region}`,
      ].filter(Boolean).join(' / ')
      return `You are a whisky search expert. Given the following bottle info, craft a SHORT precise English Google search query (6-12 words) to find this exact bottle or very similar bottles — useful for finding retail listings, reviews, and prices.

Bottle info:
${info}

Rules:
- Output ONLY the search query, no quotes, no explanation, no prefix
- Use English whisky terms (single malt, sherry cask, cask strength, etc.)
- Include distillery, age or vintage, and the most distinctive attribute (cask finish, bottler, ABV)
- Do NOT include the word "price" or "buy" — the search engine will surface listings anyway
- If the bottler is an independent bottler (not OB), include the bottler name
- Maximum 12 words`
    }

    case 'distillery_info': {
      const { brand, region } = payload
      return `당신은 위스키 증류소 전문가입니다. 아래 증류소에 대한 핵심 정보를 한국어로 정리해주세요.

증류소: ${brand}
${region ? `지역: ${region}` : ''}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운, 코드블록 없이 순수 JSON):
{
  "name": "증류소 공식 한글 이름 (원어 병기 가능)",
  "country": "국가",
  "region": "세부 지역",
  "founded": "설립 연도 (예: 1824년)",
  "owner": "현재 소유 그룹",
  "style": "위스키 스타일 한 줄 요약 (예: 셰리 캐스크 중심의 풍부하고 묵직한 하이랜드 몰트)",
  "signature": "시그니처 표현 핵심 노트 (예: 건포도, 다크 초콜릿, 가죽)",
  "flagships": ["대표 제품1", "대표 제품2", "대표 제품3"],
  "history": "150자 내외의 간결한 역사 요약",
  "trivia": "팬이라면 알면 좋을 흥미로운 한 가지 사실 (80자 내외)"
}

규칙:
- 모든 내용은 순수한 한국어 (한자·일본어·로마자 단독 사용 금지, 고유명사만 원어 병기 허용)
- 모르는 항목은 null
- JSON 외 다른 텍스트 절대 출력 금지`
    }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.' }, { status: 500 })
  }
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
