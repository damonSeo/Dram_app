import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateWithImage as groqVision } from '@/lib/groq'

// 폴백 체인 — lite를 먼저 시도 (주 모델보다 여유 있음)
// 마지막 수단으로 Groq Llama Scout까지 쓰면 최소한 결과는 나옴
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']

function getClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.')
  return new GoogleGenerativeAI(key)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /503|502|504|overload|UNAVAILABLE|high demand|rate limit|429|Quota|ECONNRESET|ETIMEDOUT/i.test(msg)
}

async function callGemini(
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
      ? { temperature: 0.1, maxOutputTokens: 1536, responseMimeType: 'application/json' }
      : { temperature: 0.7, maxOutputTokens: 2048 },
  })

  const parts = withImage
    ? [{ text: prompt }, { inlineData: { data: imageBase64, mimeType } }]
    : [{ text: prompt }]

  const res = await model.generateContent(parts)
  return res.response.text().trim()
}

export async function generateText(prompt: string): Promise<string> {
  // 주 모델 → lite 폴백
  for (const modelId of [GEMINI_MODELS[1], GEMINI_MODELS[0]]) {
    try {
      return await callGemini(modelId, prompt, '', '', false)
    } catch (err) {
      if (!isRetryable(err)) throw err
    }
  }
  throw new Error('Gemini 모든 모델 호출 실패')
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  // 라벨 스캔처럼 정확도가 중요한 작업은 강한 모델을 먼저 사용
  preferStrong = true,
): Promise<string> {
  let lastErr: unknown = null

  // 비전 정확도 우선: gemini-2.5-flash(강) → flash-lite → 2.0-flash
  // (기존엔 flash-lite가 먼저라 라벨 인식률이 낮았음)
  const modelChain = preferStrong
    ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
    : GEMINI_MODELS

  // 1단계: Gemini 모델 체인 (각 모델 2회 재시도)
  for (const modelId of modelChain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callGemini(modelId, prompt, imageBase64, mimeType, true)
        if (modelId !== modelChain[0]) {
          console.log(`[OCR] ${modelId} 성공 (폴백)`)
        }
        return text
      } catch (err: unknown) {
        lastErr = err
        if (!isRetryable(err)) throw err
        const delay = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 200)
        console.warn(`[OCR] Gemini ${modelId} 503/429 (시도 ${attempt + 1}/2), ${delay}ms 대기 후 재시도`)
        await sleep(delay)
      }
    }
    console.warn(`[OCR] Gemini ${modelId} 폴백 → 다음 모델`)
  }

  // 2단계: 최후의 수단 — Groq Llama 4 Scout로 폴백
  console.warn('[OCR] 모든 Gemini 모델 실패, Groq Llama Scout로 폴백')
  try {
    const text = await groqVision(prompt, imageBase64, mimeType)
    console.log('[OCR] Groq Llama Scout 성공 (최종 폴백)')
    return text
  } catch (err) {
    console.error('[OCR] Groq 폴백도 실패:', err)
    throw lastErr instanceof Error ? lastErr : new Error('모든 OCR 모델 호출 실패')
  }
}
