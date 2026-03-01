import { createContext } from 'react'
import type { SyncHistoryEntry, SyncPreferences, SyncState } from '../types'

export interface SyncContextValue {
  syncState: SyncState
  setPreferences: (patch: Partial<SyncPreferences>) => void
  addHistory: (entry: Omit<SyncHistoryEntry, 'id'>) => void
  clearHistory: () => void
  exportProfile: () => string
  importProfile: (rawValue: string) => void
}

export const SyncContext = createContext<SyncContextValue | null>(null)
