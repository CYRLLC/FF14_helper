import { useEffect, useMemo, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { calculateMarketboardSummary, compareTwServerPrices } from '../tools/market'
import { formatGil, formatShortDateTime } from '../tools/marketFormat'

const MARKET_FORM_KEY = 'ff14-helper.market.tw-form'

interface SavedMarketState {
  itemLabel: string
  chocoboPrice: number
  chocoboQuantity: number
  mooglePrice: number
  moogleQuantity: number
  listingPrice: number
  quantity: number
  taxRatePercent: number
  unitCost: number
}

function getDefaultState(): SavedMarketState {
  return {
    itemLabel: '',
    chocoboPrice: 1200,
    chocoboQuantity: 10,
    mooglePrice: 1350,
    moogleQuantity: 12,
    listingPrice: 1200,
    quantity: 1,
    taxRatePercent: 5,
    unitCost: 700,
  }
}

function loadSavedState(): SavedMarketState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(MARKET_FORM_KEY)

    if (!raw) {
      return getDefaultState()
    }

    const parsed = JSON.parse(raw) as Partial<SavedMarketState>

    return {
      itemLabel: typeof parsed.itemLabel === 'string' ? parsed.itemLabel : '',
      chocoboPrice: Number(parsed.chocoboPrice ?? 1200),
      chocoboQuantity: Number(parsed.chocoboQuantity ?? 10),
      mooglePrice: Number(parsed.mooglePrice ?? 1350),
      moogleQuantity: Number(parsed.moogleQuantity ?? 12),
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

function MarketPage() {
  const [savedState] = useState(() => loadSavedState())
  const [itemLabel, setItemLabel] = useState(savedState.itemLabel)
  const [chocoboPrice, setChocoboPrice] = useState(savedState.chocoboPrice)
  const [chocoboQuantity, setChocoboQuantity] = useState(savedState.chocoboQuantity)
  const [mooglePrice, setMooglePrice] = useState(savedState.mooglePrice)
  const [moogleQuantity, setMoogleQuantity] = useState(savedState.moogleQuantity)
  const [listingPrice, setListingPrice] = useState(savedState.listingPrice)
  const [quantity, setQuantity] = useState(savedState.quantity)
  const [taxRatePercent, setTaxRatePercent] = useState(savedState.taxRatePercent)
  const [unitCost, setUnitCost] = useState(savedState.unitCost)
  const [lastAppliedServer, setLastAppliedServer] = useState<'陸行鳥' | '莫古力'>('陸行鳥')

  useEffect(() => {
    window.localStorage.setItem(
      MARKET_FORM_KEY,
      JSON.stringify({
        itemLabel,
        chocoboPrice,
        chocoboQuantity,
        mooglePrice,
        moogleQuantity,
        listingPrice,
        quantity,
        taxRatePercent,
        unitCost,
      }),
    )
  }, [
    chocoboPrice,
    chocoboQuantity,
    itemLabel,
    listingPrice,
    mooglePrice,
    moogleQuantity,
    quantity,
    taxRatePercent,
    unitCost,
  ])

  const comparison = useMemo(
    () =>
      compareTwServerPrices([
        {
          serverName: '陸行鳥',
          pricePerUnit: chocoboPrice,
          quantity: chocoboQuantity,
        },
        {
          serverName: '莫古力',
          pricePerUnit: mooglePrice,
          quantity: moogleQuantity,
        },
      ]),
    [chocoboPrice, chocoboQuantity, mooglePrice, moogleQuantity],
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

  function applyListingPrice(serverName: '陸行鳥' | '莫古力'): void {
    if (serverName === '陸行鳥') {
      setListingPrice(chocoboPrice)
    } else {
      setListingPrice(mooglePrice)
    }

    setLastAppliedServer(serverName)
  }

  function applyCheaperPrice(): void {
    const cheaperServer = comparison.cheaperServer === '莫古力' ? '莫古力' : '陸行鳥'
    applyListingPrice(cheaperServer)
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Market</p>
        <h2>繁中服查價工作台</h2>
        <p className="lead">
          這一頁只針對繁中伺服器。你可以手動整理陸行鳥與莫古力的價格與庫存，快速比較價差，
          再把較適合的價格套進市場板試算。本站不保存你的查價內容到伺服器。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">限定繁中服</span>
          <span className="badge">陸行鳥 / 莫古力</span>
          <span className="badge badge--warning">價格資料由你手動輸入</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>手動比價</h2>
          <p>
            可先在外部工具確認價格，再把你要比較的資訊填進來。本站只負責整理、比較與試算，
            不宣稱提供即時繁中服 API。
          </p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">道具名稱或備註</span>
            <input
              className="input-text"
              onChange={(event) => setItemLabel(event.target.value)}
              placeholder="例如：魔匠水藥、料理、素材"
              type="text"
              value={itemLabel}
            />
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">陸行鳥單價</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setChocoboPrice(Number(event.target.value))}
              step="1"
              type="number"
              value={chocoboPrice}
            />
          </label>
          <label className="field">
            <span className="field-label">陸行鳥庫存</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setChocoboQuantity(Number(event.target.value))}
              step="1"
              type="number"
              value={chocoboQuantity}
            />
          </label>
          <label className="field">
            <span className="field-label">莫古力單價</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setMooglePrice(Number(event.target.value))}
              step="1"
              type="number"
              value={mooglePrice}
            />
          </label>
          <label className="field">
            <span className="field-label">莫古力庫存</span>
            <input
              className="input-text"
              min="0"
              onChange={(event) => setMoogleQuantity(Number(event.target.value))}
              step="1"
              type="number"
              value={moogleQuantity}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="button button--primary" onClick={() => applyListingPrice('陸行鳥')} type="button">
            套用陸行鳥價格
          </button>
          <button className="button button--ghost" onClick={() => applyListingPrice('莫古力')} type="button">
            套用莫古力價格
          </button>
          <button className="button button--ghost" onClick={applyCheaperPrice} type="button">
            套用較低價格
          </button>
          <a
            className="button button--ghost"
            href="https://beherw.github.io/FFXIV_Market/"
            rel="noreferrer"
            target="_blank"
          >
            開啟外部查價站
          </a>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">較便宜的伺服器</div>
            <div className="stat-value">{comparison.cheaperServer ?? '尚未輸入'}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">較高價伺服器</div>
            <div className="stat-value">{comparison.moreExpensiveServer ?? '尚未輸入'}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">價差</div>
            <div className="stat-value">{formatGil(comparison.priceSpread)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">平均單價</div>
            <div className="stat-value">{formatGil(comparison.averagePrice)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">較低價庫存</div>
            <div className="stat-value">{comparison.cheaperTotalStock}</div>
          </article>
        </div>

        <div className="source-grid">
          <div className="list-panel">
            <p className="callout-title">目前比價摘要</p>
            <div className="detail-list">
              <div>
                <strong>道具</strong> {itemLabel.trim() || '未填寫'}
              </div>
              <div>
                <strong>陸行鳥</strong> {formatGil(chocoboPrice)} / 庫存 {chocoboQuantity}
              </div>
              <div>
                <strong>莫古力</strong> {formatGil(mooglePrice)} / 庫存 {moogleQuantity}
              </div>
              <div>
                <strong>最後套用到試算</strong> {lastAppliedServer}
              </div>
            </div>
          </div>

          <div className="list-panel">
            <p className="callout-title">使用說明</p>
            <p className="muted">
              這一頁只整理你手動記錄的繁中服價格。若第三方查價站暫時不可用，你仍然可以直接輸入
              價格後進行比較與試算。
            </p>
            <p className="muted">最後整理時間：{formatShortDateTime(new Date().toISOString())}</p>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>市場板試算</h2>
          <p>把你要上架的價格帶進來，快速估算總價、稅額、淨收入與利潤。</p>
        </div>

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
