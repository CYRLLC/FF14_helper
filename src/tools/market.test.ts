import { describe, expect, it } from 'vitest'
import { calculateMarketboardSummary, compareTwServerPrices } from './market'

describe('calculateMarketboardSummary', () => {
  it('calculates gross, tax, and profit values', () => {
    const summary = calculateMarketboardSummary({
      listingPrice: 1200,
      quantity: 3,
      taxRatePercent: 5,
      unitCost: 700,
    })

    expect(summary.grossTotal).toBe(3600)
    expect(summary.taxAmount).toBe(180)
    expect(summary.netTotal).toBe(3420)
    expect(summary.totalCost).toBe(2100)
    expect(summary.profit).toBe(1320)
  })
})

describe('compareTwServerPrices', () => {
  it('finds the cheaper server and average price', () => {
    const comparison = compareTwServerPrices([
      {
        serverName: '陸行鳥',
        pricePerUnit: 1250,
        quantity: 8,
      },
      {
        serverName: '莫古力',
        pricePerUnit: 1480,
        quantity: 3,
      },
    ])

    expect(comparison.cheaperServer).toBe('陸行鳥')
    expect(comparison.moreExpensiveServer).toBe('莫古力')
    expect(comparison.priceSpread).toBe(230)
    expect(comparison.averagePrice).toBe(1365)
    expect(comparison.cheaperTotalStock).toBe(8)
  })
})
