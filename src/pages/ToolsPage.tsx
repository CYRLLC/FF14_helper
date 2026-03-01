import { toolDirectory } from '../catalog/tools'

function ToolsPage() {
  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>External Tools</h2>
          <p>
            These are the reference sites this project can learn from. The in-site tools focus on
            the parts that still work well as a static, browser-only application.
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
                {tool.futureIntegration
                  ? 'Good candidate for in-site features'
                  : 'Best kept as an external link'}
              </span>
            </div>
            <a className="tool-link" href={tool.url} rel="noreferrer" target="_blank">
              Open Site
            </a>
          </article>
        ))}
      </section>
    </div>
  )
}

export default ToolsPage
