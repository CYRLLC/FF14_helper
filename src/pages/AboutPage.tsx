import type { RuntimeConfig } from '../types'

interface AboutPageProps {
  config: RuntimeConfig
}

function AboutPage({ config }: AboutPageProps) {
  return (
    <div className="page-grid">
      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>專案定位</h2>
          <p>
            FF14 Helper 是一個部署在 GitHub Pages 的公開專案，目標是把 FF14 玩家常用的小工具整理成同一個純前端網站。
            第一優先是個人設定備份，後續再逐步補上繁中服查價、金碟 GATE 參考、藏寶圖工具與其他日常功能。
          </p>
        </div>
        <ul>
          <li>本站不提供遊戲自動化、外掛注入或任何高風險功能。</li>
          <li>大部分資料處理都在你的瀏覽器內完成，不經過本站伺服器。</li>
          <li>即時房間功能若有啟用 Firebase，只短暫保存房間狀態與隊伍路線，不保存個人帳號資料。</li>
          <li>所有參考來源都會在頁面內與 README 中明確標示。</li>
        </ul>
      </section>

      <section className="config-grid">
        <article className="config-card">
          <div className="config-label">站點名稱</div>
          <div className="config-value">{config.appName}</div>
        </article>
        <article className="config-card">
          <div className="config-label">版本</div>
          <div className="config-value">{config.version || '開發中'}</div>
        </article>
        <article className="config-card">
          <div className="config-label">OneDrive OAuth</div>
          <div className="config-value">{config.oneDriveClientId ? '已設定' : '未設定'}</div>
        </article>
        <article className="config-card">
          <div className="config-label">Google Drive OAuth</div>
          <div className="config-value">{config.googleClientId ? '已設定' : '未設定'}</div>
        </article>
        <article className="config-card">
          <div className="config-label">即時隊伍</div>
          <div className="config-value">{config.firebaseAppId ? '已設定 Firebase' : '未設定 Firebase'}</div>
        </article>
      </section>

      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>目前功能</h2>
          <p>目前已可使用或已進入正式頁面的功能如下。</p>
        </div>
        <ul>
          <li>FF14 個人設定備份與 ZIP 下載</li>
          <li>OneDrive / Google Drive 雲端備份上傳</li>
          <li>繁中服比價工作流與 OCR 截圖匯入</li>
          <li>金碟 GATE 台灣時間時程與候選預測</li>
          <li>單人 / 8 人藏寶圖點位瀏覽與即時隊伍房間</li>
        </ul>
      </section>

      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>資料政策</h2>
          <p>這個專案偏向前端工具站，不以收集使用者資料為目的。</p>
        </div>
        <ul>
          <li>本站不保存你的 FF14 個人設定檔與備份 ZIP。</li>
          <li>備份檔會直接由瀏覽器下載，或上傳到你自行授權的雲端服務。</li>
          <li>即時房間只保存房間名稱、隊員暱稱、路線與時間戳，並設有過期時間。</li>
          <li>外部 API 或資料網站只作資料來源與功能參考，本站會註明來源。</li>
        </ul>
      </section>
    </div>
  )
}

export default AboutPage
