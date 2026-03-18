import { Link } from 'react-router-dom'
import { secondaryNavItems } from '../content/siteCopy'

interface HomePageProps {
  appName: string
}

const features: Array<{
  title: string
  description: string
  to: string
  cta: string
  status: 'stable' | 'wip'
}> = [
  {
    title: '備份助手',
    description: '在瀏覽器內整理 FF14 個人設定，打包成 ZIP，並可選擇下載或上傳 OneDrive / Google Drive。',
    to: '/backup',
    cta: '開始備份',
    status: 'stable',
  },
  {
    title: '繁中服查價助手',
    description: '以繁中服工作流為主，支援截圖 OCR 匯入、批次整理、陸行鳥 / 莫古力比價與市場板試算。',
    to: '/market',
    cta: '前往查價',
    status: 'wip',
  },
  {
    title: '藏寶圖助手',
    description: '提供單人與 8 人模式，包含各地圖點位瀏覽、隊伍路線規劃、Firebase 即時房間與座標複製。',
    to: '/treasure',
    cta: '前往藏寶圖',
    status: 'wip',
  },
  {
    title: '金碟 GATE',
    description: '依台灣時間顯示 GATE 時段、倒數計時與非官方候選參考，方便快速確認下一輪活動窗口。',
    to: '/gold-saucer',
    cta: '查看時程',
    status: 'stable',
  },
  {
    title: '製作助手',
    description: '站內化的 BestCraft 工作台，支援全技能模擬（含 Specialist 技能）、Solver 與 Macro 輸出。',
    to: '/craft',
    cta: '開啟工作台',
    status: 'wip',
  },
  {
    title: '收藏追蹤',
    description: '把老主顧與友好部落整理成可篩選、可追蹤的清單，支援每週 / 每日視角與備份碼匯出。',
    to: '/collection',
    cta: '管理收藏',
    status: 'wip',
  },
]

function HomePage({ appName }: HomePageProps) {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">FF14 Helper</p>
        <h2>{appName}</h2>
        <p className="lead">
          以繁中服玩家工作流為核心的 FF14 前端工具站。備份設定、比較市場、規劃藏寶圖路線、模擬製作手法——
          所有工具都在同一個頁面內，不需要登入、不保存個人檔案。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">純前端，不需帳號</span>
          <span className="badge">繁中服優先</span>
          <span className="badge badge--warning">部分功能開發中</span>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/craft">開啟製作助手</Link>
          <Link className="button button--ghost" to="/market">前往查價</Link>
          <Link className="button button--ghost" to="/treasure">藏寶圖</Link>
          <Link className="button button--ghost" to="/collection">收藏追蹤</Link>
        </div>
      </section>

      <section className="feature-grid">
        {features.map((feature) => (
          <article key={feature.to} className="page-card">
            <div className="section-heading">
              <h2>
                {feature.title}
                {feature.status === 'wip' ? <span className="badge badge--warning" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', verticalAlign: 'middle' }}>開發中</span> : null}
              </h2>
              <p>{feature.description}</p>
            </div>
            <div className="button-row">
              <Link className="button button--primary" to={feature.to}>{feature.cta}</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>整合策略</h2>
          <p>
            本站對 BestCraft、collection-tc、FFXIV Market、treasure-finder 等開源工具採「研究、重製、整合」策略，
            不直接複製 UI 或內容，所有受啟發的功能都在頁面內標示來源。
          </p>
        </div>
        <div className="source-grid">
          <article className="list-panel">
            <p className="callout-title">已站內化</p>
            <p className="callout-body">BestCraft（AGPL-3.0）、collection-tc</p>
            <p className="muted">製作助手與收藏追蹤已以站內重製方式提供，來源與授權在對應頁面標示。</p>
            <div className="button-row">
              <Link className="button button--ghost" to="/tools">查看工具箱</Link>
            </div>
          </article>
          <article className="list-panel">
            <p className="callout-title">資料政策</p>
            <p className="callout-body">本站不保存你的個人設定或帳號資料</p>
            <p className="muted">
              設定備份在瀏覽器內打包。查價與收藏追蹤只存 localStorage。
              藏寶圖即時房間使用 Firebase 短暫儲存路線，不保存個人帳號。
            </p>
          </article>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>其他入口</h2>
          <p>還原檢查、同步中心與實驗性功能維持次要入口。</p>
        </div>
        <div className="button-row">
          {secondaryNavItems.map((item) => (
            <Link key={item.to} className="button button--ghost" to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomePage
