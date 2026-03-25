import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import {
  fetchItemMarketBatch,
  fetchMostRecentlyUpdatedItems,
  fetchUniversalisMarket,
} from '../api/universalis'
import {
  fetchItemSummary,
  searchEquipmentByItemLevel,
  searchRecipesByCraftTypeAndItemLevelRange,
  searchXivapi,
  searchRecipeResults,
  type XivapiEquipmentSearchResult,
  type XivapiSearchResult,
} from '../api/xivapi'
import {
  buildWorkbookSummary,
  calculateMarketboardSummary,
  compareTwServerPrices,
  sanitizeWorkbookRow,
  type MarketWorkbookRow,
} from '../tools/market'
import { formatGil, formatRelativeTime, formatShortDateTime } from '../tools/marketFormat'
import {
  applyOcrRowsToWorkbook,
  extractNamesFromOcrText,
  extractRowsFromOcrText,
  type MarketOcrParsedRow,
  type MarketOcrTargetServer,
} from '../tools/marketOcr'
import type { MarketScopeSelection, UniversalisMarketSnapshot } from '../types'
import { getErrorMessage } from '../utils/errors'
import {
  paddleOcrMarket,
  paddleOcrQuery,
  type PaddleLoadProgress,
} from '../api/paddleOcr'

const STORAGE_KEY = 'ff14-helper.market.workbench.v3'
const ITEM_HISTORY_KEY = 'ff14-helper.market.item-history.v1'

type MarketTab = 'import' | 'workbook' | 'calculator' | 'query'
type ImportSource = 'ocr-image' | 'ocr-paste' | 'bulk' | 'manual'
type MarketQualityFilter = 'all' | 'hq' | 'nq'

interface ActivityEntry {
  id: string
  createdAt: string
  message: string
}

interface LatestImportSummary {
  source: ImportSource
  importedAt: string
  rowCount: number
  targetServer?: MarketOcrTargetServer
}

interface SavedState {
  rows: MarketWorkbookRow[]
  calculatorRowId: string | null
  listingPrice: number
  quantity: number
  taxRatePercent: number
  unitCost: number
  activityLog: ActivityEntry[]
  latestImport: LatestImportSummary | null
}

interface PreviewRow extends MarketOcrParsedRow {
  id: string
  checked: boolean
  /** XIVAPI 驗證狀態：'ok' = 名稱已確認，'corrected' = 已自動修正，'unknown' = 查不到 */
  verifyStatus?: 'ok' | 'corrected' | 'unknown'
}

// ── Query feature types ──────────────────────────────────────

interface QueryName {
  id: string
  name: string
}

type QueryItemStatus = 'idle' | 'loading' | 'done' | 'not-found' | 'error'
type RecipeStatus = 'idle' | 'loading' | 'found' | 'none'
type MsqCategoryFilter = 'all' | 'weapon' | 'head' | 'body' | 'hands' | 'legs' | 'feet' | 'ears' | 'neck' | 'wrists' | 'rings'

interface QueryResult {
  queryId: string
  inputName: string
  status: QueryItemStatus
  itemRowId?: number
  confirmedName?: string
  chocoboMinPrice?: number
  moogleMinPrice?: number
  chocoboAvgPrice?: number
  moogleAvgPrice?: number
  notMarketable?: boolean
  error?: string
  recipeStatus: RecipeStatus
  recipeCraftType?: string
  recipeLevel?: number
}

interface ItemHistoryEntry {
  itemRowId: number
  itemName: string
  viewedAt: string
}

interface MarketDetailSelection {
  itemRowId: number
  itemName: string
}

interface RecentMarketEntry {
  itemRowId: number
  itemName: string
  lastUploadTime: number
  worldName: string
}

interface MsqSearchResult {
  itemRowId: number
  itemName: string
  itemLevel: number
  equipLevel: number
  slotCategory: Exclude<MsqCategoryFilter, 'all'>
  slotLabel: string
  classJobCategoryName?: string
  chocoboMinPrice?: number
  moogleMinPrice?: number
  chocoboAvgPrice?: number
  moogleAvgPrice?: number
  notMarketable: boolean
}

interface CrafterSearchResult {
  itemRowId: number
  itemName: string
  craftTypeIds: number[]
  craftJobLabels: string[]
  itemLevel: number
  equipLevel: number
  chocoboMinPrice?: number
  moogleMinPrice?: number
  chocoboAvgPrice?: number
  moogleAvgPrice?: number
  notMarketable: boolean
}

const SCOPE_CHOCOBO: MarketScopeSelection = { region: 'JP', mode: 'world', scopeKey: 'Chocobo' }
const SCOPE_MOOGLE: MarketScopeSelection = { region: 'EU', mode: 'world', scopeKey: 'Moogle' }
const MARKET_SCOPE_META: Record<
  MarketOcrTargetServer,
  { scope: MarketScopeSelection; recentUpdateDc: string; universalisWorld: string }
> = {
  chocobo: {
    scope: SCOPE_CHOCOBO,
    recentUpdateDc: 'Mana',
    universalisWorld: 'Chocobo',
  },
  moogle: {
    scope: SCOPE_MOOGLE,
    recentUpdateDc: 'Chaos',
    universalisWorld: 'Moogle',
  },
}

const MSQ_CATEGORY_OPTIONS: Array<{ value: MsqCategoryFilter; label: string }> = [
  { value: 'all', label: '全部裝備' },
  { value: 'weapon', label: '武器' },
  { value: 'head', label: '頭部' },
  { value: 'body', label: '身體' },
  { value: 'hands', label: '手部' },
  { value: 'legs', label: '腿部' },
  { value: 'feet', label: '腳部' },
  { value: 'ears', label: '耳環' },
  { value: 'neck', label: '項鍊' },
  { value: 'wrists', label: '手環' },
  { value: 'rings', label: '戒指' },
]

const MSQ_SLOT_ORDER: Record<Exclude<MsqCategoryFilter, 'all'>, number> = {
  weapon: 0,
  head: 1,
  body: 2,
  hands: 3,
  legs: 4,
  feet: 5,
  ears: 6,
  neck: 7,
  wrists: 8,
  rings: 9,
}

const MSQ_COMBAT_JOB_TAGS = new Set([
  'GLA',
  'PGL',
  'MRD',
  'LNC',
  'ARC',
  'CNJ',
  'THM',
  'ACN',
  'ROG',
  'PLD',
  'MNK',
  'WAR',
  'DRG',
  'BRD',
  'WHM',
  'BLM',
  'SMN',
  'SCH',
  'NIN',
  'MCH',
  'DRK',
  'AST',
  'SAM',
  'RDM',
  'BLU',
  'GNB',
  'DNC',
  'RPR',
  'SGE',
  'VPR',
  'PCT',
])

const CRAFTER_JOB_OPTIONS = [
  { craftTypeId: 0, label: '刻木匠', shortLabel: 'CRP' },
  { craftTypeId: 1, label: '鍛鐵匠', shortLabel: 'BSM' },
  { craftTypeId: 2, label: '鑄甲匠', shortLabel: 'ARM' },
  { craftTypeId: 3, label: '雕金匠', shortLabel: 'GSM' },
  { craftTypeId: 4, label: '製革匠', shortLabel: 'LTW' },
  { craftTypeId: 5, label: '裁衣匠', shortLabel: 'WVR' },
  { craftTypeId: 6, label: '鍊金術士', shortLabel: 'ALC' },
  { craftTypeId: 7, label: '廚師', shortLabel: 'CUL' },
] as const

const TABS: Array<{ id: MarketTab; label: string }> = [
  { id: 'import', label: '截圖匯入' },
  { id: 'workbook', label: '工作表' },
  { id: 'calculator', label: '試算' },
  { id: 'query', label: '道具查詢' },
]

// ── OCR Image Pre-processing ──────────────────────────────────

/**
 * Laplacian 銳化：強化文字邊緣（同一個 gray channel，不需處理 alpha）。
 * kernel = [0,-1,0,-1,5,-1,0,-1,0]
 */
function sharpenGrayscale(d: Uint8ClampedArray, w: number, h: number): void {
  const src = new Uint8ClampedArray(d)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const v = Math.min(255, Math.max(0,
        src[i] * 5
        - src[((y - 1) * w + x) * 4]
        - src[((y + 1) * w + x) * 4]
        - src[(y * w + x - 1) * 4]
        - src[(y * w + x + 1) * 4],
      ))
      d[i] = d[i + 1] = d[i + 2] = v
    }
  }
}

/** Otsu 自適應閾值：最大化類間變異數，回傳最佳分割亮度值。 */
function computeOtsuThreshold(d: Uint8ClampedArray): number {
  const hist = new Int32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++
  const total = d.length / 4
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0, wB = 0, maxVar = 0, threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB || wB === total) continue
    const wF = total - wB
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const v = wB * wF * (mB - mF) ** 2
    if (v > maxVar) { maxVar = v; threshold = t }
  }
  return threshold
}

/**
 * OCR 圖片前處理管線：
 * 1. 只有短邊 < 600px 才放大（FFXIV 截圖通常已夠大，過度放大反而拖慢銳化）
 * 2. 灰階化
 * 3. 暗背景（均亮 < 120）→ 反色，讓文字變暗
 * 4. 對比強化（1.8x）
 * 5. Laplacian 銳化
 * 6. Otsu 二值化（純黑白，Tesseract 最佳輸入格式）
 * 失敗時 graceful fallback 回傳原始 Blob。
 */
async function preprocessImageForOcr(file: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const shorter = Math.min(img.naturalWidth, img.naturalHeight)
        // 只有非常小的圖才放大，避免銳化在大圖上花太久
        const scale = shorter > 0 && shorter < 600 ? 2 : 1
        const w = img.naturalWidth * scale
        const h = img.naturalHeight * scale

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return }

        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)

        const imgData = ctx.getImageData(0, 0, w, h)
        const d = imgData.data

        // 步驟 1：灰階 + 偵測均亮度
        let totalLum = 0
        for (let i = 0; i < d.length; i += 4) {
          const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
          d[i] = d[i + 1] = d[i + 2] = lum
          totalLum += lum
        }
        const isDark = (totalLum / (d.length / 4)) < 120

        // 步驟 2：暗背景反色 + 對比強化（1.8x）
        const contrast = 1.8
        for (let i = 0; i < d.length; i += 4) {
          let lum = isDark ? 255 - d[i] : d[i]
          lum = Math.min(255, Math.max(0, Math.round(128 + contrast * (lum - 128))))
          d[i] = d[i + 1] = d[i + 2] = lum
        }

        // 步驟 3：Laplacian 銳化
        sharpenGrayscale(d, w, h)

        // 步驟 4：Otsu 二值化
        const thresh = computeOtsuThreshold(d)
        for (let i = 0; i < d.length; i += 4) {
          const v = d[i] >= thresh ? 255 : 0
          d[i] = d[i + 1] = d[i + 2] = v
        }

        ctx.putImageData(imgData, 0, 0)
        canvas.toBlob((blob) => resolve(blob ?? file), 'image/png')
      } catch {
        URL.revokeObjectURL(url)
        resolve(file)
      }
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Helpers ──────────────────────────────────────────────────

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyRow(): MarketWorkbookRow {
  return { id: createId('row'), itemName: '', chocoboPrice: 0, mooglePrice: 0, quantity: 1, note: '' }
}

function sourceLabel(source: ImportSource): string {
  switch (source) {
    case 'ocr-image': return '圖片 OCR'
    case 'ocr-paste': return '貼上 OCR'
    case 'bulk': return '批次匯入'
    case 'manual': return '手動新增'
  }
}

function serverLabel(server: MarketOcrTargetServer): string {
  return server === 'chocobo' ? '陸行鳥' : '莫古力'
}

function filterLabel(filter: 'all' | 'different' | 'chocobo' | 'moogle'): string {
  switch (filter) {
    case 'different': return '只看有價差'
    case 'chocobo': return '只看陸行鳥較便宜'
    case 'moogle': return '只看莫古力較便宜'
    default: return '全部資料'
  }
}

function qualityFilterLabel(filter: MarketQualityFilter): string {
  switch (filter) {
    case 'hq': return '只看 HQ'
    case 'nq': return '只看 NQ'
    default: return 'HQ / NQ 全部'
  }
}

function buildLogEntry(message: string): ActivityEntry {
  return { id: createId('log'), createdAt: new Date().toISOString(), message }
}

function qualityMatchesFilter(hq: boolean, filter: MarketQualityFilter): boolean {
  switch (filter) {
    case 'hq': return hq
    case 'nq': return !hq
    default: return true
  }
}

function msqSlotLabel(slot: Exclude<MsqCategoryFilter, 'all'>): string {
  switch (slot) {
    case 'weapon': return '武器'
    case 'head': return '頭部'
    case 'body': return '身體'
    case 'hands': return '手部'
    case 'legs': return '腿部'
    case 'feet': return '腳部'
    case 'ears': return '耳環'
    case 'neck': return '項鍊'
    case 'wrists': return '手環'
    case 'rings': return '戒指'
  }
}

