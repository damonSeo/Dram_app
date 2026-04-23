'use client'
import { useStore } from '@/lib/store'
import type { WhiskyLog } from '@/types'

const cardBase: React.CSSProperties = {
  border: '1px solid var(--bd2)',
  background: 'linear-gradient(180deg, rgba(201,168,76,0.06) 0%, rgba(28,28,28,0.9) 100%)',
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
    e.currentTarget.style.background = 'linear-gradient(180deg, rgba(201,168,76,0.14) 0%, rgba(36,36,36,0.95) 100%)'
  }
  const hoverOut = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'var(--bd2)'
    e.currentTarget.style.background = 'linear-gradient(180deg, rgba(201,168,76,0.06) 0%, rgba(28,28,28,0.9) 100%)'
  }

  const goScan = () => { setScanMode('scan'); setActiveTab('scan') }
  const goManual = () => { setScanMode('manual'); setActiveTab('scan') }
  const goCocktail = () => { setArchiveSubTab('cocktail' as const); setActiveTab('collection') }

  return (
    <div className="m-page fade-up" style={{ maxWidth: 860, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
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
                <span className="display" style={{ fontSize: '0.9rem', color: 'var(--gold)', flexShrink: 0 }}>
                  ★ {log.score?.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
