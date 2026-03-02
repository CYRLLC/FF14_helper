import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import {
  buildXivapiSearchUrl,
  searchXivapi,
  type XivapiSearchResult,
} from '../api/xivapi'
import { buildUniversalisUrl, fetchUniversalisMarket } from '../api/universalis'
import { calculateMarketboardSummary } from '../tools/market'
import { formatGil, formatShortDateTime } from '../tools/marketFormat'
import type { MarketRegion, MarketScopeMode, MarketScopeSelection } from '../types'
import { getErrorMessage } from '../utils/errors'

const MARKET_SELECTION_KEY = 'ff14-helper.market.selection'

const regionDcOptions: Record<MarketRegion, string[]> = {
  JP: ['Elemental', 'Gaia', 'Mana', 'Meteor'],
  NA: ['Aether', 'Primal', 'Crystal', 'Dynamis'],
  EU: ['Chaos', 'Light'],
  OCE: ['Materia'],
}

const regionWorldSuggestions: Record<MarketRegion, string[]> = {
  JP: ['Tonberry', 'Kujata', 'Typhon', 'Ramuh'],
  NA: ['Gilgamesh', 'Cactuar', 'Faerie', 'Leviathan'],
  EU: ['Phoenix', 'Odin', 'Shiva', 'Twintania'],
  OCE: ['Ravana', 'Sophia', 'Bismarck', 'Sephirot'],
}

function getDefaultSelection(): MarketScopeSelection {
  return {
    region: 'JP',
    mode: 'dc',
    scopeKey: 'Elemental',
  }
}

