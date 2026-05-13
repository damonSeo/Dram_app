'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import type { WhiskyLog } from '@/types'
import { toHundred } from '@/lib/scoreFormat'
import type { NewsItem } from '@/app/api/whisky-news/route'

const INSTAGRAM_HANDLE = 'the_oakarchive'

export default function HomePage() {
  const { setActiveTab, setScanMode, loadLog, collection, setSearchQuery } = useStore()
  const [homeSearchInput, setHomeSearchInput] = useState('')
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/whisky-news')
      .then(r => r.json())
      .then((j: { data?: NewsItem[] }) => { if (j.data) setNews(j.data) })
      .catch(() => {})
      .finally(() => setNewsLoading(false))
  }, [])

  const goSearch = (name: string) => {
    if (!name.trim()) return
    setSearchQuery(name.trim())
    setActiveTab('search')
  }

  const goScan   = () => { setScanMode('scan');   setActiveTab('scan') }
  const goManual = () => { setScanMode('manual'); setActiveTab('scan') }

  const exceptional = [...collection]
    .filter(l => toHundred(l.score) >= 90)
    .sort((a, b) => toHundred(b.score) - toHundred(a.score))
    .slice(0, 6)

  const recent = collection.slice(0, 3)   // 사이드바에 3개만

  const totalCount = collection.length
  const avgScore   = totalCount > 0
    ? Math.round(collection.reduce((s, l) => s + toHundred(l.score), 0) / totalCount) : 0
  const topRegion  = (() => {
    const freq: Record<string, number> = {}
    collection.forEach(l => { if (l.region) freq[l.region] = (freq[l.region] || 0) + 1 })
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  })()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ch)' }}>

      {/* ══ HERO ══ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(175deg, #1A1614 0%, #2C1E17 55%, #302C2C 100%)',
        borderBottom: '1px solid var(--bd)',
      }}>
        <div style={{ position: 'absolute', top: -100, right: -80, width: 480, height: 480, borderRadius: '50%', background: 'rgba(198,107,61,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '30%', width: 260, height: 260, borderRadius: '50%', background: 'rgba(198,107,61,0.04)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '4rem 1.5rem 3.5rem', position: 'relative', display: 'flex', alignItems: 'center', gap: '3rem' }}>
          <div style={{ flex: 1 }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'rgba(198,107,61,0.6)', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Private Whisky Archive · Est. 2024
            </p>
            <h1 className="display" style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)', color: '#F2EDE7', letterSpacing: '0.06em', lineHeight: 0.95, marginBottom: '0.5rem' }}>OAK</h1>
            <h2 className="display" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.6rem)', color: 'var(--gold)', letterSpacing: '0.38em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>The Record</h2>
            <p style={{ fontSize: '0.9rem', color: 'rgba(242,237,231,0.5)', lineHeight: 1.75, maxWidth: 420, marginBottom: '2rem' }}>
              위스키 한 잔의 기억을 기록합니다.<br />
              테이스팅 노트, 스코어, 그리고 당신만의 아카이브.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={goScan} className="mono"
                style={{ background: 'var(--gold)', border: 'none', color: '#fff', padding: '0.8rem 1.6rem', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                ⬡ Scan Label
              </button>
              <button onClick={goManual} className="mono"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(242,237,231,0.8)', padding: '0.8rem 1.6rem', cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                ✎ Manual Entry
              </button>
            </div>
          </div>

          {totalCount > 0 && (
            <div className="home-stats-panel" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.06)', minWidth: 180 }}>
              {[{ label: 'Bottles', value: totalCount }, { label: 'Avg Score', value: avgScore }, { label: 'Top Region', value: topRegion }].map(s => (
                <div key={s.label} style={{ padding: '1rem 1.4rem', background: 'rgba(0,0,0,0.25)', textAlign: 'center' }}>
                  <p className="display" style={{ fontSize: '1.8rem', color: 'var(--gold)', lineHeight: 1 }}>{s.value}</p>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'rgba(242,237,231,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.25rem' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ MAIN BODY ══ */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '2.5rem 1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: '2.5rem' }} className="home-shell">

        {/* ── LEFT ── */}
        <div>

          {/* 1. 위스키 뉴스 — 최상단 */}
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--bd)' }}>
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                📰 Whisky News
              </p>
              <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)' }}>WhiskyNotes · Spirits Business · Just Drinks</p>
            </div>

            {newsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '1.25rem', background: 'var(--c2)', border: '1px solid var(--bd)' }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx3)' }}>최신 뉴스 불러오는 중...</p>
              </div>
            )}
            {!newsLoading && news.length === 0 && (
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx3)', padding: '1rem' }}>뉴스를 불러올 수 없어요.</p>
            )}
            {!newsLoading && news.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bd)' }}>
                {news.slice(0, 8).map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', gap: '0.85rem', padding: '0.9rem 1rem', background: 'var(--c2)', textDecoration: 'none', transition: 'background 0.15s', alignItems: 'flex-start' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c2)'}>
                    {item.image ? (
                      <img src={item.image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid var(--bd)' }}>🥃</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span className="mono" style={{ fontSize: '0.48rem', color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--bd2)', padding: '0.1rem 0.4rem', flexShrink: 0 }}>
                          {item.source}
                        </span>
                        <span className="mono" style={{ fontSize: '0.48rem', color: 'var(--tx3)' }}>
                          {item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--tx)', lineHeight: 1.35, marginBottom: '0.25rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--tx3)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                          {item.description}
                        </p>
                      )}
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: '0.75rem', flexShrink: 0, marginTop: '0.15rem' }}>↗</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* 2. 입력 카드 */}
          <section>
            {collection.length === 0 && (
              <p className="display" style={{ fontSize: '1.4rem', color: 'var(--tx2)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                첫 번째 테이스팅 노트를 시작해보세요
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--bd)' }} className="m-grid-collapse">
              {[
                { icon: '⬡', label: 'AI Scan', title: 'Scan Label', desc: 'Gemini AI로 라벨을 읽고 바틀 정보를 자동 입력', onClick: goScan },
                { icon: '✎', label: 'Manual', title: 'Manual Entry', desc: '직접 입력 — 증류소, 캐스크, 도수까지 세밀하게', onClick: goManual },
              ].map(c => (
                <div key={c.title} onClick={c.onClick}
                  style={{ background: 'var(--c2)', padding: '1.4rem', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 120 }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)'}>
                  <span className="display" style={{ fontSize: '1.4rem', color: 'var(--gold)' }}>{c.icon}</span>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{c.label}</p>
                  <p className="display" style={{ fontSize: '1rem', color: 'var(--tx)', lineHeight: 1.15 }}>{c.title}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--tx3)', lineHeight: 1.5 }}>{c.desc}</p>
                  <span className="mono" style={{ marginTop: 'auto', color: 'var(--gold)', fontSize: '0.65rem' }}>→</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── RIGHT RAIL ── */}
        <aside className="home-rail" style={{ alignSelf: 'start', position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 1. Latest Rating — 3개 compact */}
          {recent.length > 0 && (
            <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
              <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>◈ Latest Rating</p>
                <button onClick={() => setActiveTab('collection')} className="mono"
                  style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: '0.52rem', cursor: 'pointer', letterSpacing: '0.05em' }}>
                  All →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recent.map((log: WhiskyLog, i) => (
                  <button key={log.id}
                    onClick={() => { loadLog({ ...log }); setActiveTab('share') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                      borderBottom: i < recent.length - 1 ? '1px solid var(--bd)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--gp)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
                    {log.image_url ? (
                      <img src={log.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', border: '1px solid var(--bd)' }}>🥃</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.region || '—'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--tx)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.brand || '—'}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p className="display" style={{ fontSize: '1rem', color: 'var(--gold)', lineHeight: 1 }}>{toHundred(log.score)}</p>
                      <p className="mono" style={{ fontSize: '0.44rem', color: 'var(--tx3)' }}>/100</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Distillery Search — 검색창만 */}
          <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
            <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)' }}>
              <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>🏭 Distillery Search</p>
            </div>
            <div style={{ padding: '0.85rem 1rem' }}>
              <form onSubmit={e => { e.preventDefault(); goSearch(homeSearchInput) }}
                style={{ display: 'flex', border: '1px solid var(--bd2)' }}>
                <input
                  type="text"
                  value={homeSearchInput}
                  onChange={e => setHomeSearchInput(e.target.value)}
                  placeholder="증류소 검색..."
                  className="mono"
                  style={{ flex: 1, padding: '0.55rem 0.75rem', background: 'var(--c3)', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: '0.72rem' }}
                />
                <button type="submit" className="mono"
                  style={{ background: 'var(--gold)', border: 'none', color: '#000', padding: '0.55rem 0.8rem', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600, flexShrink: 0 }}>
                  →
                </button>
              </form>
            </div>
          </div>

          {/* 3. Exceptional */}
          <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
            <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)' }}>
              <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>🏆 Exceptional · 90+</p>
            </div>
            {exceptional.length === 0 ? (
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx3)', padding: '1rem', lineHeight: 1.7 }}>아직 90+ 기록이 없어요.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {exceptional.map((log, i) => (
                    <button key={log.id}
                      onClick={() => { loadLog({ ...log }); setActiveTab('share') }}
                      className="mono"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        borderBottom: i === exceptional.length - 1 ? 'none' : '1px solid var(--bd)',
                        textAlign: 'left', width: '100%', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--gp)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
                      <span className="display" style={{ fontSize: '1rem', color: 'var(--gold)', minWidth: '2rem' }}>{toHundred(log.score)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{log.brand || '—'}</p>
                        <p style={{ fontSize: '0.52rem', color: 'var(--tx3)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.region || '—'}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ padding: '0.45rem 1rem', borderTop: '1px solid var(--bd)' }}>
                  <button onClick={() => setActiveTab('collection')} className="mono"
                    style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: '0.55rem', cursor: 'pointer' }}>
                    전체 Archive →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 4. Follow */}
          <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)', padding: '0.85rem 1rem' }}>
            <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>Follow</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a href={`https://instagram.com/${INSTAGRAM_HANDLE}`} target="_blank" rel="noopener noreferrer"
                title={`@${INSTAGRAM_HANDLE}`}
                style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--bd)', background: 'var(--c3)', textDecoration: 'none', transition: 'border-color 0.2s, background 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#DD2A7B'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c4)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--bd)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--c3)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <defs><linearGradient id="ig2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#F58529"/><stop offset="50%" stopColor="#DD2A7B"/><stop offset="100%" stopColor="#8134AF"/></linearGradient></defs>
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig2)" strokeWidth="1.8" fill="none"/>
                  <circle cx="12" cy="12" r="4" stroke="url(#ig2)" strokeWidth="1.8" fill="none"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="url(#ig2)"/>
                </svg>
              </a>
            </div>
          </div>

          {/* 5. About */}
          <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--bd)', background: 'var(--c2)' }}>
            <p className="mono" style={{ fontSize: '0.52rem', color: 'var(--tx3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>About</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--tx2)', lineHeight: 1.75 }}>
              위스키 테이스팅 노트를 기록하고 공유하는 개인 아카이브. AI 라벨 스캔부터 상세 노트까지.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
