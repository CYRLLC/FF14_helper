import { Link } from 'react-router-dom'

function AboutPage() {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">About</p>
        <h2>關於 FF14 Helper</h2>
        <p className="lead">
          FF14 Helper 是一個部署在 GitHub Pages 的公開前端工具站，目標是把 FF14 玩家日常工作流整合進同一個純前端介面。
          本站不需要登入、不收集帳號資料，所有核心功能都在瀏覽器內完成。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">MIT 授權</span>
          <span className="badge">GitHub Pages</span>
          <span className="badge">台灣玩家優先</span>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>專案定位</h2>
          </div>
          <div className="detail-list">
            <span>以繁中服玩家的日常工作流為優先，不以全球市場或英文服為主要使用情境。</span>
            <span>純前端架構，不依賴本站後端，讓核心功能在瀏覽器內直接運作。</span>
            <span>對外部開源工具採「研究、重製、整合」策略，而非直接照搬 UI 或內容。</span>
            <span>每個受外部工具啟發的功能都在頁面內明確標示來源與授權邊界。</span>
            <span>本站不做遊戲自動化、外掛注入、記憶體讀寫或封包分析。</span>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>資料政策</h2>
          </div>
          <div className="detail-list">
            <span>設定備份在瀏覽器內打包成 ZIP，不經過本站伺服器。</span>
            <span>雲端備份直接上傳到你授權的 OneDrive 或 Google Drive。</span>
            <span>查價工作台資料只存在 localStorage，不上傳到本站。</span>
            <span>收藏追蹤狀態只存在 localStorage，支援備份碼手動匯出 / 匯入。</span>
            <span>藏寶圖即時房間若啟用，只短暫存放房間代碼、成員暱稱與路線資料，設有 TTL，不保存個人帳號。</span>
            <span>本站不建立永久使用者帳號或跨裝置個人資料。</span>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>目前功能</h2>
          <p>以下是目前已進入正式頁面、可實際使用的功能。</p>
        </div>
        <div className="source-grid">
          <div className="detail-list">
            <span><strong>備份助手：</strong>選取 FF14 設定資料夾，掃描已知設定檔，在瀏覽器打包 ZIP 並下載或上傳雲端。</span>
            <span><strong>還原檢查：</strong>開啟備份 ZIP，驗證 manifest，在還原前預覽存檔內容。</span>
            <span><strong>繁中服查價：</strong>OCR 截圖匯入、批次文字貼上、陸行鳥 / 莫古力比價、市場板試算。</span>
            <span><strong>金碟 GATE：</strong>台灣時間時段顯示、倒數計時、非官方候選參考（純前端計算，非官方資料）。</span>
          </div>
          <div className="detail-list">
            <span><strong>製作助手：</strong>全技能模擬（含 Specialist 技能）、配方搜尋、Solver、Macro 匯出。</span>
            <span><strong>收藏追蹤：</strong>老主顧與友好部落清單、狀態追蹤、每週 / 每日視角、備份碼匯出入。</span>
            <span><strong>藏寶圖助手：</strong>單人 / 8 人模式、各地圖點位、Firebase 即時隊伍房間、路線規劃。</span>
            <span><strong>工具箱：</strong>整理已參考的 FF14 開源工具，標示來源、授權與站內整合狀態。</span>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>參考來源與授權</h2>
          <p>
            本站受多個 FF14 開源工具啟發，所有功能皆為重新實作，不直接複製 UI 版型或程式碼。
            詳細的來源標示與授權邊界請查看各功能頁面底部的來源區塊，以及工具箱頁。
          </p>
        </div>
        <div className="badge-row">
          <span className="badge badge--warning">BestCraft（AGPL-3.0）</span>
          <span className="badge">ffxiv-collection-tc</span>
          <span className="badge">FFXIV Market（beherw）</span>
          <span className="badge">xiv-tc-treasure-finder（cycleapple）</span>
          <span className="badge">XIVAPI</span>
        </div>
        <div className="button-row">
          <Link className="button button--ghost" to="/tools">查看完整工具箱</Link>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>路線圖</h2>
          <p>詳細的功能規劃、技術藍圖與執行順序記錄在專案文件中。</p>
        </div>
        <div className="detail-list">
          <span>近期目標：查價頁主流程重構、藏寶圖 8 人房間 UI 整合、製作助手工作台版型深化。</span>
          <span>中期目標：收藏追蹤與製作 / 查價頁的工作流串接、備份雲端管理升級。</span>
          <span>長期目標：站內知識層建立、更成熟的協作工具、製作助手本地化工作流整合。</span>
        </div>
        <div className="button-row">
          <a
            className="button button--ghost"
            href="https://github.com/Ynver5e/FF14_helper"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </section>
    </div>
  )
}

export default AboutPage
