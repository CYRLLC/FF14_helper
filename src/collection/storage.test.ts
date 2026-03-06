import { describe, expect, it } from 'vitest'
import {
  createDefaultCollectionTrackerState,
  exportCollectionTrackerState,
  importCollectionTrackerState,
  setCollectionStatus,
  toggleCollectionWishlist,
} from './storage'

describe('collection storage', () => {
  it('round-trips export and import', () => {
    const state = {
      statuses: { zhloe: 'active' as const },
      wishlist: ['yok-huy'],
      importedAt: null,
    }

    const imported = importCollectionTrackerState(exportCollectionTrackerState(state))

    expect(imported.statuses.zhloe).toBe('active')
    expect(imported.wishlist).toContain('yok-huy')
    expect(imported.importedAt).not.toBeNull()
  })

  it('toggles wishlist and status cleanly', () => {
    let state = createDefaultCollectionTrackerState()
    state = toggleCollectionWishlist(state, 'zhloe')
    state = setCollectionStatus(state, 'zhloe', 'completed')

    expect(state.wishlist).toContain('zhloe')
    expect(state.statuses.zhloe).toBe('completed')

    state = toggleCollectionWishlist(state, 'zhloe')
    state = setCollectionStatus(state, 'zhloe', null)

    expect(state.wishlist).not.toContain('zhloe')
    expect(state.statuses.zhloe).toBeUndefined()
  })
})
