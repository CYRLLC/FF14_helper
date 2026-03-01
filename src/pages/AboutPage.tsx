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
          <p>FF14 Helper 目前是靜態網站，不使用自架後端，所有備份都在你的瀏覽器內處理。</p>
        </div>
        <ul>
          <li>選取資料夾後，網站只會讀取 allowlist 內的 FF14 設定檔。</li>
          <li>下載 ZIP 時資料只在本機產生，不會傳到本站。</li>
          <li>只有你主動按下雲端上傳時，才會啟動對應雲端授權流程。</li>
          <li>主機版備份與更多資訊整合功能會留到後續版本。</li>
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
          <h2>部署前要完成的事</h2>
          <p>GitHub Pages 可直接部署，但要先把公開的 OAuth Client ID 填進 runtime-config.json。</p>
        </div>
        <ul>
          <li>Microsoft Entra App Registration：將 redirect URI 指向 `oauth/callback.html`。</li>
          <li>Google Cloud OAuth Client：同樣將 redirect URI 指向 `oauth/callback.html`。</li>
          <li>若 repo 名稱改變，請同步更新 `VITE_BASE_PATH` 或 `vite.config.ts` 的 base 設定。</li>
        </ul>
      </section>
    </div>
  )
}

export default AboutPage
