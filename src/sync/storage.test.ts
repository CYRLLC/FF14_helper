import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SYNC_STATE,
  importSyncState,
  normalizeSyncState,
  recordSyncHistory,
  updateSyncPreferences,
} from './storage'

describe('sync storage helpers', () => {
  it('normalizes incomplete values to safe defaults', () => {
    const state = normalizeSyncState({
      preferences: {
        preferredTarget: 'unknown',
        maxHistory: 999,
      },
    })

    expect(state.preferences.preferredTarget).toBe('download')
    expect(state.preferences.maxHistory).toBe(20)
    expect(state.history).toEqual([])
  })

  it('caps history to maxHistory and respects keepHistory', () => {
    const updated = updateSyncPreferences(DEFAULT_SYNC_STATE, {
      maxHistory: 1,
    })
    const withFirst = recordSyncHistory(updated, {
      createdAt: '2026-03-01T00:00:00.000Z',
      eventType: 'downloaded',
      target: 'download',
      fileName: 'a.zip',
      size: 10,
      sourceRootName: 'A',
      characterCount: 1,
    })
    const withSecond = recordSyncHistory(withFirst, {
      createdAt: '2026-03-01T00:01:00.000Z',
      eventType: 'uploaded',
      target: 'onedrive',
      fileName: 'b.zip',
      size: 20,
      sourceRootName: 'B',
      characterCount: 2,
      remotePathLabel: 'OneDrive > Apps > FF14Helper',
    })

    expect(withSecond.history).toHaveLength(1)
    expect(withSecond.history[0]?.fileName).toBe('b.zip')

    const noHistory = updateSyncPreferences(withSecond, {
      keepHistory: false,
    })

    expect(noHistory.history).toEqual([])
  })

  it('imports a profile and stamps importedAt', () => {
    const imported = importSyncState(
      JSON.stringify({
        preferences: {
          preferredTarget: 'gdrive',
          downloadBeforeCloudUpload: false,
          keepHistory: true,
          maxHistory: 3,
        },
        history: [],
      }),
    )

    expect(imported.preferences.preferredTarget).toBe('gdrive')
    expect(imported.importedAt).not.toBeNull()
  })
})
