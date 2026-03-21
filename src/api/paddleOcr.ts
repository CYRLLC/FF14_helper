/**
 * PaddleOCR PP-OCRv5 wrapper (free, browser, ONNX Runtime Web)
 *
 * Two-tier OCR architecture:
 *   1. PaddleOCR PP-OCRv5 (this file) — high accuracy, free, ~21MB model download
 *   2. Tesseract (fallback)            — lower accuracy, free, no download
 *
 * TODO: Future — replace or supplement with Transformers.js + GLM-4V-Flash
 *   for WebGPU-accelerated multimodal understanding (zero download via CDN weights)
 */

import type { OrtModule, PaddleOcrService as PaddleOcrServiceType, RecognitionResult } from 'paddleocr'
import { extractNamesFromOcrText } from '../tools/marketOcr'
import type { VisionMarketRow } from './claudeVisionOcr'

// ─── Singleton lazy-init ──────────────────────────────────────────────────────

let _instance: PaddleOcrServiceType | null = null
let _initPromise: Promise<PaddleOcrServiceType> | null = null

/** Download progress callback exposed to UI */
export type PaddleLoadProgress = {
  stage: 'models' | 'init'
  loaded: number   // bytes
  total: number    // bytes
}

async function fetchWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (!response.body || !onProgress || contentLength === 0) {
    return response.arrayBuffer()
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(loaded, contentLength)
  }
  const buffer = new ArrayBuffer(loaded)
  const view = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) {
    view.set(chunk, offset)
    offset += chunk.length
  }
  return buffer
}

async function initPaddleOcr(
  onProgress?: (p: PaddleLoadProgress) => void,
): Promise<PaddleOcrServiceType> {
  const [{ PaddleOcrService }, ort] = await Promise.all([
    import('paddleocr'),
    import('onnxruntime-web'),
  ])

  // Vite content-hashes WASM filenames, so onnxruntime-web can't find them by their
  // original name.  Point it at a pinned CDN copy with predictable, unhashed filenames.
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

  const base = import.meta.env.BASE_URL
  const detUrl = `${base}models/PP-OCRv5_mobile_det_infer.onnx`
  const recUrl = `${base}models/PP-OCRv5_mobile_rec_infer.onnx`
  const dictUrl = `${base}models/ppocrv5_dict.txt`

  // Det ~4.6MB, Rec ~16MB — report combined progress
  const DET_SIZE = 4_820_000
  const REC_SIZE = 16_540_000
  const TOTAL = DET_SIZE + REC_SIZE
  let detLoaded = 0
  let recLoaded = 0

  const reportProgress = () => {
    onProgress?.({ stage: 'models', loaded: detLoaded + recLoaded, total: TOTAL })
  }

  const [detBuf, recBuf, dictText] = await Promise.all([
    fetchWithProgress(detUrl, (l) => { detLoaded = l; reportProgress() }),
    fetchWithProgress(recUrl, (l) => { recLoaded = l; reportProgress() }),
    fetch(dictUrl).then((r) => r.text()),
  ])

  onProgress?.({ stage: 'init', loaded: TOTAL, total: TOTAL })

  const dict = dictText.split('\n').filter(Boolean)

  const service = await PaddleOcrService.createInstance({
    ort: ort as unknown as OrtModule,
    detection: { modelBuffer: detBuf, textPixelThreshold: 0.3, minimumAreaThreshold: 5 },
    recognition: { modelBuffer: recBuf, charactersDictionary: dict },
  })

  return service
}

export async function getPaddleOcr(
  onProgress?: (p: PaddleLoadProgress) => void,
): Promise<PaddleOcrServiceType> {
  if (_instance) return _instance
  if (_initPromise) return _initPromise
  _initPromise = initPaddleOcr(onProgress).then((svc) => {
    _instance = svc
    _initPromise = null
    return svc
  })
  return _initPromise
}

// ─── Image decode + FFXIV preprocessing ──────────────────────────────────────

/**
 * Decode a Blob → RGBA ImageData, then apply FFXIV-specific preprocessing:
 * - If the image has a dark background (avg luminance < 100), invert it so
 *   PP-OCRv5's detection model sees dark text on a light background, which
 *   matches its training distribution better.
 * - Boost contrast by 1.6× to make characters sharper.
 */
