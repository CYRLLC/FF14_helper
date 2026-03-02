import { describe, expect, it } from 'vitest'
import { coordsToMapPercent, findNearestAetheryte } from './coords'
import { treasureAetherytes } from './finderData'

describe('coordsToMapPercent', () => {
  it('converts game coordinates into map percentages', () => {
    const percent = coordsToMapPercent(
      {
        x: 22.14,
        y: 27.08,
      },
      100,
    )

    expect(percent.x).toBeCloseTo(51.6, 1)
    expect(percent.y).toBeCloseTo(63.7, 1)
  })
})

describe('findNearestAetheryte', () => {
  it('returns the nearest known aetheryte for a zone', () => {
    const nearest = findNearestAetheryte(
      4508,
      {
        x: 18.23,
        y: 21.1,
      },
      treasureAetherytes,
    )

    expect(nearest?.name).toBe('謝申內青磷泉')
  })

  it('returns null when no aetheryte data is available for the zone', () => {
    const nearest = findNearestAetheryte(
      4505,
      {
        x: 10.32,
        y: 11.7,
      },
      treasureAetherytes,
    )

    expect(nearest).toBeNull()
  })
})
