import type { CollectionStatus, CollectionTrackerState } from '../types'

const STORAGE_KEY = 'ff14-helper.collection.tracker.v1'

function encodeBase64(value: string): string {
  if (typeof window === 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64')
  }
  return window.btoa(unescape(encodeURIComponent(value)))
}

function decodeBase64(value: string): string {
  if (typeof window === 'undefined') {
    return Buffer.from(value, 'base64').toString('utf8')
  }
  return decodeURIComponent(escape(window.atob(value)))
}

export function createDefaultCollectionTrackerState(): CollectionTrackerState {
  return {
    statuses: {},
    wishlist: [],
    importedAt: null,
  }
}

export function loadCollectionTrackerState(): CollectionTrackerState {
  if (typeof window === 'undefined') {
    return createDefaultCollectionTrackerState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...createDefaultCollectionTrackerState(), ...(JSON.parse(raw) as Partial<CollectionTrackerState>) } : createDefaultCollectionTrackerState()
  } catch {
    return createDefaultCollectionTrackerState()
  }
}

export function saveCollectionTrackerState(state: CollectionTrackerState): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function exportCollectionTrackerState(state: CollectionTrackerState): string {
  return encodeBase64(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }))
}

export function importCollectionTrackerState(rawValue: string): CollectionTrackerState {
  const decoded = decodeBase64(rawValue.trim())
  const parsed = JSON.parse(decoded) as { state?: Partial<CollectionTrackerState> }
  return {
    ...createDefaultCollectionTrackerState(),
    ...(parsed.state ?? {}),
    importedAt: new Date().toISOString(),
  }
}

export function toggleCollectionWishlist(state: CollectionTrackerState, entryId: string): CollectionTrackerState {
  const nextWishlist = state.wishlist.includes(entryId)
    ? state.wishlist.filter((value) => value !== entryId)
    : [...state.wishlist, entryId]

  return { ...state, wishlist: nextWishlist }
}

export function setCollectionStatus(
  state: CollectionTrackerState,
  entryId: string,
  status: CollectionStatus | null,
): CollectionTrackerState {
  const nextStatuses = { ...state.statuses }
  if (status) {
    nextStatuses[entryId] = status
  } else {
    delete nextStatuses[entryId]
  }
  return { ...state, statuses: nextStatuses }
}
