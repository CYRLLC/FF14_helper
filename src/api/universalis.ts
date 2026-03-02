import type {
  MarketScopeSelection,
  UniversalisListing,
  UniversalisMarketSnapshot,
  UniversalisSaleEntry,
} from '../types'

interface UniversalisRawListing {
  pricePerUnit?: number
  quantity?: number
  worldName?: string
  hq?: boolean
  total?: number
  lastReviewTime?: number
}

interface UniversalisRawSaleEntry {
  pricePerUnit?: number
  quantity?: number
  worldName?: string
  hq?: boolean
  timestamp?: number
}

interface UniversalisRawResponse {
  itemID?: number
  minPrice?: number
  maxPrice?: number
  averagePrice?: number
  averagePriceNQ?: number
  averagePriceHQ?: number
  regularSaleVelocity?: number
  listings?: UniversalisRawListing[]
  recentHistory?: UniversalisRawSaleEntry[]
}

const UNIVERSALIS_BASE_URL = 'https://universalis.app/api/v2'

function sanitizeScopeKey(scopeKey: string): string {
  return encodeURIComponent(scopeKey.trim())
}

function normalizeListing(entry: UniversalisRawListing): UniversalisListing | null {
  if (typeof entry.pricePerUnit !== 'number' || typeof entry.quantity !== 'number') {
    return null
  }

  return {
    pricePerUnit: entry.pricePerUnit,
    quantity: entry.quantity,
    worldName: entry.worldName?.trim() || 'Unknown World',
    hq: Boolean(entry.hq),
    total: typeof entry.total === 'number' ? entry.total : entry.pricePerUnit * entry.quantity,
    lastReviewTime: typeof entry.lastReviewTime === 'number' ? entry.lastReviewTime : undefined,
  }
}

function normalizeSale(entry: UniversalisRawSaleEntry): UniversalisSaleEntry | null {
  if (
    typeof entry.pricePerUnit !== 'number' ||
    typeof entry.quantity !== 'number' ||
    typeof entry.timestamp !== 'number'
  ) {
    return null
  }

  return {
    pricePerUnit: entry.pricePerUnit,
    quantity: entry.quantity,
    worldName: entry.worldName?.trim() || 'Unknown World',
    hq: Boolean(entry.hq),
    timestamp: entry.timestamp,
  }
}

export function buildUniversalisUrl(
  scope: MarketScopeSelection,
  itemId: number,
  options?: { entries?: number; listings?: number },
): string {
  const safeItemId = Math.max(1, Math.round(itemId))
  const params = new URLSearchParams({
    entries: (options?.entries ?? 10).toString(),
    listings: (options?.listings ?? 10).toString(),
  })

  return `${UNIVERSALIS_BASE_URL}/${sanitizeScopeKey(scope.scopeKey)}/${safeItemId}?${params.toString()}`
}

export async function fetchUniversalisMarket(
  scope: MarketScopeSelection,
  itemId: number,
): Promise<UniversalisMarketSnapshot> {
  const response = await fetch(buildUniversalisUrl(scope, itemId, { entries: 10, listings: 10 }))

  if (!response.ok) {
    throw new Error(`Universalis request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as UniversalisRawResponse
  const listings = (payload.listings ?? [])
    .map(normalizeListing)
    .filter((entry): entry is UniversalisListing => entry !== null)
  const recentHistory = (payload.recentHistory ?? [])
    .map(normalizeSale)
    .filter((entry): entry is UniversalisSaleEntry => entry !== null)

  return {
    itemId: typeof payload.itemID === 'number' ? payload.itemID : Math.max(1, Math.round(itemId)),
    scopeLabel: scope.scopeKey,
    lowestPrice: typeof payload.minPrice === 'number' ? payload.minPrice : undefined,
    highestPrice: typeof payload.maxPrice === 'number' ? payload.maxPrice : undefined,
    averagePrice: typeof payload.averagePrice === 'number' ? payload.averagePrice : undefined,
    averagePriceNq: typeof payload.averagePriceNQ === 'number' ? payload.averagePriceNQ : undefined,
    averagePriceHq: typeof payload.averagePriceHQ === 'number' ? payload.averagePriceHQ : undefined,
    regularSaleVelocity:
      typeof payload.regularSaleVelocity === 'number' ? payload.regularSaleVelocity : undefined,
    recentHistoryCount: recentHistory.length,
    listings,
    recentHistory,
    fetchedAt: new Date().toISOString(),
  }
}
