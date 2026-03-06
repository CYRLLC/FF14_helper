import type { MarketWorkbookRow } from './market'

export type MarketOcrTargetServer = 'chocobo' | 'moogle'

export interface MarketOcrParsedRow {
  itemName: string
  price: number
  quantity: number
}

function normalizeDigits(rawText: string): string {
  return rawText.replace(/[０-９]/gu, (char) => String(char.charCodeAt(0) - 65296))
}

function normalizeOcrLine(line: string): string {
  return normalizeDigits(line)
    .replace(/[|｜]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function parseTrailingNumber(rawValue: string): number {
  const digitsOnly = rawValue.replace(/[^\d]/gu, '')
  return digitsOnly ? Number(digitsOnly) : 0
}

export function extractRowsFromOcrText(rawText: string): MarketOcrParsedRow[] {
  const seenNames = new Set<string>()

  return rawText
    .split(/\r?\n/gu)
    .map(normalizeOcrLine)
    .map((line) => {
      const priceMatch = line.match(/(\d[\d,.]*)$/u)

      if (!priceMatch) {
        return null
      }

      const price = parseTrailingNumber(priceMatch[1])

      if (price <= 0) {
        return null
      }

      const leftSide = line.slice(0, priceMatch.index).trim()
      const quantityMatch = leftSide.match(/(.+?)\s+x?(\d{1,3})$/iu)

      if (quantityMatch) {
        const itemName = quantityMatch[1].trim()
        const quantity = Math.max(1, Number(quantityMatch[2]))

        if (!itemName) {
          return null
        }

        return {
          itemName,
          price,
          quantity,
        }
      }

      if (!leftSide) {
        return null
      }

      return {
        itemName: leftSide,
        price,
        quantity: 1,
      }
    })
    .filter((row): row is MarketOcrParsedRow => row !== null)
    .filter((row) => {
      const key = row.itemName.toLocaleLowerCase('zh-TW')

      if (seenNames.has(key)) {
        return false
      }

      seenNames.add(key)
      return true
    })
}

export function applyOcrRowsToWorkbook(options: {
  existingRows: MarketWorkbookRow[]
  parsedRows: MarketOcrParsedRow[]
  targetServer: MarketOcrTargetServer
  mergeExistingRows: boolean
  createRowId: () => string
}): MarketWorkbookRow[] {
  const existingRows = [...options.existingRows]
  const nextRows = options.mergeExistingRows ? [...existingRows] : []

  for (const parsedRow of options.parsedRows) {
    const normalizedName = parsedRow.itemName.toLocaleLowerCase('zh-TW')
    const targetIndex = nextRows.findIndex(
      (row) => row.itemName.trim().toLocaleLowerCase('zh-TW') === normalizedName,
    )

    const updatedRow =
      targetIndex >= 0
        ? {
            ...nextRows[targetIndex],
            quantity: parsedRow.quantity,
            [options.targetServer === 'chocobo' ? 'chocoboPrice' : 'mooglePrice']: parsedRow.price,
          }
        : {
            id: options.createRowId(),
            itemName: parsedRow.itemName,
            chocoboPrice: options.targetServer === 'chocobo' ? parsedRow.price : 0,
            mooglePrice: options.targetServer === 'moogle' ? parsedRow.price : 0,
            quantity: parsedRow.quantity,
            note: '由 OCR 匯入',
          }

    if (targetIndex >= 0) {
      nextRows[targetIndex] = updatedRow
    } else {
      nextRows.push(updatedRow)
    }
  }

  return nextRows
}
