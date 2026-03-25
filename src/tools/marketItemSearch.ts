import { decode } from '@msgpack/msgpack'

export interface MarketItemLookupEntry {
  itemRowId: number
  itemName: string
}

interface MarketItemSearchEntry extends MarketItemLookupEntry {
  normalizedName: string
}

export interface MarketItemSearchCandidate extends MarketItemLookupEntry {
  normalizedName: string
  score: number
  exactMatch: boolean
  substringLength: number
}

export interface MarketItemSearchIndex {
  entries: MarketItemSearchEntry[]
  exactMap: Map<string, number[]>
  bigramIndex: Map<string, number[]>
  charIndex: Map<string, number[]>
}

export interface MarketItemCorrectionResult {
  inputName: string
  normalizedQuery: string
  status: 'ok' | 'corrected' | 'unknown'
  match?: MarketItemSearchCandidate
  candidates: MarketItemSearchCandidate[]
}

interface TwItemPayloadRow {
  tw?: string | null
}

const MARKET_ITEM_DATA_URL = `${import.meta.env.BASE_URL}data/tw-items.msgpack`
const DEFAULT_TOP_K = 5
const DEFAULT_MIN_SCORE = 0.48
const MIN_SUBSTRING_LENGTH = 3
const MAX_SUBSTRING_LENGTH = 5

let cachedIndex: MarketItemSearchIndex | null = null
let cachedIndexPromise: Promise<MarketItemSearchIndex> | null = null

function pushIndexEntry(index: Map<string, number[]>, token: string, entryIndex: number): void {
  const existing = index.get(token)
  if (existing) {
    existing.push(entryIndex)
    return
  }

  index.set(token, [entryIndex])
}

export function normalizeMarketOcrText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('zh-TW')
    .replace(/[^0-9a-z\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/gu, '')
}

export function toNgrams(text: string, n = 2): string[] {
  const chars = [...text]
  if (chars.length === 0) return []
  if (chars.length <= n) return [chars.join('')]

  const output: string[] = []
  for (let index = 0; index <= chars.length - n; index += 1) {
    output.push(chars.slice(index, index + n).join(''))
  }

  return output
}

function levenshteinDistance(left: string, right: string): number {
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  const rows = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0))
  for (let row = 0; row <= left.length; row += 1) rows[row][0] = row
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost,
      )
    }
  }

  return rows[left.length][right.length]
}

function positionMatchScore(query: string, name: string): number {
  const length = Math.min(query.length, name.length)
  if (length === 0) return 0

  let matches = 0
  for (let index = 0; index < length; index += 1) {
    if (query[index] === name[index]) matches += 1
  }

  return matches / Math.max(query.length, name.length)
}

function subsequenceMatchScore(query: string, name: string): number {
  if (!query) return 1
  if (!name) return 0

  let queryIndex = 0
  for (const char of name) {
    if (char === query[queryIndex]) {
      queryIndex += 1
      if (queryIndex >= query.length) break
    }
  }

  return queryIndex / query.length
}

function lengthSimilarityScore(query: string, name: string): number {
  const maxLength = Math.max(query.length, name.length, 1)
  return 1 - Math.abs(query.length - name.length) / maxLength
}

function orderFirstScore(query: string, name: string): number {
  if (!query || !name) return 0
  const recall = subsequenceMatchScore(query, name)
  const precision = subsequenceMatchScore(name, query)
  const lengthSimilarity = lengthSimilarityScore(query, name)
  return Math.max(0, Math.min(1, 0.5 * recall + 0.3 * precision + 0.2 * lengthSimilarity))
}

function consecutiveRunScore(query: string, name: string): number {
  if (!query || !name) return 0

  let totalRun = 0
  let index = 0
  while (index < query.length) {
    let bestLength = 0
    for (let length = 1; length <= query.length - index; length += 1) {
      if (name.includes(query.slice(index, index + length))) {
        bestLength = length
      }
    }
    totalRun += bestLength
    index += Math.max(bestLength, 1)
  }

  return totalRun / query.length
}

function ngramOverlapScore(query: string, name: string, n = 2): number {
  const queryNgrams = new Set(toNgrams(query, n))
  const nameNgrams = new Set(toNgrams(name, n))

  if (queryNgrams.size === 0 && nameNgrams.size === 0) return 1
  if (queryNgrams.size === 0 || nameNgrams.size === 0) return 0

  let overlap = 0
  for (const token of queryNgrams) {
    if (nameNgrams.has(token)) overlap += 1
  }

  return overlap / Math.max(queryNgrams.size, nameNgrams.size)
}

