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

/** 合併 OCR 切開的連續 CJK 字元（例如 "棕欄 折 敵 手 環" → "棕欄折敵手環"） */
function mergeSplitCjk(line: string): string {
  const isCjk = (ch: string): boolean => /[\u4e00-\u9fff\u3040-\u30ff\uff00-\uffef]/u.test(ch)
  const tokens = line.split(' ')
  const merged: string[] = []
  for (const token of tokens) {
    if (!token) continue
    if (merged.length > 0) {
      const last = merged[merged.length - 1]
      if (isCjk(last[last.length - 1]) && isCjk(token[0])) {
        merged[merged.length - 1] += token
        continue
      }
    }
    merged.push(token)
  }
  return merged.join(' ')
}

/**
 * 移除行首雜訊，找到第一個「連續 2 個以上 CJK 字元」的位置作為道具名稱起點。
 * 處理 OCR 把圖示讀成「® ★ kw 偏」等前綴的情況。
 */
function stripLeadingNoise(line: string): string {
  // 找第一個 2+ 連續 CJK 的起始位置
  const match = line.match(/([\u4e00-\u9fff\u3040-\u30ff\uff00-\uffef]{2,}.*)/u)
  if (match && match.index !== undefined && match.index > 0) return line.slice(match.index)
  // 若整行就是從 CJK 開始，不裁切
  return line.replace(/^[^\u4e00-\u9fff\u3040-\u30ffa-zA-Z]+/u, '')
}

function normalizeOcrLine(line: string): string {
  return stripLeadingNoise(
    mergeSplitCjk(
      normalizeDigits(line)
        .replace(/[|｜]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim(),
    ),
  )
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

/** 從任意截圖 OCR 文字中提取潛在道具名稱清單（非市場板格式）*/
export function extractNamesFromOcrText(rawText: string): string[] {
  const seen = new Set<string>()
  return rawText
    .split(/\r?\n/gu)
    .map((line) =>
      normalizeOcrLine(line)
        .replace(/^\d[\d,.\s]*/u, '')       // 移除行首數字（編號、價格）
        .replace(/\s*[x×]?\s*\d+\s*$/u, '') // 移除行尾數量 "x5" 或純數字
        .trim(),
    )
    .filter((line) => {
      if (line.length < 2 || line.length > 60) return false
      // 必須包含 CJK 字元或至少兩個連續英文字母
      if (!/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]|[a-zA-Z]{2,}/u.test(line)) return false
      const key = line.toLocaleLowerCase('zh-TW')
      if (seen.has(key)) return false
      seen.add(key)
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
