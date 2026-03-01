import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { inspectBackupBytes } from './restore'

async function createZipBytes(entries: Record<string, string>): Promise<Uint8Array> {
  const archive = new JSZip()

  Object.entries(entries).forEach(([path, content]) => {
    archive.file(path, content)
  })

  const generated = await archive.generateAsync({ type: 'uint8array' })
  return generated
}

describe('inspectBackupArchive', () => {
  it('reads entries and parses backup-manifest when present', async () => {
    const zipped = await createZipBytes({
      'backup-manifest.json': JSON.stringify({
        version: '0.1.0',
        createdAt: '2026-03-01T00:00:00.000Z',
        platform: 'windows',
        sourceRootName: 'FINAL FANTASY XIV - A Realm Reborn',
        characterCount: 2,
        includedPaths: ['FFXIV.cfg', 'FFXIV_CHR001/HOTBAR.DAT'],
      }),
      'FFXIV.cfg': 'main',
    })
    const inspection = await inspectBackupBytes(zipped, 'sample.zip', zipped.byteLength)

    expect(inspection.fileName).toBe('sample.zip')
    expect(inspection.entries).toEqual(['backup-manifest.json', 'FFXIV.cfg'])
    expect(inspection.manifest?.characterCount).toBe(2)
  })

  it('returns a null manifest when backup-manifest is missing', async () => {
    const zipped = await createZipBytes({ 'FFXIV.cfg': 'main' })
    const inspection = await inspectBackupBytes(zipped, 'sample.zip', zipped.byteLength)

    expect(inspection.manifest).toBeNull()
    expect(inspection.entries).toEqual(['FFXIV.cfg'])
  })
})
