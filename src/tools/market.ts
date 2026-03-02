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

function clampNumber(value: number, minimum = 0): number {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.max(minimum, value)
}

export function calculateMarketboardSummary(
  inputs: MarketboardInputs,
): MarketboardSummary {
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
