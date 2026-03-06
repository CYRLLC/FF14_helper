import { startTransition, useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
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
  extractRowsFromOcrText,
  type MarketOcrTargetServer,
} from '../tools/marketOcr'
import { getErrorMessage } from '../utils/errors'

const MARKET_STORAGE_KEY = 'ff14-helper.market.workbook.v2'

interface MarketActivityLogEntry {
  id: string
  createdAt: string
  message: string
}

interface MarketPageState {
  rows: MarketWorkbookRow[]
  calculatorRowId: string | null
  listingPrice: number
  quantity: number
  taxRatePercent: number
  unitCost: number
  activityLog: MarketActivityLogEntry[]
  lastUpdatedAt: string | null
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyRow(): MarketWorkbookRow {
  return {
    id: createId('row'),
    itemName: '',
    chocoboPrice: 0,
    mooglePrice: 0,
    quantity: 1,
    note: '',
  }
}

function getDefaultState(): MarketPageState {
  return {
    rows: [],
    calculatorRowId: null,
    listingPrice: 0,
    quantity: 1,
    taxRatePercent: 5,
    unitCost: 0,
    activityLog: [],
    lastUpdatedAt: null,
  }
}

function loadSavedState(): MarketPageState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(MARKET_STORAGE_KEY)

    if (!raw) {
      return getDefaultState()
    }

    const parsed = JSON.parse(raw) as Partial<MarketPageState>
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows
          .filter((row): row is MarketWorkbookRow => Boolean(row && typeof row === 'object'))
          .map((row) =>
            sanitizeWorkbookRow({
              id: typeof row.id === 'string' ? row.id : createId('row'),
              itemName: typeof row.itemName === 'string' ? row.itemName : '',
              chocoboPrice: Number(row.chocoboPrice ?? 0),
              mooglePrice: Number(row.mooglePrice ?? 0),
              quantity: Number(row.quantity ?? 1),
              note: typeof row.note === 'string' ? row.note : '',
            }),
          )
      : []

    return {
      rows,
      calculatorRowId: typeof parsed.calculatorRowId === 'string' ? parsed.calculatorRowId : null,
      listingPrice: Number(parsed.listingPrice ?? 0),
      quantity: Number(parsed.quantity ?? 1),
      taxRatePercent: Number(parsed.taxRatePercent ?? 5),
      unitCost: Number(parsed.unitCost ?? 0),
      activityLog: Array.isArray(parsed.activityLog)
        ? parsed.activityLog
            .filter((entry): entry is MarketActivityLogEntry => Boolean(entry && typeof entry === 'object'))
            .map((entry) => ({
              id: typeof entry.id === 'string' ? entry.id : createId('log'),
              createdAt:
                typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
              message: typeof entry.message === 'string' ? entry.message : '已更新工作表',
            }))
            .slice(0, 10)
        : [],
      lastUpdatedAt: typeof parsed.lastUpdatedAt === 'string' ? parsed.lastUpdatedAt : null,
    }
  } catch {
    return getDefaultState()
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 2,
  }).format(value)
}

function parseBulkRows(rawValue: string): MarketWorkbookRow[] {
  return rawValue
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [itemName = '', chocobo = '0', moogle = '0', quantity = '1', note = ''] = line
        .split('\t')
        .map((part) => part.trim())

      return sanitizeWorkbookRow({
        id: createId('row'),
        itemName,
        chocoboPrice: Number(chocobo),
        mooglePrice: Number(moogle),
        quantity: Number(quantity),
        note,
      })
    })
    .filter((row) => row.itemName.length > 0)
}

function buildLogEntry(message: string): MarketActivityLogEntry {
  return {
    id: createId('log'),
    createdAt: new Date().toISOString(),
    message,
  }
}

