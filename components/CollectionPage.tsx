'use client'
import { useStore } from '@/lib/store'
import type { WhiskyLog } from '@/types'

const COLOR_HEX: Record<string, string> = {
  'Pale Straw': '#F5E6A3',
  'Light Gold': '#E8C84A',
  'Deep Gold': '#C9A84C',
  'Amber': '#A0622A',
  'Deep Amber': '#7A3E18',
  'Mahogany': '#4A1E0A',
}

export default function CollectionPage() {
  const { collection, updateCurrentLog, setActiveTab } = useStore()

  const handleCardClick = (log: WhiskyLog) => {
    updateCurrentLog({ ...log })
    setActiveTab('share')
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--bd)', paddingBottom: '1rem' }}>
        <h1 className="display" style={{ fontSize: '2rem', color: 'var(--tx)' }}>Collection</h1>
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{collection.length} Drams</span>
      </div>

      {collection.length === 0 ? (
        <p style={{ color: 'var(--tx2)', fontStyle: 'italic', textAlign: 'center', padding: '4rem 0' }}>
          Your collection is empty. Start by scanning a label.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1px', background: 'var(--bd)' }}>
          {collection.map((log) => (
            <div
              key={log.id}
              onClick={() => handleCardClick(log)}
              style={{ background: 'var(--c2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', paddingBottom: '0.75rem' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c3)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c2)' }}
            >
              <div style={{ height: 3, background: COLOR_HEX[log.color] || 'var(--gold)' }} />
              <div style={{ padding: '0.75rem 0.9rem' }}>
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                  {log.region?.toLowerCase()}
                </p>
                <p className="display" style={{ fontSize: '1.2rem', lineHeight: 1.2, marginBottom: '0.25rem', color: 'var(--tx)' }}>
                  {log.brand || '—'}
                </p>
                <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--tx2)', marginBottom: '0.5rem' }}>
                  {[log.age, log.bottler === 'IB' ? (log.ib_name || 'IB') : 'OB'].filter(Boolean).join(' · ')}
                </p>
                {log.nose && (
                  <p style={{
                    fontSize: '0.75rem', color: 'var(--tx2)', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.75rem',
                  }}>
                    {log.nose}
                  </p>
                )}
              </div>
              <div style={{ padding: '0 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="display" style={{ fontSize: '1.1rem', color: 'var(--gold)' }}>★ {log.score?.toFixed(1)}</span>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {(log.casks || []).slice(0, 2).map((c) => (
                    <span key={c} className="mono" style={{ fontSize: '0.55rem', color: 'var(--tx3)', border: '1px solid var(--bd)', padding: '0.1rem 0.35rem' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: 'var(--tx3)', fontSize: '0.8rem' }}>↗</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
