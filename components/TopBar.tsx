'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/Toast'
import UserMenu from '@/components/UserMenu'
import type { TabName } from '@/types'

// 상단 네비 탭 (Input · Share 제거)
const TABS: { id: TabName; label: string }[] = [
  { id: 'home',       label: 'Home' },
  { id: 'tasting',   label: 'Notes' },
  { id: 'collection',label: 'Archive' },
  { id: 'search',    label: 'Search' },
]

// 모바일 하단 바
const BOTTOM_TABS: { id: TabName; label: string; icon: string }[] = [
  { id: 'home',       label: 'Home',    icon: '⌂' },
  { id: 'tasting',   label: 'Notes',   icon: '✎' },
  { id: 'collection',label: 'Archive', icon: '◈' },
  { id: 'search',    label: 'Search',  icon: '⌕' },
]

export default function TopBar() {
  const { activeTab, setActiveTab, isDirty, startNewNote, saveCurrentLog, resetCurrentLog } = useStore()
  const { showToast } = useToast()

  const [confirm, setConfirm] = useState<{ open: boolean; target?: TabName; action?: 'navigate' | 'new' }>({ open: false })
  const [busy, setBusy] = useState(false)

  const canTriggerDirty = activeTab === 'scan' || activeTab === 'tasting'
  const isTabActive = (id: TabName) => activeTab === id

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

  const proceedWithoutSave = () => {
    if (confirm.action === 'new') {
      startNewNote()
    } else if (confirm.target) {
      resetCurrentLog()
      setActiveTab(confirm.target)
    }
    setConfirm({ open: false })
  }

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
      {/* ── 데스크탑 헤더 ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(48,44,44,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--bd2)',
        height: '56px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 1.5rem',
      }}>
        {/* 로고 */}
        <button onClick={() => handleTabClick('home')} title="홈으로" className="brand-logo"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, padding: '0.1rem 0', gap: '2px' }}>
          <span className="display" style={{ fontSize: '1rem', letterSpacing: '0.28em', color: 'var(--gold)', fontWeight: 500 }}>OAK</span>
          <span className="display" style={{ fontSize: '0.62rem', letterSpacing: '0.22em', color: 'var(--gold)', opacity: 0.85 }}>THE RECORD</span>
        </button>

        {/* 데스크탑 탭 — 모바일에서 숨김 */}
        <nav className="topbar-nav" style={{ display: 'flex', alignItems: 'center' }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => handleTabClick(tab.id)} className="mono"
              style={{
                background: 'transparent', border: 'none',
                borderBottom: isTabActive(tab.id) ? '2px solid var(--gold)' : '2px solid transparent',
                color: isTabActive(tab.id) ? 'var(--gold)' : 'var(--tx2)',
                padding: '0 1rem', height: '56px',
                fontSize: '0.7rem', letterSpacing: '0.08em',
                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase',
              }}>
              {tab.label}
              {isTabActive(tab.id) && isDirty && canTriggerDirty && (
                <span style={{ marginLeft: 6, color: '#cf7e7e', fontSize: '0.6rem' }}>●</span>
              )}
            </button>
          ))}

          {/* + New Note */}
          <button onClick={handleNewNote} className="mono topbar-newnote" title="새 노트 시작"
            style={{
              background: 'var(--gold)', border: 'none', color: '#000',
              padding: '0.4rem 0.8rem', marginLeft: '0.75rem',
              fontSize: '0.65rem', letterSpacing: '0.08em',
              cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase',
            }}>
            + New Note
          </button>

          <div style={{ marginLeft: '0.5rem' }}>
            <UserMenu />
          </div>
        </nav>

        {/* 모바일 우측 — UserMenu만 */}
        <div className="topbar-mobile-right" style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={handleNewNote} className="mono"
            style={{
              background: 'var(--gold)', border: 'none', color: '#000',
              padding: '0.35rem 0.65rem', fontSize: '0.6rem',
              letterSpacing: '0.06em', cursor: 'pointer', fontWeight: 700,
            }}>
            + New
          </button>
          <UserMenu />
        </div>
      </header>

      {/* ── 모바일 하단 네비 ── */}
      <nav className="bottom-nav">
        {BOTTOM_TABS.map(tab => (
          <button key={tab.id} onClick={() => handleTabClick(tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '3px', background: 'none', border: 'none', cursor: 'pointer',
              color: isTabActive(tab.id) ? 'var(--gold)' : 'var(--tx3)',
              padding: '0.5rem 0', transition: 'color 0.15s',
            }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{tab.icon}</span>
            <span className="mono" style={{ fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tab.label}</span>
            {isTabActive(tab.id) && (
              <span style={{ position: 'absolute', bottom: 0, width: 24, height: 2, background: 'var(--gold)', borderRadius: 1 }} />
            )}
          </button>
        ))}
      </nav>

      {/* ── 저장 확인 모달 ── */}
      {confirm.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setConfirm({ open: false }) }}>
          <div style={{ background: 'var(--c2)', border: '1px solid var(--gold)', maxWidth: 440, width: '100%' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bd)' }}>
              <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>⚠ 저장하지 않은 변경사항</p>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ color: 'var(--tx)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                저장 없이 {confirm.action === 'new' ? '새 노트를 시작' : '다른 탭으로 이동'}하시겠습니까?
              </p>
              <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--tx3)', lineHeight: 1.5 }}>
                현재 작성 중인 노트가 컬렉션에 저장되지 않았습니다.
              </p>
            </div>
            <div className="m-confirm-actions" style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--bd)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn-ghost" disabled={busy} style={{ fontSize: '0.72rem' }} onClick={() => setConfirm({ open: false })}>취소</button>
              <button className="btn-outline-gold" disabled={busy} style={{ fontSize: '0.72rem' }} onClick={saveThenProceed}>
                {busy ? <span className="spinner" /> : null}아니요 · 저장하고 이동
              </button>
              <button disabled={busy} onClick={proceedWithoutSave}
                style={{ background: 'transparent', border: '1px solid #cf7e7e', color: '#cf7e7e', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'var(--mono)' }}>
                예 · 저장 없이 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
