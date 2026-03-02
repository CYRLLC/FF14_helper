import { Link } from 'react-router-dom'

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
          FF14 Helper 是以瀏覽器為中心的工具站，集中處理備份、還原檢查、金碟時程、查價與藏寶圖輔助，而且盡量只在你的裝置上處理資料。
        </p>
        <div className="badge-row">
          <span className="badge">Work in Progress</span>
          <span className="badge badge--positive">No server-side storage</span>
          <span className="badge badge--warning">Best on Windows + Chromium</span>
          <span className="badge">Public project</span>
        </div>
        <div className="callout">
          <span className="callout-title">Project Status</span>
          <span className="callout-body">
            這是持續開發中的公開專案。現有功能可直接使用，後續仍會繼續擴充更多 FF14 日常小幫手。
          </span>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/backup">
            開始備份
          </Link>
          <Link className="button button--ghost" to="/gold-saucer">
            金碟遊樂園
          </Link>
          <Link className="button button--ghost" to="/market">
            市場查價
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>備份助手</h2>
            <p>在瀏覽器內建立設定備份 ZIP，並可選擇同步到你自己的雲端空間。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>還原檢查</h2>
            <p>先檢查備份 ZIP 內容與 manifest，再手動執行還原。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>金碟遊樂園</h2>
            <p>依台灣時間查看 GATE 時段與倒數，先用來安排金碟活動節奏。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>市場查價</h2>
            <p>結合 XIVAPI 與 Universalis，直接在站內搜尋道具並查看市場板數據。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>藏寶圖座標</h2>
            <p>用站內格線板做粗略定位，快速估算座標後再回遊戲內確認。</p>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>資料政策</h2>
          <p>本站不保存你的備份內容、查價結果或藏寶圖定位點到本站伺服器。需要外部資料時，會直接在瀏覽器向第三方公開 API 取用。</p>
        </div>
      </section>
    </div>
  )
}

export default HomePage
