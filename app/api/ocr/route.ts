import { NextRequest, NextResponse } from 'next/server'
import { generateWithImage } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const prompt = `Analyze this whisky bottle label carefully. Return ONLY a JSON object (no markdown, no explanation):
{"brand":null,"region":null,"age":null,"vintage":null,"abv":null,"cask":null,"bottler":null,"distilled":null,"bottled":null,"cask_no":null}
Rules: brand=distillery name, include "%" in abv, include "yr" in age statement, bottler should be "OB" or "IB", use null if not clearly visible.`

    const raw = await generateWithImage(prompt, base64, mimeType)
    let parsed: Record<string, string | null> = {}
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch {
      // ignore parse errors
    }

    return NextResponse.json({ data: parsed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OCR error'
    console.error('OCR error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
