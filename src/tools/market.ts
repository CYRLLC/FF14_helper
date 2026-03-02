export interface MarketboardInputs {
  listingPrice: number
  quantity: number
  taxRatePercent: number
  unitCost: number
}

export interface MarketboardSummary {
  grossTotal: number
  taxAmount: number
  netTotal: number
  totalCost: number
  profit: number
  breakEvenPerUnit: number
}

export interface TwServerPriceInput {
  serverName: string
  pricePerUnit: number
  quantity: number
}

export interface TwServerComparison {
  cheaperServer: string | null
  moreExpensiveServer: string | null
  priceSpread: number
  averagePrice: number
  cheaperTotalStock: number
}

export interface MarketWorkbookRow {
  id: string
  itemName: string
  chocoboPrice: number
  mooglePrice: number
  quantity: number
  note: string
}

export interface MarketWorkbookSummary {
  chocoboTotal: number
  moogleTotal: number
  mixedCheapestTotal: number
  savingsVsChocobo: number
  savingsVsMoogle: number
  cheaperOnChocobo: number
  cheaperOnMoogle: number
  equalPriceItems: number
}

function clampNumber(value: number, minimum = 0): number {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.max(minimum, value)
}

export function sanitizeWorkbookRow(row: MarketWorkbookRow): MarketWorkbookRow {
  return {
    ...row,
    itemName: row.itemName.trim(),
    chocoboPrice: clampNumber(row.chocoboPrice),
    mooglePrice: clampNumber(row.mooglePrice),
    quantity: Math.max(1, Math.round(clampNumber(row.quantity, 1))),
    note: row.note.trim(),
  }
}

export function calculateMarketboardSummary(inputs: MarketboardInputs): MarketboardSummary {
  const listingPrice = clampNumber(inputs.listingPrice)
  const quantity = Math.max(1, Math.round(clampNumber(inputs.quantity, 1)))
  const taxRatePercent = clampNumber(inputs.taxRatePercent)
  const unitCost = clampNumber(inputs.unitCost)

  const grossTotal = listingPrice * quantity
  const taxAmount = grossTotal * (taxRatePercent / 100)
  const netTotal = grossTotal - taxAmount
  const totalCost = unitCost * quantity
  const profit = netTotal - totalCost
  const breakEvenPerUnit = totalCost / (quantity * (1 - taxRatePercent / 100 || 1))

  return {
    grossTotal,
    taxAmount,
    netTotal,
    totalCost,
    profit,
    breakEvenPerUnit: Number.isFinite(breakEvenPerUnit) ? breakEvenPerUnit : 0,
  }
}

export function compareTwServerPrices(inputs: TwServerPriceInput[]): TwServerComparison {
  const safeInputs = inputs
    .map((input) => ({
      serverName: input.serverName,
      pricePerUnit: clampNumber(input.pricePerUnit),
      quantity: Math.max(0, Math.round(clampNumber(input.quantity))),
    }))
    .sort((left, right) => left.pricePerUnit - right.pricePerUnit)

  if (safeInputs.length < 2) {
    return {
      cheaperServer: null,
      moreExpensiveServer: null,
      priceSpread: 0,
      averagePrice: safeInputs[0]?.pricePerUnit ?? 0,
      cheaperTotalStock: safeInputs[0]?.quantity ?? 0,
    }
  }

  const cheaper = safeInputs[0]
  const expensive = safeInputs[safeInputs.length - 1]
  const averagePrice =
    safeInputs.reduce((total, input) => total + input.pricePerUnit, 0) / safeInputs.length

  return {
    cheaperServer: cheaper.serverName,
    moreExpensiveServer: expensive.serverName,
    priceSpread: Math.max(0, expensive.pricePerUnit - cheaper.pricePerUnit),
    averagePrice,
    cheaperTotalStock: cheaper.quantity,
  }
}

export function buildWorkbookSummary(rows: MarketWorkbookRow[]): MarketWorkbookSummary {
  let chocoboTotal = 0
  let moogleTotal = 0
  let mixedCheapestTotal = 0
  let cheaperOnChocobo = 0
  let cheaperOnMoogle = 0
  let equalPriceItems = 0

  for (const rawRow of rows) {
    const row = sanitizeWorkbookRow(rawRow)
    const chocoboCost = row.chocoboPrice * row.quantity
    const moogleCost = row.mooglePrice * row.quantity

    chocoboTotal += chocoboCost
    moogleTotal += moogleCost
    mixedCheapestTotal += Math.min(chocoboCost, moogleCost)

    if (row.chocoboPrice < row.mooglePrice) {
      cheaperOnChocobo += 1
    } else if (row.chocoboPrice > row.mooglePrice) {
      cheaperOnMoogle += 1
    } else {
      equalPriceItems += 1
    }
  }

  return {
    chocoboTotal,
    moogleTotal,
    mixedCheapestTotal,
    savingsVsChocobo: Math.max(0, chocoboTotal - mixedCheapestTotal),
    savingsVsMoogle: Math.max(0, moogleTotal - mixedCheapestTotal),
    cheaperOnChocobo,
    cheaperOnMoogle,
    equalPriceItems,
  }
}
