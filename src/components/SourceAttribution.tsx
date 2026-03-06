import type { SourceLink } from '../types'

interface SourceAttributionProps {
  entries: SourceLink[]
  title?: string
}

function SourceAttribution({ entries, title = '參考來源' }: SourceAttributionProps) {
  const inspirationEntries = entries.filter((entry) => entry.category === 'inspiration')
  const dataEntries = entries.filter((entry) => entry.category === 'data')

  return (
    <section className="page-card">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>
          本站會清楚標示功能參考與資料來源。所有頁面都是重新整理與重新實作，不直接複製原站文案、版型或受保護資產。
        </p>
      </div>

      <div className="source-grid">
        <div className="list-panel">
          <p className="callout-title">功能參考</p>
          {inspirationEntries.length === 0 ? (
            <p className="muted">這一頁目前沒有額外的功能參考來源。</p>
          ) : (
            <div className="source-list">
              {inspirationEntries.map((entry) => (
                <article key={entry.id} className="source-item">
                  <a className="tool-link" href={entry.url} rel="noreferrer" target="_blank">
                    {entry.name}
                  </a>
                  <p className="muted">{entry.note}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="list-panel">
          <p className="callout-title">資料來源</p>
          {dataEntries.length === 0 ? (
            <p className="muted">這一頁目前沒有額外的資料來源。</p>
          ) : (
            <div className="source-list">
              {dataEntries.map((entry) => (
                <article key={entry.id} className="source-item">
                  <a className="tool-link" href={entry.url} rel="noreferrer" target="_blank">
                    {entry.name}
                  </a>
                  <p className="muted">{entry.note}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default SourceAttribution
