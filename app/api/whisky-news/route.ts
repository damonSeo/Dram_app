import { NextResponse } from 'next/server'

// 30분 캐시 — Vercel Edge에서 매번 RSS 재요청 방지
export const revalidate = 1800

export interface NewsItem {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  sourceUrl: string
  image?: string
}

const FEEDS = [
  {
    name: 'Whisky Advocate',
    url: 'https://www.whiskyadvocate.com/feed/',
    home: 'https://www.whiskyadvocate.com',
  },
  {
    name: 'The Whisky Exchange',
    url: 'https://www.thewhiskyexchange.com/blog/feed/',
    home: 'https://www.thewhiskyexchange.com/blog',
  },
  {
    name: 'Scotch Whisky',
    url: 'https://scotchwhisky.com/feed/',
    home: 'https://scotchwhisky.com',
  },
  {
    name: 'Master of Malt',
    url: 'https://www.masterofmalt.com/blog/feed/',
    home: 'https://www.masterofmalt.com/blog',
  },
  {
    name: 'Whisky Magazine',
    url: 'https://www.whiskymag.com/feed/',
    home: 'https://www.whiskymag.com',
  },
]

function getTag(block: string, tag: string): string {
  // CDATA 포함 처리
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\/${tag}>`, 'i')
  const m = block.match(re)
  if (!m) return ''
  return (m[1] ?? m[2] ?? '').trim()
}

function getAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["']`, 'i')
  const m = block.match(re)
  return m ? m[1] : ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function extractImage(block: string): string {
  // media:thumbnail, media:content, enclosure, og:image 순서로 시도
  const thumb = getAttr(block, 'media:thumbnail', 'url') ||
    getAttr(block, 'media:content', 'url') ||
    getAttr(block, 'enclosure', 'url')
  if (thumb) return thumb

  // description에서 첫 번째 <img> src
  const desc = getTag(block, 'description')
  const imgM = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
  return imgM ? imgM[1] : ''
}

async function fetchFeed(feed: typeof FEEDS[0]): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'OakTheRecord/1.0 (RSS Reader)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const xml = await res.text()

    const items: NewsItem[] = []
    const blocks = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)]

    for (const b of blocks.slice(0, 5)) {
      const block = b[1]
      const title = stripHtml(getTag(block, 'title'))
      let link = getTag(block, 'link')
      // <link> is sometimes CDATA-less plain text between tags; try guid too
      if (!link) link = getTag(block, 'guid')
      const pubDate = getTag(block, 'pubDate') || getTag(block, 'dc:date') || ''
      const rawDesc = getTag(block, 'description') || getTag(block, 'content:encoded') || ''
      const description = stripHtml(rawDesc)
      const image = extractImage(block)

      if (!title || !link) continue
      items.push({ title, link, description, pubDate, source: feed.name, sourceUrl: feed.home, image })
    }
    return items
  } catch {
    return []
  }
}

function parseDate(s: string): number {
  if (!s) return 0
  const d = new Date(s)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export async function GET() {
  try {
    const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)))
    const all: NewsItem[] = results
      .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => parseDate(b.pubDate) - parseDate(a.pubDate))
      .slice(0, 20)

    return NextResponse.json({ data: all, count: all.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed', data: [] }, { status: 500 })
  }
}
