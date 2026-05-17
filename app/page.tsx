'use client'
import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import TopBar from '@/components/TopBar'
import HomePage from '@/components/HomePage'
import ScanPage from '@/components/ScanPage'
import TastingPage from '@/components/TastingPage'
import CollectionPage from '@/components/CollectionPage'
import SharePage from '@/components/SharePage'
import SearchPage from '@/components/SearchPage'
import { ToastProvider } from '@/components/Toast'
import type { WhiskyLog, TabName } from '@/types'

export default function Home() {
  const { activeTab, setCollection, loadBookmarks, currentUserId } = useStore()
  // popstate(뒤로가기)로 인한 탭 변경 시 history push를 건너뛰기 위한 플래그
  const skipPushRef = useRef(false)

  useEffect(() => {
    fetch('/api/whisky-logs')
      .then((r) => r.json())
      .then((json: { data?: WhiskyLog[] }) => {
        if (Array.isArray(json.data)) setCollection(json.data)
      })
      .catch(() => {})
  }, [setCollection])

  // 로그인되면 북마크 로드
  useEffect(() => {
    if (currentUserId) loadBookmarks()
  }, [currentUserId, loadBookmarks])

  // ── 브라우저/사파리 뒤로가기 ↔ activeTab 동기화 ──
  // location.hash를 단일 진실 소스로 사용 (Safari macOS는 popstate state를 누락하는 경우가 있음)
  useEffect(() => {
    const VALID: TabName[] = ['home', 'scan', 'tasting', 'collection', 'search', 'share', 'cocktail']
    const tabFromHash = (): TabName | null => {
      const h = window.location.hash.replace(/^#/, '') as TabName
      return VALID.includes(h) ? h : null
    }
    const setTab = useStore.getState().setActiveTab
    const cur = useStore.getState().activeTab

    // 첫 진입: URL 해시가 유효하면 그 탭으로, 아니면 현재 탭을 해시에 고정
    const initial = tabFromHash()
    if (initial && initial !== cur) {
      skipPushRef.current = true
      setTab(initial)
      window.history.replaceState({ tab: initial }, '', `#${initial}`)
    } else {
      window.history.replaceState({ tab: cur }, '', `#${cur}`)
    }

    // 뒤로/앞으로 가기 또는 사파리 스와이프 → 해시 기준으로 탭 복원
    const onNav = () => {
      const t = tabFromHash() || (window.history.state as { tab?: TabName } | null)?.tab || 'home'
      if (t === useStore.getState().activeTab) return
      skipPushRef.current = true
      setTab(t)
    }
    window.addEventListener('popstate', onNav)
    window.addEventListener('hashchange', onNav)
    return () => {
      window.removeEventListener('popstate', onNav)
      window.removeEventListener('hashchange', onNav)
    }
  }, [])

  // 탭이 사용자 조작으로 바뀌면 history에 push (뒤로가기로 복귀 가능하게)
  useEffect(() => {
    if (skipPushRef.current) { skipPushRef.current = false; return }
    if (window.location.hash.replace(/^#/, '') === activeTab) return
    window.history.pushState({ tab: activeTab }, '', `#${activeTab}`)
  }, [activeTab])

  return (
    <ToastProvider>
      <TopBar />
      <main style={{ paddingTop: '56px', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'scan' && <ScanPage />}
        {activeTab === 'tasting' && <TastingPage />}
        {activeTab === 'collection' && <CollectionPage />}
        {activeTab === 'search' && <SearchPage />}
        {activeTab === 'share' && <SharePage />}
      </main>
    </ToastProvider>
  )
}
