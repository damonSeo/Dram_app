'use client'
import { useStore } from '@/lib/store'
import { TabName } from '@/types'

const TABS: { id: TabName; label: string }[] = [
  { id: 'scan', label: 'Scan' },
  { id: 'tasting', label: 'Notes' },
  { id: 'collection', label: 'Collection' },
  { id: 'share', label: 'Share' },
]

export default function TopBar() {
  const { activeTab, setActiveTab } = useStore()

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--bd)',
      height: '56px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 1.5rem',
    }}>
      <span className="display" style={{ fontSize: '1.4rem', letterSpacing: '0.15em', color: 'var(--gold)' }}>
        DRAM
      </span>
      <nav style={{ display: 'flex', gap: '0' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="mono"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--gold)' : 'var(--tx2)',
              padding: '0 1rem',
              height: '56px',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
