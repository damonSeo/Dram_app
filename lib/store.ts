import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WhiskyLog, TabName, ExtractedKeys } from '@/types'

const DEFAULT_LOG: Partial<WhiskyLog> = {
  color: 'Deep Gold',
  score: 4.0,
  casks: [],
}

interface DramStore {
  activeTab: TabName
  currentLog: Partial<WhiskyLog>
  collection: WhiskyLog[]
  extractedKeys: ExtractedKeys
  notionDbId: string
  notionToken: string
  setActiveTab: (tab: TabName) => void
  updateCurrentLog: (fields: Partial<WhiskyLog>) => void
  resetCurrentLog: () => void
  upsertToCollection: (log: WhiskyLog) => void
  setExtractedKeys: (keys: ExtractedKeys) => void
  setNotionDbId: (id: string) => void
  setNotionToken: (token: string) => void
}

export const useStore = create<DramStore>()(
  persist(
    (set, get) => ({
      activeTab: 'scan',
      currentLog: { ...DEFAULT_LOG },
      collection: [],
      extractedKeys: { nose: [], palate: [], finish: [] },
      notionDbId: '',
      notionToken: '',
      setActiveTab: (tab) => set({ activeTab: tab }),
      updateCurrentLog: (fields) =>
        set({ currentLog: { ...get().currentLog, ...fields } }),
      resetCurrentLog: () => set({ currentLog: { ...DEFAULT_LOG } }),
      upsertToCollection: (log) => {
        const existing = get().collection
        const idx = existing.findIndex((l) => l.id === log.id)
        if (idx >= 0) {
          const updated = [...existing]
          updated[idx] = log
          set({ collection: updated })
        } else {
          set({ collection: [log, ...existing] })
        }
      },
      setExtractedKeys: (keys) => set({ extractedKeys: keys }),
      setNotionDbId: (id) => set({ notionDbId: id }),
      setNotionToken: (token) => set({ notionToken: token }),
    }),
    {
      name: 'dram-gemini-store',
      partialize: (state) => ({
        collection: state.collection,
        notionDbId: state.notionDbId,
        notionToken: state.notionToken,
      }),
    }
  )
)