function resolveMsqSlotCategory(itemUiCategoryName: string): Exclude<MsqCategoryFilter, 'all'> | null {
  const normalized = itemUiCategoryName.trim().toLowerCase()

  if (normalized.includes('arm')) return 'weapon'
  if (normalized === 'head') return 'head'
  if (normalized === 'body') return 'body'
  if (normalized === 'hands') return 'hands'
  if (normalized === 'legs') return 'legs'
  if (normalized === 'feet') return 'feet'
  if (normalized === 'earrings') return 'ears'
  if (normalized === 'necklace') return 'neck'
  if (normalized === 'bracelets') return 'wrists'
  if (normalized === 'ring') return 'rings'

  return null
}

function isCombatOrUniversalClassJob(classJobCategoryName?: string): boolean {
  if (!classJobCategoryName) return false
  if (classJobCategoryName === 'All Classes') return true

  return classJobCategoryName
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => MSQ_COMBAT_JOB_TAGS.has(token))
}

function matchesMsqCategoryFilter(result: XivapiEquipmentSearchResult, category: MsqCategoryFilter): boolean {
  const slotCategory = resolveMsqSlotCategory(result.itemUiCategoryName)
  if (!slotCategory) return false
  if (!isCombatOrUniversalClassJob(result.classJobCategoryName)) return false
  return category === 'all' ? true : slotCategory === category
}

function buildMsqCategoryQuery(category: MsqCategoryFilter): string | undefined {
  switch (category) {
    case 'weapon': return 'ItemUICategory.Name~"Arm"'
    case 'head': return 'ItemUICategory=34'
    case 'body': return 'ItemUICategory=35'
    case 'hands': return 'ItemUICategory=37'
    case 'legs': return 'ItemUICategory=36'
    case 'feet': return 'ItemUICategory=38'
    case 'ears': return 'ItemUICategory=41'
    case 'neck': return 'ItemUICategory=40'
    case 'wrists': return 'ItemUICategory=42'
    case 'rings': return 'ItemUICategory=43'
    default: return undefined
  }
}

function crafterRangeLimit(jobCount: number): number {
  if (jobCount <= 0) return 10
  if (jobCount === 1) return 50
  if (jobCount === 2) return 30
  if (jobCount === 3) return 20
  return 10
}

function crafterJobLabel(craftTypeId: number): string {
  return CRAFTER_JOB_OPTIONS.find((option) => option.craftTypeId === craftTypeId)?.label ?? `Craft #${craftTypeId}`
}

function parseBulkRows(value: string): MarketOcrParsedRow[] {
  return value
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [itemName = '', price = '0', quantity = '1'] = line.split(/\t+/u).map((part) => part.trim())
      return { itemName, price: Number(price), quantity: Number(quantity) }
    })
    .filter((row) => row.itemName.length > 0 && row.price > 0)
}

function loadSavedState(): SavedState {
  const fallback: SavedState = {
    rows: [],
    calculatorRowId: null,
    listingPrice: 0,
    quantity: 1,
    taxRatePercent: 5,
    unitCost: 0,
    activityLog: [],
    latestImport: null,
  }

  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SavedState>
    return {
      rows: Array.isArray(parsed.rows)
        ? parsed.rows.map((row) =>
            sanitizeWorkbookRow({
              id: typeof row.id === 'string' ? row.id : createId('row'),
              itemName: typeof row.itemName === 'string' ? row.itemName : '',
              chocoboPrice: Number(row.chocoboPrice ?? 0),
              mooglePrice: Number(row.mooglePrice ?? 0),
              quantity: Number(row.quantity ?? 1),
              note: typeof row.note === 'string' ? row.note : '',
            }),
          )
        : [],
      calculatorRowId: typeof parsed.calculatorRowId === 'string' ? parsed.calculatorRowId : null,
      listingPrice: Number(parsed.listingPrice ?? 0),
      quantity: Number(parsed.quantity ?? 1),
      taxRatePercent: Number(parsed.taxRatePercent ?? 5),
      unitCost: Number(parsed.unitCost ?? 0),
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog.slice(0, 8) : [],
      latestImport: parsed.latestImport ?? null,
    }
  } catch {
    return fallback
  }
}

function loadItemHistory(): ItemHistoryEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(ITEM_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<ItemHistoryEntry>>
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((entry) => ({
        itemRowId: Number(entry.itemRowId ?? 0),
        itemName: typeof entry.itemName === 'string' ? entry.itemName.trim() : '',
        viewedAt: typeof entry.viewedAt === 'string' ? entry.viewedAt : new Date().toISOString(),
      }))
      .filter((entry) => entry.itemRowId > 0 && entry.itemName.length > 0)
      .slice(0, 8)
  } catch {
    return []
  }
}

// ── Component ─────────────────────────────────────────────────

