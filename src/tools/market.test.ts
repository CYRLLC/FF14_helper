import { describe, expect, it } from 'vitest'
import { calculateMarketboardSummary } from './market'

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
