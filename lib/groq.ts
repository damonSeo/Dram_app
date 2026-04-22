import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

// 한국어 특화 모델 — 한자 혼입 없음, Gemini급 품질
const TEXT_MODEL = 'qwen/qwen3-32b'
// 이미지 인식 전용 (OCR) — maverick: Scout보다 정확도 높음
const VISION_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'

// 한국어 전용 시스템 프롬프트 — 모든 텍스트 생성에 적용
const SYSTEM_KO = `당신은 한국어 전문 위스키 작가입니다.
반드시 순수한 한국어(한글)로만 답변하세요.
절대 금지 사항:
- 중국어 한자(汉字/漢字) 사용
- 일본어 가나(ひらがな/カタカナ) 사용
- 한자 혼용
- 로마자 영어 단어 단독 사용 (위스키 용어는 한국어 표기: Sherry→셰리, Bourbon→버번, Cask→캐스크, Nose→향, Palate→맛, Finish→여운)
출력은 오직 순수 한글과 숫자, 이모지, 한국식 문장부호만 사용하세요.`

// Qwen3 추론 태그 제거 (<think>...</think>)
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export async function generateText(prompt: string): Promise<string> {
  const res = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_KO },
      { role: 'user', content: prompt },
    ],
    temperature: 0.75,
    max_tokens: 3000,
  })
  const raw = res.choices[0]?.message?.content?.trim() ?? ''
  return stripThink(raw)
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const res = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  })
  return res.choices[0]?.message?.content?.trim() ?? ''
}
