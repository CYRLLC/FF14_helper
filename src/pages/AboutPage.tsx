import type { RuntimeConfig } from '../types'

interface AboutPageProps {
  config: RuntimeConfig
}

function AboutPage({ config }: AboutPageProps) {
  return (
    <div className="page-grid">
      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>關於這個網站</h2>
          <p>FF14 Helper 是純前端網站。備份、同步偏好與最近紀錄都以瀏覽器端為主，不存到本站。</p>
        </div>
        <ul>
          <li>選取資料夾後只會讀取 FF14 設定相關檔案，不會整包掃描你的 Documents。</li>
          <li>下載 ZIP 時資料只在本機產生。</li>
          <li>上傳到雲端時會直接由瀏覽器連到 OneDrive 或 Google Drive。</li>
          <li>同步中心只保存偏好與操作紀錄摘要，不保存實際備份檔內容。</li>
        </ul>
      </section>

      <section className="config-grid">
        <article className="config-card">
          <div className="config-label">網站名稱</div>
          <div className="config-value">{config.appName}</div>
        </article>
        <article className="config-card">
          <div className="config-label">版本</div>
          <div className="config-value">{config.version}</div>
        </article>
        <article className="config-card">
          <div className="config-label">OneDrive 設定</div>
          <div className="config-value">
            {config.oneDriveClientId ? '已填入 Client ID' : '尚未填入 Client ID'}
          </div>
        </article>
        <article className="config-card">
          <div className="config-label">Google Drive 設定</div>
          <div className="config-value">
            {config.googleClientId ? '已填入 Client ID' : '尚未填入 Client ID'}
          </div>
        </article>
      </section>

      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>下一步可擴充</h2>
          <p>目前已把同步骨架放進站內，之後可以繼續延伸更多不依賴伺服器的小功能。</p>
        </div>
        <ul>
          <li>還原教學與設定比對頁</li>
          <li>雲端備份清單掃描</li>
          <li>Gold Saucer / GATE 參考頁</li>
          <li>市場資料與道具查詢功能</li>
        </ul>
      </section>
    </div>
  )
}

export default AboutPage
