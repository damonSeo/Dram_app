'use client'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { toHundred } from '@/lib/scoreFormat'

interface DistilleryInfo {
  name: string
  region: string
  country: string
  founded?: string
  owner?: string
  style?: string
  signature?: string
  history?: string
  trivia?: string
  flagships?: string[]
  core_range?: { name: string; note?: string; abv?: string; approx_price?: string }[]
  special_releases?: { name: string; note?: string; year?: string }[]
  rare_bottles?: { name: string; note?: string; rarity?: string }[]
  acclaimed?: { name: string; note?: string; rating?: string }[]
  sources?: string[]
}

export default function SearchPage() {
  const { collection, setActiveTab, loadLog, searchQuery, setSearchQuery, newsBookmarks } = useStore()
  const [query, setQuery] = useState('')
  const [distilleryInfo, setDistilleryInfo] = useState<DistilleryInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 검색어와 일치하는 북마크 (제목·본문에서 검색)
  const matchedBookmarks = query.trim().length > 1
    ? newsBookmarks.filter(b => {
        const q = query.toLowerCase()
        return (b.title?.toLowerCase().includes(q)) ||
               (b.description?.toLowerCase().includes(q)) ||
               (b.user_note?.toLowerCase().includes(q))
      })
    : []

  // 홈에서 검색어를 가져왔으면 자동 실행
  useEffect(() => {
    if (searchQuery) {
      searchDistillery(searchQuery)
      setSearchQuery('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 컬렉션 내 검색 결과
  const filteredLogs = query.trim().length > 1
    ? collection.filter(l =>
        [l.brand, l.region, l.bottler, l.spirit_type].some(v =>
          v?.toLowerCase().includes(query.toLowerCase())
        )
      )
    : []

  // 유명 증류소 목록 (클릭으로 검색)
  const FAMOUS = [
    'Macallan', 'Glenfarclas', 'Glenfiddich', 'Glenlivet', 'Ardbeg',
    'Laphroaig', 'Bowmore', 'Bruichladdich', 'Highland Park', 'Springbank',
    'Yamazaki', 'Hakushu', 'Nikka', 'Chichibu', 'Kavalan',
    'Buffalo Trace', 'Pappy Van Winkle', 'Blanton\'s', 'Woodford Reserve',
    'Glendronach', 'Benriach', 'Dalmore', 'Balvenie', 'Talisker',
  ]

  const searchDistillery = async (name: string) => {
    if (!name.trim()) return
    setQuery(name)
    setLoading(true)
    setSearched(true)
    setDistilleryInfo(null)
    try {
      const res = await fetch(`/api/distillery?name=${encodeURIComponent(name)}`)
      const json = await res.json() as { data?: DistilleryInfo; error?: string }
      if (json.data) setDistilleryInfo(json.data)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) searchDistillery(query.trim())
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }} className="m-page fade-up">

      {/* 헤더 */}
      <div style={{ marginBottom: '2rem' }}>
        <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Distillery & Whisky
        </p>
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)', marginBottom: '0.3rem' }}>Search</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--tx3)', lineHeight: 1.6 }}>
          증류소 정보 검색 · 내 아카이브에서 찾기
        </p>
      </div>

      {/* 검색창 */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0', border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="증류소명 또는 위스키 검색... (예: Macallan, Ardbeg)"
            style={{
              flex: 1, padding: '0.85rem 1rem',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--tx)', fontSize: '0.9rem', fontFamily: 'Tenor Sans, sans-serif',
            }}
            autoFocus
          />
          <button type="submit" className="btn-gold" style={{ borderRadius: 0, fontSize: '0.72rem', padding: '0.85rem 1.4rem' }}>
            {loading ? <span className="spinner" style={{ borderTopColor: '#000' }} /> : '검색'}
          </button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: '2rem' }} className="m-grid-collapse">

        {/* 메인 — 검색 결과 */}
        <div>
          {/* 증류소 정보 카드 */}
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--bd)', background: 'var(--c2)' }}>
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx3)', marginTop: '1rem' }}>AI로 증류소 정보 검색 중...</p>
            </div>
          )}

          {!loading && distilleryInfo && (
            <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)', marginBottom: '1.5rem' }}>
              {/* 헤더 */}
              <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #1A1614, #2C1E17)', borderBottom: '1px solid var(--bd)' }}>
                <p className="mono" style={{ fontSize: '0.55rem', color: 'rgba(198,107,61,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  {distilleryInfo.country} · {distilleryInfo.region}
                </p>
                <h2 className="display" style={{ fontSize: '1.8rem', color: '#F2EDE7', lineHeight: 1.1, marginBottom: '0.2rem' }}>
                  {distilleryInfo.name}
                </h2>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  {distilleryInfo.founded && (
                    <div>
                      <p className="mono" style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Founded</p>
                      <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{distilleryInfo.founded}</p>
                    </div>
                  )}
                  {distilleryInfo.owner && (
                    <div>
                      <p className="mono" style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Owner</p>
                      <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{distilleryInfo.owner}</p>
                    </div>
                  )}
                  {distilleryInfo.style && (
                    <div>
                      <p className="mono" style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Style</p>
                      <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{distilleryInfo.style}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 본문 */}
              <div style={{ padding: '1.25rem 1.5rem' }}>
                {distilleryInfo.signature && (
                  <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                    "{distilleryInfo.signature}"
                  </p>
                )}
                {distilleryInfo.history && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--tx)', lineHeight: 1.85, marginBottom: '1rem' }}>
                    {distilleryInfo.history}
                  </p>
                )}
                {distilleryInfo.trivia && (
                  <div style={{ padding: '0.65rem 1rem', background: 'var(--c3)', border: '1px solid var(--bd)', marginBottom: '1.25rem' }}>
                    <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Trivia</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--tx2)', lineHeight: 1.7 }}>{distilleryInfo.trivia}</p>
                  </div>
                )}

                {distilleryInfo.flagships && distilleryInfo.flagships.length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                      Notable Expressions
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {distilleryInfo.flagships.map((e, i) => (
                        <span key={i} className="mono"
                          style={{ fontSize: '0.65rem', padding: '0.25rem 0.65rem', border: '1px solid var(--bd2)', color: 'var(--tx2)', background: 'var(--c3)' }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 보틀 라인업 섹션들 */}
                {([
                  { key: 'core_range', label: '🥃 Core Range', accent: 'var(--gold)', metaKeys: ['abv', 'approx_price'] },
                  { key: 'special_releases', label: '✦ Special / Limited', accent: '#C9A84C', metaKeys: ['year'] },
                  { key: 'rare_bottles', label: '💎 Rare & Collectible', accent: '#cf7e7e', metaKeys: ['rarity'] },
                  { key: 'acclaimed', label: '🏆 Highly Acclaimed', accent: '#7ec59a', metaKeys: ['rating'] },
                ] as const).map(sec => {
                  const list = (distilleryInfo as unknown as Record<string, { name: string; note?: string; [k: string]: string | undefined }[]>)[sec.key]
                  if (!Array.isArray(list) || list.length === 0) return null
                  return (
                    <div key={sec.key} style={{ marginTop: '1.4rem' }}>
                      <p className="mono" style={{ fontSize: '0.58rem', color: sec.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                        {sec.label}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bd)' }}>
                        {list.map((b, i) => {
                          const meta = sec.metaKeys.map(k => b[k]).filter(Boolean) as string[]
                          return (
                            <div key={i} style={{ background: 'var(--c2)', padding: '0.7rem 0.9rem', borderLeft: `2px solid ${sec.accent}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--tx)', fontWeight: 500 }}>{b.name}</p>
                                {meta.length > 0 && (
                                  <span className="mono" style={{ fontSize: '0.56rem', color: sec.accent, flexShrink: 0 }}>{meta.join(' · ')}</span>
                                )}
                              </div>
                              {b.note && <p style={{ fontSize: '0.72rem', color: 'var(--tx3)', lineHeight: 1.55, marginTop: '0.2rem' }}>{b.note}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {distilleryInfo.sources && distilleryInfo.sources.length > 0 && (
                  <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)', marginTop: '1.25rem' }}>
                    Sources: {distilleryInfo.sources.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {!loading && searched && !distilleryInfo && (
            <div style={{ padding: '1.5rem', border: '1px solid var(--bd)', background: 'var(--c2)', marginBottom: '1.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--tx3)' }}>증류소 정보를 찾을 수 없어요</p>
            </div>
          )}

          {/* 저장된 뉴스 북마크 매칭 결과 */}
          {matchedBookmarks.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                📚 저장된 참고 자료 ({matchedBookmarks.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bd)' }}>
                {matchedBookmarks.map(b => (
                  <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', gap: '0.85rem', padding: '0.85rem 1rem', background: 'var(--c2)', textDecoration: 'none', alignItems: 'flex-start', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c2)'}>
                    {b.image
                      ? <img src={b.image} alt="" style={{ width: 50, height: 50, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      : <div style={{ width: 50, height: 50, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', border: '1px solid var(--bd)' }}>★</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--gold)', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid var(--bd2)', padding: '0.1rem 0.4rem' }}>
                          {b.source}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--tx)', lineHeight: 1.35 }}>{b.title}</p>
                      {b.description && <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', marginTop: '0.25rem', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.description}</p>}
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: '0.8rem', flexShrink: 0 }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 내 아카이브 결과 */}
          {filteredLogs.length > 0 && (
            <div>
              <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                내 아카이브 ({filteredLogs.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bd)' }}>
                {filteredLogs.map(log => (
                  <div key={log.id}
                    onClick={() => { loadLog({ ...log }); setActiveTab('share') }}
                    style={{ background: 'var(--c2)', cursor: 'pointer', display: 'flex', gap: '1rem', padding: '0.85rem 1rem', alignItems: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)'}>
                    {log.image_url
                      ? <img src={log.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} />
                      : <div style={{ width: 44, height: 44, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', border: '1px solid var(--bd)' }}>🥃</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: '0.1rem' }}>{log.region || '—'}</p>
                      <p className="display" style={{ fontSize: '1rem', color: 'var(--tx)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.brand}</p>
                      <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', marginTop: '0.1rem' }}>{[log.age, log.abv].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '0.75rem', borderLeft: '1px solid var(--bd)' }}>
                      <p className="display" style={{ fontSize: '1.3rem', color: 'var(--gold)', lineHeight: 1 }}>{toHundred(log.score)}</p>
                      <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--tx3)' }}>/100</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 초기 상태 */}
          {!searched && query.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--tx3)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</p>
              <p className="display" style={{ fontSize: '1.2rem', color: 'var(--tx2)', marginBottom: '0.4rem' }}>증류소 또는 위스키 검색</p>
              <p className="mono" style={{ fontSize: '0.65rem', lineHeight: 1.7 }}>AI가 증류소 정보를 가져오고<br />내 아카이브에서도 함께 찾아드려요</p>
            </div>
          )}
        </div>

        {/* 사이드 — 빠른 검색 */}
        <aside className="search-sidebar">
          <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
            <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)' }}>
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                🏭 Famous Distilleries
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {FAMOUS.map((name, i) => (
                <button key={name}
                  onClick={() => searchDistillery(name)}
                  className="mono"
                  style={{
                    padding: '0.55rem 1rem', background: query === name ? 'var(--gp)' : 'transparent',
                    border: 'none', borderBottom: i === FAMOUS.length - 1 ? 'none' : '1px solid var(--bd)',
                    color: query === name ? 'var(--gold)' : 'var(--tx2)',
                    fontSize: '0.68rem', cursor: 'pointer', textAlign: 'left',
                    letterSpacing: '0.03em', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (query !== name) (e.currentTarget as HTMLButtonElement).style.background = 'var(--c3)' }}
                  onMouseLeave={e => { if (query !== name) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 저장된 북마크 전체 목록 */}
          {newsBookmarks.length > 0 && (
            <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)', marginTop: '1.25rem' }}>
              <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  ★ Saved Notes
                </p>
                <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--tx3)' }}>{newsBookmarks.length}</span>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {newsBookmarks.slice(0, 15).map((b, i) => (
                  <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', gap: '0.5rem', padding: '0.55rem 0.75rem',
                      borderBottom: i < Math.min(newsBookmarks.length, 15) - 1 ? '1px solid var(--bd)' : 'none',
                      textDecoration: 'none', transition: 'background 0.15s', alignItems: 'flex-start',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}>
                    {b.image
                      ? <img src={b.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      : <div style={{ width: 32, height: 32, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: '1px solid var(--bd)' }}>★</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="mono" style={{ fontSize: '0.45rem', color: 'var(--gold)', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>{b.source}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--tx2)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.title}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
