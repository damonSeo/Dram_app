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
  isDirty: boolean
  setActiveTab: (tab: TabName) => void
  updateCurrentLog: (fields: Partial<WhiskyLog>) => void
  resetCurrentLog: () => void
  startNewNote: () => void
  loadLog: (log: Partial<WhiskyLog>) => void
  setDirty: (v: boolean) => void
  setCollection: (logs: WhiskyLog[]) => void
  upsertToCollection: (log: WhiskyLog) => void
  removeFromCollection: (id: string) => void
  setExtractedKeys: (keys: ExtractedKeys) => void
  saveCurrentLog: () => Promise<WhiskyLog>
}

export const useStore = create<DramStore>()((set, get) => ({
  activeTab: 'scan',
  currentLog: { ...DEFAULT_LOG },
  collection: [],
  extractedKeys: { nose: [], palate: [], finish: [] },
  isDirty: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  updateCurrentLog: (fields) =>
    set({ currentLog: { ...get().currentLog, ...fields }, isDirty: true }),

  resetCurrentLog: () =>
    set({ currentLog: { ...DEFAULT_LOG }, isDirty: false, extractedKeys: { nose: [], palate: [], finish: [] } }),

  startNewNote: () =>
    set({
      currentLog: { ...DEFAULT_LOG },
      isDirty: false,
      extractedKeys: { nose: [], palate: [], finish: [] },
      activeTab: 'scan',
    }),

  loadLog: (log) =>
    set({ currentLog: { ...DEFAULT_LOG, ...log }, isDirty: false }),

  setDirty: (v) => set({ isDirty: v }),

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

  saveCurrentLog: async () => {
    const { currentLog, collection, upsertToCollection } = get()
    const hasContent =
      currentLog.brand || currentLog.nose || currentLog.palate || currentLog.finish || currentLog.comment
    if (!hasContent) throw new Error('저장할 내용이 없습니다')
    const isUpdate = !!currentLog.id && collection.some((l) => l.id === currentLog.id)
    const logBase = {
      ...currentLog,
      brand: currentLog.brand || '',
      region: currentLog.region || '',
      bottler: currentLog.bottler || 'OB',
      color: currentLog.color || 'Deep Gold',
      score: currentLog.score ?? 7.0,
      casks: currentLog.casks || [],
      date: currentLog.date || new Date().toISOString().split('T')[0],
    }
    const body = isUpdate ? { id: currentLog.id, ...logBase } : logBase
    const res = await fetch('/api/whisky-logs', {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { data?: WhiskyLog; error?: string }
    if (!res.ok) throw new Error(json.error || '저장 실패')
    if (json.data) upsertToCollection(json.data)
    set({ currentLog: { ...DEFAULT_LOG }, isDirty: false, extractedKeys: { nose: [], palate: [], finish: [] } })
    return json.data as WhiskyLog
  },
}))
