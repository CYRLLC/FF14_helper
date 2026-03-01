import type { BackupSourceSelection, BackupSourceSummary, LocalFileEntry } from '../types'

const CHARACTER_DIR_PATTERN = /^FFXIV_CHR[^/]+/i
const ROOT_CONFIG_PATTERN = /^FFXIV.*\.(cfg|dat)$/i

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function shouldIncludePath(relativePath: string): boolean {
  const normalizedPath = normalizeRelativePath(relativePath)

  if (!normalizedPath) {
    return false
  }

  const segments = normalizedPath.split('/')
  const [topLevel] = segments

  if (CHARACTER_DIR_PATTERN.test(topLevel)) {
    return true
  }

  return segments.length === 1 && ROOT_CONFIG_PATTERN.test(topLevel)
}

export function summarizeBackupSource(
  rootName: string,
  entries: LocalFileEntry[],
): BackupSourceSummary {
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    relativePath: normalizeRelativePath(entry.relativePath),
  }))

  const includedPaths = normalizedEntries
    .map((entry) => entry.relativePath)
    .filter(shouldIncludePath)
    .sort((left, right) => {
      const depthDifference = left.split('/').length - right.split('/').length

      if (depthDifference !== 0) {
        return depthDifference
      }

      return left.localeCompare(right)
    })

  const topLevelItems = new Set(includedPaths.map((path) => path.split('/')[0]))
  const characterDirs = [...topLevelItems].filter((item) => CHARACTER_DIR_PATTERN.test(item))

  const summary: BackupSourceSummary = {
    rootName,
    hasBootConfig: topLevelItems.has('FFXIV_BOOT.cfg'),
    hasMainConfig: topLevelItems.has('FFXIV.cfg'),
    characterDirs: characterDirs.sort((left, right) => left.localeCompare(right)),
    includedPaths,
  }

  if (!summary.hasBootConfig && !summary.hasMainConfig && summary.characterDirs.length === 0) {
    throw new Error('選取的資料夾內找不到 FF14 個人設定檔，請確認你選的是遊戲設定資料夾。')
  }

  return summary
}

export function scanSelectedEntries(
  rootName: string,
  entries: LocalFileEntry[],
): BackupSourceSelection {
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    relativePath: normalizeRelativePath(entry.relativePath),
  }))

  const summary = summarizeBackupSource(rootName, normalizedEntries)
  const includedPathSet = new Set(summary.includedPaths)
  const filteredEntries = normalizedEntries.filter((entry) =>
    includedPathSet.has(entry.relativePath),
  )

  return {
    rootName,
    entries: filteredEntries,
    summary,
  }
}
