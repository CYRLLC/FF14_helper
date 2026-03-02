import { pageSources } from '../catalog/sources'
import { toolDirectory } from '../catalog/tools'
import SourceAttribution from '../components/SourceAttribution'

function ToolsPage() {
  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>外部工具導覽</h2>
          <p>
            這裡整理本站功能參考過的社群工具與資料站。部分能力已經在本站做成自己的版本，
            其餘則保留作後續擴充方向。
          </p>
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
                {tool.futureIntegration ? '適合後續站內化' : '目前以外部連結為主'}
              </span>
            </div>
            <a className="tool-link" href={tool.url} rel="noreferrer" target="_blank">
              前往查看
            </a>
          </article>
        ))}
      </section>

      <SourceAttribution entries={pageSources.tools.entries} />
    </div>
  )
}

export default ToolsPage
