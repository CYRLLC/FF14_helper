import { pageSources } from '../catalog/sources'
import { toolDirectory } from '../catalog/tools'
import SourceAttribution from '../components/SourceAttribution'

function ToolsPage() {
  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>外部工具與參考站</h2>
          <p>這些是本站會參考的社群工具與資料站。本站只會重整適合純前端靜態網站的部分，不直接複製外站內容。</p>
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
                {tool.futureIntegration ? '已納入或適合納入站內功能' : '較適合作外部連結'}
              </span>
            </div>
            <a className="tool-link" href={tool.url} rel="noreferrer" target="_blank">
              打開站點
            </a>
          </article>
        ))}
      </section>

      <SourceAttribution entries={pageSources.tools.entries} />
    </div>
  )
}

export default ToolsPage
