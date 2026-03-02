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
          這是持續開發中的 FF14 工具站。本站主打純前端處理，讓備份、查價、金碟時程與藏寶圖等常用
          功能都盡量在瀏覽器內完成，減少把資料送往本站伺服器的需求。
        </p>
        <div className="badge-row">
          <span className="badge">開發中</span>
          <span className="badge badge--positive">不保存站端資料</span>
          <span className="badge badge--warning">建議使用 Windows + Chromium</span>
          <span className="badge">公開專案</span>
        </div>
        <div className="callout">
          <span className="callout-title">目前狀態</span>
          <span className="callout-body">
            核心功能已可使用，但仍會持續補強。新功能若有參考其他工具站，會在頁面與 README 中清楚標示
            來源，並維持本站自己的介面與文案。
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
            雙服比價
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>備份助手</h2>
            <p>選取設定資料夾，在瀏覽器中打包成 ZIP，並可選擇同步到自己的 OneDrive 或 Google Drive。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>還原檢查</h2>
            <p>載入既有備份 ZIP，檢查 manifest 與內容清單，先確認檔案完整再決定是否還原。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>金碟遊樂園</h2>
            <p>依台灣時間顯示 GATE 時段、倒數，以及僅供參考的活動預測。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>雙服比價</h2>
            <p>針對繁中服的陸行鳥與莫古力，支援多項目比價清單、總價比較與市場板試算。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>完整藏寶圖</h2>
            <p>納入參考站目前公開的全數寶圖資料，並把單人與 8 人寶圖分開整理。</p>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>站內原則</h2>
          <p>
            本站以靜態網站與瀏覽器端運算為核心。若功能需要外部資料，會直接連到第三方公開來源，並清楚
            註明來源與參考站，不在本站自建後端轉存你的個人資料。
          </p>
        </div>
      </section>
    </div>
  )
}

export default HomePage
