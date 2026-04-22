import { create } from 'zustand'
import type { WhiskyLog, TabName, ExtractedKeys } from '@/types'

const DEFAULT_LOG: Partial<WhiskyLog> = {
  color: 'Deep Gold',
  score: 7.0,
  casks: [],
}

interface DramStore {
  activeTab: TabName
  currentLog: Partial<WhiskyLog>
  collection: WhiskyLog[]
  extractedKeys: ExtractedKeys
  setActiveTab: (tab: TabName) => void
  updateCurrentLog: (fields: Partial<WhiskyLog>) => void
  resetCurrentLog: () => void
  setCollection: (logs: WhiskyLog[]) => void
  upsertToCollection: (log: WhiskyLog) => void
  removeFromCollection: (id: string) => void
  setExtractedKeys: (keys: ExtractedKeys) => void
}

export const useStore = create<DramStore>()((set, get) => ({
  activeTab: 'scan',
  currentLog: { ...DEFAULT_LOG },
  collection: [],
  extractedKeys: { nose: [], palate: [], finish: [] },

  setActiveTab: (tab) => set({ activeTab: tab }),
  updateCurrentLog: (fields) => set({ currentLog: { ...get().currentLog, ...fields } }),
  resetCurrentLog: () => set({ currentLog: { ...DEFAULT_LOG } }),

  setCollection: (logs) => set({ collection: logs }),

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

  removeFromCollection: (id) =>
    set({ collection: get().collection.filter((l) => l.id !== id) }),

  setExtractedKeys: (keys) => set({ extractedKeys: keys }),
}))