async function blobToImageInput(blob: Blob): Promise<{ width: number; height: number; data: Uint8Array }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Image decode failed'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2d context unavailable')
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imageData.data  // Uint8ClampedArray, RGBA

    // Compute average luminance (sample every 4th pixel for speed)
    let lumSum = 0
    const step = 4 * 4  // skip 3 pixels at a time
    let count = 0
    for (let i = 0; i < d.length; i += step) {
      lumSum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      count++
    }
    const avgLum = lumSum / count
    const isDark = avgLum < 100

    // Contrast factor (applied as: new = (old - 128) * factor + 128)
    const contrast = 1.6

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2]
      if (isDark) { r = 255 - r; g = 255 - g; b = 255 - b }
      // contrast
      r = Math.max(0, Math.min(255, (r - 128) * contrast + 128))
      g = Math.max(0, Math.min(255, (g - 128) * contrast + 128))
      b = Math.max(0, Math.min(255, (b - 128) * contrast + 128))
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }

    return {
      width: canvas.width,
      height: canvas.height,
      data: new Uint8Array(d.buffer),
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── Bounding-box based row extraction ───────────────────────────────────────

/**
 * Group OCR results into visual rows by Y-proximity, then extract
 * market board fields (item name + price + quantity) from each row.
 *
 * This is more reliable than parsing concatenated text because PaddleOCR
 * returns each text region (name, price, qty) as separate bounding boxes.
 */
function extractMarketRowsFromResults(results: RecognitionResult[]): VisionMarketRow[] {
  if (results.length === 0) return []

  // Sort: top-to-bottom, then left-to-right
  const sorted = [...results].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)

  // Group into visual lines: two boxes are on the same line if their Y centres
  // are within 60% of their average height.
  const lines: RecognitionResult[][] = []
  for (const r of sorted) {
    const matched = lines.find((line) => {
      const avgY = line.reduce((s, b) => s + b.box.y + b.box.height / 2, 0) / line.length
      const avgH = line.reduce((s, b) => s + b.box.height, 0) / line.length
      return Math.abs((r.box.y + r.box.height / 2) - avgY) < avgH * 0.6
    })
    if (matched) matched.push(r)
    else lines.push([r])
  }

  const rows: VisionMarketRow[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    // Sort within line by X
    line.sort((a, b) => a.box.x - b.box.x)

    const nameParts: string[] = []
    const numbers: number[] = []

    for (const box of line) {
      const text = box.text.trim()
      // Pure/mostly numeric → price or quantity
      const numOnly = text.replace(/[,，、.\s]/g, '')
      if (/^\d{2,}$/.test(numOnly)) {
        numbers.push(Number(numOnly))
      } else if (text.length >= 2) {
        // Could be item name segment
        nameParts.push(text)
      }
    }

    if (nameParts.length === 0 || numbers.length === 0) continue

    const itemName = nameParts.join('').trim()
    if (itemName.length < 2) continue

    // Last big number = price; second-to-last small number = quantity
    const sorted = [...numbers].sort((a, b) => b - a)
    const price = sorted[0]
    // Quantity: any number ≤ 999 that isn't the price
    const quantityCandidate = numbers.filter((n) => n !== price && n <= 999)
    const quantity = quantityCandidate.length > 0 ? Math.max(1, quantityCandidate[0]) : 1

    if (price <= 0) continue

    const key = itemName.toLocaleLowerCase('zh-TW')
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({ itemName, price, quantity })
  }

  return rows
}

/** 結果轉純文字（用於 debug textarea 顯示） */
export function paddleResultsToText(results: RecognitionResult[]): string {
  if (results.length === 0) return ''
  const sorted = [...results].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
  return sorted.map((r) => r.text).join('\n')
}

// ─── Public OCR functions ─────────────────────────────────────────────────────

export interface PaddleOcrMarketResult {
  rows: VisionMarketRow[]
  rawText: string  // raw recognized text for display/debugging
}

/** 市場板截圖 → 道具名稱 + 價格 + 數量（PaddleOCR 版） */
export async function paddleOcrMarket(
  imageBlob: Blob,
  onProgress?: (p: PaddleLoadProgress) => void,
): Promise<PaddleOcrMarketResult> {
  const ocr = await getPaddleOcr(onProgress)
  const input = await blobToImageInput(imageBlob)
  const results = await ocr.recognize(input, {
    ordering: { sameLineThresholdRatio: 0.5 },
  })
  const rawText = paddleResultsToText(results)
  const rows = extractMarketRowsFromResults(results)
  return { rows, rawText }
}

/** 任意截圖 → 道具名稱清單（PaddleOCR 版） */
export async function paddleOcrQuery(
  imageBlob: Blob,
  onProgress?: (p: PaddleLoadProgress) => void,
): Promise<string[]> {
  const ocr = await getPaddleOcr(onProgress)
  const input = await blobToImageInput(imageBlob)
  const results = await ocr.recognize(input)
  const processed = ocr.processRecognition(results)
  return extractNamesFromOcrText(processed.text)
}

/** 釋放 ONNX session（通常不需要主動呼叫） */
export async function destroyPaddleOcr(): Promise<void> {
  if (_instance) {
    await _instance.destroy()
    _instance = null
  }
  _initPromise = null
}
