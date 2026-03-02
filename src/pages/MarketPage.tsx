import { useEffect, useMemo, useState } from 'react'
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

const MARKET_WORKBOOK_KEY = 'ff14-helper.market.workbook'

interface MarketWorkbookState {
  rows: MarketWorkbookRow[]
  calculatorRowId: string | null
  listingPrice: number
  quantity: number
  taxRatePercent: number
  unitCost: number
}

function createRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyRow(): MarketWorkbookRow {
  return {
    id: createRowId(),
    itemName: '',
    chocoboPrice: 0,
    mooglePrice: 0,
    quantity: 1,
    note: '',
  }
}

function getDefaultState(): MarketWorkbookState {
  return {
    rows: [
      {
        id: createRowId(),
        itemName: '魔匠水藥',
        chocoboPrice: 1200,
        mooglePrice: 1350,
        quantity: 3,
        note: '',
      },
    ],
    calculatorRowId: null,
    listingPrice: 1200,
    quantity: 1,
    taxRatePercent: 5,
    unitCost: 700,
  }
}

function loadSavedState(): MarketWorkbookState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(MARKET_WORKBOOK_KEY)

    if (!raw) {
      return getDefaultState()
    }

    const parsed = JSON.parse(raw) as Partial<MarketWorkbookState>
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows
          .filter((row): row is MarketWorkbookRow => Boolean(row && typeof row === 'object'))
          .map((row) =>
            sanitizeWorkbookRow({
              id: typeof row.id === 'string' ? row.id : createRowId(),
              itemName: typeof row.itemName === 'string' ? row.itemName : '',
              chocoboPrice: Number(row.chocoboPrice ?? 0),
              mooglePrice: Number(row.mooglePrice ?? 0),
              quantity: Number(row.quantity ?? 1),
              note: typeof row.note === 'string' ? row.note : '',
            }),
          )
      : getDefaultState().rows

    return {
      rows: rows.length > 0 ? rows : getDefaultState().rows,
      calculatorRowId: typeof parsed.calculatorRowId === 'string' ? parsed.calculatorRowId : null,
      listingPrice: Number(parsed.listingPrice ?? 1200),
      quantity: Number(parsed.quantity ?? 1),
      taxRatePercent: Number(parsed.taxRatePercent ?? 5),
      unitCost: Number(parsed.unitCost ?? 700),
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
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [itemName = '', chocobo = '0', moogle = '0', quantity = '1', note = ''] = line
        .split('\t')
        .map((part) => part.trim())

      return sanitizeWorkbookRow({
        id: createRowId(),
        itemName,
        chocoboPrice: Number(chocobo),
        mooglePrice: Number(moogle),
        quantity: Number(quantity),
        note,
      })
    })
    .filter((row) => row.itemName.length > 0)
}

