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

interface UniversalisBatchRawResponse {
  items?: Record<string, UniversalisRawResponse>
  unresolvedItems?: number[]
}

interface UniversalisRecentUpdateRaw {
  itemID?: number
  lastUploadTime?: number
  worldID?: number
  worldName?: string
}

interface UniversalisRecentUpdatesResponse {
  items?: UniversalisRecentUpdateRaw[]
}

export interface UniversalisRecentUpdate {
  itemId: number
  lastUploadTime: number
  worldId?: number
  worldName: string
}

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

export function buildUniversalisRecentUpdatesUrl(dataCenter: string, entries = 10): string {
  const params = new URLSearchParams({
    dcName: dataCenter.trim(),
    entries: Math.max(1, Math.min(50, Math.round(entries))).toString(),
  })

  return `${UNIVERSALIS_BASE_URL}/extra/stats/most-recently-updated?${params.toString()}`
}

/** 批次查詢多個道具在指定伺服器的市場板資料。回傳每個 itemId 的快照 Map 與不可交易的 itemId 集合。*/
export async function fetchItemMarketBatch(
  scope: MarketScopeSelection,
  itemIds: number[],
): Promise<{ snapshots: Map<number, UniversalisMarketSnapshot>; unresolved: Set<number> }> {
  if (itemIds.length === 0) return { snapshots: new Map(), unresolved: new Set() }

  const ids = [...new Set(itemIds.map((id) => Math.max(1, Math.round(id))))]
  const params = new URLSearchParams({ listings: '3', entries: '0' })
  const url = `${UNIVERSALIS_BASE_URL}/${sanitizeScopeKey(scope.scopeKey)}/${ids.join(',')}?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Universalis batch request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as UniversalisRawResponse | UniversalisBatchRawResponse
  const snapshots = new Map<number, UniversalisMarketSnapshot>()

  // API returns single-item format when querying 1 item, multi-item format otherwise
  const itemsMap: Record<string, UniversalisRawResponse> =
    'items' in payload && payload.items != null
      ? payload.items
      : { [ids[0].toString()]: payload as UniversalisRawResponse }

  const unresolved = new Set<number>(
    'unresolvedItems' in payload && Array.isArray(payload.unresolvedItems) ? payload.unresolvedItems : [],
  )

  for (const [idStr, data] of Object.entries(itemsMap)) {
    const numId = Number(idStr)
    if (isNaN(numId)) continue
    const listings = (data.listings ?? []).map(normalizeListing).filter((e): e is UniversalisListing => e !== null)
    snapshots.set(numId, {
      itemId: numId,
      scopeLabel: scope.scopeKey,
      lowestPrice: typeof data.minPrice === 'number' ? data.minPrice : undefined,
      highestPrice: typeof data.maxPrice === 'number' ? data.maxPrice : undefined,
      averagePrice: typeof data.averagePrice === 'number' ? data.averagePrice : undefined,
      averagePriceNq: typeof data.averagePriceNQ === 'number' ? data.averagePriceNQ : undefined,
      averagePriceHq: typeof data.averagePriceHQ === 'number' ? data.averagePriceHQ : undefined,
      regularSaleVelocity: typeof data.regularSaleVelocity === 'number' ? data.regularSaleVelocity : undefined,
      recentHistoryCount: 0,
      listings,
      recentHistory: [],
      fetchedAt: new Date().toISOString(),
    })
  }

  return { snapshots, unresolved }
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

export async function fetchMostRecentlyUpdatedItems(
  dataCenter: string,
  entries = 10,
): Promise<UniversalisRecentUpdate[]> {
  const response = await fetch(buildUniversalisRecentUpdatesUrl(dataCenter, entries))

  if (!response.ok) {
    throw new Error(`Universalis recent updates request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as UniversalisRecentUpdatesResponse

  return (payload.items ?? [])
    .filter(
      (entry): entry is Required<Pick<UniversalisRecentUpdateRaw, 'itemID' | 'lastUploadTime'>> & UniversalisRecentUpdateRaw =>
        typeof entry.itemID === 'number' && typeof entry.lastUploadTime === 'number',
    )
    .map((entry) => ({
      itemId: entry.itemID,
      lastUploadTime: entry.lastUploadTime,
      worldId: typeof entry.worldID === 'number' ? entry.worldID : undefined,
      worldName: entry.worldName?.trim() || 'Unknown World',
    }))
}
