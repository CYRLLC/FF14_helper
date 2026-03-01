import { Link } from 'react-router-dom'

interface HomePageProps {
  appName: string
}

function HomePage({ appName }: HomePageProps) {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">FF14 小幫手</p>
        <h2>{appName}</h2>
        <p className="lead">
          第一版聚焦在個人設定備份，把最常遺漏但最痛的事情先變成一個 3 分鐘能完成的流程。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">純前端，不經過本站伺服器</span>
          <span className="badge badge--warning">Windows / Chromium 體驗最佳</span>
          <span className="badge">GitHub Pages 可部署</span>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/backup">
            開始備份
          </Link>
          <Link className="button button--ghost" to="/tools">
            查看工具導覽
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>本機設定打包</h2>
            <p>針對 FF14 設定資料夾做 allowlist 篩選，避免誤把整個 Documents 一起打包。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>雙雲端上傳</h2>
            <p>ZIP 檔先在本機建立，只有在你主動點擊上傳時才會進行雲端授權。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>擴充骨架已留好</h2>
            <p>後續可繼續加上 Gold Saucer / GATE 參考頁、工具聚合與資料查詢功能。</p>
          </div>
        </article>
      </section>
    </div>
  )
}

export default HomePage
