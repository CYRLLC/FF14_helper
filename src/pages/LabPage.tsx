import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  buildXivapiSearchUrl,
  searchXivapi,
  type XivapiSearchResult,
  type XivapiSheet,
} from '../api/xivapi'
import { getErrorMessage } from '../utils/errors'

const searchableSheets: XivapiSheet[] = ['Item', 'Recipe', 'Quest', 'Action']

function LabPage() {
  const [sheet, setSheet] = useState<XivapiSheet>('Item')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<XivapiSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

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
          <p>這裡保留原型性質的資料搜尋區。正式查價、金碟與藏寶圖功能已移到各自的正式頁面。</p>
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
          <h2>正式工具入口</h2>
          <p>這裡保留給之後測試中的小功能；常用功能請直接使用正式頁面。</p>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/market">
            打開市場查價
          </Link>
          <Link className="button button--ghost" to="/gold-saucer">
            打開金碟頁
          </Link>
          <Link className="button button--ghost" to="/treasure">
            打開藏寶圖頁
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LabPage
