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
