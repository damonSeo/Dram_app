import { NextResponse } from 'next/server'

// 30분 캐시
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

// 실제로 접근 가능한 위스키/스피릿 뉴스 RSS 피드
const FEEDS = [
  {
    name: 'The Spirits Business',
    url: 'https://www.thespiritsbusiness.com/tag/whisky/feed/',
    home: 'https://www.thespiritsbusiness.com',
  },
  {
    name: 'The Spirits Business',
    url: 'https://www.thespiritsbusiness.com/tag/whiskey/feed/',
    home: 'https://www.thespiritsbusiness.com',
  },
  {
    name: 'Just Drinks',
    url: 'https://www.just-drinks.com/feed/',
    home: 'https://www.just-drinks.com',
    filterKeywords: ['whisky', 'whiskey', 'bourbon', 'scotch', 'malt', 'distill'],
  },
]

function getTag(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i'
  )
  const m = block.match(re)
  if (!m) return ''
  return (m[1] ?? m[2] ?? '').trim()
}

function getAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>\\s][^>]*\\s${attr}=["']([^"']+)["']`, 'i')
  const m = block.match(re)
  if (m) return m[1]
  // self-closing도 처리
  const re2 = new RegExp(`<${tag}[^/]*${attr}=["']([^"']+)["'][^/]*/?>`, 'i')
  const m2 = block.match(re2)
  return m2 ? m2[1] : ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

function extractImage(block: string): string {
  // 1. <feature_image> (just-drinks 커스텀 태그)
  const fi = getTag(block, 'feature_image')
  if (fi && fi.startsWith('http')) return fi
  // 2. media:thumbnail url 속성
  const mt = block.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)
  if (mt) return mt[1]
  // 3. media:content url
  const mc = block.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)
  if (mc) return mc[1]
  // 4. enclosure (이미지 타입만)
  const enc = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)
  if (enc) return enc[1]
  // 5. description/content 안의 <img src>
  const desc = getTag(block, 'description') || getTag(block, 'content:encoded') || ''
  const img = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (img && img[1].startsWith('http')) return img[1]
  return ''
}

interface FeedConfig {
  name: string
  url: string
  home: string
  filterKeywords?: string[]
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OakTheRecord/1.0; +https://dram-app.vercel.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    if (!xml.includes('<item')) return []

    const items: NewsItem[] = []
    const blocks = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)]

    for (const b of blocks.slice(0, 8)) {
      const block = b[1]
      const title = stripHtml(getTag(block, 'title'))
      if (!title) continue

      // <link>가 CDATA 없이 텍스트로만 올 때 처리
      let link = getTag(block, 'link').trim()
      if (!link || !link.startsWith('http')) {
        // <link>href="..." /> 형태 (Atom)
        const atomLink = block.match(/<link[^>]*href=["']([^"']+)["']/i)
        link = atomLink ? atomLink[1] : ''
      }
      if (!link || !link.startsWith('http')) {
        link = getTag(block, 'guid')
      }
      if (!link || !link.startsWith('http')) continue

      const pubDate = getTag(block, 'pubDate') || getTag(block, 'dc:date') || ''
      const rawDesc = getTag(block, 'description') || getTag(block, 'content:encoded') || ''
      const description = stripHtml(rawDesc)
      const image = extractImage(block)

      // 키워드 필터 (Just Drinks는 위스키 관련만)
      if (feed.filterKeywords) {
        const combined = (title + ' ' + description).toLowerCase()
        if (!feed.filterKeywords.some(kw => combined.includes(kw))) continue
      }

      items.push({
        title,
        link,
        description,
        pubDate,
        source: feed.name,
        sourceUrl: feed.home,
        image,
      })
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

// 중복 제거 (같은 제목 또는 같은 링크)
function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.link || item.title
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET() {
  try {
    const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)))
    const all = dedupe(
      results
        .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
        .flatMap(r => r.value)
        .sort((a, b) => parseDate(b.pubDate) - parseDate(a.pubDate))
    ).slice(0, 20)

    return NextResponse.json({ data: all, count: all.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed', data: [] }, { status: 500 })
  }
}
