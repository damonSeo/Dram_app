'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import type { TabName } from '@/types'

const TABS: { id: TabName; label: string }[] = [
  { id: 'scan', label: 'Scan' },
  { id: 'tasting', label: 'Notes' },
  { id: 'collection', label: 'Collection' },
  { id: 'share', label: 'Share' },
]

export default function TopBar() {
  const { activeTab, setActiveTab, isDirty, startNewNote, saveCurrentLog, resetCurrentLog } = useStore()
  const { showToast } = useToast()

  // 확인 모달: 저장 없이 이동 확인. action = 'navigate' | 'new'
  const [confirm, setConfirm] = useState<{ open: boolean; target?: TabName; action?: 'navigate' | 'new' }>({ open: false })
  const [busy, setBusy] = useState(false)

  const canTriggerDirty = activeTab === 'scan' || activeTab === 'tasting'

  const handleTabClick = (tab: TabName) => {
    if (tab === activeTab) return
    if (isDirty && canTriggerDirty) {
      setConfirm({ open: true, target: tab, action: 'navigate' })
    } else {
      setActiveTab(tab)
    }
  }

  const handleNewNote = () => {
    if (isDirty && canTriggerDirty) {
      setConfirm({ open: true, action: 'new' })
    } else {
      startNewNote()
    }
  }

  // "맞아 / 예 / 그냥 이동" — 저장 없이 진행
  const proceedWithoutSave = () => {
    if (confirm.action === 'new') {
      startNewNote()
    } else if (confirm.target) {
      resetCurrentLog()
      setActiveTab(confirm.target)
    }
    setConfirm({ open: false })
  }

  // "아니요" — 저장하고 이동
  const saveThenProceed = async () => {
    setBusy(true)
    try {
      await saveCurrentLog()
      showToast('컬렉션에 저장됨', 'ok')
      if (confirm.action === 'new') {
        startNewNote()
      } else if (confirm.target) {
        setActiveTab(confirm.target)
      }
      setConfirm({ open: false })
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '저장 실패', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(20,20,20,0.96)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--bd)',
        height: '56px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 1.5rem',
      }}>
        <span className="display" style={{ fontSize: '1.5rem', letterSpacing: '0.2em', color: 'var(--gold)' }}>
          DRAM
        </span>
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
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
              {tab.id === activeTab && isDirty && canTriggerDirty && (
                <span style={{ marginLeft: 6, color: '#cf7e7e', fontSize: '0.6rem' }}>●</span>
              )}
            </button>
          ))}
          <button
            onClick={handleNewNote}
            className="mono"
            title="새 노트 시작"
            style={{
              background: 'var(--gold)',
              border: 'none',
              color: '#000',
              padding: '0.4rem 0.8rem',
              marginLeft: '0.75rem',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            + New Note
          </button>
        </nav>
      </header>

      {/* 저장 확인 모달 */}
      {confirm.open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setConfirm({ open: false }) }}
        >
          <div style={{
            background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 440, width: '100%',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)' }}>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                ⚠ 저장하지 않은 변경사항
              </p>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ color: 'var(--tx)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                저장 없이 {confirm.action === 'new' ? '새 노트를 시작' : '다른 탭으로 이동'}하시겠습니까?
              </p>
              <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)', lineHeight: 1.5 }}>
                현재 작성 중인 노트가 컬렉션에 저장되지 않았습니다.
              </p>
            </div>
            <div style={{
              padding: '0.85rem 1.25rem', borderTop: '1px solid var(--bd)',
              display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap',
            }}>
              <button className="btn-ghost" disabled={busy}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setConfirm({ open: false })}>
                취소
              </button>
              <button className="btn-outline-gold" disabled={busy}
                style={{ fontSize: '0.72rem' }}
                onClick={saveThenProceed}>
                {busy ? <span className="spinner" /> : null}
                아니요 · 저장하고 이동
              </button>
              <button disabled={busy}
                onClick={proceedWithoutSave}
                style={{
                  background: 'transparent', border: '1px solid #cf7e7e', color: '#cf7e7e',
                  padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'var(--mono)',
                }}>
                예 · 저장 없이 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
