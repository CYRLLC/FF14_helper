import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function collectFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const nextPath = path.join(root, entry)
    const stat = statSync(nextPath)

    if (stat.isDirectory()) {
      return collectFiles(nextPath)
    }

    if (/\.(ts|tsx|md)$/u.test(nextPath)) {
      return [nextPath]
    }

    return []
  })
}

describe('copy integrity', () => {
  it('does not contain replacement or private-use mojibake characters', () => {
    const rootDir = path.resolve(import.meta.dirname, '..')
    const files = [...collectFiles(rootDir), path.resolve(rootDir, '..', 'README.md')]
    const suspiciousPattern = /[\uFFFD\uE000-\uF8FF]|\?[\u3400-\u9FFF]/u
    const offenders = files.filter((filePath) => suspiciousPattern.test(readFileSync(filePath, 'utf8')))

    expect(offenders).toEqual([])
  })
})
