import { describe, expect, it } from 'vitest'
import { computeTreasureMarker } from './coords'
import { getTreasureZoneById } from './data'

describe('computeTreasureMarker', () => {
  it('converts percentage coordinates into map coordinates', () => {
    const zone = getTreasureZoneById('urqopacha')
    const marker = computeTreasureMarker(zone, 50, 50)

    expect(marker.zoneId).toBe('urqopacha')
    expect(marker.mapX).toBe(19)
    expect(marker.mapY).toBe(19)
  })

  it('clamps values outside the board bounds', () => {
    const zone = getTreasureZoneById('urqopacha')
    const marker = computeTreasureMarker(zone, 120, -10)

    expect(marker.percentX).toBe(100)
    expect(marker.percentY).toBe(0)
  })
})
