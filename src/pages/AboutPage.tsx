import type { RuntimeConfig } from '../types'

interface AboutPageProps {
  config: RuntimeConfig
}

function AboutPage({ config }: AboutPageProps) {
  return (
    <div className="page-grid">
      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>關於這個專案</h2>
          <p>
            FF14 Helper 是公開的靜態網站專案，目標是把 FF14 玩家常用的小工具整理成同一個前端網站，
            盡量避免安裝額外程式或把資料交給本站伺服器保存。
          </p>
        </div>
        <ul>
          <li>備份功能會在瀏覽器內整理 FF14 設定資料，避免把整個文件夾無差別打包。</li>
          <li>ZIP 建立、還原檢查與同步偏好都盡量在本機完成。</li>
          <li>雲端上傳只會在你明確選擇時，送到你自己的 OneDrive 或 Google Drive。</li>
          <li>若功能參考了其他公開工具站，會在頁面與 README 中標示來源。</li>
        </ul>
      </section>

      <section className="config-grid">
        <article className="config-card">
          <div className="config-label">專案名稱</div>
          <div className="config-value">{config.appName}</div>
        </article>
        <article className="config-card">
          <div className="config-label">版本</div>
          <div className="config-value">{config.version}</div>
        </article>
        <article className="config-card">
          <div className="config-label">OneDrive 設定</div>
          <div className="config-value">
            {config.oneDriveClientId ? '已設定 Client ID' : '尚未設定 Client ID'}
          </div>
        </article>
        <article className="config-card">
          <div className="config-label">Google Drive 設定</div>
          <div className="config-value">
            {config.googleClientId ? '已設定 Client ID' : '尚未設定 Client ID'}
          </div>
        </article>
      </section>

      <section className="page-card about-copy">
        <div className="section-heading">
          <h2>目前發展方向</h2>
          <p>本站會優先補強實用但低風險、可純前端完成的功能。</p>
        </div>
        <ul>
          <li>備份與還原流程持續完善</li>
          <li>同步摘要與本機設定管理</li>
          <li>金碟遊樂園時程與參考預測</li>
          <li>繁中服雙服比價與市場板試算</li>
          <li>完整藏寶圖與 8 人組隊規劃</li>
        </ul>
      </section>
    </div>
  )
}

export default AboutPage
