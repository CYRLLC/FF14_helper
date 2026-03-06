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
          <h2>資料實驗室</h2>
          <p>這裡保留站內尚未正式產品化的資料搜尋與驗證工具。</p>
        </div>

        <form className="page-grid" onSubmit={(event) => void handleSearch(event)}>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">資料表</span>
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
              <span className="field-label">搜尋關鍵字</span>
              <input
                className="input-text"
                onChange={(event) => setTerm(event.target.value)}
                placeholder="例如 Rainbow Drip"
                type="text"
                value={term}
              />
            </label>
          </div>

          <div className="button-row">
            <button className="button button--primary" disabled={loading} type="submit">
              {loading ? '搜尋中' : '搜尋 XIVAPI'}
            </button>
            <a
              className="button button--ghost"
              href="https://v2.xivapi.com/docs/guides/search/"
              rel="noreferrer"
              target="_blank"
            >
              查看 Search 文件
            </a>
          </div>
        </form>

        {searchError && (
          <div className="callout callout--error">
            <span className="callout-title">搜尋失敗</span>
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
                  開啟相似 API 查詢
                </a>
              </article>
            ))}
          </div>
        )}

        {!loading && !searchError && term.trim().length >= 2 && results.length === 0 && (
          <div className="empty-state">
            <strong>沒有結果</strong>
            <p>請嘗試更寬鬆的關鍵字或切換資料表。</p>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>正式功能入口</h2>
          <p>如果你要的是站內主要工具，請直接走正式頁面。</p>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/market">
            查價頁
          </Link>
          <Link className="button button--ghost" to="/gold-saucer">
            金碟頁
          </Link>
          <Link className="button button--ghost" to="/treasure">
            藏寶圖頁
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LabPage