function loadSavedSelection(): MarketScopeSelection {
  if (typeof window === 'undefined') {
    return getDefaultSelection()
  }

  try {
    const raw = window.localStorage.getItem(MARKET_SELECTION_KEY)

    if (!raw) {
      return getDefaultSelection()
    }

    const parsed = JSON.parse(raw) as Partial<MarketScopeSelection>

    if (
      (parsed.region === 'JP' || parsed.region === 'NA' || parsed.region === 'EU' || parsed.region === 'OCE') &&
      (parsed.mode === 'dc' || parsed.mode === 'world') &&
      typeof parsed.scopeKey === 'string' &&
      parsed.scopeKey.trim()
    ) {
      return {
        region: parsed.region,
        mode: parsed.mode,
        scopeKey: parsed.scopeKey.trim(),
      }
    }
  } catch {
    return getDefaultSelection()
  }

  return getDefaultSelection()
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

function MarketPage() {
  const [selection, setSelection] = useState<MarketScopeSelection>(() => loadSavedSelection())
  const [sheetTerm, setSheetTerm] = useState('')
  const [searchResults, setSearchResults] = useState<XivapiSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<XivapiSearchResult | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [marketSnapshot, setMarketSnapshot] = useState<Awaited<
    ReturnType<typeof fetchUniversalisMarket>
  > | null>(null)
  const [listingPrice, setListingPrice] = useState(1200)
  const [quantity, setQuantity] = useState(1)
  const [taxRatePercent, setTaxRatePercent] = useState(5)
  const [unitCost, setUnitCost] = useState(700)

  useEffect(() => {
    window.localStorage.setItem(MARKET_SELECTION_KEY, JSON.stringify(selection))
  }, [selection])

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

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSearchLoading(true)
    setSearchError(null)
    setSelectedItem(null)
    setMarketSnapshot(null)
    setMarketError(null)

    try {
      const results = await searchXivapi(sheetTerm, 'Item', 8)
      setSearchResults(results)
    } catch (error: unknown) {
      setSearchResults([])
      setSearchError(getErrorMessage(error))
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleMarketLookup(result: XivapiSearchResult): Promise<void> {
    setSelectedItem(result)
    setMarketLoading(true)
    setMarketError(null)

    try {
      const snapshot = await fetchUniversalisMarket(selection, result.rowId)
      setMarketSnapshot(snapshot)

      if (typeof snapshot.lowestPrice === 'number') {
        setListingPrice(Math.max(1, Math.round(snapshot.lowestPrice)))
      }
    } catch (error: unknown) {
      setMarketSnapshot(null)
      setMarketError(getErrorMessage(error))
    } finally {
      setMarketLoading(false)
    }
  }

  const dcOptions = regionDcOptions[selection.region]
  const worldSuggestions = regionWorldSuggestions[selection.region]

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Market</p>
        <h2>市場查價</h2>
        <p className="lead">
          先用 XIVAPI 搜尋道具，再用 Universalis 抓取市場資料。所有查詢都直接由你的瀏覽器送出，本站不保存查價資料。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">資料中心優先</span>
          <span className="badge">預設 JP / Elemental</span>
          <span className="badge badge--warning">數據會隨市場變動</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>查詢條件</h2>
          <p>先選範圍，再搜尋道具名稱。若切到世界模式，可直接輸入世界名稱。</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">區域</span>
            <select
              className="input-select"
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  region: event.target.value as MarketRegion,
                  scopeKey:
                    current.mode === 'dc'
                      ? regionDcOptions[event.target.value as MarketRegion][0]
                      : regionWorldSuggestions[event.target.value as MarketRegion][0],
                }))
              }
              value={selection.region}
            >
              <option value="JP">JP</option>
              <option value="NA">NA</option>
              <option value="EU">EU</option>
              <option value="OCE">OCE</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">範圍模式</span>
            <select
              className="input-select"
              onChange={(event) => {
                const nextMode = event.target.value as MarketScopeMode
                setSelection((current) => ({
                  ...current,
                  mode: nextMode,
                  scopeKey:
                    nextMode === 'dc'
                      ? regionDcOptions[current.region][0]
                      : regionWorldSuggestions[current.region][0],
                }))
              }}
              value={selection.mode}
            >
              <option value="dc">資料中心</option>
              <option value="world">單一世界</option>
            </select>
          </label>

          {selection.mode === 'dc' ? (
            <label className="field">
              <span className="field-label">資料中心</span>
              <select
                className="input-select"
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    scopeKey: event.target.value,
                  }))
                }
                value={selection.scopeKey}
              >
                {dcOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span className="field-label">世界</span>
              <input
                className="input-text"
                list={`world-suggestions-${selection.region}`}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    scopeKey: event.target.value,
                  }))
                }
                placeholder="輸入世界名稱"
                type="text"
                value={selection.scopeKey}
              />
              <datalist id={`world-suggestions-${selection.region}`}>
                {worldSuggestions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
          )}
        </div>

        <form className="page-grid" onSubmit={(event) => void handleSearch(event)}>
          <label className="field">
            <span className="field-label">道具名稱</span>
            <input
              className="input-text"
              onChange={(event) => setSheetTerm(event.target.value)}
              placeholder="例如 Tincture, Materia, Food"
              type="text"
              value={sheetTerm}
            />
          </label>

          <div className="button-row">
            <button className="button button--primary" disabled={searchLoading} type="submit">
              {searchLoading ? '搜尋中...' : '搜尋道具'}
            </button>
            <a
              className="button button--ghost"
              href={buildXivapiSearchUrl(sheetTerm || 'Potion', 'Item', 8)}
              rel="noreferrer"
              target="_blank"
            >
              查看 XIVAPI 查詢
            </a>
          </div>
        </form>

        {searchError && (
          <div className="callout callout--error">
            <span className="callout-title">搜尋失敗</span>
            <span className="callout-body">{searchError}</span>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="history-list">
            {searchResults.map((result) => (
              <article key={result.rowId} className="history-item">
                <div className="history-item__top">
                  <div>
                    <strong>{result.name}</strong>
                    <p className="muted">Item ID: {result.rowId}</p>
                  </div>
                  <button
                    className="button button--ghost"
                    onClick={() => void handleMarketLookup(result)}
                    type="button"
                  >
                    查詢 {selection.scopeKey}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!searchLoading && !searchError && sheetTerm.trim().length >= 2 && searchResults.length === 0 && (
          <div className="empty-state">
            <strong>查無道具</strong>
            <p>可改用更短的關鍵字，或直接開啟 XIVAPI 查詢連結確認名稱。</p>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>市場資料</h2>
          <p>若第三方 API 暫時不可用，頁面會保留查詢條件，不會整頁中斷。</p>
        </div>

        {selectedItem && (
          <div className="callout">
            <span className="callout-title">目前查詢</span>
            <span className="callout-body">
              {selectedItem.name} ({selectedItem.rowId}) | {selection.scopeKey}
            </span>
          </div>
        )}

        {marketLoading && (
          <div className="callout">
            <span className="callout-title">載入中</span>
            <span className="callout-body">正在向 Universalis 取得最新公開資料...</span>
          </div>
        )}

        {marketError && (
          <div className="callout callout--error">
            <span className="callout-title">查價失敗</span>
            <span className="callout-body">{marketError}</span>
          </div>
        )}

        {marketSnapshot && !marketLoading && (
          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">最低上架</div>
                <div className="stat-value">{formatGil(marketSnapshot.lowestPrice)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">最高上架</div>
                <div className="stat-value">{formatGil(marketSnapshot.highestPrice)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">平均價格</div>
                <div className="stat-value">{formatGil(marketSnapshot.averagePrice)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">近期成交數</div>
                <div className="stat-value">{marketSnapshot.recentHistoryCount}</div>
              </article>
            </div>

            <div className="callout">
              <span className="callout-title">最後更新</span>
              <span className="callout-body">{formatShortDateTime(marketSnapshot.fetchedAt)}</span>
              <span className="muted">
                API URL: {buildUniversalisUrl(selection, marketSnapshot.itemId)}
              </span>
            </div>

            <div className="source-grid">
              <div className="list-panel">
                <p className="callout-title">前 5 筆上架</p>
                {marketSnapshot.listings.length === 0 ? (
                  <p className="muted">目前沒有可用的上架資料。</p>
                ) : (
                  <div className="source-list">
                    {marketSnapshot.listings.slice(0, 5).map((entry, index) => (
                      <article key={`${entry.worldName}-${index}`} className="source-item">
                        <strong>
                          {formatGil(entry.pricePerUnit)} x {entry.quantity}
                        </strong>
                        <p className="muted">
                          {entry.worldName} | {entry.hq ? 'HQ' : 'NQ'} | 總價 {formatGil(entry.total)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="list-panel">
                <p className="callout-title">前 5 筆成交</p>
                {marketSnapshot.recentHistory.length === 0 ? (
                  <p className="muted">目前沒有可用的近期成交資料。</p>
                ) : (
                  <div className="source-list">
                    {marketSnapshot.recentHistory.slice(0, 5).map((entry, index) => (
                      <article
                        key={`${entry.worldName}-${entry.timestamp}-${index}`}
                        className="source-item"
                      >
                        <strong>
                          {formatGil(entry.pricePerUnit)} x {entry.quantity}
                        </strong>
                        <p className="muted">
                          {entry.worldName} | {entry.hq ? 'HQ' : 'NQ'} |{' '}
                          {formatShortDateTime(entry.timestamp)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>上架試算</h2>
          <p>可直接用查到的價格做試算，也能手動調整稅率、數量與成本。</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">單價</span>
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
            <div className="stat-label">總收入</div>
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
            <div className="stat-label">利潤</div>
            <div className="stat-value">{formatNumber(marketSummary.profit)} gil</div>
          </article>
        </div>
      </section>

      <SourceAttribution entries={pageSources.market.entries} />
    </div>
  )
}

export default MarketPage