function longestSharedSubstring(query: string, name: string): number {
  const maxLength = Math.min(MAX_SUBSTRING_LENGTH, query.length)
  for (let length = maxLength; length >= MIN_SUBSTRING_LENGTH; length -= 1) {
    for (let start = 0; start <= query.length - length; start += 1) {
      if (name.includes(query.slice(start, start + length))) {
        return length
      }
    }
  }

  return 0
}

export function calcMarketItemSimilarity(query: string, name: string): number {
  if (!query || !name) return 0

  const orderScore = orderFirstScore(query, name)
  const runScore = consecutiveRunScore(query, name)
  const overlapScore = ngramOverlapScore(query, name, 2)
  const distanceScore = 1 - (levenshteinDistance(query, name) / Math.max(query.length, name.length, 1))
  const positionScore = positionMatchScore(query, name)

  return Math.max(
    0,
    Math.min(1, 0.45 * orderScore + 0.15 * runScore + 0.2 * overlapScore + 0.15 * distanceScore + 0.05 * positionScore),
  )
}

export function buildMarketItemSearchIndex(entries: MarketItemLookupEntry[]): MarketItemSearchIndex {
  const normalizedEntries: MarketItemSearchEntry[] = []
  const exactMap = new Map<string, number[]>()
  const bigramIndex = new Map<string, number[]>()
  const charIndex = new Map<string, number[]>()

  for (const entry of entries) {
    const itemName = entry.itemName.trim()
    if (!itemName) continue

    const normalizedName = normalizeMarketOcrText(itemName)
    if (normalizedName.length < 2) continue

    const nextEntryIndex = normalizedEntries.length
    normalizedEntries.push({ ...entry, itemName, normalizedName })
    pushIndexEntry(exactMap, normalizedName, nextEntryIndex)

    for (const token of new Set(toNgrams(normalizedName, 2))) {
      pushIndexEntry(bigramIndex, token, nextEntryIndex)
    }

    for (const token of new Set([...normalizedName])) {
      pushIndexEntry(charIndex, token, nextEntryIndex)
    }
  }

  return {
    entries: normalizedEntries,
    exactMap,
    bigramIndex,
    charIndex,
  }
}

export function findMarketItemCandidates(
  query: string,
  index: MarketItemSearchIndex,
  options?: { topK?: number; minScore?: number },
): MarketItemSearchCandidate[] {
  const normalizedQuery = normalizeMarketOcrText(query)
  if (normalizedQuery.length < 2) return []

  const topK = Math.max(1, Math.min(20, Math.round(options?.topK ?? DEFAULT_TOP_K)))
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE
  const exactMatches = index.exactMap.get(normalizedQuery) ?? []

  if (exactMatches.length > 0) {
    return exactMatches.slice(0, topK).map((entryIndex) => {
      const entry = index.entries[entryIndex]
      return {
        itemRowId: entry.itemRowId,
        itemName: entry.itemName,
        normalizedName: entry.normalizedName,
        score: 1,
        exactMatch: true,
        substringLength: normalizedQuery.length,
      }
    })
  }

  const candidateHits = new Map<number, number>()
  for (const token of new Set(toNgrams(normalizedQuery, 2))) {
    for (const entryIndex of index.bigramIndex.get(token) ?? []) {
      candidateHits.set(entryIndex, (candidateHits.get(entryIndex) ?? 0) + 1)
    }
  }

  if (candidateHits.size < topK) {
    const minimumSharedChars = normalizedQuery.length <= 3 ? 1 : 2
    const charMatches = new Map<number, number>()

    for (const token of new Set([...normalizedQuery])) {
      for (const entryIndex of index.charIndex.get(token) ?? []) {
        charMatches.set(entryIndex, (charMatches.get(entryIndex) ?? 0) + 1)
      }
    }

    for (const [entryIndex, sharedChars] of charMatches) {
      if (sharedChars >= minimumSharedChars && !candidateHits.has(entryIndex)) {
        candidateHits.set(entryIndex, 0)
      }
    }
  }

  if (candidateHits.size === 0 && normalizedQuery.length >= MIN_SUBSTRING_LENGTH) {
    for (let entryIndex = 0; entryIndex < index.entries.length; entryIndex += 1) {
      const entry = index.entries[entryIndex]
      if (longestSharedSubstring(normalizedQuery, entry.normalizedName) >= MIN_SUBSTRING_LENGTH) {
        candidateHits.set(entryIndex, 0)
      }
    }
  }

  const candidates: MarketItemSearchCandidate[] = []
  for (const entryIndex of candidateHits.keys()) {
    const entry = index.entries[entryIndex]
    const substringLength = longestSharedSubstring(normalizedQuery, entry.normalizedName)
    let score = calcMarketItemSimilarity(normalizedQuery, entry.normalizedName)

    if (substringLength >= MIN_SUBSTRING_LENGTH) {
      score = Math.min(1, score + Math.min(0.12, substringLength * 0.02))
    }

    if (score < minScore) continue

    candidates.push({
      itemRowId: entry.itemRowId,
      itemName: entry.itemName,
      normalizedName: entry.normalizedName,
      score,
      exactMatch: false,
      substringLength,
    })
  }

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.substringLength !== left.substringLength) return right.substringLength - left.substringLength
      if (left.itemName.length !== right.itemName.length) return left.itemName.length - right.itemName.length
      return left.itemRowId - right.itemRowId
    })
    .slice(0, topK)
}

