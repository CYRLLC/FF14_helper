import { describe, expect, it } from 'vitest'
import { buildBackupManifest, createBackupArtifact, createBackupFileName } from './archive'
import type { BackupSourceSelection } from '../types'

function createSelection(): BackupSourceSelection {
  return {
    rootName: 'FINAL FANTASY XIV - A Realm Reborn',
    summary: {
      rootName: 'FINAL FANTASY XIV - A Realm Reborn',
      hasBootConfig: true,
      hasMainConfig: true,
      characterDirs: ['FFXIV_CHR001'],
      includedPaths: ['FFXIV.cfg', 'FFXIV_BOOT.cfg', 'FFXIV_CHR001/HOTBAR.DAT'],
    },
    entries: [
      {
        relativePath: 'FFXIV.cfg',
        name: 'FFXIV.cfg',
        getFile: async () => new File(['main'], 'FFXIV.cfg'),
      },
      {
        relativePath: 'FFXIV_BOOT.cfg',
        name: 'FFXIV_BOOT.cfg',
        getFile: async () => new File(['boot'], 'FFXIV_BOOT.cfg'),
      },
      {
        relativePath: 'FFXIV_CHR001/HOTBAR.DAT',
        name: 'HOTBAR.DAT',
        getFile: async () => new File(['bars'], 'HOTBAR.DAT'),
      },
    ],
  }
}

describe('archive helpers', () => {
  it('builds a predictable backup file name', () => {
    const name = createBackupFileName(new Date('2026-03-01T09:08:07'))
    expect(name).toBe('ff14-backup-20260301-090807.zip')
  })

  it('creates a manifest and archive payload', async () => {
    const selection = createSelection()
    const createdAt = new Date('2026-03-01T09:08:07')
    const artifact = await createBackupArtifact(selection, '0.1.0', createdAt)
    const manifest = buildBackupManifest(selection, '0.1.0', createdAt.toISOString())

    expect(artifact.fileName).toBe('ff14-backup-20260301-090807.zip')
    expect(artifact.manifest).toEqual(manifest)
    expect(artifact.blob.size).toBe(artifact.size)
    expect(artifact.blob.type).toBe('application/zip')
    expect(artifact.size).toBeGreaterThan(0)
  })
})
