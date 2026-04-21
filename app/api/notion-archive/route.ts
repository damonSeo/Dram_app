import { NextRequest, NextResponse } from 'next/server'
import type { WhiskyLog } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { log, notionDbId, notionToken } = await req.json() as {
      log: WhiskyLog
      notionDbId: string
      notionToken: string
    }

    const token = notionToken || process.env.NOTION_TOKEN
    if (!notionDbId || !token) {
      return NextResponse.json(
        { error: 'Notion DB ID와 Integration Token이 필요합니다' },
        { status: 400 }
      )
    }

    const properties: Record<string, unknown> = {
      Name: {
        title: [
          {
            text: {
              content: [log.brand, log.age, log.vintage ? `(${log.vintage})` : '']
                .filter(Boolean)
                .join(' ')
                .trim(),
            },
          },
        ],
      },
    }

    const textFields: Record<string, string> = {
      Distillery: log.brand || '',
      Region: log.region || '',
      Age: log.age || '',
      Vintage: log.vintage || '',
      ABV: log.abv || '',
      Cask: (log.casks || []).join(', '),
      Bottler: log.bottler || '',
      Color: log.color || '',
      Nose: log.nose || '',
      Palate: log.palate || '',
      Finish: log.finish || '',
      Comment: log.comment || '',
      Date: log.date || new Date().toLocaleDateString('ko-KR'),
    }

    for (const [key, value] of Object.entries(textFields)) {
      if (value) {
        properties[key] = {
          rich_text: [{ text: { content: value.substring(0, 2000) } }],
        }
      }
    }

    if (log.score) {
      properties['Score'] = { number: log.score }
    }

    const dbId = notionDbId.replace(/-/g, '').replace(/\?.*$/, '')

    const body: Record<string, unknown> = {
      parent: { database_id: dbId },
      properties,
    }

    if (log.blog_post) {
      body.children = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { type: 'text', text: { content: log.blog_post.substring(0, 2000) } },
            ],
          },
        },
      ]
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(err.message || `Notion API error ${res.status}`)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Notion archive failed'
    console.error('Notion error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
