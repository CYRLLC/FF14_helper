import { describe, expect, it } from 'vitest'
import {
  buildMarketItemSearchIndex,
  normalizeMarketOcrText,
  resolveMarketItemCorrection,
} from './marketItemSearch'

describe('market item OCR search helpers', () => {
  it('normalizes OCR text into a contiguous search token', () => {
    expect(normalizeMarketOcrText(' 魔 匠-魔晶石 陸型 ')).toBe('魔匠魔晶石陸型')
    expect(normalizeMarketOcrText('陳舊的地圖 G1')).toBe('陳舊的地圖g1')
  })

  it('finds an exact normalized match', () => {
    const index = buildMarketItemSearchIndex([
      { itemRowId: 1, itemName: '紅松木紡車' },
      { itemRowId: 2, itemName: '魔匠魔晶石陸型' },
    ])

    const result = resolveMarketItemCorrection('紅 松 木 紡 車', index)

    expect(result.status).toBe('corrected')
    expect(result.match?.itemName).toBe('紅松木紡車')
    expect(result.match?.score).toBe(1)
  })

  it('ranks the most plausible OCR candidate ahead of nearby partial matches', () => {
    const index = buildMarketItemSearchIndex([
      { itemRowId: 1, itemName: '魔匠魔晶石陸型' },
      { itemRowId: 2, itemName: '魔匠魔晶石參型' },
      { itemRowId: 3, itemName: '甜味智力之秘藥' },
    ])

    const result = resolveMarketItemCorrection('魔 晶 石 陸 型', index)

    expect(result.status).toBe('corrected')
    expect(result.match?.itemName).toBe('魔匠魔晶石陸型')
    expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score)
  })
})
