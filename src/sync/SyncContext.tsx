import { useEffect, useState, type ReactNode } from 'react'
import { SyncContext } from './context'
import type { SyncHistoryEntry, SyncPreferences, SyncState } from '../types'
import {
  clearSyncHistory,
  exportSyncState,
  importSyncState,
  loadSyncState,
  persistSyncState,
  recordSyncHistory,
  updateSyncPreferences,
} from './storage'

interface SyncProviderProps {
  children: ReactNode
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>(() => loadSyncState())

  useEffect(() => {
    persistSyncState(syncState)
  }, [syncState])

  function setPreferences(patch: Partial<SyncPreferences>): void {
    setSyncState((currentState) => updateSyncPreferences(currentState, patch))
  }

  function addHistory(entry: Omit<SyncHistoryEntry, 'id'>): void {
    setSyncState((currentState) => recordSyncHistory(currentState, entry))
  }

  function clearHistory(): void {
    setSyncState((currentState) => clearSyncHistory(currentState))
  }

  function exportProfile(): string {
    return exportSyncState(syncState)
  }

  function importProfile(rawValue: string): void {
    setSyncState(importSyncState(rawValue))
  }

  return (
    <SyncContext.Provider
      value={{
        syncState,
        setPreferences,
        addHistory,
        clearHistory,
        exportProfile,
        importProfile,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}
