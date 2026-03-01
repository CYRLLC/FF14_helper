import { toolDirectory } from '../catalog/tools'

function ToolsPage() {
  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>工具導覽</h2>
          <p>第一版先整理高價值外部工具，後續再挑選可內建的功能逐步整合。</p>
        </div>
      </section>

      <section className="tool-grid">
        {toolDirectory.map((tool) => (
          <article key={tool.id} className="tool-card">
            <div>
              <p className="tool-meta">{tool.category}</p>
              <h3>{tool.name}</h3>
            </div>
            <p>{tool.description}</p>
            <div className="badge-row">
              <span className={tool.futureIntegration ? 'badge badge--positive' : 'badge'}>
                {tool.futureIntegration ? '適合後續內建參考' : '以外部工具導流為主'}
              </span>
            </div>
            <a className="tool-link" href={tool.url} rel="noreferrer" target="_blank">
              前往工具站
            </a>
          </article>
        ))}
      </section>
    </div>
  )
}

export default ToolsPage
