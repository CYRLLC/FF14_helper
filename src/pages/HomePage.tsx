import { Link } from 'react-router-dom'
import { secondaryNavItems, workInProgressLabel } from '../content/siteCopy'

interface HomePageProps {
  appName: string
}

function HomePage({ appName }: HomePageProps) {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">FF14 Helper</p>
        <h2>{appName}</h2>
        <p className="lead">
          這是以 GitHub Pages 部署的 FF14 前端工具站。本站目前聚焦在設定備份、繁中服查價、金碟時程、藏寶圖規劃，
          並把值得參考的外部工具整理進同一個工具箱。
        </p>
        <div className="badge-row">
          <span className="badge badge--warning">開發中</span>
          <span className="badge">GitHub Pages</span>
          <span className="badge badge--positive">本站不保存你的個人檔案</span>
        </div>
        <div className="callout">
          <span className="callout-title">目前狀態</span>
          <span className="callout-body">{workInProgressLabel}</span>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/backup">
            前往備份助手
          </Link>
          <Link className="button button--ghost" to="/market">
            前往查價頁
          </Link>
          <Link className="button button--ghost" to="/treasure">
            前往藏寶圖
          </Link>
          <Link className="button button--ghost" to="/craft">
            前往製作助手
          </Link>
          <Link className="button button--ghost" to="/collection">
            前往收藏追蹤
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>備份助手</h2>
            <p>在瀏覽器內整理 FF14 個人設定，打包成 ZIP，並可選擇下載或上傳雲端。</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>繁中服查價助手</h2>
            <p>以繁中服工作流為主，支援 OCR 匯入、批次整理、最近變更與市場板試算。</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>藏寶圖助手</h2>
            <p>提供單人與 8 人模式，包含點位瀏覽、隊伍路線規劃、即時房間與座標複製。</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>金碟 GATE</h2>
            <p>依台灣時間顯示 GATE 時段、倒數與非官方參考候選，方便快速查看下一輪活動。</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>製作助手</h2>
            <p>站內化的 BestCraft 風格工作台，支援製作者屬性、配方參數、技能序列與巨集草稿。</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>收藏追蹤</h2>
            <p>把老主顧與友好部落整理成可篩選、可追蹤、可備份的站內清單，靈感來自 collection-tc 的前端工作流。</p>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>工具箱焦點</h2>
          <p>本站會把值得研究的 FF14 開源工具整理進工具箱，並標明來源、用途與是否適合後續重製。</p>
        </div>
        <div className="source-grid">
          <article className="list-panel">
            <p className="callout-title">BestCraft</p>
            <p className="callout-body">已站內化</p>
            <p className="muted">
              來源為 <strong>Tnze/ffxiv-best-craft</strong>。現在已整理成本站自己的製作助手頁，並保留來源與授權說明。
            </p>
            <div className="badge-row">
              <span className="badge badge--warning">AGPL-3.0</span>
              <span className="badge badge--positive">已標示來源</span>
            </div>
            <div className="button-row">
              <Link className="button button--primary" to="/craft">
                前往製作助手
              </Link>
              <Link className="button button--ghost" to="/tools">
                在工具箱查看
              </Link>
            </div>
          </article>

          <article className="list-panel">
            <p className="callout-title">整合原則</p>
            <p className="callout-body">先整理來源，再評估重製</p>
            <p className="muted">
              對大型外部工具，本站優先採「來源標示 + 入口整理 + 單一功能重製」的方式，不直接整包複製或混入本站程式。
            </p>
          </article>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>其他入口</h2>
          <p>還原檢查、同步中心與實驗性功能維持次要入口，不與主功能混在同一層導航。</p>
        </div>
        <div className="button-row">
          {secondaryNavItems.map((item) => (
            <Link key={item.to} className="button button--ghost" to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>資料政策</h2>
          <p>
            本站不會把你的 FF14 設定檔保存到本站伺服器。查價、藏寶圖與即時房間若需要第三方服務，頁面內都會另外標示來源與資料流向。
          </p>
        </div>
      </section>
    </div>
  )
}

export default HomePage
