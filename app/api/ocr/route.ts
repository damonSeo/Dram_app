import { NextRequest, NextResponse } from 'next/server'
import { generateWithImage } from '@/lib/groq'

const OCR_PROMPT = `You are an expert whisky label analyst with 20+ years of experience. Your task is to extract every piece of information from this whisky bottle label with maximum accuracy.

STEP 1 — READ ALL TEXT: Carefully examine the entire label including the main panel, neck label, back label, and any tax stamps. Note all text, numbers, and symbols you can see.

STEP 2 — EXTRACT FIELDS: Based on what you read, fill this JSON. Return ONLY the raw JSON object, no markdown fences, no explanation text.

JSON schema:
{
  "brand": "distillery name only (e.g. Glenfarclas, Macallan, Ardbeg) — NOT 'Highland Park 12' — just the distillery",
  "region": "one of: Speyside / Islay / Highland / Lowland / Campbeltown / Island / Irish / Japanese / American / Taiwanese / Indian / Other",
  "age": "age statement with yr suffix (e.g. 12yr, 25yr) OR 'NAS' if non-age statement",
  "vintage": "four-digit distillation year if shown (e.g. 2005)",
  "abv": "alcohol content with % suffix (e.g. 46%, 56.8%, 58.3%)",
  "cask": "cask type(s) from label (e.g. Oloroso Sherry Cask, Ex-Bourbon Hogshead, Port Pipe)",
  "bottler": "OB if official bottling by the distillery; or the independent bottler name (e.g. Gordon & MacPhail, Signatory, Berry Bros)",
  "distilled": "distillation date if present (e.g. Nov 1995, May 2008)",
  "bottled": "bottling date if present (e.g. Mar 2023, September 2019)",
  "cask_no": "cask number or barrel number if shown (e.g. #1234, Cask 42, Barrel 007)"
}

RULES:
- Use null for any field not clearly visible or readable
- brand = distillery only, NOT the full product name
- Always include % in abv and yr in age (or NAS)
- If bottler is the same as the distillery, use "OB"
- For region: infer from distillery name if label doesn't state it (e.g. Ardbeg → Islay, Glenfarclas → Speyside, Nikka → Japanese)
- Return ONLY the JSON object starting with { and ending with }`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const raw = await generateWithImage(OCR_PROMPT, base64, mimeType)

    let parsed: Record<string, string | null> = {}
    try {
      // strip any markdown fences and find the JSON object
      const cleaned = raw.replace(/```(?:json)?/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch {
      // ignore parse errors — return empty object
    }

    // Normalise: trim whitespace, replace empty strings with null
    const normalised: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(parsed)) {
      normalised[k] = typeof v === 'string' && v.trim() !== '' ? v.trim() : null
    }

    return NextResponse.json({ data: normalised })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OCR error'
    console.error('OCR error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
