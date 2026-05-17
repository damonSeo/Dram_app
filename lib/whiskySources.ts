// 위스키 라벨 식별 / 정보 수집에 활용하는 신뢰 소스 정의

// 검색 시 site: 타겟으로 쓰는 핵심 데이터베이스/리테일러/커뮤니티
export const WHISKY_SITES = {
  databases: [
    'whiskybase.com',           // 세계 최대 위스키 DB (90만+ 보틀)
    'whiskyfun.com',            // Serge Valentin — 리뷰 레퍼런스
    'whiskynotes.be',           // 상세 리뷰
  ],
  auctions: [
    'whiskyauctioneer.com',     // 옥션 — 상세 카탈로그 + 실거래가
    'scotchwhiskyauctions.com', // The Auction House
    'whisky.auction',           // Whisky.Auction
  ],
  retailers: [
    'thewhiskyexchange.com',    // TWE 제품 페이지
    'masterofmalt.com',         // MoM 제품 페이지
    'royalmilewhiskies.com',
  ],
  community: [
    'reddit.com/r/Scotch',
    'reddit.com/r/whisky',
    'connosr.com',              // 커뮤니티 리뷰 평점
  ],
  japanese: [
    'whiskyhoop.com',
    'kannpaikai.com',
    'dekanta.com',              // 일본 위스키 전문 리테일러
  ],
} as const

// 우선적으로 본문을 크롤링할 도메인 (리뷰/DB 신뢰도 높은 순)
export const PRIORITY_FETCH_DOMAINS = [
  'whiskybase', 'whiskyfun', 'whiskynotes', 'connosr',
  'whiskyauctioneer', 'scotchwhiskyauctions', 'whisky.auction',
  'thewhiskyexchange', 'masterofmalt', 'dekanta',
  'kannpaikai', 'whiskyhoop', 'scotchwhisky', 'whiskyadvocate',
]

// 모든 site 도메인 평탄화
export function allSiteDomains(): string[] {
  return [
    ...WHISKY_SITES.databases,
    ...WHISKY_SITES.auctions,
    ...WHISKY_SITES.retailers,
    ...WHISKY_SITES.community,
    ...WHISKY_SITES.japanese,
  ]
}

export interface SerperOrganic {
  title: string
  link: string
  snippet?: string
  displayLink?: string
}
interface SerperResponse {
  organic?: SerperOrganic[]
  knowledgeGraph?: { description?: string; attributes?: Record<string, string> }
}

// Serper 단일 검색 (키 없으면 빈 결과)
export async function serperSearch(query: string, num = 8): Promise<SerperOrganic[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'us', num }),
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json() as SerperResponse
    return data.organic || []
  } catch {
    return []
  }
}

// 위스키 DB·리테일러·옥션을 site: OR 로 묶어 한 번에 타겟 검색
export async function searchWhiskySources(
  bottleName: string,
  opts: { groups?: (keyof typeof WHISKY_SITES)[]; num?: number } = {},
): Promise<SerperOrganic[]> {
  const groups = opts.groups ?? ['databases', 'auctions', 'retailers', 'japanese']
  const domains = groups.flatMap(g => WHISKY_SITES[g])
  // Serper 쿼리 길이 제한 고려해 상위 8개 도메인만
  const siteFilter = domains.slice(0, 8).map(d => `site:${d}`).join(' OR ')
  const q = `${bottleName} (${siteFilter})`
  return serperSearch(q, opts.num ?? 8)
}

// 도메인 우선순위로 정렬
export function sortByPriority<T extends { link: string; source?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aKey = `${a.link} ${a.source || ''}`.toLowerCase()
    const bKey = `${b.link} ${b.source || ''}`.toLowerCase()
    const aPri = PRIORITY_FETCH_DOMAINS.findIndex(d => aKey.includes(d))
    const bPri = PRIORITY_FETCH_DOMAINS.findIndex(d => bKey.includes(d))
    const aRank = aPri === -1 ? 999 : aPri
    const bRank = bPri === -1 ? 999 : bPri
    return aRank - bRank
  })
}
