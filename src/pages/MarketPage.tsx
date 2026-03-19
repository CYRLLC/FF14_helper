import { startTransition, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { fetchItemMarketBatch } from '../api/universalis'
import { searchXivapi, searchRecipeResults, type XivapiSearchResult } from '../api/xivapi'
import {
  buildWorkbookSummary,
  calculateMarketboardSummary,
  compareTwServerPrices,
  sanitizeWorkbookRow,
  type MarketWorkbookRow,
} from '../tools/market'
import { formatGil, formatShortDateTime } from '../tools/marketFormat'
import {
  applyOcrRowsToWorkbook,
  extractNamesFromOcrText,
  extractRowsFromOcrText,
  type MarketOcrParsedRow,
  type MarketOcrTargetServer,
} from '../tools/marketOcr'
import type { MarketScopeSelection } from '../types'
import { getErrorMessage } from '../utils/errors'

const STORAGE_KEY = 'ff14-helper.market.workbench.v3'

type MarketTab = 'import' | 'workbook' | 'calculator' | 'query'
type ImportSource = 'ocr-image' | 'ocr-paste' | 'bulk' | 'manual'

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
}

// ── Query feature types ──────────────────────────────────────

interface QueryName {
  id: string
  name: string
}

type QueryItemStatus = 'idle' | 'loading' | 'done' | 'not-found' | 'error'
type RecipeStatus = 'idle' | 'loading' | 'found' | 'none'

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

const SCOPE_CHOCOBO: MarketScopeSelection = { region: 'JP', mode: 'world', scopeKey: 'Chocobo' }
const SCOPE_MOOGLE: MarketScopeSelection = { region: 'EU', mode: 'world', scopeKey: 'Moogle' }

const TABS: Array<{ id: MarketTab; label: string }> = [
  { id: 'import', label: '截圖匯入' },
  { id: 'workbook', label: '工作表' },
  { id: 'calculator', label: '試算' },
  { id: 'query', label: '道具查詢' },
]

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

function buildLogEntry(message: string): ActivityEntry {
  return { id: createId('log'), createdAt: new Date().toISOString(), message }
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
  const queryDropRef = useRef<HTMLDivElement>(null)

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

  // ── Import handlers ──────────────────────────────────────────

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
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('chi_tra+eng')
      const result = await worker.recognize(file)
      await worker.terminate()
      const nextText = result.data.text?.trim() ?? ''
      const parsedRows = extractRowsFromOcrText(nextText)
      setOcrText(nextText)
      setOcrPreviewRows(parsedRows.map((row) => ({ ...row, id: createId('preview') })))
      if (parsedRows.length === 0) {
        setOcrError('OCR 沒有辨識出可用資料，請改用更清楚的截圖，或直接手動修正預覽內容。')
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
      .map((row) => ({ itemName: row.itemName.trim(), price: Number(row.price), quantity: Math.max(1, Number(row.quantity)) }))
      .filter((row) => row.itemName.length > 0 && row.price > 0)
    if (parsedRows.length === 0) {
      setOcrError('預覽區沒有可寫入的資料。')
      return
    }
    commitImport(parsedRows, ocrSource)
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
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('chi_tra+eng')
      const result = await worker.recognize(file)
      await worker.terminate()
      const names = extractNamesFromOcrText(result.data.text?.trim() ?? '')
      setQueryNames(names.map((name) => ({ id: createId('q'), name })))
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
      setQueryResults(
        queryNames.map((qn): QueryResult => {
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
        }),
      )
    } catch (error) {
      setMessage(`查詢失敗：${getErrorMessage(error)}`)
      setQueryResults((current) => current.map((r) => ({ ...r, status: 'error', error: getErrorMessage(error) })))
    } finally {
      setQueryBusy(false)
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
                  <span className="callout-body">正在分析圖片文字，請稍候。</span>
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
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr><th>道具名稱</th><th>價格</th><th>數量</th><th>操作</th></tr>
                          </thead>
                          <tbody>
                            {ocrPreviewRows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <input
                                    className="input-text"
                                    onChange={(event) => setOcrPreviewRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, itemName: event.target.value } : entry)))}
                                    type="text"
                                    value={row.itemName}
                                  />
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
                          寫入工作表
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
            </article>

            {/* Right: results */}
            <article className="page-card">
              <div className="section-heading">
                <h2>查詢結果</h2>
                <p>
                  市價由 Universalis 即時查詢（陸行鳥 / 莫古力）。
                  「取得方式」點擊 Garland Tools 連結查看完整資料，「查配方」確認是否可製作。
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
                                  href={universalisLink(result.itemRowId, 'Chocobo')}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Universalis
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
          </div>
        )}
      </section>

      <SourceAttribution entries={pageSources.market.entries} />
    </div>
  )
}

export default MarketPage