function MarketPage() {
  const [savedState] = useState(() => loadSavedState())
  const [rows, setRows] = useState<MarketWorkbookRow[]>(savedState.rows)
  const [calculatorRowId, setCalculatorRowId] = useState<string | null>(savedState.calculatorRowId)
  const [listingPrice, setListingPrice] = useState(savedState.listingPrice)
  const [quantity, setQuantity] = useState(savedState.quantity)
  const [taxRatePercent, setTaxRatePercent] = useState(savedState.taxRatePercent)
  const [unitCost, setUnitCost] = useState(savedState.unitCost)
  const [draftRow, setDraftRow] = useState<MarketWorkbookRow>(() => createEmptyRow())
  const [bulkInput, setBulkInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(
      MARKET_WORKBOOK_KEY,
      JSON.stringify({
        rows,
        calculatorRowId,
        listingPrice,
        quantity,
        taxRatePercent,
        unitCost,
      }),
    )
  }, [calculatorRowId, listingPrice, quantity, rows, taxRatePercent, unitCost])

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
  }

  function addDraftRow(): void {
    if (!draftRow.itemName.trim()) {
      setMessage('請先填入道具名稱。')
      return
    }

    const nextRow = sanitizeWorkbookRow({
      ...draftRow,
      id: createRowId(),
    })

    setRows((currentRows) => [...currentRows, nextRow])
    setDraftRow(createEmptyRow())
    setMessage('已加入比價清單。')
  }

  function importBulkRows(): void {
    const parsedRows = parseBulkRows(bulkInput)

    if (parsedRows.length === 0) {
      setMessage('沒有可匯入的資料列。請使用 Tab 分隔：道具、陸行鳥、莫古力、數量、備註。')
      return
    }

    setRows((currentRows) => [...currentRows, ...parsedRows])
    setBulkInput('')
    setMessage(`已匯入 ${parsedRows.length} 筆資料。`)
  }

  function removeRow(rowId: string): void {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId))
    setCalculatorRowId((currentRowId) => (currentRowId === rowId ? null : currentRowId))
  }

  function clearRows(): void {
    setRows([])
    setCalculatorRowId(null)
    setMessage('已清空比價清單。')
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
    setMessage(`已將「${sanitized.itemName || '未命名道具'}」帶入市場板試算。`)
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">繁中服查價</p>
        <h2>雙服比價工作表</h2>
        <p className="lead">
          這一頁改成更接近繁中服查價站的使用方式，適合一次整理多個道具，快速比較陸行鳥與莫古力
          的價差、購買總額與建議購買方向。價格仍由你自行輸入，資料只留在瀏覽器。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">只做繁中服</span>
          <span className="badge">陸行鳥 / 莫古力</span>
          <span className="badge badge--warning">靈感來自 FFXIV Market (beherw)</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>新增比價項目</h2>
          <p>你可以單筆新增，也可以直接貼上多行資料。每行請用 Tab 分隔欄位。</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">道具名稱</span>
            <input
              className="input-text"
              onChange={(event) => setDraftRow((current) => ({ ...current, itemName: event.target.value }))}
              placeholder="例如：魔匠水藥"
              type="text"
              value={draftRow.itemName}
            />
          </label>
          <label className="field">
            <span className="field-label">陸行鳥單價</span>
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
            <span className="field-label">莫古力單價</span>
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
            <span className="field-label">預計購買數量</span>
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
              placeholder="可填規格、用途、HQ/NQ 等"
              type="text"
              value={draftRow.note}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="button button--primary" onClick={addDraftRow} type="button">
            加入比價清單
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
          <span className="field-label">批次貼上 (Tab 分隔：道具、陸行鳥、莫古力、數量、備註)</span>
          <textarea
            className="input-text"
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder={'魔匠水藥\t1200\t1350\t3\t補師用\n魔匠料理\t880\t920\t2\t'}
            rows={4}
            value={bulkInput}
          />
        </label>

        <div className="button-row">
          <button className="button button--ghost" onClick={importBulkRows} type="button">
            匯入多行資料
          </button>
          <button className="button button--ghost" onClick={clearRows} type="button">
            清空比價清單
          </button>
        </div>

        {message && (
          <div className="callout callout--success">
            <span className="callout-title">狀態</span>
            <span className="callout-body">{message}</span>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>整體購買摘要</h2>
          <p>用同一份清單快速看出整體買在陸行鳥、莫古力，或混合購買的成本差異。</p>
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
            <div className="stat-label">相較陸行鳥可省</div>
            <div className="stat-value">{formatGil(workbookSummary.savingsVsChocobo)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">相較莫古力可省</div>
            <div className="stat-value">{formatGil(workbookSummary.savingsVsMoogle)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">便宜分佈</div>
            <div className="stat-value">
              陸 {workbookSummary.cheaperOnChocobo} / 莫 {workbookSummary.cheaperOnMoogle} / 平{' '}
              {workbookSummary.equalPriceItems}
            </div>
          </article>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>比價清單</h2>
          <p>每筆都可即時編輯，並可一鍵帶入市場板試算。</p>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <strong>目前沒有比價項目</strong>
            <p>先新增一筆資料，或使用上方的批次貼上功能。</p>
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
                      <div className="stat-label">建議購買</div>
                      <div className="stat-value">{comparison.cheaperServer ?? '待輸入'}</div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-label">單價價差</div>
                      <div className="stat-value">{formatGil(comparison.priceSpread)}</div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-label">建議總價</div>
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
                      套用較低價到試算
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => applyRowToCalculator(row, 'chocobo')}
                      type="button"
                    >
                      套用陸行鳥價格
                    </button>
                    <button
                      className="button button--ghost"
                      onClick={() => applyRowToCalculator(row, 'moogle')}
                      type="button"
                    >
                      套用莫古力價格
                    </button>
                    <button className="button button--ghost" onClick={() => removeRow(row.id)} type="button">
                      移除此項
                    </button>
                  </div>

                  {row.note && <p className="treasure-card__meta">備註：{row.note}</p>}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>市場板試算</h2>
          <p>從清單中帶入價格後，可再估算稅額、利潤與損平點。</p>
        </div>

        {selectedCalculatorRow && (
          <div className="callout">
            <span className="callout-title">目前試算來源</span>
            <span className="callout-body">
              {selectedCalculatorRow.itemName} | 數量 {selectedCalculatorRow.quantity} | 最後帶入時間{' '}
              {formatShortDateTime(new Date().toISOString())}
            </span>
          </div>
        )}

        <div className="field-grid">
          <label className="field">
            <span className="field-label">上架單價</span>
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
            <div className="stat-label">預估利潤</div>
            <div className="stat-value">{formatNumber(marketSummary.profit)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">損平單價</div>
            <div className="stat-value">{formatNumber(marketSummary.breakEvenPerUnit)} gil</div>
          </article>
        </div>
      </section>

      <SourceAttribution entries={pageSources.market.entries} />
    </div>
  )
}

export default MarketPage
