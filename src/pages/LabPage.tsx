import { useState, type FormEvent } from 'react'
import {
  buildXivapiSearchUrl,
  searchXivapi,
  type XivapiSearchResult,
  type XivapiSheet,
} from '../api/xivapi'
import { calculateMarketboardSummary } from '../tools/market'
import { getErrorMessage } from '../utils/errors'
import { formatBytes } from '../utils/format'

const searchableSheets: XivapiSheet[] = ['Item', 'Recipe', 'Quest', 'Action']

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

function LabPage() {
  const [sheet, setSheet] = useState<XivapiSheet>('Item')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<XivapiSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [listingPrice, setListingPrice] = useState(1200)
  const [quantity, setQuantity] = useState(3)
  const [taxRatePercent, setTaxRatePercent] = useState(5)
  const [unitCost, setUnitCost] = useState(700)

  const marketSummary = calculateMarketboardSummary({
    listingPrice,
    quantity,
    taxRatePercent,
    unitCost,
  })

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setLoading(true)
    setSearchError(null)

    try {
      const nextResults = await searchXivapi(term, sheet)
      setResults(nextResults)
    } catch (error: unknown) {
      setResults([])
      setSearchError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>Data Explorer</h2>
          <p>
            Inspired by database tools like XIVAPI and Garland Tools: search common sheets directly
            from this site without leaving the page.
          </p>
        </div>

        <form className="page-grid" onSubmit={(event) => void handleSearch(event)}>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">Sheet</span>
              <select
                className="input-select"
                onChange={(event) => setSheet(event.target.value as XivapiSheet)}
                value={sheet}
              >
                {searchableSheets.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Search term</span>
              <input
                className="input-text"
                onChange={(event) => setTerm(event.target.value)}
                placeholder="e.g. Rainbow Drip"
                type="text"
                value={term}
              />
            </label>
          </div>

          <div className="button-row">
            <button className="button button--primary" disabled={loading} type="submit">
              {loading ? 'Searching...' : 'Search XIVAPI'}
            </button>
            <a
              className="button button--ghost"
              href="https://v2.xivapi.com/docs/guides/search/"
              rel="noreferrer"
              target="_blank"
            >
              Search Docs
            </a>
          </div>
        </form>

        {searchError && (
          <div className="callout callout--error">
            <span className="callout-title">Search Error</span>
            <span className="callout-body">{searchError}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="history-list">
            {results.map((result) => (
              <article key={`${result.sheet}-${result.rowId}`} className="history-item">
                <div className="history-item__top">
                  <strong>{result.name}</strong>
                  <span className="badge">{result.sheet}</span>
                </div>
                <p className="muted">
                  Row ID: {result.rowId} | Score: {result.score}
                </p>
                <a
                  className="tool-link"
                  href={buildXivapiSearchUrl(result.name, result.sheet as XivapiSheet, 1)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open similar API query
                </a>
              </article>
            ))}
          </div>
        )}

        {!loading && !searchError && term.trim().length >= 2 && results.length === 0 && (
          <div className="empty-state">
            <strong>No results</strong>
            <p>Try another sheet or a broader search term.</p>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>Marketboard Quick Math</h2>
          <p>
            Inspired by market tools like Universalis: compare listing price, tax, and your own
            cost before posting items.
          </p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Listing price (per item)</span>
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
            <span className="field-label">Quantity</span>
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
            <span className="field-label">Tax rate (%)</span>
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
            <span className="field-label">Your unit cost</span>
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
            <div className="stat-label">Gross Total</div>
            <div className="stat-value">{formatNumber(marketSummary.grossTotal)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Tax</div>
            <div className="stat-value">{formatNumber(marketSummary.taxAmount)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Net Total</div>
            <div className="stat-value">{formatNumber(marketSummary.netTotal)} gil</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Profit</div>
            <div className="stat-value">{formatNumber(marketSummary.profit)} gil</div>
          </article>
        </div>

        <div className="list-panel">
          <p className="callout-title">Break-even guide</p>
          <p className="muted">
            You need about {formatNumber(marketSummary.breakEvenPerUnit)} gil per item to break
            even after tax.
          </p>
          <p className="muted">
            If you were exporting this as raw bytes, the current form state is roughly{' '}
            {formatBytes(
              new Blob([
                JSON.stringify({
                  listingPrice,
                  quantity,
                  taxRatePercent,
                  unitCost,
                }),
              ]).size,
            )}
            .
          </p>
        </div>
      </section>
    </div>
  )
}

export default LabPage
