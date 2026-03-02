import { describe, expect, it } from 'vitest'
import {
  buildWorkbookSummary,
  calculateMarketboardSummary,
  compareTwServerPrices,
  sanitizeWorkbookRow,
} from './market'

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

describe('sanitizeWorkbookRow', () => {
  it('normalizes price and quantity fields', () => {
    const row = sanitizeWorkbookRow({
      id: 'test',
      itemName: '  魔匠水藥  ',
      chocoboPrice: Number.NaN,
      mooglePrice: -10,
      quantity: 0,
      note: '  備註  ',
    })

    expect(row.itemName).toBe('魔匠水藥')
    expect(row.chocoboPrice).toBe(0)
    expect(row.mooglePrice).toBe(0)
    expect(row.quantity).toBe(1)
    expect(row.note).toBe('備註')
  })
})

describe('buildWorkbookSummary', () => {
  it('builds totals for a multi-item comparison sheet', () => {
    const summary = buildWorkbookSummary([
      {
        id: '1',
        itemName: 'A',
        chocoboPrice: 100,
        mooglePrice: 150,
        quantity: 2,
        note: '',
      },
      {
        id: '2',
        itemName: 'B',
        chocoboPrice: 300,
        mooglePrice: 250,
        quantity: 1,
        note: '',
      },
      {
        id: '3',
        itemName: 'C',
        chocoboPrice: 400,
        mooglePrice: 400,
        quantity: 1,
        note: '',
      },
    ])

    expect(summary.chocoboTotal).toBe(900)
    expect(summary.moogleTotal).toBe(950)
    expect(summary.mixedCheapestTotal).toBe(850)
    expect(summary.savingsVsChocobo).toBe(50)
    expect(summary.savingsVsMoogle).toBe(100)
    expect(summary.cheaperOnChocobo).toBe(1)
    expect(summary.cheaperOnMoogle).toBe(1)
    expect(summary.equalPriceItems).toBe(1)
  })
})
