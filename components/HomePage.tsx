'use client'
import { useStore } from '@/lib/store'
import type { WhiskyLog } from '@/types'
import { toHundred } from '@/lib/scoreFormat'

const cardBase: React.CSSProperties = {
  border: '1px solid var(--bd2)',
  background: 'linear-gradient(180deg, rgba(168,132,42,0.05) 0%, var(--c2) 100%)',
  padding: '1.4rem 1.2rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '0.4rem',
  minHeight: 150,
  position: 'relative',
}

export default function HomePage() {
  const { setActiveTab, setScanMode, setArchiveSubTab, loadLog, collection } = useStore()

  const hoverIn = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'var(--gold)'
    e.currentTarget.style.background = 'linear-gradient(180deg, rgba(168,132,42,0.14) 0%, var(--c4) 100%)'
  }
  const hoverOut = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'var(--bd2)'
    e.currentTarget.style.background = 'linear-gradient(180deg, rgba(168,132,42,0.05) 0%, var(--c2) 100%)'
    e.currentTarget.style.borderColor = 'var(--bd2)'
  }

  const goScan = () => { setScanMode('scan'); setActiveTab('scan') }
  const goManual = () => { setScanMode('manual'); setActiveTab('scan') }
  const goCocktail = () => { setScanMode('manual'); setActiveTab('scan') }

  // Exceptional Scores: 90+ /100 (모든 stype 포함, 점수 정렬)
  const exceptional = [...collection]
    .filter((l) => toHundred(l.score) >= 90)
    .sort((a, b) => toHundred(b.score) - toHundred(a.score))
    .slice(0, 8)

  return (
    <div className="m-page fade-up home-shell" style={{ maxWidth: 1160, margin: '0 auto', padding: '2.5rem 1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: '1.5rem' }}>
      {/* ── RIGHT (top) — Exceptional Scores rail ── */}
      <aside className="home-rail" style={{ alignSelf: 'start', position: 'sticky', top: 76, gridColumn: 2, gridRow: 1 }}>
        <div style={{ border: '1px solid var(--bd2)', background: 'var(--c2)' }}>
          <div style={{ padding: '0.55rem 0.85rem', borderBottom: '1px solid var(--bd)', background: 'var(--c3)' }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              🏆 Exceptional
            </p>
            <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--tx3)', letterSpacing: '0.05em', marginTop: '0.15rem' }}>
              90+ / 100 명작들
            </p>
          </div>
          {exceptional.length === 0 ? (
            <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--tx3)', padding: '1.25rem 0.85rem', lineHeight: 1.6 }}>
              아직 90+ 점수의 기록이 없어요. 첫 명작을 발견해보세요.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {exceptional.map((log, i) => (
                <button key={log.id}
                  onClick={() => { loadLog({ ...log }); setActiveTab('share') }}
                  className="mono"
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: '0.5rem',
                    padding: '0.55rem 0.85rem',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderBottom: i === exceptional.length - 1 ? 'none' : '1px solid var(--bd)',
                    textAlign: 'left', width: '100%',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gp)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span className="display" style={{ fontSize: '0.95rem', color: 'var(--gold)', minWidth: '2rem' }}>
                    {toHundred(log.score)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                      {log.brand || '—'}
                    </p>
                    <p style={{ fontSize: '0.55rem', color: 'var(--tx3)', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                      {[log.age, log.abv].filter(Boolean).join(' · ') || (log.region || '—')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {exceptional.length > 0 && (
          <button onClick={() => setActiveTab('collection')} className="mono"
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--tx3)', fontSize: '0.6rem',
              cursor: 'pointer', marginTop: '0.5rem', padding: '0.2rem 0',
              letterSpacing: '0.05em', textAlign: 'right', width: '100%',
            }}>
            전체 Archive →
          </button>
        )}
      </aside>

      {/* ── LEFT — main content ── */}
      <div style={{ gridColumn: 1, gridRow: 1 }}>
      {/* Hero — title + logo */}
      <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
        <p className="mono" style={{
          fontSize: '0.62rem', color: 'var(--gold)',
          letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '0.6rem', opacity: 0.7,
        }}>
          Private Society · Est. 2024
        </p>
        <h1 className="display m-display-lg" style={{
          fontSize: '2.4rem', color: 'var(--gold)', letterSpacing: '0.08em',
          lineHeight: 1.05, marginBottom: '0.2rem',
        }}>
          OAK THE RECORD
        </h1>
        <p className="mono" style={{
          fontSize: '0.68rem', color: 'var(--tx2)', letterSpacing: '0.22em',
          textTransform: 'uppercase', marginBottom: '1.25rem',
        }}>
          Whisky · Wine · Fellowship
        </p>

        {/* Logo image */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: '0.5rem',
        }}>
          <img
            src="/logo.png"
            alt="Oak The Record emblem"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            style={{
              width: 'min(300px, 70vw)',
              height: 'auto',
              filter: 'drop-shadow(0 8px 24px rgba(201,168,76,0.15))',
            }}
          />
        </div>
      </div>

      {/* ── Scan Label (full-width primary) ── */}
      <div
        onClick={goScan}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        style={{
          ...cardBase,
          padding: '1.6rem 1.4rem',
          marginBottom: '1px',
        }}
      >
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '1rem' }}>
          <span className="display" style={{ fontSize: '2.2rem', color: 'var(--gold)' }}>⬡</span>
          <div style={{ flex: 1 }}>
            <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              New Entry
            </p>
            <p className="display" style={{ fontSize: '1.5rem', color: 'var(--tx)', lineHeight: 1.1 }}>
              Scan Label
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--tx2)', marginTop: '0.3rem', lineHeight: 1.5 }}>
              사진 한 장이면 Gemini AI가 라벨을 읽고 유사 바틀·증류소 정보까지 찾아냅니다.
            </p>
          </div>
          <span style={{ color: 'var(--gold)', fontSize: '1.3rem' }}>→</span>
        </div>
      </div>

      {/* ── Manual Entry + Cocktail ── */}
      <div className="m-grid-collapse" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--bd)',
      }}>
        <div onClick={goManual} onMouseEnter={hoverIn} onMouseLeave={hoverOut} style={cardBase}>
          <span className="display" style={{ fontSize: '1.8rem', color: 'var(--gold)' }}>✎</span>
          <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Manual
          </p>
          <p className="display" style={{ fontSize: '1.25rem', color: 'var(--tx)', lineHeight: 1.15 }}>
            Manual Entry
          </p>
          <p style={{ fontSize: '0.74rem', color: 'var(--tx2)', lineHeight: 1.5 }}>
            라벨이 흐리거나 직접 입력하고 싶을 때 — 증류소, 캐스크, 도수를 세밀하게 기록.
          </p>
          <span style={{ marginTop: 'auto', color: 'var(--gold)', fontSize: '0.75rem' }} className="mono">→ 시작</span>
        </div>

        <div onClick={goCocktail} onMouseEnter={hoverIn} onMouseLeave={hoverOut} style={cardBase}>
          <span className="display" style={{ fontSize: '1.8rem', color: 'var(--gold)' }}>🍸</span>
          <p className="mono" style={{ fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            New
          </p>
          <p className="display" style={{ fontSize: '1.25rem', color: 'var(--tx)', lineHeight: 1.15 }}>
            Cocktail
          </p>
          <p style={{ fontSize: '0.74rem', color: 'var(--tx2)', lineHeight: 1.5 }}>
            위스키·와인 베이스 칵테일 레시피와 시음 기록 — 곧 공개됩니다.
          </p>
          <span style={{ marginTop: 'auto', color: 'var(--gold)', fontSize: '0.75rem' }} className="mono">→ 둘러보기</span>
        </div>
      </div>

      {/* ── 최근 저장한 노트 ── */}
      {collection.length > 0 && (
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--bd)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ◈ 최근 저장한 노트
            </p>
            <button className="btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setActiveTab('collection')}>
              전체 보기 →
            </button>
          </div>
          <div className="m-recent-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: 'var(--bd)' }}>
            {collection.slice(0, 6).map((log: WhiskyLog) => (
              <div key={log.id}
                onClick={() => { loadLog({ ...log }); setActiveTab('share') }}
                style={{ background: 'var(--c2)', cursor: 'pointer', display: 'flex', gap: '0.6rem', padding: '0.6rem', alignItems: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}>
                {log.image_url ? (
                  <img src={log.image_url} alt="" style={{ width: 46, height: 46, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--bd)' }} />
                ) : (
                  <div style={{ width: 46, height: 46, background: 'var(--c3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: '1rem' }}>🥃</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: '0.1rem', textTransform: 'lowercase' }}>
                    {log.region || '—'}
                  </p>
                  <p className="display" style={{ fontSize: '0.92rem', color: 'var(--tx)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.brand || '—'}
                  </p>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--tx2)', marginTop: '0.1rem' }}>
                    {[log.age, log.abv].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <span className="display" style={{ fontSize: '1rem', color: 'var(--gold)' }}>{toHundred(log.score)}</span>
                  <p className="mono" style={{ fontSize: '0.55rem', color: 'var(--gd)', letterSpacing: '0.04em' }}>/ 100</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
