import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 45

/**
 * 비주얼 검색 프록시.
 * ML_SERVICE_URL (YOLOv8·PaddleOCR·OpenCLIP·FAISS) 가 설정돼 있으면 그쪽으로 이미지 전달,
 * 미설정/실패 시 { fallback: true } 를 반환해 클라이언트가 기존 /api/ocr 로 폴백하게 한다.
 */
export interface VisualMatch {
  name: string
  source: string
  ref_id?: string
  brand?: string
  region?: string
  bottler?: string
  link?: string
  image_url?: string
  similarity: number
}

export interface VisualSearchResult {
  engine: 'ml' | 'fallback'
  detected?: boolean
  ocr_text?: string
  ocr_lines?: string[]
  matches?: VisualMatch[]
  fallback?: boolean
  reason?: string
}

export async function POST(req: NextRequest) {
  const base = process.env.ML_SERVICE_URL?.replace(/\/$/, '')
  if (!base) {
    return NextResponse.json<VisualSearchResult>({
      engine: 'fallback', fallback: true, reason: 'ML_SERVICE_URL 미설정',
    })
  }

  try {
    const inForm = await req.formData()
    const file = inForm.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'image required' }, { status: 400 })

    const outForm = new FormData()
    outForm.append('image', file, (file as File).name || 'label.jpg')

    const res = await fetch(`${base}/analyze?k=5`, {
      method: 'POST',
      body: outForm,
      headers: process.env.ML_SERVICE_TOKEN ? { 'X-Index-Token': process.env.ML_SERVICE_TOKEN } : undefined,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      return NextResponse.json<VisualSearchResult>({
        engine: 'fallback', fallback: true, reason: `ML 서비스 ${res.status}`,
      })
    }
    const data = await res.json() as {
      detected?: boolean
      ocr_text?: string
      ocr_lines?: string[]
      matches?: VisualMatch[]
    }
    return NextResponse.json<VisualSearchResult>({
      engine: 'ml',
      detected: data.detected,
      ocr_text: data.ocr_text,
      ocr_lines: data.ocr_lines,
      matches: data.matches || [],
    })
  } catch (e: unknown) {
    return NextResponse.json<VisualSearchResult>({
      engine: 'fallback', fallback: true,
      reason: e instanceof Error ? e.message : 'ML 서비스 호출 실패',
    })
  }
}