function MarketPage() {
  const [savedState] = useState(() => loadSavedState())
  const [rows, setRows] = useState<MarketWorkbookRow[]>(savedState.rows)
  const [calculatorRowId, setCalculatorRowId] = useState<string | null>(savedState.calculatorRowId)
  const [listingPrice, setListingPrice] = useState(savedState.listingPrice)
  const [quantity, setQuantity] = useState(savedState.quantity)
  const [taxRatePercent, setTaxRatePercent] = useState(savedState.taxRatePercent)
  const [unitCost, setUnitCost] = useState(savedState.unitCost)
  const [activityLog, setActivityLog] = useState<MarketActivityLogEntry[]>(savedState.activityLog)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(savedState.lastUpdatedAt)
  const [draftRow, setDraftRow] = useState<MarketWorkbookRow>(() => createEmptyRow())
  const [bulkInput, setBulkInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [ocrTargetServer, setOcrTargetServer] = useState<MarketOcrTargetServer>('chocobo')
  const [mergeOcrRows, setMergeOcrRows] = useState(true)
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(
      MARKET_STORAGE_KEY,
      JSON.stringify({
        rows,
        calculatorRowId,
        listingPrice,
        quantity,
        taxRatePercent,
        unitCost,
        activityLog,
        lastUpdatedAt,
      }),
    )
  }, [activityLog, calculatorRowId, lastUpdatedAt, listingPrice, quantity, rows, taxRatePercent, unitCost])

  const runOcr = useCallback(
    async (file: Blob): Promise<void> => {
      setOcrBusy(true)
      setOcrError(null)
      setOcrText('')

      if (ocrPreviewUrl) {
        URL.revokeObjectURL(ocrPreviewUrl)
      }

      const previewUrl = URL.createObjectURL(file)
      setOcrPreviewUrl(previewUrl)

      try {
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('chi_tra+eng')
        const result = await worker.recognize(file)
        await worker.terminate()

        const nextOcrText = result.data.text?.trim() ?? ''
        const parsedRows = extractRowsFromOcrText(nextOcrText)

        if (parsedRows.length === 0) {
          setOcrText(nextOcrText)
          setOcrError('OCR 已完成，但沒有辨識到可用的「道具名稱 + 價格」資料')
          return
        }

        setOcrText(nextOcrText)

        startTransition(() => {
          const nextRows = applyOcrRowsToWorkbook({
            existingRows: rows,
            parsedRows,
            targetServer: ocrTargetServer,
            mergeExistingRows: mergeOcrRows,
            createRowId: () => createId('row'),
          }).map((row) => sanitizeWorkbookRow(row))
          const nextMessage = `已從截圖辨識匯入 ${parsedRows.length} 筆 ${ocrTargetServer === 'chocobo' ? '陸行鳥' : '莫古力'} 價格`
          const logEntry = buildLogEntry(nextMessage)

          setRows(nextRows)
          setActivityLog((current) => [logEntry, ...current].slice(0, 8))
          setLastUpdatedAt(logEntry.createdAt)
          setMessage(nextMessage)
        })
      } catch (error) {
        setOcrError(getErrorMessage(error))
      } finally {
        setOcrBusy(false)
      }
    },
    [mergeOcrRows, ocrPreviewUrl, ocrTargetServer, rows],
  )

  useEffect(() => {
    async function handlePaste(event: ClipboardEvent): Promise<void> {
      const items = event.clipboardData?.items

      if (!items) {
        return
      }

      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))

      if (!imageItem) {
        return
      }

      event.preventDefault()
      const file = imageItem.getAsFile()

      if (!file) {
        return
      }

      await runOcr(file)
    }

    window.addEventListener('paste', handlePaste)

    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [runOcr])

  const workbookSummary = useMemo(() => buildWorkbookSummary(rows), [rows])
  const selectedCalculatorRow = useMemo(
    () => rows.find((row) => row.id === calculatorRowId) ?? null,
    [calculatorRowId, rows],
  )
  const marketSummary = useMemo(
    () =>
      calculateMarketboardSummary({
        listingPrice,
        quantity,
        taxRatePercent,
        unitCost,
      }),
    [listingPrice, quantity, taxRatePercent, unitCost],
  )

  function pushActivity(messageText: string): void {
    const entry = buildLogEntry(messageText)

    setActivityLog((current) => [entry, ...current].slice(0, 8))
    setLastUpdatedAt(entry.createdAt)
    setMessage(messageText)
  }

  function updateRows(nextRows: MarketWorkbookRow[], logMessage: string): void {
    setRows(nextRows)
    pushActivity(logMessage)
  }

  function updateRow(rowId: string, patch: Partial<MarketWorkbookRow>): void {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? sanitizeWorkbookRow({
              ...row,
              ...patch,
            })
          : row,
      ),
    )

    pushActivity('已更新一筆查價資料')
  }

  function addDraftRow(): void {
    if (!draftRow.itemName.trim()) {
      setMessage('請先輸入道具名稱')
      return
    }

    const nextRow = sanitizeWorkbookRow({
      ...draftRow,
      id: createId('row'),
    })

    updateRows([...rows, nextRow], `已新增「${nextRow.itemName}」到工作表`)
    setDraftRow(createEmptyRow())
  }

  function importBulkRows(): void {
    const parsedRows = parseBulkRows(bulkInput)

    if (parsedRows.length === 0) {
      setMessage('沒有讀到可匯入的資料，請確認每列使用 Tab 分隔欄位')
      return
    }

    updateRows([...rows, ...parsedRows], `已匯入 ${parsedRows.length} 筆手動資料`)
    setBulkInput('')
  }

  function removeRow(rowId: string): void {
    updateRows(
      rows.filter((row) => row.id !== rowId),
      '已移除一筆查價資料',
    )
    setCalculatorRowId((currentRowId) => (currentRowId === rowId ? null : currentRowId))
  }

  function clearRows(): void {
    setRows([])
    setCalculatorRowId(null)
    pushActivity('已清空整個查價工作表')
  }

  function applyRowToCalculator(row: MarketWorkbookRow, preferred: 'cheaper' | 'chocobo' | 'moogle'): void {
    const sanitized = sanitizeWorkbookRow(row)
    const comparison = compareTwServerPrices([
      {
        serverName: '陸行鳥',
        pricePerUnit: sanitized.chocoboPrice,
        quantity: sanitized.quantity,
      },
      {
        serverName: '莫古力',
        pricePerUnit: sanitized.mooglePrice,
        quantity: sanitized.quantity,
      },
    ])

    let nextPrice = sanitized.chocoboPrice

    if (preferred === 'moogle') {
      nextPrice = sanitized.mooglePrice
    } else if (preferred === 'cheaper' && comparison.cheaperServer === '莫古力') {
      nextPrice = sanitized.mooglePrice
    }

    setCalculatorRowId(row.id)
    setListingPrice(nextPrice)
    setQuantity(sanitized.quantity)
    pushActivity(`已將「${sanitized.itemName || '未命名道具'}」帶入市場板試算`)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    void runOcr(file)
    event.target.value = ''
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">繁中服查價</p>
        <h2>陸行鳥 / 莫古力雙服工作表</h2>
        <p className="lead">
          本頁參考 FFXIV Market (beherw) 的工作流程，整合雙服比價、最近異動摘要、手動匯入與
          截圖 OCR 匯入。本站不保證即時抓到官方市場資料，因此把焦點放在你真正會用到的整理與比價流程。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">繁體中文介面</span>
          <span className="badge">雙服工作表</span>
          <span className="badge badge--warning">支援貼上或上傳截圖辨識</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>最新資料與最近異動</h2>
          <p>這裡會顯示目前工作表最後更新時間，以及最近做了哪些匯入或調整。</p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">工作表筆數</div>
            <div className="stat-value">{rows.length}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">最後更新</div>
            <div className="stat-value">{formatShortDateTime(lastUpdatedAt ?? undefined)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">最新資料</div>
            <div className="stat-value">
              {activityLog[0]?.message ?? '尚未建立任何查價資料'}
            </div>
          </article>
        </div>

        {activityLog.length === 0 ? (
          <div className="empty-state">
            <strong>目前還沒有異動紀錄</strong>
            <p>你新增道具、批次匯入或使用 OCR 後，這裡會顯示最近更新的內容。</p>
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
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>新增或匯入價格</h2>
          <p>可逐筆輸入、批次貼上，或用截圖 OCR 匯入。貼上截圖支援直接從剪貼簿 Ctrl+V。</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">道具名稱</span>
            <input
              className="input-text"
              onChange={(event) => setDraftRow((current) => ({ ...current, itemName: event.target.value }))}
              placeholder="例如：靈砂油"
              type="text"
              value={draftRow.itemName}
            />
          </label>
          <label className="field">
            <span className="field-label">陸行鳥價格</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) =>
                setDraftRow((current) => ({ ...current, chocoboPrice: Number(event.target.value) }))
              }
              step="1"
              type="number"
              value={draftRow.chocoboPrice}
            />
          </label>
          <label className="field">
            <span className="field-label">莫古力價格</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) =>
                setDraftRow((current) => ({ ...current, mooglePrice: Number(event.target.value) }))
              }
              step="1"
              type="number"
              value={draftRow.mooglePrice}
            />
          </label>
          <label className="field">
            <span className="field-label">數量</span>
            <input
              className="input-text"
              min="1"
              onChange={(event) =>
                setDraftRow((current) => ({ ...current, quantity: Number(event.target.value) }))
              }
              step="1"
              type="number"
              value={draftRow.quantity}
            />
          </label>
          <label className="field">
            <span className="field-label">備註</span>
            <input
              className="input-text"
              onChange={(event) => setDraftRow((current) => ({ ...current, note: event.target.value }))}
              placeholder="例如：HQ 或限量"
              type="text"
              value={draftRow.note}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="button button--primary" onClick={addDraftRow} type="button">
            新增到工作表
          </button>
          <button className="button button--ghost" onClick={clearRows} type="button">
            清空工作表
          </button>
          <a
            className="button button--ghost"
            href="https://beherw.github.io/FFXIV_Market/"
            rel="noreferrer"
            target="_blank"
          >
            開啟參考網站
          </a>
        </div>

        <label className="field">
          <span className="field-label">批次貼上（每列：道具名稱 / 陸行鳥 / 莫古力 / 數量 / 備註，以 Tab 分隔）</span>
          <textarea
            className="input-text"
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder={'靈砂油\t12500\t13200\t3\t\n匠人藥水\t8800\t9000\t2\tHQ'}
            rows={4}
            value={bulkInput}
          />
        </label>

        <div className="button-row">
          <button className="button button--ghost" onClick={importBulkRows} type="button">
            匯入批次資料
          </button>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">OCR 匯入目標伺服器</span>
            <select
              className="input-select"
              onChange={(event) => setOcrTargetServer(event.target.value as MarketOcrTargetServer)}
              value={ocrTargetServer}
            >
              <option value="chocobo">陸行鳥</option>
              <option value="moogle">莫古力</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">OCR 匯入模式</span>
            <select
              className="input-select"
              onChange={(event) => setMergeOcrRows(event.target.value === 'merge')}
              value={mergeOcrRows ? 'merge' : 'replace'}
            >
              <option value="merge">合併到現有工作表</option>
              <option value="replace">建立新的工作表內容</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">上傳截圖</span>
            <input
              accept="image/*"
              className="input-text"
              onChange={handleFileChange}
              type="file"
            />
          </label>
        </div>

        <div className="callout">
          <span className="callout-title">截圖查價</span>
          <span className="callout-body">
            你可以直接把遊戲或其他表格截圖貼到這個頁面，本站會用 OCR 抽出「道具名稱 + 價格」並匯入工作表。
          </span>
        </div>

        {ocrBusy ? (
          <div className="callout">
            <span className="callout-title">OCR 辨識中</span>
            <span className="callout-body">正在分析截圖，這通常需要幾秒鐘。</span>
          </div>
        ) : null}

        {ocrError ? (
          <div className="callout callout--error">
            <span className="callout-title">OCR 提示</span>
            <span className="callout-body">{ocrError}</span>
          </div>
        ) : null}

        {ocrPreviewUrl ? (
          <div className="field-grid">
            <div className="field">
              <span className="field-label">最近辨識的截圖</span>
              <img
                alt="OCR 預覽"
                className="market-ocr-preview"
                src={ocrPreviewUrl}
              />
            </div>
            <label className="field">
              <span className="field-label">OCR 原始文字</span>
              <textarea className="input-text" readOnly rows={8} value={ocrText} />
            </label>
          </div>
        ) : null}

        {message ? (
          <div className="callout callout--success">
            <span className="callout-title">狀態</span>
            <span className="callout-body">{message}</span>
          </div>
        ) : null}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>雙服總覽</h2>
          <p>先看整體買在哪一邊比較省，再決定逐項拆單。</p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">全部買陸行鳥</div>
            <div className="stat-value">{formatGil(workbookSummary.chocoboTotal)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">全部買莫古力</div>
            <div className="stat-value">{formatGil(workbookSummary.moogleTotal)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">逐項挑低價</div>
            <div className="stat-value">{formatGil(workbookSummary.mixedCheapestTotal)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">比陸行鳥省下</div>
            <div className="stat-value">{formatGil(workbookSummary.savingsVsChocobo)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">比莫古力省下</div>
            <div className="stat-value">{formatGil(workbookSummary.savingsVsMoogle)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">較便宜分布</div>
            <div className="stat-value">
              陸行鳥 {workbookSummary.cheaperOnChocobo} / 莫古力 {workbookSummary.cheaperOnMoogle} / 同價{' '}
              {workbookSummary.equalPriceItems}
            </div>
          </article>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>工作表</h2>
          <p>每一列都可以即時編修，並把單列價格帶入下方市場板試算。</p>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <strong>目前還沒有任何查價資料</strong>
            <p>你可以手動新增、批次貼上，或直接貼截圖讓 OCR 幫你整理。</p>
          </div>
        ) : (
          <div className="treasure-card-grid">
            {rows.map((row) => {
              const comparison = compareTwServerPrices([
                {
                  serverName: '陸行鳥',
                  pricePerUnit: row.chocoboPrice,
                  quantity: row.quantity,
                },
                {
                  serverName: '莫古力',
                  pricePerUnit: row.mooglePrice,
                  quantity: row.quantity,
                },
              ])

              return (
                <article
                  key={row.id}
                  className={
                    row.id === selectedCalculatorRow?.id ? 'treasure-card treasure-card--active' : 'treasure-card'
                  }
                >
                  <div className="field-grid">
                    <label className="field">
                      <span className="field-label">道具名稱</span>
                      <input
                        className="input-text"
                        onChange={(event) => updateRow(row.id, { itemName: event.target.value })}
                        type="text"
                        value={row.itemName}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">陸行鳥</span>
                      <input
                        className="input-text"
                        min="0"
                        onChange={(event) => updateRow(row.id, { chocoboPrice: Number(event.target.value) })}
                        step="1"
                        type="number"
                        value={row.chocoboPrice}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">莫古力</span>
                      <input
                        className="input-text"
                        min="0"
                        onChange={(event) => updateRow(row.id, { mooglePrice: Number(event.target.value) })}
                        step="1"
                        type="number"
                        value={row.mooglePrice}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">數量</span>
                      <input
                        className="input-text"
                        min="1"
                        onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value) })}
                        step="1"
                        type="number"
                        value={row.quantity}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">備註</span>
                      <input
                        className="input-text"
                        onChange={(event) => updateRow(row.id, { note: event.target.value })}
                        type="text"
                        value={row.note}
                      />
                    </label>
                  </div>

                  <div className="stats-grid">
                    <article className="stat-card">
                      <div className="stat-label">較便宜</div>
                      <div className="stat-value">{comparison.cheaperServer ?? '無法判斷'}</div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-label">價差</div>
                      <div className="stat-value">{formatGil(comparison.priceSpread)}</div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-label">最低總價</div>
                      <div className="stat-value">
                        {formatGil(Math.min(row.chocoboPrice, row.mooglePrice) * Math.max(1, row.quantity))}
                      </div>
                    </article>
                  </div>

                  <div className="button-row">
                    <button
                      className="button button--primary"
                      onClick={() => applyRowToCalculator(row, 'cheaper')}
                      type="button"
                    >
                      帶入較低價
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => applyRowToCalculator(row, 'chocobo')}
                      type="button"
                    >
                      帶入陸行鳥
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => applyRowToCalculator(row, 'moogle')}
                      type="button"
                    >
                      帶入莫古力
                    </button>
                    <button className="button button--ghost" onClick={() => removeRow(row.id)} type="button">
                      移除
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>市場板試算</h2>
          <p>把工作表中的價格帶進來後，可以快速估算稅額、淨收入、成本與利潤。</p>
        </div>

        {selectedCalculatorRow ? (
          <div className="callout">
            <span className="callout-title">目前帶入資料</span>
            <span className="callout-body">
              {selectedCalculatorRow.itemName} | 數量 {selectedCalculatorRow.quantity} | 最近帶入時間{' '}
              {formatShortDateTime(lastUpdatedAt ?? undefined)}
            </span>
          </div>
        ) : null}

        <div className="field-grid">
          <label className="field">
            <span className="field-label">售價</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setListingPrice(Number(event.target.value))}
              step="1"
              type="number"
              value={listingPrice}
            />
          </label>
          <label className="field">
            <span className="field-label">數量</span>
            <input
              className="input-text"
              min="1"
              onChange={(event) => setQuantity(Number(event.target.value))}
              step="1"
              type="number"
              value={quantity}
            />
          </label>
          <label className="field">
            <span className="field-label">稅率 (%)</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setTaxRatePercent(Number(event.target.value))}
              step="0.1"
              type="number"
              value={taxRatePercent}
            />
          </label>
          <label className="field">
            <span className="field-label">單位成本</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setUnitCost(Number(event.target.value))}
              step="1"
              type="number"
              value={unitCost}
            />
          </label>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">總售價</div>
            <div className="stat-value">{formatNumber(marketSummary.grossTotal)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">稅額</div>
            <div className="stat-value">{formatNumber(marketSummary.taxAmount)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">淨收入</div>
            <div className="stat-value">{formatNumber(marketSummary.netTotal)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">總成本</div>
            <div className="stat-value">{formatNumber(marketSummary.totalCost)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">利潤</div>
            <div className="stat-value">{formatNumber(marketSummary.profit)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">損益平衡單價</div>
            <div className="stat-value">{formatNumber(marketSummary.breakEvenPerUnit)} gil</div>
          </article>
        </div>
      </section>

      <SourceAttribution entries={pageSources.market.entries} />
    </div>
  )
}

export default MarketPage
