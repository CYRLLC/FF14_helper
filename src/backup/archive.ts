import { strToU8, zipSync } from 'fflate'
import type { BackupArtifact, BackupManifest, BackupSourceSelection } from '../types'

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

export function createBackupFileName(now = new Date()): string {
  const stamp = [
    now.getFullYear().toString(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('')
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('')

  return `ff14-backup-${stamp}-${time}.zip`
}

export function buildBackupManifest(
  selection: BackupSourceSelection,
  version: string,
  createdAt = new Date().toISOString(),
): BackupManifest {
  return {
    version,
    createdAt,
    platform: 'windows',
    sourceRootName: selection.rootName,
    characterCount: selection.summary.characterDirs.length,
    includedPaths: selection.summary.includedPaths,
  }
}

export async function createBackupArtifact(
  selection: BackupSourceSelection,
  version: string,
  now = new Date(),
): Promise<BackupArtifact> {
  const manifest = buildBackupManifest(selection, version, now.toISOString())
  const archiveMap: Record<string, Uint8Array> = {
    'backup-manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  }

  for (const entry of selection.entries) {
    const file = await entry.getFile()
    archiveMap[entry.relativePath] = new Uint8Array(await file.arrayBuffer())
  }

  const zipped = zipSync(archiveMap, { level: 6 })
  const safeBuffer = new ArrayBuffer(zipped.byteLength)
  new Uint8Array(safeBuffer).set(zipped)
  const blob = new Blob([safeBuffer], { type: 'application/zip' })

  return {
    fileName: createBackupFileName(now),
    blob,
    size: blob.size,
    manifest,
  }
}

export function triggerArtifactDownload(artifact: BackupArtifact): void {
  const objectUrl = URL.createObjectURL(artifact.blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = artifact.fileName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}
