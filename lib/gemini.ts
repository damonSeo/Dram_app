import { GoogleGenerativeAI } from '@google/generative-ai'

// gemini-2.0-flash: OCR 정확도가 Llama 4 Scout 대비 압도적으로 높음
const VISION_MODEL = 'gemini-2.0-flash'

function getClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.')
  return new GoogleGenerativeAI(key)
}

export async function generateText(prompt: string): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({ model: VISION_MODEL })
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: VISION_MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  })
  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    },
  }
  const result = await model.generateContent([prompt, imagePart])
  return result.response.text().trim()
}
