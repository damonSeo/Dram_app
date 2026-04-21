import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/groq'

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
      return `당신은 20년 경력의 위스키 마스터 블렌더이자 테이스팅 노트 전문 작가입니다.
아래 위스키의 ${fk} 메모를 감각적이고 풍부한 문장으로 확장해주세요.

위스키 정보:
- 증류소: ${brand}
- 숙성: ${age} / 캐스크: ${caskStr}
- 도수: ${abv} / 지역: ${region}

원본 메모: "${raw}"

작성 기준:
- 원본의 핵심 풍미를 반드시 살리되, 더 구체적이고 시적인 표현으로 확장
- 후각/미각/촉각적 묘사를 조화롭게 사용
- 전문 위스키 용어와 감성적 비유를 자연스럽게 혼합
- 250~350자 분량의 유려한 한국어 문장
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
- 키워드만 출력 (설명 없이)`
    }

    case 'extract_keys': {
      const { longText, brand, age, abv, casks } = payload
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      return `당신은 위스키 테이스팅 전문가입니다. 아래 시음 코멘트를 분석하여 Nose(향), Palate(맛), Finish(여운) 각 영역의 핵심 키워드를 추출해주세요.

위스키 정보: ${brand} ${age} / ${abv} / ${caskStr}

시음 코멘트:
"${longText}"

반드시 아래 JSON 형식으로만 응답하세요 (마크다운, 코드블록 없이 순수 JSON):
{"nose":["키워드1","키워드2","키워드3","키워드4"],"palate":["키워드1","키워드2","키워드3","키워드4"],"finish":["키워드1","키워드2","키워드3"]}

규칙:
- nose: 향기, 아로마 관련 키워드 3~5개
- palate: 맛, 질감 관련 키워드 3~5개
- finish: 여운, 끝맛 관련 키워드 2~4개
- 모두 한국어로 작성
- JSON 외 다른 텍스트 절대 출력 금지`
    }

    case 'gen_insta_from_keys': {
      const { selectedNose, selectedPalate, selectedFinish, longText, brand, age, abv, casks, region, score } = payload
      const caskStr = Array.isArray(casks) ? casks.join(', ') : String(casks ?? '')
      const scoreNum = typeof score === 'number' ? score : parseFloat(String(score ?? 4))
      return `당신은 위스키 전문 인플루언서로 감성적이고 전문적인 Instagram 콘텐츠를 제작합니다.
아래 테이스팅 정보를 바탕으로 매력적인 Instagram 캡션을 작성해주세요.

위스키 정보:
- 증류소: ${brand} ${age}
- 지역: ${region} / 도수: ${abv} / 캐스크: ${caskStr}
- 종합 점수: ★ ${scoreNum.toFixed(1)} / 5.0

테이스팅 키워드:
- 향(Nose): ${selectedNose || '—'}
- 맛(Palate): ${selectedPalate || '—'}
- 여운(Finish): ${selectedFinish || '—'}

시음 코멘트 (참고): "${longText}"

캡션 작성 규칙:
1. 첫 줄: 이 위스키를 한 문장으로 압축한 강렬한 한 줄평 (독자가 멈추게 만드는 문장)
2. 둘째 단락: 향과 맛 키워드를 녹인 감성적 묘사 (3~4문장, 직접 경험하는 듯한 현장감)
3. 셋째 단락: 어울리는 순간/페어링 추천 또는 총평 (2문장)
4. 점수: ★ ${scoreNum.toFixed(1)} / 5.0
5. 이모지: 3~5개를 자연스럽게 배치
6. 마지막 줄: 관련 해시태그 7~10개
7. 전체 450자 내외, 한국어
8. 캡션 본문만 출력 (제목, 설명 없이)`
    }

    case 'gen_blog_post': {
      const { brand, age, vintage, abv, casks, region, color, score, nose, palate, finish, comment } = payload
      const caskStr = Array.isArray(casks) ? casks.join(' + ') : String(casks ?? '')
      const scoreNum = typeof score === 'number' ? score : parseFloat(String(score ?? 4))
      const info = [
        brand, age,
        vintage ? `Vintage ${vintage}` : null,
        abv, caskStr, region,
      ].filter(Boolean).join(' / ')
      return `당신은 국내 최고의 위스키 전문 블로거입니다. 아래 테이스팅 정보를 바탕으로 독자가 실제로 이 위스키를 경험하는 듯한 생동감 있는 블로그 포스트를 작성해주세요.

위스키 정보: ${info}
컬러: ${color} / 종합 점수: ${scoreNum.toFixed(1)} / 5.0

테이스팅 노트:
- Nose(향): ${nose || '기록 없음'}
- Palate(맛): ${palate || '기록 없음'}
- Finish(여운): ${finish || '기록 없음'}
- 총평: ${comment || '기록 없음'}

블로그 포스트 구성:
[도입부] 이 위스키와의 첫 만남, 또는 이 위스키가 가진 독특한 매력을 소개하는 감성적인 오프닝 (3~4문장)

[외관 & 컬러] 잔에 담긴 색상과 점도 묘사 (2~3문장)

[Nose — 향] 첫 잔을 들었을 때 퍼지는 향의 레이어를 순서대로 묘사. 구체적인 비유 포함 (4~5문장)

[Palate — 맛] 입 안에서 전개되는 맛의 변화와 질감. 음식 페어링 힌트 포함 (4~5문장)

[Finish — 여운] 마신 후 남는 여운의 길이와 특성 (3~4문장)

[총평 & 추천] 이 위스키가 어울리는 사람과 상황, 총점과 함께 추천 이유 (3~4문장)

[해시태그] 관련 해시태그 8~10개

작성 기준:
- 전체 1,000~1,200자 분량
- 전문성과 감성을 균형 있게
- 각 섹션은 줄바꿈으로 구분
- 마크다운 헤더(#) 없이 섹션 이름을 볼드 없이 일반 텍스트로
- 본문만 출력`
    }

    case 'gen_insta_post': {
      const { brand, age, vintage, abv, casks, region, score, nose, palate, finish, comment_insta, comment } = payload
      const caskStr = Array.isArray(casks) ? casks.join(' + ') : String(casks ?? '')
      const scoreNum = typeof score === 'number' ? score : parseFloat(String(score ?? 4))
      const info = [
        brand, age,
        vintage ? `Vintage ${vintage}` : null,
        abv, caskStr, region,
      ].filter(Boolean).join(' / ')
      const userComment = String(comment_insta ?? comment ?? '')
      return `당신은 팔로워 10만의 위스키 전문 인플루언서입니다. 아래 정보로 Instagram에서 높은 참여율을 이끌어낼 캡션을 작성해주세요.

위스키: ${info}
점수: ★ ${scoreNum.toFixed(1)} / 5.0

테이스팅 노트:
- Nose: ${nose || '—'}
- Palate: ${palate || '—'}
- Finish: ${finish || '—'}
${userComment ? `- 한줄평: ${userComment}` : ''}

캡션 구성:
1. 훅 문장: 스크롤을 멈추게 하는 강렬한 첫 문장 (위스키의 가장 인상적인 특징)
2. 스토리: 이 위스키가 주는 감각적 경험을 생생하게 묘사 (3~4문장, 이모지 자연스럽게 삽입)
3. 위스키 스펙: 핵심 정보를 읽기 쉽게 정리
4. 점수: ★ ${scoreNum.toFixed(1)} / 5.0
5. CTA: 팔로워 참여 유도 문장 ("여러분의 최애 위스키는?" 류)
6. 해시태그: 8~12개 (위스키 관련 인기 태그 포함)

작성 기준:
- 전체 500자 내외
- 한국어 (위스키 용어는 영어 병기 가능)
- 진짜 사람이 쓴 듯 자연스러운 구어체
- 본문만 출력`
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
