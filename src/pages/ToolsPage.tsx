import { pageSources } from '../catalog/sources'
import { toolDirectory } from '../catalog/tools'
import SourceAttribution from '../components/SourceAttribution'

function isInternalHashUrl(url: string): boolean {
  return url.startsWith('#/')
}

function ToolsPage() {
  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>外部工具箱</h2>
          <p>
            這裡整理目前專案已參考、已站內化，或後續可能持續研究的 FF14 工具。對每一個外部工具，本站都會明確標示來源、
            授權背景與本站目前採取的整合方式。
          </p>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>BestCraft 狀態</h2>
            <p>
              來源為 <code>FF14_bestCraft_ZH_TW</code> 與
              <a className="tool-link" href="https://github.com/Tnze/ffxiv-best-craft" rel="noreferrer" target="_blank"> Tnze/ffxiv-best-craft</a>。
              現在已整理成本站自己的 `製作助手`，並保留 AGPL-3.0 授權與來源標示。
            </p>
          </div>
          <div className="badge-row">
            <span className="badge badge--positive">已站內化</span>
            <span className="badge">來源已標示</span>
            <span className="badge badge--warning">授權：AGPL-3.0</span>
          </div>
          <div className="button-row">
            <a className="button button--primary" href="#/craft">開啟製作助手</a>
            <a className="button button--ghost" href="https://github.com/Tnze/ffxiv-best-craft" rel="noreferrer" target="_blank">原始專案</a>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>collection-tc 狀態</h2>
            <p>
              來源為
              <a className="tool-link" href="https://cycleapple.github.io/ffxiv-collection-tc/" rel="noreferrer" target="_blank"> ffxiv-collection-tc</a>。
              本站已把它的收藏追蹤、願望清單與備份碼概念整理成 `收藏追蹤` 頁，先聚焦老主顧與友好部落。
            </p>
          </div>
          <div className="badge-row">
            <span className="badge badge--positive">已站內化</span>
            <span className="badge">本機備份碼</span>
            <span className="badge">來源已標示</span>
          </div>
          <div className="button-row">
            <a className="button button--primary" href="#/collection">開啟收藏追蹤</a>
            <a className="button button--ghost" href="https://cycleapple.github.io/ffxiv-collection-tc/" rel="noreferrer" target="_blank">參考站</a>
          </div>
        </article>
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
                {tool.futureIntegration ? '可作為後續功能參考' : tool.id === 'bestcraft' || tool.id === 'collection-tc' ? '已提供站內版本' : '目前以外部工具為主'}
              </span>
            </div>
            <a
              className="tool-link"
              href={tool.url}
              rel={isInternalHashUrl(tool.url) ? undefined : 'noreferrer'}
              target={isInternalHashUrl(tool.url) ? undefined : '_blank'}
            >
              {isInternalHashUrl(tool.url) ? '開啟站內工具' : '開啟工具或原始專案'}
            </a>
          </article>
        ))}
      </section>

      <SourceAttribution entries={pageSources.tools.entries} />
    </div>
  )
}

export default ToolsPage
