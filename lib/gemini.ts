import { GoogleGenerativeAI } from '@google/generative-ai'

// 503 대비: 주 모델 → 폴백 체인 (lite가 보통 더 여유로움)
const VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
const PRIMARY_MODEL = VISION_MODELS[0]

function getClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.')
  return new GoogleGenerativeAI(key)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 503 / 429 같은 재시도 가능 에러 판별
function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /503|502|504|overload|UNAVAILABLE|high demand|rate limit|429|Quota/i.test(msg)
}

async function callModel(
  modelId: string,
  prompt: string,
  imageBase64: string,
  mimeType: string,
  withImage: boolean,
): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: modelId,
    generationConfig: withImage
      ? { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' }
      : { temperature: 0.7, maxOutputTokens: 2048 },
  })

  const parts = withImage
    ? [{ text: prompt }, { inlineData: { data: imageBase64, mimeType } }]
    : [{ text: prompt }]

  const res = await model.generateContent(parts)
  return res.response.text().trim()
}

export async function generateText(prompt: string): Promise<string> {
  return callModel(PRIMARY_MODEL, prompt, '', '', false)
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  let lastErr: unknown = null

  for (const modelId of VISION_MODELS) {
    // 각 모델마다 최대 3회 재시도 (지수 백오프)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await callModel(modelId, prompt, imageBase64, mimeType, true)
      } catch (err: unknown) {
        lastErr = err
        if (!isRetryable(err)) {
          // 인증/형식 오류 등은 바로 실패 처리
          throw err
        }
        // 재시도 가능 에러면 backoff 후 재시도
        const delay = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 300)
        console.warn(`Gemini ${modelId} 503/429 (attempt ${attempt + 1}), retrying in ${delay}ms`)
        await sleep(delay)
      }
    }
    // 이 모델로는 실패 → 다음 모델로 넘어감
    console.warn(`Gemini ${modelId} 모든 재시도 실패, 다음 모델로 폴백`)
  }

  throw lastErr instanceof Error ? lastErr : new Error('Gemini 모든 모델 호출 실패')
}
