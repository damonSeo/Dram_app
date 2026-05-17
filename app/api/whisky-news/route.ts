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
export const FEEDS = [
  {
    name: 'WhiskyNotes',
    url: 'https://www.whiskynotes.be/feed/',
    home: 'https://www.whiskynotes.be',
  },
  {
    name: 'Whisky Hoop',
    url: 'https://whiskyhoop.com/?mode=rss',
    home: 'https://whiskyhoop.com',
  },
  {
    name: '乾杯会 (Kanpaikai)',
    url: 'https://kannpaikai.com/feed/',
    home: 'https://kannpaikai.com',
  },
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
    // RSS 2.0과 RSS 1.0(RDF) 모두 매칭 — <item ...> 또는 <item rdf:about="...">
    const blocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)]

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

// Whiskybase는 Cloudflare 봇 차단으로 직접 fetch 불가 →
// Serper(Google 색인)로 최근 색인된 신규 위스키 페이지를 뉴스로 가져옴
async function fetchWhiskybaseNew(): Promise<NewsItem[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      // 최근 1주일 내 색인된 Whiskybase 위스키 페이지
      body: JSON.stringify({
        q: 'site:whiskybase.com/whiskies new release',
        gl: 'us',
        num: 12,
        tbs: 'qdr:w',
      }),
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json() as {
      organic?: Array<{ title: string; link: string; snippet?: string; date?: string }>
    }
    if (!data.organic) return []
    return data.organic
      .filter(o => o.link.includes('/whiskies/'))
      .slice(0, 10)
      .map(o => ({
        title: o.title.replace(/\s*[-|]\s*Whiskybase\s*$/i, '').trim(),
        link: o.link,
        description: o.snippet || '',
        pubDate: o.date ? new Date(o.date).toUTCString() : '',
        source: 'Whiskybase',
        sourceUrl: 'https://www.whiskybase.com/whiskies/new-releases',
      }))
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
    const [feedResults, whiskybase] = await Promise.all([
      Promise.allSettled(FEEDS.map(f => fetchFeed(f))),
      fetchWhiskybaseNew(),
    ])
    const rssItems = feedResults
      .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    // Whiskybase 신규 등록은 상단 우선 노출 (날짜 메타 불확실해도 최신성 보장)
    const all = dedupe([
      ...whiskybase,
      ...rssItems.sort((a, b) => parseDate(b.pubDate) - parseDate(a.pubDate)),
    ]).slice(0, 28)

    return NextResponse.json({ data: all, count: all.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed', data: [] }, { status: 500 })
  }
}
