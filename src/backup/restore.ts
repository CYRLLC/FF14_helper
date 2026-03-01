import JSZip from 'jszip'
import type { BackupManifest, RestoreInspection } from '../types'

function parseManifest(rawValue: string | null): BackupManifest | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<BackupManifest>

    if (
      typeof parsed.version !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      parsed.platform !== 'windows' ||
      typeof parsed.sourceRootName !== 'string' ||
      typeof parsed.characterCount !== 'number' ||
      !Array.isArray(parsed.includedPaths)
    ) {
      return null
    }

    return {
      version: parsed.version,
      createdAt: parsed.createdAt,
      platform: 'windows',
      sourceRootName: parsed.sourceRootName,
      characterCount: parsed.characterCount,
      includedPaths: parsed.includedPaths.filter(
        (entry): entry is string => typeof entry === 'string',
      ),
    }
  } catch {
    return null
  }
}

export async function inspectBackupArchive(file: File): Promise<RestoreInspection> {
  return inspectBackupBytes(new Uint8Array(await file.arrayBuffer()), file.name, file.size)
}

export async function inspectBackupBytes(
  bytes: Uint8Array,
  fileName = 'backup.zip',
  size = bytes.byteLength,
): Promise<RestoreInspection> {
  const archive = await JSZip.loadAsync(bytes)
  const entries = Object.values(archive.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
  const manifestText = await archive.file('backup-manifest.json')?.async('string')
  const manifest = parseManifest(manifestText ?? null)

  return {
    fileName,
    size,
    entries,
    manifest,
  }
}