function MarketPage() {
  const [savedState] = useState(() => loadSavedState())

  // Workbook state
  const [rows, setRows] = useState(savedState.rows)
  const [calculatorRowId, setCalculatorRowId] = useState<string | null>(savedState.calculatorRowId)
  const [listingPrice, setListingPrice] = useState(savedState.listingPrice)
  const [quantity, setQuantity] = useState(savedState.quantity)
  const [taxRatePercent, setTaxRatePercent] = useState(savedState.taxRatePercent)
  const [unitCost, setUnitCost] = useState(savedState.unitCost)
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(savedState.activityLog)
  const [latestImport, setLatestImport] = useState<LatestImportSummary | null>(savedState.latestImport)
  const [draftRow, setDraftRow] = useState<MarketWorkbookRow>(() => createEmptyRow())
  const [bulkInput, setBulkInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tableFilter, setTableFilter] = useState<'all' | 'different' | 'chocobo' | 'moogle'>('all')

  // Import OCR state
  const [ocrTargetServer, setOcrTargetServer] = useState<MarketOcrTargetServer>('chocobo')
  const [mergeOcrRows, setMergeOcrRows] = useState(true)
  const [ocrPreviewRows, setOcrPreviewRows] = useState<PreviewRow[]>([])
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrVerifyBusy, setOcrVerifyBusy] = useState(false)
  const [paddleLoadProgress, setPaddleLoadProgress] = useState<PaddleLoadProgress | null>(null)
  const [ocrSource, setOcrSource] = useState<ImportSource>('ocr-image')
  const [dropActive, setDropActive] = useState(false)

  // Query feature state
  const [activeTab, setActiveTab] = useState<MarketTab>('import')
  const [queryNames, setQueryNames] = useState<QueryName[]>([])
  const [queryResults, setQueryResults] = useState<QueryResult[]>([])
  const [queryBusy, setQueryBusy] = useState(false)
  const [queryOcrBusy, setQueryOcrBusy] = useState(false)
  const [queryPreviewUrl, setQueryPreviewUrl] = useState<string | null>(null)
  const [queryDropActive, setQueryDropActive] = useState(false)
  const [queryManualInput, setQueryManualInput] = useState('')
  const [msqItemLevelInput, setMsqItemLevelInput] = useState('')
  const [msqCategoryFilter, setMsqCategoryFilter] = useState<MsqCategoryFilter>('all')
  const [msqResults, setMsqResults] = useState<MsqSearchResult[]>([])
  const [msqBusy, setMsqBusy] = useState(false)
  const [msqError, setMsqError] = useState<string | null>(null)
  const [crafterSelectedJobs, setCrafterSelectedJobs] = useState<number[]>([])
  const [crafterMinLevelInput, setCrafterMinLevelInput] = useState('')
  const [crafterMaxLevelInput, setCrafterMaxLevelInput] = useState('')
  const [crafterResults, setCrafterResults] = useState<CrafterSearchResult[]>([])
  const [crafterBusy, setCrafterBusy] = useState(false)
  const [crafterError, setCrafterError] = useState<string | null>(null)
  const [crafterNotice, setCrafterNotice] = useState<string | null>(null)
  const [detailTargetServer, setDetailTargetServer] = useState<MarketOcrTargetServer>('chocobo')
  const [detailSelection, setDetailSelection] = useState<MarketDetailSelection | null>(null)
  const [detailSnapshot, setDetailSnapshot] = useState<UniversalisMarketSnapshot | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailQualityFilter, setDetailQualityFilter] = useState<MarketQualityFilter>('all')
  const [recentMarketEntries, setRecentMarketEntries] = useState<RecentMarketEntry[]>([])
  const [recentMarketBusy, setRecentMarketBusy] = useState(false)
  const [recentMarketError, setRecentMarketError] = useState<string | null>(null)
  const [itemHistory, setItemHistory] = useState<ItemHistoryEntry[]>(() => loadItemHistory())
  const queryDropRef = useRef<HTMLDivElement>(null)
  const detailSectionRef = useRef<HTMLElement | null>(null)
  const detailCacheRef = useRef<Map<string, UniversalisMarketSnapshot>>(new Map())
  const recentUpdatesCacheRef = useRef<Map<MarketOcrTargetServer, RecentMarketEntry[]>>(new Map())
  const itemNameCacheRef = useRef<Map<number, string>>(new Map())

  // ── Persistence ──────────────────────────────────────────────

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rows, calculatorRowId, listingPrice, quantity, taxRatePercent, unitCost, activityLog, latestImport }),
    )
  }, [activityLog, calculatorRowId, latestImport, listingPrice, quantity, rows, taxRatePercent, unitCost])

  useEffect(() => {
    return () => {
      if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl)
    }
  }, [ocrPreviewUrl])

  useEffect(() => {
    return () => {
      if (queryPreviewUrl) URL.revokeObjectURL(queryPreviewUrl)
    }
  }, [queryPreviewUrl])

  useEffect(() => {
    window.localStorage.setItem(ITEM_HISTORY_KEY, JSON.stringify(itemHistory))
  }, [itemHistory])

  // ── Memos ────────────────────────────────────────────────────

  const workbookSummary = useMemo(() => buildWorkbookSummary(rows), [rows])
  const selectedCalculatorRow = useMemo(() => rows.find((row) => row.id === calculatorRowId) ?? null, [calculatorRowId, rows])
  const marketSummary = useMemo(
    () => calculateMarketboardSummary({ listingPrice, quantity, taxRatePercent, unitCost }),
    [listingPrice, quantity, taxRatePercent, unitCost],
  )
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const normalizedQuery = searchQuery.trim().toLocaleLowerCase('zh-TW')
      if (normalizedQuery.length > 0 && !row.itemName.toLocaleLowerCase('zh-TW').includes(normalizedQuery)) return false
      const comparison = compareTwServerPrices([
        { serverName: '陸行鳥', pricePerUnit: row.chocoboPrice, quantity: row.quantity },
        { serverName: '莫古力', pricePerUnit: row.mooglePrice, quantity: row.quantity },
      ])
      switch (tableFilter) {
        case 'different': return row.chocoboPrice !== row.mooglePrice
        case 'chocobo': return comparison.cheaperServer === '陸行鳥'
        case 'moogle': return comparison.cheaperServer === '莫古力'
        default: return true
      }
    })
  }, [rows, searchQuery, tableFilter])
  const detailListings = useMemo(() => {
    return (detailSnapshot?.listings ?? []).filter((listing) => qualityMatchesFilter(listing.hq, detailQualityFilter))
  }, [detailQualityFilter, detailSnapshot])
  const detailSales = useMemo(() => {
    return (detailSnapshot?.recentHistory ?? []).filter((sale) => qualityMatchesFilter(sale.hq, detailQualityFilter))
  }, [detailQualityFilter, detailSnapshot])
  const sortedDetailListings = useMemo(
    () => [...detailListings].sort((left, right) => left.pricePerUnit - right.pricePerUnit),
    [detailListings],
  )
  const sortedDetailSales = useMemo(
    () => [...detailSales].sort((left, right) => right.timestamp - left.timestamp),
    [detailSales],
  )
  const detailLatestReviewTime = useMemo(
    () => sortedDetailListings.reduce((latest, listing) => Math.max(latest, listing.lastReviewTime ?? 0), 0),
    [sortedDetailListings],
  )
  const detailSummary = useMemo(() => {
    const lowestPrice = detailListings.length > 0
      ? Math.min(...detailListings.map((listing) => listing.pricePerUnit))
      : detailQualityFilter === 'hq'
        ? detailSnapshot?.averagePriceHq
        : detailQualityFilter === 'nq'
          ? detailSnapshot?.averagePriceNq
          : detailSnapshot?.lowestPrice
    const averagePrice = detailQualityFilter === 'hq'
      ? detailSnapshot?.averagePriceHq
      : detailQualityFilter === 'nq'
        ? detailSnapshot?.averagePriceNq
        : detailSnapshot?.averagePrice
    const recentPurchasePrice = detailSales.length > 0 ? detailSales[0].pricePerUnit : undefined
    const recentPurchaseAt = detailSales.length > 0 ? detailSales[0].timestamp : undefined

    return {
      lowestPrice,
      averagePrice,
      recentPurchasePrice,
      recentPurchaseAt,
    }
  }, [detailListings, detailQualityFilter, detailSales, detailSnapshot])

  // ── Import handlers ──────────────────────────────────────────

  const msqItemLevelValue = Number(msqItemLevelInput)
  const msqItemLevelValid = Number.isInteger(msqItemLevelValue) && msqItemLevelValue >= 1 && msqItemLevelValue <= 999
  const crafterMinLevelValue = Number(crafterMinLevelInput)
  const crafterMaxLevelValue = Number(crafterMaxLevelInput)
  const crafterMaxRange = crafterRangeLimit(crafterSelectedJobs.length)
  const crafterLevelBoundsValid =
    Number.isInteger(crafterMinLevelValue)
    && Number.isInteger(crafterMaxLevelValue)
    && crafterMinLevelValue >= 1
    && crafterMaxLevelValue >= 1
    && crafterMinLevelValue <= 999
    && crafterMaxLevelValue <= 999
    && crafterMinLevelValue <= crafterMaxLevelValue
  const crafterRangeValid =
    crafterLevelBoundsValid && (crafterMaxLevelValue - crafterMinLevelValue + 1) <= crafterMaxRange
  const crafterSearchReady = crafterSelectedJobs.length > 0 && crafterRangeValid

  function pushActivity(messageText: string): void {
    const nextEntry = buildLogEntry(messageText)
    setActivityLog((current) => [nextEntry, ...current].slice(0, 8))
    setMessage(messageText)
  }

  async function runOcr(file: Blob, source: ImportSource): Promise<void> {
    setOcrBusy(true)
    setOcrError(null)
    setMessage(null)
    setOcrText('')
    if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl)
    setOcrPreviewUrl(URL.createObjectURL(file))
    setOcrSource(source)
    try {
      // ── Tier 1: PaddleOCR PP-OCRv5（免費，首次使用需下載 ~21MB 模型）──
      try {
        setPaddleLoadProgress(null)
        const { rows: paddleRows, rawText } = await paddleOcrMarket(file, (p) => setPaddleLoadProgress(p))
        setPaddleLoadProgress(null)
        setOcrText(rawText || `PaddleOCR 辨識到 ${paddleRows.length} 筆資料。`)
        setOcrPreviewRows(paddleRows.map((r) => ({ ...r, id: createId('preview'), checked: true })))
        if (paddleRows.length === 0) {
          setOcrError('PaddleOCR 未辨識出市場板資料。下方文字區域可查看原始辨識內容。')
        }
      } catch (paddleErr) {
        // ── Tier 2: Tesseract fallback（PaddleOCR 初始化失敗時）──────────
        setPaddleLoadProgress(null)
        const paddleErrMsg = getErrorMessage(paddleErr)
        const processedFile = await preprocessImageForOcr(file)
        const { PSM, createWorker } = await import('tesseract.js')
        const worker = await createWorker('chi_tra')
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
        const result = await worker.recognize(processedFile)
        await worker.terminate()
        const nextText = result.data.text?.trim() ?? ''
        const parsedRows = extractRowsFromOcrText(nextText)
        setOcrText(nextText)
        setOcrPreviewRows(parsedRows.map((row) => ({ ...row, id: createId('preview'), checked: true })))
        setOcrError(`PaddleOCR 失敗（${paddleErrMsg}），已改用 Tesseract。`)
      }
    } catch (error) {
      setOcrPreviewRows([])
      setOcrError(getErrorMessage(error))
    } finally {
      setOcrBusy(false)
    }
  }

  function commitImport(parsedRows: MarketOcrParsedRow[], source: ImportSource): void {
    const nextRows = applyOcrRowsToWorkbook({
      existingRows: rows,
      parsedRows,
      targetServer: ocrTargetServer,
      mergeExistingRows: mergeOcrRows,
      createRowId: () => createId('row'),
    }).map((row) => sanitizeWorkbookRow(row))
    const importedAt = new Date().toISOString()
    const nextMessage = `已從 ${sourceLabel(source)} 匯入 ${parsedRows.length} 筆資料到 ${serverLabel(ocrTargetServer)}。`
    startTransition(() => {
      setRows(nextRows)
      setLatestImport({ source, importedAt, rowCount: parsedRows.length, targetServer: ocrTargetServer })
      setActivityLog((current) => [buildLogEntry(nextMessage), ...current].slice(0, 8))
      setMessage(nextMessage)
      setOcrPreviewRows([])
    })
  }

  function applyPreviewRows(): void {
    const parsedRows = ocrPreviewRows
      .filter((row) => row.checked)
      .map((row) => ({ itemName: row.itemName.trim(), price: Number(row.price), quantity: Math.max(1, Number(row.quantity)) }))
      .filter((row) => row.itemName.length > 0 && row.price > 0)
    if (parsedRows.length === 0) {
      setOcrError('沒有勾選的可寫入資料。請先勾選要寫入的列。')
      return
    }
    commitImport(parsedRows, ocrSource)
  }

  function toggleAllPreviewRows(checked: boolean): void {
    setOcrPreviewRows((current) => current.map((row) => ({ ...row, checked })))
  }

  function removeUncheckedPreviewRows(): void {
    setOcrPreviewRows((current) => current.filter((row) => row.checked))
  }

  /**
   * 逐列查詢 XIVAPI，比對 OCR 名稱與實際物品名稱：
   * - 完全一致 → verifyStatus: 'ok'
   * - 有更相似的候選 → 自動修正名稱，verifyStatus: 'corrected'
   * - 查無結果 → verifyStatus: 'unknown'（不修改名稱）
   */
  async function autoVerifyOcrNames(): Promise<void> {
    if (ocrPreviewRows.length === 0 || ocrVerifyBusy) return
    setOcrVerifyBusy(true)
    const results = await Promise.allSettled(
      ocrPreviewRows.map(async (row): Promise<PreviewRow> => {
        const trimmed = row.itemName.trim()
        if (trimmed.length < 2) return { ...row, verifyStatus: 'unknown' }
        try {
          const found = await searchXivapi(trimmed, 'Item', 1, 'chs')
          if (found.length === 0) return { ...row, verifyStatus: 'unknown' }
          const apiName = found[0].name
          if (!apiName) return { ...row, verifyStatus: 'unknown' }
          if (apiName === trimmed) return { ...row, verifyStatus: 'ok' }
          // 計算字元相似度，>= 50% 才自動修正
          const shared = [...apiName].filter((ch) => trimmed.includes(ch)).length
          const similarity = (2 * shared) / (apiName.length + trimmed.length)
          if (similarity >= 0.5) return { ...row, itemName: apiName, verifyStatus: 'corrected' }
          return { ...row, verifyStatus: 'unknown' }
        } catch {
          return row
        }
      }),
    )
    setOcrPreviewRows(
      results.map((r, i) => (r.status === 'fulfilled' ? r.value : ocrPreviewRows[i])),
    )
    setOcrVerifyBusy(false)
  }

  function importBulkRows(): void {
    const parsedRows = parseBulkRows(bulkInput)
    if (parsedRows.length === 0) {
      setMessage('批次匯入需要 Tab 分隔格式：道具名稱 / 價格 / 數量。')
      return
    }
    commitImport(parsedRows, 'bulk')
    setBulkInput('')
  }

  function addDraftRow(): void {
    if (!draftRow.itemName.trim()) {
      setMessage('請先輸入道具名稱。')
      return
    }
    const nextRow = sanitizeWorkbookRow({ ...draftRow, id: createId('row') })
    setRows((current) => [...current, nextRow])
    setLatestImport({ source: 'manual', importedAt: new Date().toISOString(), rowCount: 1 })
    pushActivity(`已手動新增 ${nextRow.itemName}。`)
    setDraftRow(createEmptyRow())
  }

  function updateRow(rowId: string, patch: Partial<MarketWorkbookRow>): void {
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? sanitizeWorkbookRow({ ...row, ...patch }) : row)))
    pushActivity('已更新工作表資料。')
  }

  function removeRow(rowId: string): void {
    setRows((current) => current.filter((row) => row.id !== rowId))
    setCalculatorRowId((current) => (current === rowId ? null : current))
    pushActivity('已移除一筆資料。')
  }

  function clearWorkbook(): void {
    setRows([])
    setCalculatorRowId(null)
    pushActivity('已清空工作表。')
  }

  function applyRowToCalculator(row: MarketWorkbookRow): void {
    const comparison = compareTwServerPrices([
      { serverName: '陸行鳥', pricePerUnit: row.chocoboPrice, quantity: row.quantity },
      { serverName: '莫古力', pricePerUnit: row.mooglePrice, quantity: row.quantity },
    ])
    setCalculatorRowId(row.id)
    setListingPrice(comparison.cheaperServer === '莫古力' ? row.mooglePrice : row.chocoboPrice)
    setQuantity(row.quantity)
    pushActivity(`已將 ${row.itemName || '未命名道具'} 帶入市場板試算。`)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) void runOcr(file, 'ocr-image')
    event.target.value = ''
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>): void {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    const file = imageItem?.getAsFile()
    if (!file) return
    event.preventDefault()
    void runOcr(file, 'ocr-paste')
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDropActive(false)
    const file = event.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      setOcrError('拖曳的檔案不是圖片。')
      return
    }
    void runOcr(file, 'ocr-image')
  }

  // ── Query feature handlers ────────────────────────────────────

  async function runQueryOcr(file: Blob): Promise<void> {
    setQueryOcrBusy(true)
    if (queryPreviewUrl) URL.revokeObjectURL(queryPreviewUrl)
    setQueryPreviewUrl(URL.createObjectURL(file))
    try {
      try {
        const names = await paddleOcrQuery(file)
        setQueryNames(names.map((name) => ({ id: createId('q'), name })))
      } catch (paddleErr) {
        // Tesseract fallback
        const processedFile = await preprocessImageForOcr(file)
        const { createWorker, PSM } = await import('tesseract.js')
        const worker = await createWorker('chi_tra')
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
        const result = await worker.recognize(processedFile)
        await worker.terminate()
        const names = extractNamesFromOcrText(result.data.text?.trim() ?? '')
        setQueryNames(names.map((name) => ({ id: createId('q'), name })))
        setMessage(`PaddleOCR 失敗（${getErrorMessage(paddleErr)}），已改用 Tesseract。`)
      }
    } catch (error) {
      setMessage(`查詢 OCR 失敗：${getErrorMessage(error)}`)
    } finally {
      setQueryOcrBusy(false)
    }
  }

  function handleQueryFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) void runQueryOcr(file)
    event.target.value = ''
  }

  function handleQueryPaste(event: ClipboardEvent<HTMLDivElement>): void {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    const file = imageItem?.getAsFile()
    if (!file) return
    event.preventDefault()
    void runQueryOcr(file)
  }

  function handleQueryDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setQueryDropActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) void runQueryOcr(file)
  }

  function addQueryManualItem(): void {
    const name = queryManualInput.trim()
    if (!name) return
    setQueryNames((current) => [...current, { id: createId('q'), name }])
    setQueryManualInput('')
  }

  function toggleCrafterJob(craftTypeId: number): void {
    setCrafterSelectedJobs((current) => {
      if (current.includes(craftTypeId)) {
        return current.filter((value) => value !== craftTypeId)
      }

      if (current.length >= 4) {
        setCrafterError('最多只能選擇 4 個製作職。')
        return current
      }

      return [...current, craftTypeId]
    })
  }

  function rememberViewedItem(itemRowId: number, itemName: string): void {
    const nextEntry: ItemHistoryEntry = {
      itemRowId,
      itemName,
      viewedAt: new Date().toISOString(),
    }
    setItemHistory((current) => [nextEntry, ...current.filter((entry) => entry.itemRowId !== itemRowId)].slice(0, 8))
  }

  function openMarketDetail(itemRowId: number, itemName: string, targetServer: MarketOcrTargetServer): void {
    setDetailSelection({ itemRowId, itemName })
    setDetailTargetServer(targetServer)
    setDetailQualityFilter('all')
    rememberViewedItem(itemRowId, itemName)
    window.requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const refreshRecentMarketEntries = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh) {
      const cached = recentUpdatesCacheRef.current.get(detailTargetServer)
      if (cached) {
        setRecentMarketEntries(cached)
        setRecentMarketError(null)
        return
      }
    }

    setRecentMarketBusy(true)
    setRecentMarketError(null)

    try {
      const rawEntries = await fetchMostRecentlyUpdatedItems(MARKET_SCOPE_META[detailTargetServer].recentUpdateDc, 10)
      const uniqueEntries = rawEntries.filter(
        (entry, index, array) => array.findIndex((candidate) => candidate.itemId === entry.itemId) === index,
      ).slice(0, 8)

      const enrichedEntries = await Promise.all(
        uniqueEntries.map(async (entry): Promise<RecentMarketEntry> => {
          const cachedName = itemNameCacheRef.current.get(entry.itemId)
          if (cachedName) {
            return {
              itemRowId: entry.itemId,
              itemName: cachedName,
              lastUploadTime: entry.lastUploadTime,
              worldName: entry.worldName,
            }
          }

          try {
            const itemSummary = await fetchItemSummary(entry.itemId)
            itemNameCacheRef.current.set(entry.itemId, itemSummary.name)
            return {
              itemRowId: entry.itemId,
              itemName: itemSummary.name,
              lastUploadTime: entry.lastUploadTime,
              worldName: entry.worldName,
            }
          } catch {
            const fallbackName = `道具 #${entry.itemId}`
            itemNameCacheRef.current.set(entry.itemId, fallbackName)
            return {
              itemRowId: entry.itemId,
              itemName: fallbackName,
              lastUploadTime: entry.lastUploadTime,
              worldName: entry.worldName,
            }
          }
        }),
      )

      recentUpdatesCacheRef.current.set(detailTargetServer, enrichedEntries)
      setRecentMarketEntries(enrichedEntries)
    } catch (error) {
      setRecentMarketEntries([])
      setRecentMarketError(getErrorMessage(error))
    } finally {
      setRecentMarketBusy(false)
    }
  }, [detailTargetServer])

  useEffect(() => {
    if (activeTab !== 'query') return
    void refreshRecentMarketEntries()
  }, [activeTab, refreshRecentMarketEntries])

  useEffect(() => {
    if (activeTab !== 'query' || !detailSelection) return

    const cacheKey = `${detailTargetServer}:${detailSelection.itemRowId}`
    const cachedSnapshot = detailCacheRef.current.get(cacheKey)
    if (cachedSnapshot) {
      setDetailSnapshot(cachedSnapshot)
      setDetailError(null)
      setDetailBusy(false)
      return
    }

    let cancelled = false
    setDetailBusy(true)
    setDetailError(null)
    setDetailSnapshot(null)

    fetchUniversalisMarket(MARKET_SCOPE_META[detailTargetServer].scope, detailSelection.itemRowId)
      .then((snapshot) => {
        if (cancelled) return
        detailCacheRef.current.set(cacheKey, snapshot)
        setDetailSnapshot(snapshot)
      })
      .catch((error) => {
        if (cancelled) return
        setDetailError(getErrorMessage(error))
        setDetailSnapshot(null)
      })
      .finally(() => {
        if (!cancelled) setDetailBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, detailSelection, detailTargetServer])

  async function runQueryAll(): Promise<void> {
    if (queryNames.length === 0) return
    setQueryBusy(true)
    setQueryResults(queryNames.map((qn) => ({ queryId: qn.id, inputName: qn.name, status: 'loading', recipeStatus: 'idle' })))

    try {
      // 1. Search XIVAPI for each name (try chs first, then en)
      const xivapiLookups = await Promise.all(
        queryNames.map(async (qn): Promise<{ id: string; item: XivapiSearchResult | null }> => {
          try {
            const chsResults = await searchXivapi(qn.name, 'Item', 1, 'chs')
            if (chsResults.length > 0) return { id: qn.id, item: chsResults[0] }
            const enResults = await searchXivapi(qn.name, 'Item', 1, 'en')
            return { id: qn.id, item: enResults[0] ?? null }
          } catch {
            return { id: qn.id, item: null }
          }
        }),
      )

      // 2. Collect valid item IDs for Universalis batch query
      const validItems = xivapiLookups.filter((x) => x.item !== null)
      const itemIds = validItems.map((x) => x.item!.rowId)

      // 3. Batch fetch prices for Chocobo + Moogle in parallel
      const [chocoboData, moogleData] = await Promise.all([
        itemIds.length > 0 ? fetchItemMarketBatch(SCOPE_CHOCOBO, itemIds) : Promise.resolve({ snapshots: new Map(), unresolved: new Set<number>() }),
        itemIds.length > 0 ? fetchItemMarketBatch(SCOPE_MOOGLE, itemIds) : Promise.resolve({ snapshots: new Map(), unresolved: new Set<number>() }),
      ])

      // 4. Build result objects
      const nextResults = queryNames.map((qn): QueryResult => {
          const lookup = xivapiLookups.find((x) => x.id === qn.id)
          if (!lookup?.item) {
            return { queryId: qn.id, inputName: qn.name, status: 'not-found', recipeStatus: 'idle' }
          }
          const rowId = lookup.item.rowId
          const chocoboSnap = chocoboData.snapshots.get(rowId)
          const moogleSnap = moogleData.snapshots.get(rowId)
          const notMarketable = chocoboData.unresolved.has(rowId) && moogleData.unresolved.has(rowId)
          return {
            queryId: qn.id,
            inputName: qn.name,
            status: 'done',
            itemRowId: rowId,
            confirmedName: lookup.item.name,
            chocoboMinPrice: chocoboSnap?.lowestPrice,
            moogleMinPrice: moogleSnap?.lowestPrice,
            chocoboAvgPrice: chocoboSnap?.averagePrice,
            moogleAvgPrice: moogleSnap?.averagePrice,
            notMarketable,
            recipeStatus: 'idle',
          }
        })
      setQueryResults(nextResults)

      const firstFound = nextResults.find((result) => result.status === 'done' && result.itemRowId != null && result.confirmedName)
      if (firstFound?.itemRowId && firstFound.confirmedName) {
        openMarketDetail(firstFound.itemRowId, firstFound.confirmedName, detailTargetServer)
      }
    } catch (error) {
      setMessage(`查詢失敗：${getErrorMessage(error)}`)
      setQueryResults((current) => current.map((r) => ({ ...r, status: 'error', error: getErrorMessage(error) })))
    } finally {
      setQueryBusy(false)
    }
  }

  async function runMsqSearch(): Promise<void> {
    const itemLevel = Number(msqItemLevelInput)
    if (!Number.isInteger(itemLevel) || itemLevel < 1 || itemLevel > 999) {
      setMsqError('請輸入 1 到 999 的裝備品級。')
      setMsqResults([])
      return
    }

    setMsqBusy(true)
    setMsqError(null)
    setMsqResults([])

    try {
      const equipmentResults = (await searchEquipmentByItemLevel(itemLevel, {
        categoryQuery: buildMsqCategoryQuery(msqCategoryFilter),
        limit: 100,
        language: 'en',
      }))
        .filter((result) => matchesMsqCategoryFilter(result, msqCategoryFilter))
        .filter((result, index, array) => array.findIndex((candidate) => candidate.rowId === result.rowId) === index)
        .sort((left, right) => {
          const leftSlot = resolveMsqSlotCategory(left.itemUiCategoryName)
          const rightSlot = resolveMsqSlotCategory(right.itemUiCategoryName)
          const leftOrder = leftSlot ? MSQ_SLOT_ORDER[leftSlot] : 999
          const rightOrder = rightSlot ? MSQ_SLOT_ORDER[rightSlot] : 999

          if (leftOrder !== rightOrder) return leftOrder - rightOrder
          if (left.levelEquip !== right.levelEquip) return left.levelEquip - right.levelEquip
          return left.name.localeCompare(right.name)
        })

      if (equipmentResults.length === 0) {
        setMsqError('找不到符合條件的主線裝備。')
        return
      }

      const itemIds = equipmentResults.map((item) => item.rowId)
      const [chocoboData, moogleData, localizedNames] = await Promise.all([
        fetchItemMarketBatch(SCOPE_CHOCOBO, itemIds),
        fetchItemMarketBatch(SCOPE_MOOGLE, itemIds),
        Promise.all(
          equipmentResults.map(async (item) => {
            const cachedName = itemNameCacheRef.current.get(item.rowId)
            if (cachedName) {
              return [item.rowId, cachedName] as const
            }

            try {
              const summary = await fetchItemSummary(item.rowId)
              itemNameCacheRef.current.set(item.rowId, summary.name)
              return [item.rowId, summary.name] as const
            } catch {
              return [item.rowId, item.name] as const
            }
          }),
        ),
      ])

      const localizedNameMap = new Map<number, string>(localizedNames)
      const nextResults = equipmentResults
        .map((item): MsqSearchResult | null => {
          const slotCategory = resolveMsqSlotCategory(item.itemUiCategoryName)
          if (!slotCategory) return null

          const rowId = item.rowId
          const chocoboSnapshot = chocoboData.snapshots.get(rowId)
          const moogleSnapshot = moogleData.snapshots.get(rowId)

          return {
            itemRowId: rowId,
            itemName: localizedNameMap.get(rowId) ?? item.name,
            itemLevel: item.itemLevel,
            equipLevel: item.levelEquip,
            slotCategory,
            slotLabel: msqSlotLabel(slotCategory),
            classJobCategoryName: item.classJobCategoryName,
            chocoboMinPrice: chocoboSnapshot?.lowestPrice,
            moogleMinPrice: moogleSnapshot?.lowestPrice,
            chocoboAvgPrice: chocoboSnapshot?.averagePrice,
            moogleAvgPrice: moogleSnapshot?.averagePrice,
            notMarketable: item.isUntradable || (chocoboData.unresolved.has(rowId) && moogleData.unresolved.has(rowId)),
          }
        })
        .filter((result): result is MsqSearchResult => result !== null)

      setMsqResults(nextResults)

      const firstResult = nextResults[0]
      if (firstResult) {
        openMarketDetail(firstResult.itemRowId, firstResult.itemName, detailTargetServer)
      }
    } catch (error) {
      setMsqError(getErrorMessage(error))
      setMsqResults([])
    } finally {
      setMsqBusy(false)
    }
  }

  async function runCrafterSearch(): Promise<void> {
    if (!crafterSearchReady) {
      setCrafterError('請先選擇製作職，並輸入符合範圍限制的物品等級。')
      setCrafterResults([])
      return
    }

    setCrafterBusy(true)
    setCrafterError(null)
    setCrafterNotice(null)
    setCrafterResults([])

    try {
      const recipeMatches = (
        await Promise.all(
          crafterSelectedJobs.map((craftTypeId) =>
            searchRecipesByCraftTypeAndItemLevelRange(
              craftTypeId,
              crafterMinLevelValue,
              crafterMaxLevelValue,
              100,
              'en',
            ),
          ),
        )
      ).flat()

      const aggregatedMatches = new Map<
        number,
        {
          itemRowId: number
          itemName: string
          craftTypeIds: Set<number>
          craftJobLabels: Set<string>
          itemLevel: number
          equipLevel: number
          isUntradable: boolean
        }
      >()

      for (const match of recipeMatches) {
        const existing = aggregatedMatches.get(match.itemRowId)
        if (existing) {
          existing.craftTypeIds.add(match.craftTypeId)
          existing.craftJobLabels.add(crafterJobLabel(match.craftTypeId))
          existing.itemLevel = Math.max(existing.itemLevel, match.itemLevel)
          existing.equipLevel = Math.max(existing.equipLevel, match.levelEquip)
          existing.isUntradable = existing.isUntradable || match.isUntradable
          continue
        }

        aggregatedMatches.set(match.itemRowId, {
          itemRowId: match.itemRowId,
          itemName: match.itemName,
          craftTypeIds: new Set([match.craftTypeId]),
          craftJobLabels: new Set([crafterJobLabel(match.craftTypeId)]),
          itemLevel: match.itemLevel,
          equipLevel: match.levelEquip,
          isUntradable: match.isUntradable,
        })
      }

      let mergedMatches = Array.from(aggregatedMatches.values()).sort((left, right) => {
        if (left.itemLevel !== right.itemLevel) return left.itemLevel - right.itemLevel
        if (left.equipLevel !== right.equipLevel) return left.equipLevel - right.equipLevel
        return left.itemName.localeCompare(right.itemName)
      })

      if (mergedMatches.length === 0) {
        setCrafterError('找不到符合條件的製作成果。')
        return
      }

      if (mergedMatches.length > 80) {
        mergedMatches = mergedMatches.slice(0, 80)
        setCrafterNotice('結果數量過多，第一版先顯示前 80 筆，避免查價請求過重。')
      }

      const itemIds = mergedMatches.map((item) => item.itemRowId)
      const [chocoboData, moogleData, localizedNames] = await Promise.all([
        fetchItemMarketBatch(SCOPE_CHOCOBO, itemIds),
        fetchItemMarketBatch(SCOPE_MOOGLE, itemIds),
        Promise.all(
          mergedMatches.map(async (item) => {
            const cachedName = itemNameCacheRef.current.get(item.itemRowId)
            if (cachedName) {
              return [item.itemRowId, cachedName] as const
            }

            try {
              const summary = await fetchItemSummary(item.itemRowId)
              itemNameCacheRef.current.set(item.itemRowId, summary.name)
              return [item.itemRowId, summary.name] as const
            } catch {
              return [item.itemRowId, item.itemName] as const
            }
          }),
        ),
      ])

      const localizedNameMap = new Map<number, string>(localizedNames)
      const nextResults = mergedMatches.map((item): CrafterSearchResult => {
        const chocoboSnapshot = chocoboData.snapshots.get(item.itemRowId)
        const moogleSnapshot = moogleData.snapshots.get(item.itemRowId)

        return {
          itemRowId: item.itemRowId,
          itemName: localizedNameMap.get(item.itemRowId) ?? item.itemName,
          craftTypeIds: Array.from(item.craftTypeIds).sort((left, right) => left - right),
          craftJobLabels: Array.from(item.craftJobLabels),
          itemLevel: item.itemLevel,
          equipLevel: item.equipLevel,
          chocoboMinPrice: chocoboSnapshot?.lowestPrice,
          moogleMinPrice: moogleSnapshot?.lowestPrice,
          chocoboAvgPrice: chocoboSnapshot?.averagePrice,
          moogleAvgPrice: moogleSnapshot?.averagePrice,
          notMarketable: item.isUntradable || (chocoboData.unresolved.has(item.itemRowId) && moogleData.unresolved.has(item.itemRowId)),
        }
      })

      setCrafterResults(nextResults)

      const firstResult = nextResults[0]
      if (firstResult) {
        openMarketDetail(firstResult.itemRowId, firstResult.itemName, detailTargetServer)
      }
    } catch (error) {
      setCrafterError(getErrorMessage(error))
      setCrafterResults([])
    } finally {
      setCrafterBusy(false)
    }
  }

  async function fetchItemRecipe(queryId: string, itemName: string): Promise<void> {
    setQueryResults((current) =>
      current.map((r) => (r.queryId === queryId ? { ...r, recipeStatus: 'loading' } : r)),
    )
    try {
      const recipes = await searchRecipeResults(itemName, 1)
      if (recipes.length === 0) {
        setQueryResults((current) =>
          current.map((r) => (r.queryId === queryId ? { ...r, recipeStatus: 'none' } : r)),
        )
        return
      }
      const recipe = recipes[0]
      setQueryResults((current) =>
        current.map((r) =>
          r.queryId === queryId
            ? {
                ...r,
                recipeStatus: 'found',
                recipeCraftType: recipe.craftTypeName,
                recipeLevel: undefined,
              }
            : r,
        ),
      )
    } catch {
      setQueryResults((current) =>
        current.map((r) => (r.queryId === queryId ? { ...r, recipeStatus: 'none' } : r)),
      )
    }
  }

  function addDetailToWorkbook(): void {
    if (!detailSelection) return

    const queryResultMatch = queryResults.find((result) => result.itemRowId === detailSelection.itemRowId)
    const msqResultMatch = msqResults.find((result) => result.itemRowId === detailSelection.itemRowId)
    const crafterResultMatch = crafterResults.find((result) => result.itemRowId === detailSelection.itemRowId)
    const derivedChocoboPrice =
      queryResultMatch?.chocoboMinPrice
      ?? msqResultMatch?.chocoboMinPrice
      ?? crafterResultMatch?.chocoboMinPrice
      ?? (detailTargetServer === 'chocobo' ? detailSummary.lowestPrice ?? 0 : 0)
    const derivedMooglePrice =
      queryResultMatch?.moogleMinPrice
      ?? msqResultMatch?.moogleMinPrice
      ?? crafterResultMatch?.moogleMinPrice
      ?? (detailTargetServer === 'moogle' ? detailSummary.lowestPrice ?? 0 : 0)

    const normalizedName = detailSelection.itemName.trim()
    const nextRow = sanitizeWorkbookRow({
      id: createId('row'),
      itemName: normalizedName,
      chocoboPrice: derivedChocoboPrice,
      mooglePrice: derivedMooglePrice,
      quantity: 1,
      note: '',
    })

    setRows((current) => {
      const existingIndex = current.findIndex((row) => row.itemName.trim() === normalizedName)
      if (existingIndex === -1) {
        return [...current, nextRow]
      }

      return current.map((row, index) =>
        index === existingIndex
          ? sanitizeWorkbookRow({
              ...row,
              chocoboPrice: nextRow.chocoboPrice || row.chocoboPrice,
              mooglePrice: nextRow.mooglePrice || row.mooglePrice,
            })
          : row,
      )
    })

    setLatestImport({
      source: 'manual',
      importedAt: new Date().toISOString(),
      rowCount: 1,
      targetServer: detailTargetServer,
    })
    pushActivity(`已將 ${normalizedName} 的市場資料帶入工作表。`)
  }

  // ── Render helpers ────────────────────────────────────────────

  function garlandLink(rowId: number): string {
    return `https://www.garlandtools.org/db/#item/${rowId}`
  }

  function universalisLink(rowId: number, world: string): string {
    return `https://universalis.app/market/${rowId}?world=${world}`
  }

  function cheaperServer(chocoboPrice?: number, mooglePrice?: number): string | null {
    if (!chocoboPrice && !mooglePrice) return null
    if (!mooglePrice) return '陸行鳥'
    if (!chocoboPrice) return '莫古力'
    if (chocoboPrice < mooglePrice) return '陸行鳥'
    if (mooglePrice < chocoboPrice) return '莫古力'
    return '相同'
  }

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className="page-grid">
      {/* ── Hero ── */}
      <section className="hero-card">
        <p className="eyebrow">繁中服查詢助手</p>
        <h2>陸行鳥 / 莫古力 比價 & 道具查詢</h2>
        <p className="lead">
          截圖匯入比價工作表，或直接丟圖片查詢任意道具的市價與取得方式。本站不假裝有不存在的繁中服即時 API。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">繁中服限定</span>
          <span className="badge">OCR 匯入</span>
          <span className="badge">Universalis 即時市價</span>
          <span className="badge badge--warning">價格資料以截圖與 Universalis 查詢為準</span>
        </div>
        {rows.length > 0 ? (
          <div className="badge-row">
            <span className="badge badge--positive">工作表：{rows.length} 筆</span>
            {latestImport ? <span className="badge">最近匯入：{formatShortDateTime(latestImport.importedAt)}</span> : null}
          </div>
        ) : null}
      </section>

      {/* ── Tabs ── */}
      <section>
        <div className="tool-tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tool-tab tool-tab--active' : 'tool-tab'}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: 截圖匯入 ── */}
        {activeTab === 'import' && (
          <div className="tool-panel page-grid">
            <section className="page-card">
              <div className="section-heading">
                <h2>匯入截圖或批次文字</h2>
                <p>先指定這次 OCR 要寫進哪一個伺服器，再貼上截圖、拖曳圖片或用 Tab 分隔文字批次匯入。</p>
              </div>

              <div className="badge-row" style={{ marginBottom: '0.75rem' }}>
                <span className="badge badge--info">OCR 引擎：PaddleOCR PP-OCRv5</span>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">OCR 目標伺服器</span>
                  <select className="input-select" onChange={(event) => setOcrTargetServer(event.target.value as MarketOcrTargetServer)} value={ocrTargetServer}>
                    <option value="chocobo">陸行鳥</option>
                    <option value="moogle">莫古力</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">寫入方式</span>
                  <select className="input-select" onChange={(event) => setMergeOcrRows(event.target.value === 'merge')} value={mergeOcrRows ? 'merge' : 'replace'}>
                    <option value="merge">合併到現有工作表</option>
                    <option value="replace">清空後重新匯入</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">上傳圖片</span>
                  <input accept="image/*" className="input-text" onChange={handleFileChange} type="file" />
                </label>
              </div>
              <div
                className={dropActive ? 'drop-zone drop-zone--active' : 'drop-zone'}
                onDragEnter={() => setDropActive(true)}
                onDragLeave={() => setDropActive(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
              >
                <strong>把市場板截圖拖進來，或點這裡後按 Ctrl+V 貼上</strong>
                <p>建議使用清楚的市場板截圖。若 OCR 不穩定，仍可先進預覽區手動修正。</p>
              </div>
              <label className="field">
                <span className="field-label">批次匯入文字</span>
                <textarea
                  className="input-text"
                  onChange={(event) => setBulkInput(event.target.value)}
                  placeholder={'道具名稱\t價格\t數量\n高品質素材\t12500\t3'}
                  rows={4}
                  value={bulkInput}
                />
              </label>
              <div className="button-row">
                <button className="button button--ghost" onClick={importBulkRows} type="button">
                  匯入批次文字
                </button>
              </div>
              {ocrBusy ? (
                <div className="callout">
                  <span className="callout-title">OCR 辨識中</span>
                  <span className="callout-body">
                    {paddleLoadProgress?.stage === 'models'
                      ? `下載 PaddleOCR 模型… ${Math.round((paddleLoadProgress.loaded / paddleLoadProgress.total) * 100)}%（${Math.round(paddleLoadProgress.loaded / 1_048_576)} / ${Math.round(paddleLoadProgress.total / 1_048_576)} MB）`
                      : paddleLoadProgress?.stage === 'init'
                        ? '初始化 PaddleOCR 模型…'
                        : '正在分析圖片文字，請稍候。'}
                  </span>
                </div>
              ) : null}
              {ocrError ? (
                <div className="callout callout--error">
                  <span className="callout-title">OCR 錯誤</span>
                  <span className="callout-body">{ocrError}</span>
                </div>
              ) : null}
              {message ? (
                <div className="callout callout--success">
                  <span className="callout-title">完成</span>
                  <span className="callout-body">{message}</span>
                </div>
              ) : null}
            </section>

            <section className="page-card">
              <div className="section-heading">
                <h2>校對 OCR 預覽</h2>
                <p>OCR 匯入後不會直接覆寫工作表。先在這裡修正品名、價格和數量，再決定是否寫入。</p>
              </div>
              {ocrPreviewUrl || ocrPreviewRows.length > 0 ? (
                <div className="page-grid">
                  <div className="field-grid">
                    {ocrPreviewUrl ? (
                      <div className="field">
                        <span className="field-label">目前圖片</span>
                        <img alt="OCR 預覽" className="market-ocr-preview" src={ocrPreviewUrl} />
                      </div>
                    ) : null}
                    <label className="field">
                      <span className="field-label">OCR 原始文字</span>
                      <textarea className="input-text" readOnly rows={10} value={ocrText} />
                    </label>
                  </div>
                  {ocrPreviewRows.length === 0 ? (
                    <div className="empty-state">
                      <strong>預覽區沒有可寫入資料</strong>
                      <p>請換一張更清楚的截圖，或改用批次匯入。</p>
                    </div>
                  ) : (
                    <>
                      <div className="button-row" style={{ marginBottom: '0.5rem' }}>
                        <button className="button button--ghost" onClick={() => toggleAllPreviewRows(true)} type="button">全選</button>
                        <button className="button button--ghost" onClick={() => toggleAllPreviewRows(false)} type="button">全消</button>
                        <button className="button button--ghost" onClick={removeUncheckedPreviewRows} type="button">
                          刪除未勾選
                        </button>
                        <button
                          className="button button--ghost"
                          disabled={ocrVerifyBusy}
                          onClick={() => void autoVerifyOcrNames()}
                          type="button"
                          title="查詢 XIVAPI 確認 / 修正道具名稱"
                        >
                          {ocrVerifyBusy ? '驗證中…' : '自動驗證名稱'}
                        </button>
                        <span className="muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                          已選 {ocrPreviewRows.filter((r) => r.checked).length} / {ocrPreviewRows.length} 列
                        </span>
                      </div>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr><th style={{ width: '2rem' }}>✓</th><th>道具名稱</th><th>價格</th><th>數量</th><th>操作</th></tr>
                          </thead>
                          <tbody>
                            {ocrPreviewRows.map((row) => (
                              <tr key={row.id} style={row.checked ? undefined : { opacity: 0.45 }}>
                                <td>
                                  <input
                                    checked={row.checked}
                                    onChange={(event) => setOcrPreviewRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, checked: event.target.checked } : entry)))}
                                    type="checkbox"
                                  />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <input
                                      className="input-text"
                                      onChange={(event) => setOcrPreviewRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, itemName: event.target.value, verifyStatus: undefined } : entry)))}
                                      type="text"
                                      value={row.itemName}
                                    />
                                    {row.verifyStatus === 'ok' && <span className="badge badge--positive" title="XIVAPI 已確認">✓</span>}
                                    {row.verifyStatus === 'corrected' && <span className="badge badge--warning" title="名稱已由 XIVAPI 自動修正">修正</span>}
                                    {row.verifyStatus === 'unknown' && <span className="badge" title="XIVAPI 找不到對應道具">?</span>}
                                  </div>
                                </td>
                                <td>
                                  <input
                                    className="input-text"
                                    min="0"
                                    onChange={(event) => setOcrPreviewRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, price: Number(event.target.value) } : entry)))}
                                    step="1"
                                    type="number"
                                    value={row.price}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="input-text"
                                    min="1"
                                    onChange={(event) => setOcrPreviewRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, quantity: Number(event.target.value) } : entry)))}
                                    step="1"
                                    type="number"
                                    value={row.quantity}
                                  />
                                </td>
                                <td>
                                  <button className="button button--ghost" onClick={() => setOcrPreviewRows((current) => current.filter((entry) => entry.id !== row.id))} type="button">
                                    移除
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="button-row">
                        <button className="button button--primary" onClick={applyPreviewRows} type="button">
                          寫入勾選列
                        </button>
                        <button
                          className="button button--ghost"
                          onClick={() => { setOcrPreviewRows([]); setOcrText(''); setOcrError(null) }}
                          type="button"
                        >
                          清空預覽
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>尚未產生 OCR 預覽</strong>
                  <p>請先在左側貼上或上傳市場板截圖，再到這裡確認辨識結果。</p>
                </div>
              )}
            </section>

            <section className="source-grid">
              <article className="page-card">
                <div className="section-heading">
                  <h2>最新匯入資料</h2>
                  <p>這裡顯示最近一次 OCR、批次匯入或手動新增的摘要，方便確認目前工作表的來源。</p>
                </div>
                {latestImport ? (
                  <div className="detail-list">
                    <div><strong>來源：</strong>{sourceLabel(latestImport.source)}</div>
                    <div><strong>時間：</strong>{formatShortDateTime(latestImport.importedAt)}</div>
                    <div><strong>筆數：</strong>{latestImport.rowCount}</div>
                    <div><strong>目標：</strong>{latestImport.targetServer ? serverLabel(latestImport.targetServer) : '工作表'}</div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <strong>尚無匯入紀錄</strong>
                    <p>請先匯入圖片、批次文字或手動新增資料。</p>
                  </div>
                )}
              </article>
              <article className="page-card">
                <div className="section-heading">
                  <h2>最近變更</h2>
                  <p>用來追蹤你最近更新了哪些資料，不會被描述成伺服器最新價格。</p>
                </div>
                {activityLog.length === 0 ? (
                  <div className="empty-state">
                    <strong>尚無變更</strong>
                    <p>開始匯入或編輯資料後，這裡就會顯示最近操作。</p>
                  </div>
                ) : (
                  <div className="detail-list">
                    {activityLog.map((entry) => (
                      <div key={entry.id}>
                        <strong>{formatShortDateTime(entry.createdAt)}</strong> {entry.message}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </div>
        )}

        {/* ── Tab: 工作表 ── */}
        {activeTab === 'workbook' && (
          <div className="tool-panel page-grid">
            <section className="page-card">
              <div className="section-heading">
                <h2>繁中服比價工作表</h2>
                <p>工作表只比較陸行鳥與莫古力。你可以持續修正價格、數量與備註，再挑便宜的伺服器帶去試算。</p>
              </div>
              <div className="stats-grid">
                <article className="stat-card"><div className="stat-label">工作表筆數</div><div className="stat-value">{rows.length}</div></article>
                <article className="stat-card"><div className="stat-label">陸行鳥總成本</div><div className="stat-value">{formatGil(workbookSummary.chocoboTotal)}</div></article>
                <article className="stat-card"><div className="stat-label">莫古力總成本</div><div className="stat-value">{formatGil(workbookSummary.moogleTotal)}</div></article>
                <article className="stat-card"><div className="stat-label">混合最低成本</div><div className="stat-value">{formatGil(workbookSummary.mixedCheapestTotal)}</div></article>
                <article className="stat-card"><div className="stat-label">比陸行鳥省下</div><div className="stat-value">{formatGil(workbookSummary.savingsVsChocobo)}</div></article>
                <article className="stat-card"><div className="stat-label">比莫古力省下</div><div className="stat-value">{formatGil(workbookSummary.savingsVsMoogle)}</div></article>
                <article className="stat-card"><div className="stat-label">陸行鳥較低價</div><div className="stat-value">{workbookSummary.cheaperOnChocobo} 項</div></article>
                <article className="stat-card"><div className="stat-label">莫古力較低價</div><div className="stat-value">{workbookSummary.cheaperOnMoogle} 項</div></article>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">搜尋道具</span>
                  <input className="input-text" onChange={(event) => setSearchQuery(event.target.value)} placeholder="輸入道具名稱" type="text" value={searchQuery} />
                </label>
                <label className="field">
                  <span className="field-label">工作表篩選</span>
                  <select className="input-select" onChange={(event) => setTableFilter(event.target.value as typeof tableFilter)} value={tableFilter}>
                    <option value="all">全部資料</option>
                    <option value="different">只看有價差</option>
                    <option value="chocobo">只看陸行鳥較便宜</option>
                    <option value="moogle">只看莫古力較便宜</option>
                  </select>
                </label>
              </div>
              <div className="badge-row">
                <span className="badge">目前顯示 {filteredRows.length} / {rows.length} 筆</span>
                {searchQuery.trim() ? <span className="badge badge--positive">搜尋：{searchQuery.trim()}</span> : null}
                {tableFilter !== 'all' ? <span className="badge badge--warning">篩選：{filterLabel(tableFilter)}</span> : null}
              </div>
              {rows.length > 0 ? (
                <div className="button-row">
                  <button
                    className="button button--ghost"
                    onClick={() => { if (window.confirm(`確定要清空全部 ${rows.length} 筆資料嗎？`)) clearWorkbook() }}
                    type="button"
                  >
                    清空全部
                  </button>
                </div>
              ) : null}
              {rows.length === 0 ? (
                <div className="empty-state">
                  <strong>工作表目前是空的</strong>
                  <p>請先到「截圖匯入」頁籤，或直接在下方手動新增資料。</p>
                  <button className="button button--ghost" onClick={() => setActiveTab('import')} type="button">前往截圖匯入</button>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="empty-state">
                  <strong>目前篩選沒有符合的資料</strong>
                  <p>請調整搜尋字詞或切換篩選條件。</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>道具名稱</th><th>陸行鳥</th><th>莫古力</th><th>數量</th><th>較低價</th><th>價差</th><th>備註</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const comparison = compareTwServerPrices([
                          { serverName: '陸行鳥', pricePerUnit: row.chocoboPrice, quantity: row.quantity },
                          { serverName: '莫古力', pricePerUnit: row.mooglePrice, quantity: row.quantity },
                        ])
                        return (
                          <tr key={row.id}>
                            <td><input className="input-text" onChange={(event) => updateRow(row.id, { itemName: event.target.value })} type="text" value={row.itemName} /></td>
                            <td><input className="input-text" min="0" onChange={(event) => updateRow(row.id, { chocoboPrice: Number(event.target.value) })} step="1" type="number" value={row.chocoboPrice} /></td>
                            <td><input className="input-text" min="0" onChange={(event) => updateRow(row.id, { mooglePrice: Number(event.target.value) })} step="1" type="number" value={row.mooglePrice} /></td>
                            <td><input className="input-text" min="1" onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value) })} step="1" type="number" value={row.quantity} /></td>
                            <td>{comparison.cheaperServer ?? '相同'}</td>
                            <td>{formatGil(comparison.priceSpread)}</td>
                            <td><input className="input-text" onChange={(event) => updateRow(row.id, { note: event.target.value })} type="text" value={row.note} /></td>
                            <td>
                              <div className="table-actions">
                                <button className="button button--primary" onClick={() => { applyRowToCalculator(row); setActiveTab('calculator') }} type="button">帶入試算</button>
                                <button className="button button--ghost" onClick={() => removeRow(row.id)} type="button">刪除</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="page-card">
              <div className="section-heading">
                <h2>手動新增一筆</h2>
                <p>當 OCR 不可靠或你想先規劃清單時，可以直接手動新增價格資料。</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">道具名稱</span>
                  <input className="input-text" onChange={(event) => setDraftRow((current) => ({ ...current, itemName: event.target.value }))} type="text" value={draftRow.itemName} />
                </label>
                <label className="field">
                  <span className="field-label">陸行鳥價格</span>
                  <input className="input-text" min="0" onChange={(event) => setDraftRow((current) => ({ ...current, chocoboPrice: Number(event.target.value) }))} step="1" type="number" value={draftRow.chocoboPrice} />
                </label>
                <label className="field">
                  <span className="field-label">莫古力價格</span>
                  <input className="input-text" min="0" onChange={(event) => setDraftRow((current) => ({ ...current, mooglePrice: Number(event.target.value) }))} step="1" type="number" value={draftRow.mooglePrice} />
                </label>
                <label className="field">
                  <span className="field-label">數量</span>
                  <input className="input-text" min="1" onChange={(event) => setDraftRow((current) => ({ ...current, quantity: Number(event.target.value) }))} step="1" type="number" value={draftRow.quantity} />
                </label>
              </div>
              <div className="button-row">
                <button className="button button--primary" onClick={addDraftRow} type="button">新增到工作表</button>
              </div>
            </section>
          </div>
        )}

        {/* ── Tab: 試算 ── */}
        {activeTab === 'calculator' && (
          <div className="tool-panel page-card">
            <div className="section-heading">
              <h2>市場板試算</h2>
              <p>把一筆比價結果帶進來後，可以繼續計算總價、稅額、淨收入、成本與損益。</p>
            </div>
            {selectedCalculatorRow ? (
              <div className="callout">
                <span className="callout-title">目前套用道具</span>
                <span className="callout-body">{selectedCalculatorRow.itemName} | 數量 {selectedCalculatorRow.quantity}</span>
              </div>
            ) : null}
            <div className="field-grid">
              <label className="field">
                <span className="field-label">售價</span>
                <input className="input-text" min="0" onChange={(event) => setListingPrice(Number(event.target.value))} step="1" type="number" value={listingPrice} />
              </label>
              <label className="field">
                <span className="field-label">數量</span>
                <input className="input-text" min="1" onChange={(event) => setQuantity(Number(event.target.value))} step="1" type="number" value={quantity} />
              </label>
              <label className="field">
                <span className="field-label">稅率 (%)</span>
                <input className="input-text" min="0" onChange={(event) => setTaxRatePercent(Number(event.target.value))} step="0.1" type="number" value={taxRatePercent} />
              </label>
              <label className="field">
                <span className="field-label">單位成本</span>
                <input className="input-text" min="0" onChange={(event) => setUnitCost(Number(event.target.value))} step="1" type="number" value={unitCost} />
              </label>
            </div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-label">總售價</div><div className="stat-value">{formatGil(marketSummary.grossTotal)}</div></article>
              <article className="stat-card"><div className="stat-label">稅額</div><div className="stat-value">{formatGil(marketSummary.taxAmount)}</div></article>
              <article className="stat-card"><div className="stat-label">淨收入</div><div className="stat-value">{formatGil(marketSummary.netTotal)}</div></article>
              <article className="stat-card"><div className="stat-label">總成本</div><div className="stat-value">{formatGil(marketSummary.totalCost)}</div></article>
              <article className="stat-card"><div className="stat-label">損益</div><div className="stat-value">{formatGil(marketSummary.profit)}</div></article>
              <article className="stat-card"><div className="stat-label">損平單價</div><div className="stat-value">{formatGil(marketSummary.breakEvenPerUnit)}</div></article>
            </div>
          </div>
        )}

        {/* ── Tab: 道具查詢 ── */}
        {activeTab === 'query' && (
          <div className="tool-panel source-grid">
            {/* Left: input */}
            <article className="page-card">
              <div className="section-heading">
                <h2>圖片查詢</h2>
                <p>
                  丟入任意截圖，OCR 自動提取道具名稱；也可以直接手動輸入。確認名稱清單後按「查詢」，
                  系統會向 Universalis 取得陸行鳥與莫古力的即時市價，並顯示 Garland Tools 取得來源連結。
                </p>
              </div>
              <div
                className={queryDropActive ? 'drop-zone drop-zone--active' : 'drop-zone'}
                onDragEnter={() => setQueryDropActive(true)}
                onDragLeave={() => setQueryDropActive(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleQueryDrop}
                onPaste={handleQueryPaste}
                ref={queryDropRef}
                tabIndex={0}
              >
                <strong>拖曳或貼上任意截圖（背包、清單、配方⋯）</strong>
                <p>OCR 會提取圖片中所有可辨識的道具名稱。繁體中文與英文皆可。</p>
              </div>
              <label className="field">
                <span className="field-label">上傳圖片</span>
                <input accept="image/*" className="input-text" onChange={handleQueryFileChange} type="file" />
              </label>
              {queryOcrBusy ? (
                <div className="callout">
                  <span className="callout-title">OCR 辨識中</span>
                  <span className="callout-body">正在分析圖片，請稍候⋯</span>
                </div>
              ) : null}
              {queryPreviewUrl ? (
                <img alt="查詢圖片預覽" className="market-ocr-preview" src={queryPreviewUrl} />
              ) : null}

              <div className="section-heading" style={{ marginTop: '0.8rem' }}>
                <h2>道具名稱清單</h2>
                <p>可以編輯或刪除清單中的名稱，也可以手動新增（繁體中文或英文均可）。</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">手動新增道具名稱</span>
                  <input
                    className="input-text"
                    onChange={(event) => setQueryManualInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') addQueryManualItem() }}
                    placeholder="鑄鐵錠 / Iron Ingot"
                    type="text"
                    value={queryManualInput}
                  />
                </label>
              </div>
              <div className="button-row">
                <button className="button button--ghost" onClick={addQueryManualItem} type="button">新增</button>
                <button className="button button--ghost" onClick={() => setQueryNames([])} type="button">清空清單</button>
              </div>
              {queryNames.length === 0 ? (
                <div className="empty-state">
                  <strong>清單目前是空的</strong>
                  <p>請上傳截圖或手動輸入道具名稱。</p>
                </div>
              ) : (
                <div className="history-list">
                  {queryNames.map((qn) => (
                    <article key={qn.id} className="history-item">
                      <div className="history-item__top">
                        <input
                          className="input-text"
                          onChange={(event) => setQueryNames((current) => current.map((n) => (n.id === qn.id ? { ...n, name: event.target.value } : n)))}
                          style={{ flex: 1 }}
                          type="text"
                          value={qn.name}
                        />
                        <button className="button button--ghost" onClick={() => setQueryNames((current) => current.filter((n) => n.id !== qn.id))} type="button">
                          刪除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <div className="button-row">
                <button
                  className="button button--primary"
                  disabled={queryBusy || queryNames.length === 0}
                  onClick={() => void runQueryAll()}
                  type="button"
                >
                  {queryBusy ? '查詢中⋯' : `查詢全部 ${queryNames.length} 個道具`}
                </button>
              </div>

              <div className="section-heading" style={{ marginTop: '0.8rem' }}>
                <h2>最近查看</h2>
                <p>保留最近打開過的單品市場詳情，方便快速回看。</p>
              </div>
              {itemHistory.length === 0 ? (
                <div className="empty-state">
                  <strong>尚無查看紀錄</strong>
                  <p>點開任一道具詳情後，這裡會保留最近 8 筆。</p>
                </div>
              ) : (
                <div className="history-list">
                  {itemHistory.map((entry) => (
                    <article key={`${entry.itemRowId}-${entry.viewedAt}`} className="history-item">
                      <div className="history-item__top">
                        <strong>{entry.itemName}</strong>
                        <span className="badge">{formatRelativeTime(entry.viewedAt)}</span>
                      </div>
                      <div className="detail-list">
                        <div><strong>查看時間：</strong>{formatShortDateTime(entry.viewedAt)}</div>
                      </div>
                      <div className="button-row">
                        <button
                          className="button button--ghost"
                          onClick={() => openMarketDetail(entry.itemRowId, entry.itemName, detailTargetServer)}
                          type="button"
                        >
                          重新打開詳情
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            {/* Right: results */}
            <article className="page-card">
              <div className="section-heading">
                <h2>查詢結果</h2>
                <p>
                  市價由 Universalis 即時查詢（陸行鳥 / 莫古力）。
                  「查看詳情」會進一步載入單品掛單、近期交易與資料新鮮度；
                  「取得方式」可用 Garland Tools 連結查看。
                </p>
              </div>
              {queryResults.length === 0 ? (
                <div className="empty-state">
                  <strong>尚無查詢結果</strong>
                  <p>在左側建立道具清單後，按「查詢全部」即可查看即時市價與取得方式。</p>
                </div>
              ) : (
                <div className="history-list">
                  {queryResults.map((result) => {
                    const cheaper = cheaperServer(result.chocoboMinPrice, result.moogleMinPrice)
                    return (
                      <article key={result.queryId} className="history-item">
                        <div className="history-item__top">
                          <strong>
                            {result.status === 'done' ? (result.confirmedName ?? result.inputName) : result.inputName}
                          </strong>
                          {result.status === 'loading' && <span className="badge">查詢中</span>}
                          {result.status === 'not-found' && <span className="badge badge--warning">未找到</span>}
                          {result.status === 'error' && <span className="badge badge--warning">錯誤</span>}
                          {result.status === 'done' && result.notMarketable && <span className="badge">無市場板資料</span>}
                          {result.status === 'done' && !result.notMarketable && cheaper && (
                            <span className="badge badge--positive">較低：{cheaper}</span>
                          )}
                        </div>

                        {result.status === 'done' && (
                          <div className="detail-list">
                            {result.confirmedName && result.confirmedName !== result.inputName ? (
                              <div><strong>辨識為：</strong>{result.confirmedName}</div>
                            ) : null}
                            {!result.notMarketable && (
                              <>
                                {result.chocoboMinPrice != null
                                  ? <div><strong>陸行鳥最低：</strong>{formatGil(result.chocoboMinPrice)}</div>
                                  : <div><strong>陸行鳥：</strong>無最新掛單</div>}
                                {result.moogleMinPrice != null
                                  ? <div><strong>莫古力最低：</strong>{formatGil(result.moogleMinPrice)}</div>
                                  : <div><strong>莫古力：</strong>無最新掛單</div>}
                                {result.chocoboAvgPrice != null && <div><strong>陸行鳥均價：</strong>{formatGil(result.chocoboAvgPrice)}</div>}
                                {result.moogleAvgPrice != null && <div><strong>莫古力均價：</strong>{formatGil(result.moogleAvgPrice)}</div>}
                              </>
                            )}
                            {result.notMarketable && <div>此道具無法在市場板交易，請參考 Garland Tools 連結確認取得方式。</div>}
                          </div>
                        )}

                        {result.recipeStatus === 'found' && (
                          <div className="badge-row">
                            <span className="badge badge--positive">
                              可製作{result.recipeCraftType ? `（${result.recipeCraftType}）` : ''}
                            </span>
                          </div>
                        )}
                        {result.recipeStatus === 'none' && (
                          <div className="badge-row">
                            <span className="badge">無製作配方</span>
                          </div>
                        )}

                        {result.status === 'done' && (
                          <div className="button-row">
                            {result.recipeStatus === 'idle' && (
                              <button
                                className="button button--ghost"
                                onClick={() => void fetchItemRecipe(result.queryId, result.confirmedName ?? result.inputName)}
                                type="button"
                              >
                                查配方
                              </button>
                            )}
                            {result.recipeStatus === 'loading' && (
                              <button className="button button--ghost" disabled type="button">查詢配方中⋯</button>
                            )}
                            {result.itemRowId != null && (
                              <>
                                <button
                                  className="button button--ghost"
                                  onClick={() => openMarketDetail(result.itemRowId!, result.confirmedName ?? result.inputName, 'chocobo')}
                                  type="button"
                                >
                                  查看陸行鳥詳情
                                </button>
                                <button
                                  className="button button--ghost"
                                  onClick={() => openMarketDetail(result.itemRowId!, result.confirmedName ?? result.inputName, 'moogle')}
                                  type="button"
                                >
                                  查看莫古力詳情
                                </button>
                                <a
                                  className="button button--ghost"
                                  href={garlandLink(result.itemRowId)}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Garland Tools（取得方式）
                                </a>
                                <a
                                  className="button button--ghost"
                                  href={universalisLink(result.itemRowId, MARKET_SCOPE_META[detailTargetServer].universalisWorld)}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Universalis（目前伺服器）
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </article>

            <article className="page-card" style={{ gridColumn: '1 / -1' }}>
              <div className="section-heading">
                <h2>主線裝備查價</h2>
                <p>
                  參考 FFXIV Market 的 MSQ price checker，依裝備品級與部位抓出可用裝備，
                  再同步比較陸行鳥與莫古力的市場價格。
                </p>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">裝備品級（ilvl）</span>
                  <input
                    className="input-text"
                    inputMode="numeric"
                    max={999}
                    min={1}
                    onChange={(event) => setMsqItemLevelInput(event.target.value)}
                    placeholder="例如 120"
                    type="number"
                    value={msqItemLevelInput}
                  />
                </label>
                <label className="field">
                  <span className="field-label">裝備部位</span>
                  <select
                    className="input-select"
                    onChange={(event) => setMsqCategoryFilter(event.target.value as MsqCategoryFilter)}
                    value={msqCategoryFilter}
                  >
                    {MSQ_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="button-row">
                <button
                  className="button button--primary"
                  disabled={msqBusy || !msqItemLevelValid}
                  onClick={() => void runMsqSearch()}
                  type="button"
                >
                  {msqBusy ? '查詢中⋯' : '查主線裝備'}
                </button>
              </div>

              {msqError ? (
                <div className="callout">
                  <span className="callout-title">查詢狀態</span>
                  <span className="callout-body">{msqError}</span>
                </div>
              ) : null}

              {msqResults.length === 0 ? (
                <div className="empty-state">
                  <strong>尚未執行主線裝備查價</strong>
                  <p>輸入裝備品級後，可快速檢查該等級的武器、防具與飾品市場價格。</p>
                </div>
              ) : (
                <div className="history-list">
                  {msqResults.map((result) => {
                    const cheaper = cheaperServer(result.chocoboMinPrice, result.moogleMinPrice)
                    return (
                      <article key={`${result.itemRowId}-${result.slotCategory}`} className="history-item">
                        <div className="history-item__top">
                          <strong>{result.itemName}</strong>
                          <span className="badge">{result.slotLabel}</span>
                          <span className="badge">裝備等級 {result.equipLevel}</span>
                          <span className="badge">物品等級 {result.itemLevel}</span>
                          {result.notMarketable && <span className="badge">不可交易</span>}
                          {!result.notMarketable && cheaper && (
                            <span className="badge badge--positive">較便宜：{cheaper}</span>
                          )}
                        </div>

                        <div className="detail-list">
                          {result.classJobCategoryName ? <div><strong>職業：</strong>{result.classJobCategoryName}</div> : null}
                          {result.chocoboMinPrice != null
                            ? <div><strong>陸行鳥最低：</strong>{formatGil(result.chocoboMinPrice)}</div>
                            : <div><strong>陸行鳥最低：</strong>暫無資料</div>}
                          {result.moogleMinPrice != null
                            ? <div><strong>莫古力最低：</strong>{formatGil(result.moogleMinPrice)}</div>
                            : <div><strong>莫古力最低：</strong>暫無資料</div>}
                          {result.chocoboAvgPrice != null ? <div><strong>陸行鳥平均：</strong>{formatGil(result.chocoboAvgPrice)}</div> : null}
                          {result.moogleAvgPrice != null ? <div><strong>莫古力平均：</strong>{formatGil(result.moogleAvgPrice)}</div> : null}
                        </div>

                        <div className="button-row">
                          <button
                            className="button button--ghost"
                            onClick={() => openMarketDetail(result.itemRowId, result.itemName, 'chocobo')}
                            type="button"
                          >
                            查看陸行鳥詳情
                          </button>
                          <button
                            className="button button--ghost"
                            onClick={() => openMarketDetail(result.itemRowId, result.itemName, 'moogle')}
                            type="button"
                          >
                            查看莫古力詳情
                          </button>
                          <a
                            className="button button--ghost"
                            href={garlandLink(result.itemRowId)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Garland Tools
                          </a>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </article>

            <article className="page-card" style={{ gridColumn: '1 / -1' }}>
              <div className="section-heading">
                <h2>製作職找價</h2>
                <p>
                  參考 FFXIV Market 的 crafting inspiration，依製作職與物品等級範圍找出可製作成果，
                  再比較陸行鳥與莫古力市場價格。
                </p>
              </div>

              <div className="field">
                <span className="field-label">製作職（最多 4 個）</span>
                <div className="button-row">
                  {CRAFTER_JOB_OPTIONS.map((option) => {
                    const selected = crafterSelectedJobs.includes(option.craftTypeId)
                    return (
                      <button
                        key={option.craftTypeId}
                        className={selected ? 'button button--primary' : 'button button--ghost'}
                        onClick={() => toggleCrafterJob(option.craftTypeId)}
                        type="button"
                      >
                        {option.label}（{option.shortLabel}）
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">最小物品等級</span>
                  <input
                    className="input-text"
                    inputMode="numeric"
                    max={999}
                    min={1}
                    onChange={(event) => setCrafterMinLevelInput(event.target.value)}
                    placeholder="例如 100"
                    type="number"
                    value={crafterMinLevelInput}
                  />
                </label>
                <label className="field">
                  <span className="field-label">最大物品等級</span>
                  <input
                    className="input-text"
                    inputMode="numeric"
                    max={999}
                    min={1}
                    onChange={(event) => setCrafterMaxLevelInput(event.target.value)}
                    placeholder="例如 120"
                    type="number"
                    value={crafterMaxLevelInput}
                  />
                </label>
              </div>

              <div className="badge-row">
                <span className="badge">已選職業：{crafterSelectedJobs.length} / 4</span>
                <span className="badge">目前範圍上限：{crafterMaxRange}</span>
                {crafterLevelBoundsValid
                  ? <span className="badge badge--positive">目前範圍：{crafterMaxLevelValue - crafterMinLevelValue + 1}</span>
                  : null}
              </div>

              {!crafterRangeValid && crafterLevelBoundsValid ? (
                <div className="callout">
                  <span className="callout-title">範圍限制</span>
                  <span className="callout-body">
                    目前選了 {crafterSelectedJobs.length || 0} 個製作職，本輪最多只建議查 {crafterMaxRange} 個等級範圍。
                  </span>
                </div>
              ) : null}

              <div className="button-row">
                <button
                  className="button button--primary"
                  disabled={crafterBusy || !crafterSearchReady}
                  onClick={() => void runCrafterSearch()}
                  type="button"
                >
                  {crafterBusy ? '查詢中⋯' : '查製作成果'}
                </button>
              </div>

              {crafterNotice ? (
                <div className="callout">
                  <span className="callout-title">查詢提示</span>
                  <span className="callout-body">{crafterNotice}</span>
                </div>
              ) : null}

              {crafterError ? (
                <div className="callout">
                  <span className="callout-title">查詢狀態</span>
                  <span className="callout-body">{crafterError}</span>
                </div>
              ) : null}

              {crafterResults.length === 0 ? (
                <div className="empty-state">
                  <strong>尚未執行製作職找價</strong>
                  <p>先選擇製作職與物品等級範圍。第一版會限制結果量，優先給出可操作的市場比價清單。</p>
                </div>
              ) : (
                <div className="history-list">
                  {crafterResults.map((result) => {
                    const cheaper = cheaperServer(result.chocoboMinPrice, result.moogleMinPrice)
                    return (
                      <article key={`${result.itemRowId}-craft`} className="history-item">
                        <div className="history-item__top">
                          <strong>{result.itemName}</strong>
                          <span className="badge">{result.craftJobLabels.join(' / ')}</span>
                          <span className="badge">物品等級 {result.itemLevel}</span>
                          <span className="badge">
                            {result.equipLevel > 1 ? `裝備等級 ${result.equipLevel}` : '非裝備道具'}
                          </span>
                          {result.notMarketable && <span className="badge">不可交易</span>}
                          {!result.notMarketable && cheaper && (
                            <span className="badge badge--positive">較便宜：{cheaper}</span>
                          )}
                        </div>

                        <div className="detail-list">
                          {result.chocoboMinPrice != null
                            ? <div><strong>陸行鳥最低：</strong>{formatGil(result.chocoboMinPrice)}</div>
                            : <div><strong>陸行鳥最低：</strong>暫無資料</div>}
                          {result.moogleMinPrice != null
                            ? <div><strong>莫古力最低：</strong>{formatGil(result.moogleMinPrice)}</div>
                            : <div><strong>莫古力最低：</strong>暫無資料</div>}
                          {result.chocoboAvgPrice != null ? <div><strong>陸行鳥平均：</strong>{formatGil(result.chocoboAvgPrice)}</div> : null}
                          {result.moogleAvgPrice != null ? <div><strong>莫古力平均：</strong>{formatGil(result.moogleAvgPrice)}</div> : null}
                        </div>

                        <div className="button-row">
                          <button
                            className="button button--ghost"
                            onClick={() => openMarketDetail(result.itemRowId, result.itemName, 'chocobo')}
                            type="button"
                          >
                            查看陸行鳥詳情
                          </button>
                          <button
                            className="button button--ghost"
                            onClick={() => openMarketDetail(result.itemRowId, result.itemName, 'moogle')}
                            type="button"
                          >
                            查看莫古力詳情
                          </button>
                          <a
                            className="button button--ghost"
                            href={garlandLink(result.itemRowId)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Garland Tools
                          </a>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </article>

            <article className="page-card" ref={detailSectionRef} style={{ gridColumn: '1 / -1' }}>
              <div className="section-heading">
                <h2>單品市場詳情</h2>
                <p>
                  這裡顯示單一道具在 {serverLabel(detailTargetServer)} 的市場摘要、掛單與近期交易。
                  目前支援 HQ / NQ 篩選與一鍵帶入工作表。
                </p>
              </div>

              {detailSelection ? (
                <>
                  <div className="badge-row">
                    <span className="badge badge--positive">目前道具：{detailSelection.itemName}</span>
                    <span className="badge">伺服器：{serverLabel(detailTargetServer)}</span>
                    <span className="badge">品質：{qualityFilterLabel(detailQualityFilter)}</span>
                    {detailSnapshot ? <span className="badge">查詢時間：{formatRelativeTime(detailSnapshot.fetchedAt)}</span> : null}
                    {detailLatestReviewTime > 0 ? <span className="badge">最新檢視：{formatRelativeTime(detailLatestReviewTime)}</span> : null}
                  </div>

                  <div className="field-grid">
                    <label className="field">
                      <span className="field-label">市場伺服器</span>
                      <select
                        className="input-select"
                        onChange={(event) => setDetailTargetServer(event.target.value as MarketOcrTargetServer)}
                        value={detailTargetServer}
                      >
                        <option value="chocobo">陸行鳥</option>
                        <option value="moogle">莫古力</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">品質篩選</span>
                      <select
                        className="input-select"
                        onChange={(event) => setDetailQualityFilter(event.target.value as MarketQualityFilter)}
                        value={detailQualityFilter}
                      >
                        <option value="all">HQ / NQ 全部</option>
                        <option value="hq">只看 HQ</option>
                        <option value="nq">只看 NQ</option>
                      </select>
                    </label>
                  </div>

                  <div className="button-row">
                    <button className="button button--primary" onClick={addDetailToWorkbook} type="button">帶入工作表</button>
                    <a
                      className="button button--ghost"
                      href={garlandLink(detailSelection.itemRowId)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Garland Tools
                    </a>
                    <a
                      className="button button--ghost"
                      href={universalisLink(detailSelection.itemRowId, MARKET_SCOPE_META[detailTargetServer].universalisWorld)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Universalis
                    </a>
                  </div>

                  {detailBusy ? (
                    <div className="callout">
                      <span className="callout-title">市場資料載入中</span>
                      <span className="callout-body">正在向 Universalis 取得掛單與交易歷史。</span>
                    </div>
                  ) : detailError ? (
                    <div className="callout callout--error">
                      <span className="callout-title">查詢失敗</span>
                      <span className="callout-body">{detailError}</span>
                    </div>
                  ) : detailSnapshot ? (
                    <div className="page-grid">
                      <div className="stats-grid">
                        <article className="stat-card"><div className="stat-label">最低價格</div><div className="stat-value">{formatGil(detailSummary.lowestPrice)}</div></article>
                        <article className="stat-card"><div className="stat-label">平均價格</div><div className="stat-value">{formatGil(detailSummary.averagePrice)}</div></article>
                        <article className="stat-card"><div className="stat-label">最近成交</div><div className="stat-value">{formatGil(detailSummary.recentPurchasePrice)}</div></article>
                        <article className="stat-card"><div className="stat-label">成交時間</div><div className="stat-value">{detailSummary.recentPurchaseAt ? formatRelativeTime(detailSummary.recentPurchaseAt) : '無資料'}</div></article>
                        <article className="stat-card"><div className="stat-label">流通速度</div><div className="stat-value">{detailSnapshot.regularSaleVelocity != null ? `${detailSnapshot.regularSaleVelocity.toFixed(1)} / day` : '無資料'}</div></article>
                        <article className="stat-card"><div className="stat-label">掛單 / 歷史</div><div className="stat-value">{sortedDetailListings.length} / {sortedDetailSales.length}</div></article>
                      </div>

                      <section className="page-card">
                        <div className="section-heading">
                          <h2>目前掛單</h2>
                          <p>依單價由低到高排序，支援 HQ / NQ 篩選。</p>
                        </div>
                        {sortedDetailListings.length === 0 ? (
                          <div className="empty-state">
                            <strong>目前沒有符合條件的掛單</strong>
                            <p>可能是該道具沒有上架，或目前品質篩選沒有資料。</p>
                          </div>
                        ) : (
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr><th>單價</th><th>數量</th><th>總價</th><th>品質</th><th>世界</th><th>檢視時間</th></tr>
                              </thead>
                              <tbody>
                                {sortedDetailListings.map((listing, index) => (
                                  <tr key={`${listing.worldName}-${listing.pricePerUnit}-${listing.quantity}-${index}`}>
                                    <td>{formatGil(listing.pricePerUnit)}</td>
                                    <td>{listing.quantity}</td>
                                    <td>{formatGil(listing.total)}</td>
                                    <td>{listing.hq ? 'HQ' : 'NQ'}</td>
                                    <td>{listing.worldName}</td>
                                    <td>{listing.lastReviewTime ? formatRelativeTime(listing.lastReviewTime) : '無資料'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>

                      <section className="page-card">
                        <div className="section-heading">
                          <h2>近期交易</h2>
                          <p>依成交時間由新到舊排序，可快速確認最近是否有人買。</p>
                        </div>
                        {sortedDetailSales.length === 0 ? (
                          <div className="empty-state">
                            <strong>目前沒有符合條件的交易紀錄</strong>
                            <p>這代表近期沒有成交，或目前品質篩選沒有資料。</p>
                          </div>
                        ) : (
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr><th>單價</th><th>數量</th><th>品質</th><th>世界</th><th>成交時間</th></tr>
                              </thead>
                              <tbody>
                                {sortedDetailSales.map((sale, index) => (
                                  <tr key={`${sale.worldName}-${sale.timestamp}-${sale.pricePerUnit}-${index}`}>
                                    <td>{formatGil(sale.pricePerUnit)}</td>
                                    <td>{sale.quantity}</td>
                                    <td>{sale.hq ? 'HQ' : 'NQ'}</td>
                                    <td>{sale.worldName}</td>
                                    <td>{formatShortDateTime(sale.timestamp)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <strong>尚未載入市場資料</strong>
                      <p>請先從上方查詢結果或最近更新清單開啟道具詳情。</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <strong>尚未選擇單一道具</strong>
                  <p>請先從上方查詢結果點「查看詳情」。</p>
                </div>
              )}
            </article>

            <article className="page-card" style={{ gridColumn: '1 / -1' }}>
              <div className="section-heading">
                <h2>最近更新的物品</h2>
                <p>
                  這裡顯示與 {serverLabel(detailTargetServer)} 對應資料中心
                  （{MARKET_SCOPE_META[detailTargetServer].recentUpdateDc}）最近上傳的市場物品。
                </p>
              </div>
              <div className="button-row">
                <button
                  className="button button--ghost"
                  disabled={recentMarketBusy}
                  onClick={() => void refreshRecentMarketEntries(true)}
                  type="button"
                >
                  {recentMarketBusy ? '更新中⋯' : '重新整理最近更新'}
                </button>
              </div>
              {recentMarketBusy ? (
                <div className="callout">
                  <span className="callout-title">市場摘要更新中</span>
                  <span className="callout-body">正在取得最近上傳的市場物品與道具名稱。</span>
                </div>
              ) : recentMarketError ? (
                <div className="callout callout--error">
                  <span className="callout-title">載入失敗</span>
                  <span className="callout-body">{recentMarketError}</span>
                </div>
              ) : recentMarketEntries.length === 0 ? (
                <div className="empty-state">
                  <strong>目前沒有最近更新資料</strong>
                  <p>請稍後重試，或切換另一個伺服器查看對應資料中心。</p>
                </div>
              ) : (
                <div className="history-list">
                  {recentMarketEntries.map((entry) => (
                    <article key={`${entry.itemRowId}-${entry.lastUploadTime}`} className="history-item">
                      <div className="history-item__top">
                        <strong>{entry.itemName}</strong>
                        <span className="badge badge--positive">{formatRelativeTime(entry.lastUploadTime)}</span>
                      </div>
                      <div className="detail-list">
                        <div><strong>更新世界：</strong>{entry.worldName}</div>
                        <div><strong>更新時間：</strong>{formatShortDateTime(entry.lastUploadTime)}</div>
                      </div>
                      <div className="button-row">
                        <button
                          className="button button--ghost"
                          onClick={() => openMarketDetail(entry.itemRowId, entry.itemName, detailTargetServer)}
                          type="button"
                        >
                          查看單品詳情
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </div>
        )}
      </section>

      <SourceAttribution entries={pageSources.market.entries} />
    </div>
  )
}

export default MarketPage
