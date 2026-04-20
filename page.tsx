'use client'
import { useStore } from '@/lib/store'
import TopBar from '@/components/TopBar'
import ScanPage from '@/components/ScanPage'
import TastingPage from '@/components/TastingPage'
import CollectionPage from '@/components/CollectionPage'
import SharePage from '@/components/SharePage'
import Toast, { ToastProvider } from '@/components/Toast'

export default function Home() {
  const activeTab = useStore((s) => s.activeTab)

  return (
    <ToastProvider>
      <TopBar />
      <main style={{ paddingTop: '56px', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {activeTab === 'scan' && <ScanPage />}
        {activeTab === 'tasting' && <TastingPage />}
        {activeTab === 'collection' && <CollectionPage />}
        {activeTab === 'share' && <SharePage />}
      </main>
      <Toast />
    </ToastProvider>
  )
}
