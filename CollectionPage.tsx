'use client'
import { useStore } from '@/lib/store'
import { WhiskyLog } from '@/types'

const COLOR_MAP: Record<string, string> = {
  'Pale Straw': '#F5F0DC',
  'Light Gold': '#E8CC7A',
  'Deep Gold': '#C9A84C',
  'Amber': '#A0693A',
  'Deep Amber': '#7A4820',
  'Mahogany': '#4A1E0A',
}

function CollectionCard({ log, onClick }: { log: WhiskyLog; onClick: () => void }) {
  const colorHex = COLOR_MAP[log.color] || '#C9A84C'

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--c2)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--c2)')}
    >
      {/* Color bar */}
      <div style={{ height: '3px', background: colorHex, width: '100%' }} />
      {/* Arrow icon */}
      <span style={{
        position: 'absolute', top: '0.75rem', right: '0.75rem',
        color: 'var(--tx3)', fontSize: '0.75rem',
      }}>↗</span>
      <div style={{ padding: '1rem' }}>
        <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
          {log.region}
        </p>
        <p className="display" style={{ fontSize: '1.4rem', color: 'var(--tx)', marginBottom: '0.3rem', lineHeight: '1.2' }}>
          {log.brand}
        </p>
        <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '0.75rem' }}>
          {log.age && `${log.age}y`}{log.age && log.bottler && ' · '}{log.bottler}
        </p>
        {log.nose && (
          <p style={{
            fontSize: '0.75rem', color: 'var(--tx2)', lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: '0.75rem',
          }}>
            {log.nose}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="display" style={{ fontSize: '1.6rem', color: 'var(--gold)' }}>
            {(log.score || 0).toFixed(1)}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: 'flex-end' }}>
            {(log.casks || []).slice(0, 2).map(c => (
              <span key={c} className="chip" style={{ cursor: 'default', fontSize: '0.6rem' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CollectionPage() {
  const { collection, updateCurrentLog, setActiveTab } = useStore()

  const handleCardClick = (log: WhiskyLog) => {
    updateCurrentLog(log)
    setActiveTab('share')
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)' }}>Collection</h1>
        <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx2)' }}>
          {collection.length} Drams
        </p>
      </div>

      {collection.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p style={{ fontStyle: 'italic', color: 'var(--tx2)', fontSize: '0.9rem' }}>
            Your collection is empty. Start by scanning a label.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: '1px',
          background: 'var(--bd)',
        }}>
          {collection.map(log => (
            <CollectionCard key={log.id} log={log} onClick={() => handleCardClick(log)} />
          ))}
        </div>
      )}
    </div>
  )
}
