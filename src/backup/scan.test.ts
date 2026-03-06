import { describe, expect, it } from 'vitest'
import { scanSelectedEntries, summarizeBackupSource } from './scan'
import type { LocalFileEntry } from '../types'

function createEntry(relativePath: string): LocalFileEntry {
  return {
    relativePath,
    name: relativePath.split('/').at(-1) ?? relativePath,
    getFile: async () => new File(['sample'], relativePath),
  }
}

describe('scanSelectedEntries', () => {
  it('recognizes a valid FF14 settings directory and filters by allowlist', () => {
    const result = scanSelectedEntries('FINAL FANTASY XIV - A Realm Reborn', [
      createEntry('FFXIV.cfg'),
      createEntry('FFXIV_BOOT.cfg'),
      createEntry('FFXIV_CHR0042/HOTBAR.DAT'),
      createEntry('FFXIV_CHR0042/GEARSET.DAT'),
      createEntry('notes.txt'),
      createEntry('screenshots/photo.png'),
    ])

    expect(result.summary.hasMainConfig).toBe(true)
    expect(result.summary.hasBootConfig).toBe(true)
    expect(result.summary.characterDirs).toEqual(['FFXIV_CHR0042'])
    expect(result.summary.includedPaths).toEqual([
      'FFXIV_BOOT.cfg',
      'FFXIV.cfg',
      'FFXIV_CHR0042/GEARSET.DAT',
      'FFXIV_CHR0042/HOTBAR.DAT',
    ])
    expect(result.entries).toHaveLength(4)
  })

  it('rejects a directory that does not look like FF14 settings', () => {
    expect(() =>
      summarizeBackupSource('Documents', [createEntry('screenshots/photo.png'), createEntry('todo.txt')]),
    ).toThrow('選取的資料夾看起來不像 FF14 設定資料夾')
  })
})