export function resolveMarketItemCorrection(
  query: string,
  index: MarketItemSearchIndex,
): MarketItemCorrectionResult {
  const trimmedQuery = query.trim()
  const normalizedQuery = normalizeMarketOcrText(trimmedQuery)
  if (normalizedQuery.length < 2) {
    return {
      inputName: trimmedQuery,
      normalizedQuery,
      status: 'unknown',
      candidates: [],
    }
  }

  const candidates = findMarketItemCandidates(trimmedQuery, index)
  const bestCandidate = candidates[0]
  if (!bestCandidate) {
    return {
      inputName: trimmedQuery,
      normalizedQuery,
      status: 'unknown',
      candidates,
    }
  }

  if (bestCandidate.exactMatch) {
    return {
      inputName: trimmedQuery,
      normalizedQuery,
      status: bestCandidate.itemName === trimmedQuery ? 'ok' : 'corrected',
      match: bestCandidate,
      candidates,
    }
  }

  const secondCandidate = candidates[1]
  const scoreGap = secondCandidate ? bestCandidate.score - secondCandidate.score : bestCandidate.score
  const strongMatch = bestCandidate.score >= 0.86
  const clearLeader = bestCandidate.score >= 0.72 && scoreGap >= 0.08
  const substringLeader = bestCandidate.score >= 0.64 && bestCandidate.substringLength >= MIN_SUBSTRING_LENGTH && scoreGap >= 0.04

  return {
    inputName: trimmedQuery,
    normalizedQuery,
    status: strongMatch || clearLeader || substringLeader ? 'corrected' : 'unknown',
    match: strongMatch || clearLeader || substringLeader ? bestCandidate : undefined,
    candidates,
  }
}

async function fetchTwItemEntries(): Promise<MarketItemLookupEntry[]> {
  const response = await fetch(MARKET_ITEM_DATA_URL)
  if (!response.ok) {
    throw new Error(`Failed to load OCR item index: HTTP ${response.status}.`)
  }

  const payload = decode(new Uint8Array(await response.arrayBuffer())) as Record<string, TwItemPayloadRow>
  return Object.entries(payload)
    .map(([itemRowId, row]) => ({
      itemRowId: Number(itemRowId),
      itemName: typeof row?.tw === 'string' ? row.tw.trim() : '',
    }))
    .filter((entry) => Number.isInteger(entry.itemRowId) && entry.itemRowId > 0 && entry.itemName.length >= 2)
}

export async function loadMarketItemSearchIndex(): Promise<MarketItemSearchIndex> {
  if (cachedIndex) return cachedIndex
  if (cachedIndexPromise) return cachedIndexPromise

  cachedIndexPromise = fetchTwItemEntries()
    .then((entries) => {
      cachedIndex = buildMarketItemSearchIndex(entries)
      cachedIndexPromise = null
      return cachedIndex
    })
    .catch((error) => {
      cachedIndexPromise = null
      throw error
    })

  return cachedIndexPromise
}

export async function correctMarketItemName(query: string): Promise<MarketItemCorrectionResult> {
  const index = await loadMarketItemSearchIndex()
  return resolveMarketItemCorrection(query, index)
}
