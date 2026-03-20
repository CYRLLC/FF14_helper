/**
 * Claude Vision OCR
 * 透過 Anthropic Messages API 從截圖提取 FFXIV 道具名稱與價格。
 * API Key 由使用者自行提供並存於 localStorage，不經過後端。
 */

export const OCR_API_KEY_STORAGE = 'ff14-helper.ocr.anthropic-key'

export interface VisionMarketRow {
  itemName: string
  price: number
  quantity: number
}

const MARKET_PROMPT = `
This is a Final Fantasy XIV (FFXIV) Traditional Chinese server market board screenshot.
Extract every item listing. Each row has: Chinese item name, unit price (a number), quantity.

Return ONLY a JSON array — no explanation, no markdown fences:
[{"itemName":"道具名稱","price":12345,"quantity":1}]

Rules:
- itemName: Chinese item name only; strip all leading/trailing symbols, stars, icons
- price: unit price as a plain integer (remove commas)
- quantity: integer, default 1 if not shown
- Skip header rows (e.g. "道具名稱", "價格")
- Skip any row where the item name is unclear
`.trim()

const QUERY_PROMPT = `
This is a Final Fantasy XIV (FFXIV) Traditional Chinese server screenshot.
Extract every item name visible in the image.

Return ONLY a JSON array of strings — no explanation, no markdown fences:
["道具名稱1","道具名稱2"]

Rules:
- Include only clear item names (Chinese / Japanese / English)
- Exclude UI labels, column headers, numbers, status indicators, icons
- Each name should be a complete item name, not a fragment
`.trim()

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>
  error?: { message: string }
}

async function callClaudeVision(imageBlob: Blob, prompt: string, apiKey: string): Promise<string> {
  const base64 = await blobToBase64(imageBlob)
  const mediaType = (imageBlob.type.startsWith('image/') ? imageBlob.type : 'image/png') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // 使用者自行提供 API Key，在瀏覽器端直接呼叫
      'anthropic-dangerous-client-side-api-key-use': 'ff14-helper',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as AnthropicResponse)
    const msg = (body as AnthropicResponse).error?.message ?? response.statusText
    throw new Error(`Claude API ${response.status}: ${msg}`)
  }

  const data = (await response.json()) as AnthropicResponse
  return data.content.find((c) => c.type === 'text')?.text?.trim() ?? ''
}

/** 從市場板截圖提取道具名稱 + 價格 + 數量 */
export async function claudeVisionMarket(
  imageBlob: Blob,
  apiKey: string,
): Promise<VisionMarketRow[]> {
  const raw = await callClaudeVision(imageBlob, MARKET_PROMPT, apiKey)
  // 容錯：去掉可能包在外面的 markdown code fence
  const cleaned = raw.replace(/^```(?:json)?\n?/u, '').replace(/\n?```$/u, '').trim()
  const parsed = JSON.parse(cleaned) as VisionMarketRow[]
  return parsed.filter(
    (r) => typeof r.itemName === 'string' && r.itemName.length > 0 && Number(r.price) > 0,
  )
}

/** 從任意截圖提取道具名稱清單（道具查詢用） */
export async function claudeVisionQuery(imageBlob: Blob, apiKey: string): Promise<string[]> {
  const raw = await callClaudeVision(imageBlob, QUERY_PROMPT, apiKey)
  const cleaned = raw.replace(/^```(?:json)?\n?/u, '').replace(/\n?```$/u, '').trim()
  const parsed = JSON.parse(cleaned) as string[]
  return parsed.filter((s) => typeof s === 'string' && s.trim().length >= 2)
}
