import type { SyncHistoryEntry, SyncPreferences, SyncState, SyncTarget } from '../types'

const STORAGE_KEY = 'ff14-helper:sync-state'

const DEFAULT_PREFERENCES: SyncPreferences = {
  preferredTarget: 'download',
  downloadBeforeCloudUpload: true,
  keepHistory: true,
  maxHistory: 8,
}

export const DEFAULT_SYNC_STATE: SyncState = {
  preferences: DEFAULT_PREFERENCES,
  history: [],
  importedAt: null,
}

function createHistoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeTarget(value: unknown): SyncTarget {
  return value === 'onedrive' || value === 'gdrive' ? value : 'download'
}

function normalizeMaxHistory(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.maxHistory
  }

  return Math.max(1, Math.min(20, Math.round(value)))
}

export function normalizeSyncState(value: unknown): SyncState {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SYNC_STATE
  }

  const rawState = value as Partial<SyncState>
  const rawPreferences = rawState.preferences as Partial<SyncPreferences> | undefined
  const preferences: SyncPreferences = {
    preferredTarget: normalizeTarget(rawPreferences?.preferredTarget),
    downloadBeforeCloudUpload:
      typeof rawPreferences?.downloadBeforeCloudUpload === 'boolean'
        ? rawPreferences.downloadBeforeCloudUpload
        : DEFAULT_PREFERENCES.downloadBeforeCloudUpload,
    keepHistory:
      typeof rawPreferences?.keepHistory === 'boolean'
        ? rawPreferences.keepHistory
        : DEFAULT_PREFERENCES.keepHistory,
    maxHistory: normalizeMaxHistory(rawPreferences?.maxHistory),
  }

  const history = Array.isArray(rawState.history)
    ? rawState.history
        .filter((entry): entry is SyncHistoryEntry => Boolean(entry && typeof entry === 'object'))
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : createHistoryId(),
          createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
          eventType: (entry.eventType === 'uploaded' ? 'uploaded' : 'downloaded') as
            | 'uploaded'
            | 'downloaded',
          target: normalizeTarget(entry.target),
          fileName: typeof entry.fileName === 'string' ? entry.fileName : 'ff14-backup.zip',
          size: typeof entry.size === 'number' ? entry.size : 0,
          sourceRootName:
            typeof entry.sourceRootName === 'string' ? entry.sourceRootName : 'FF14 Settings',
          characterCount: typeof entry.characterCount === 'number' ? entry.characterCount : 0,
          remotePathLabel:
            typeof entry.remotePathLabel === 'string' ? entry.remotePathLabel : undefined,
        }))
    : []

  return {
    preferences,
    history: preferences.keepHistory ? history.slice(0, preferences.maxHistory) : [],
    importedAt: typeof rawState.importedAt === 'string' ? rawState.importedAt : null,
  }
}

export function loadSyncState(): SyncState {
  if (typeof window === 'undefined') {
    return DEFAULT_SYNC_STATE
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)

    if (!rawValue) {
      return DEFAULT_SYNC_STATE
    }

    return normalizeSyncState(JSON.parse(rawValue))
  } catch {
    return DEFAULT_SYNC_STATE
  }
}

export function persistSyncState(state: SyncState): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function updateSyncPreferences(
  currentState: SyncState,
  patch: Partial<SyncPreferences>,
): SyncState {
  const nextPreferences: SyncPreferences = {
    ...currentState.preferences,
    ...patch,
    preferredTarget: normalizeTarget(patch.preferredTarget ?? currentState.preferences.preferredTarget),
    maxHistory: normalizeMaxHistory(patch.maxHistory ?? currentState.preferences.maxHistory),
  }

  return {
    ...currentState,
    preferences: nextPreferences,
    history: nextPreferences.keepHistory
      ? currentState.history.slice(0, nextPreferences.maxHistory)
      : [],
  }
}

export function recordSyncHistory(
  currentState: SyncState,
  entry: Omit<SyncHistoryEntry, 'id'>,
): SyncState {
  if (!currentState.preferences.keepHistory) {
    return currentState
  }

  const nextEntry: SyncHistoryEntry = {
    ...entry,
    id: createHistoryId(),
  }

  return {
    ...currentState,
    history: [nextEntry, ...currentState.history].slice(0, currentState.preferences.maxHistory),
  }
}

export function clearSyncHistory(currentState: SyncState): SyncState {
  return {
    ...currentState,
    history: [],
  }
}

export function exportSyncState(state: SyncState): string {
  return JSON.stringify(state, null, 2)
}

export function importSyncState(rawValue: string): SyncState {
  const parsed = JSON.parse(rawValue) as unknown

  return {
    ...normalizeSyncState(parsed),
    importedAt: new Date().toISOString(),
  }
}
