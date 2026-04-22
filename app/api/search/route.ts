import { NextRequest, NextResponse } from 'next/server'

interface SerperResult {
  title: string
  link: string
  snippet?: string
  source?: string
  price?: string
  imageUrl?: string
}

interface SerperResponse {
  organic?: Array<{ title: string; link: string; snippet: string; displayLink?: string }>
  shopping?: Array<{ title: string; link: string; source: string; price?: string; imageUrl?: string }>
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const key = process.env.SERPER_API_KEY

  // No API key → return a Google search URL for the client to open
  if (!key) {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q + ' whisky')}&tbm=shop`
    const lensUrl = `https://www.google.com/search?q=${encodeURIComponent(q + ' whisky bottle price buy')}`
    return NextResponse.json({
      fallback: true,
      googleUrl,
      lensUrl,
    })
  }

  try {
    // Shopping search for price/retailer info
    const [shoppingRes, organicRes] = await Promise.all([
      fetch('https://google.serper.dev/shopping', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: `${q} whisky`, gl: 'us', num: 4 }),
      }),
      fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: `${q} whisky review tasting notes`, gl: 'us', num: 4 }),
      }),
    ])

    const [shoppingData, organicData] = await Promise.all([
      shoppingRes.json() as Promise<SerperResponse>,
      organicRes.json() as Promise<SerperResponse>,
    ])

    const shopping: SerperResult[] = (shoppingData.shopping || []).slice(0, 4).map((r) => ({
      title: r.title,
      link: r.link,
      source: r.source,
      price: r.price,
      imageUrl: r.imageUrl,
    }))

    const organic: SerperResult[] = (organicData.organic || []).slice(0, 4).map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      source: r.displayLink,
    }))

    return NextResponse.json({ shopping, organic })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
