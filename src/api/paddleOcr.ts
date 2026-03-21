/**
 * PaddleOCR PP-OCRv5 wrapper (free, browser, ONNX Runtime Web)
 *
 * Three-tier OCR architecture:
 *   1. Claude Vision (API key required) — highest accuracy, paid
 *   2. PaddleOCR PP-OCRv5 (this file) — high accuracy, free, ~21MB model download
 *   3. Tesseract (fallback)            — lower accuracy, free, no download
 *
 * TODO: Future — replace or supplement with Transformers.js + GLM-4V-Flash
 *   for WebGPU-accelerated multimodal understanding (zero download via CDN weights)
 */

import type { OrtModule, PaddleOcrService as PaddleOcrServiceType } from 'paddleocr'
import { extractNamesFromOcrText, extractRowsFromOcrText } from '../tools/marketOcr'
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
    detection: { modelBuffer: detBuf },
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

// ─── Public OCR functions ─────────────────────────────────────────────────────

/** 市場板截圖 → 道具名稱 + 價格 + 數量（PaddleOCR 版） */
export async function paddleOcrMarket(
  imageBlob: Blob,
  onProgress?: (p: PaddleLoadProgress) => void,
): Promise<VisionMarketRow[]> {
  const ocr = await getPaddleOcr(onProgress)
  const input = await blobToImageInput(imageBlob)
  const results = await ocr.recognize(input)
  const processed = ocr.processRecognition(results)
  const rows = extractRowsFromOcrText(processed.text)
  return rows.map((r) => ({ itemName: r.itemName, price: r.price, quantity: r.quantity }))
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
