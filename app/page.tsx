'use client'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import TopBar from '@/components/TopBar'
import HomePage from '@/components/HomePage'
import ScanPage from '@/components/ScanPage'
import TastingPage from '@/components/TastingPage'
import CollectionPage from '@/components/CollectionPage'
import SharePage from '@/components/SharePage'
import SearchPage from '@/components/SearchPage'
import { ToastProvider } from '@/components/Toast'
import type { WhiskyLog } from '@/types'

export default function Home() {
  const { activeTab, setCollection, loadBookmarks, currentUserId } = useStore()

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
