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
          這是持續開發中的 FF14 前端工具站。備份、還原檢查、金碟時程、繁中服比價、
          藏寶圖輔助等功能都盡量在瀏覽器內完成，不把你的個人資料存到本站伺服器。
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
            目前已經有可用版本，但整站仍在持續擴充中。每個新功能頁都會標示參考來源，
            並維持本站自己的 UI、文案與程式碼結構。
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
            繁中服比價
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>備份助手</h2>
            <p>選取你的設定資料夾，在瀏覽器中打包成 ZIP，並可選擇同步到自己的雲端。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>還原檢查</h2>
            <p>把既有備份 ZIP 拖進站內，快速查看內容與 manifest，確認檔案是否完整。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>金碟遊樂園</h2>
            <p>依台灣時間顯示 GATE 時段、倒數與僅供參考的活動預測，不保證實際輪替。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>繁中服比價</h2>
            <p>聚焦繁中伺服器，只做陸行鳥與莫古力的手動比價、價差整理與市場板試算。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>藏寶圖輔助</h2>
            <p>參考繁中工具箱的藏寶圖流程，提供 Dawntrail 寶圖地點、地圖標記與最近水晶提示。</p>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>站內原則</h2>
          <p>
            本站以靜態網站與前端計算為核心。若功能需要外部資料，會直接向第三方公開服務請求，
            並在頁面中標示來源，不把資料轉存到本站自己的後端。
          </p>
        </div>
      </section>
    </div>
  )
}

export default HomePage
