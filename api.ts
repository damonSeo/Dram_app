import { OcrResult, WhiskyLog } from '@/types'

export async function runOcr(file: File): Promise<OcrResult> {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch('/api/ocr', { method: 'POST', body: form })
  if (!res.ok) throw new Error('OCR failed')
  const json = await res.json()
  return json.data as OcrResult
}

export async function aiGenerate(action: string, payload: object): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error('AI generation failed')
  const json = await res.json()
  return json.text as string
}

export async function saveLog(log: Partial<WhiskyLog>): Promise<WhiskyLog> {
  const res = await fetch('/api/whisky-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  })
  if (!res.ok) throw new Error('Save failed')
  return (await res.json()).data as WhiskyLog
}

export async function updateLog(id: string, fields: Partial<WhiskyLog>): Promise<WhiskyLog> {
  const res = await fetch('/api/whisky-logs', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...fields }),
  })
  if (!res.ok) throw new Error('Update failed')
  return (await res.json()).data as WhiskyLog
}

export async function notionArchive(log: WhiskyLog, dbId: string): Promise<void> {
  const res = await fetch('/api/notion-archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ log, dbId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Notion archive failed')
  }
}
