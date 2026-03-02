# FF14 Helper

FF14 Helper 是一個公開的、以瀏覽器為核心的 Final Fantasy XIV 工具站。

本站以 GitHub Pages 靜態網站形式部署，盡量把備份、還原檢查、同步偏好、金碟時程、繁中服查價與藏寶圖輔助都放在前端完成，不依賴本站自建後端來保存使用者內容。

## 目前狀態

此專案持續開發中。

- 備份與還原檢查已可使用
- 金碟、雙服比價、完整藏寶圖已上線
- 後續仍會持續擴充更多 FF14 輔助功能

## 目前功能

- 在瀏覽器中整理 FF14 個人設定資料並打包 ZIP
- 可選擇上傳到自己的 OneDrive 或 Google Drive
- 還原前可先檢查 ZIP 與 `backup-manifest.json`
- 同步偏好與最近紀錄只存在本機瀏覽器
- 金碟 GATE 時段參考表（台灣時間）
- 僅供參考的 GATE 活動預測
- 繁中服 `陸行鳥 / 莫古力` 多項目比價工作表
- 市場板試算工具
- 參考 `xiv-tc-treasure-finder` 的完整藏寶圖頁
- 單人與 8 人寶圖分開整理
- 8 人寶圖本機組隊規劃與路線整理
- 外部工具導覽與來源標示

## 資料政策

本站不經營自己的使用者資料後端。

- 備份 ZIP 在瀏覽器中建立
- 同步偏好、查價工作表、藏寶圖選擇與組隊清單會存在瀏覽器 `localStorage`
- 本站不會把你的個人設定檔、查價內容或藏寶圖規劃上傳到本站伺服器
- 只有在你明確選擇雲端上傳時，備份檔才會送到你自己的 OneDrive 或 Google Drive

## 參考來源

本站會參考社群工具與公開文件的功能方向或資料格式，但不直接複製對方的版面、文案或素材。所有功能都會用本站自己的 UI 與程式碼重新實作。

### 功能參考

- [FFXIV Market (beherw)](https://beherw.github.io/FFXIV_Market/)
- [xiv-tc-toolbox (cycleapple)](https://cycleapple.github.io/xiv-tc-toolbox/)
- [xiv-tc-treasure-finder (cycleapple)](https://cycleapple.github.io/xiv-tc-treasure-finder/)
- [FFXIV Teamcraft](https://ffxivteamcraft.com/)
- [Garland Tools](https://garlandtools.org/)

### 資料來源與文件

- [Console Games Wiki: Gold Saucer Active Time Events](https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Time_Events)
- [cycleapple treasure data.js](https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js)
- [XIVAPI](https://xivapi.com/)
- [XIVAPI Docs](https://v2.xivapi.com/docs)
- [XIVAPI Search Guide](https://v2.xivapi.com/docs/guides/search/)
- [XIVAPI MapCoordinates.md](https://github.com/xivapi/ffxiv-datamining/blob/master/docs/MapCoordinates.md)
- [Universalis](https://universalis.app/)

## 專案目標

- 維持可部署於 GitHub Pages 的純前端架構
- 盡量避免在本站伺服器保存使用者資料
- 把 FF14 常用小工具整合成一個實用網站
- 保持公開專案可讀性，方便外部協作者理解

## 技術棧

- React
- TypeScript
- Vite
- React Router
- Vitest
- GitHub Pages

## 本機開發

```bash
npm install
npm run dev
```

常用指令：

```bash
npm run build
npm run test
npm run lint
```

## 執行期設定

部署雲端上傳功能前，請先更新 [public/runtime-config.json](/d:/FF14_helper/public/runtime-config.json)：

- `oneDriveClientId`
- `googleClientId`
- `oneDriveRedirectUri`（可選）
- `googleRedirectUri`（可選）

若 `Client ID` 留空，網站仍可使用本機備份、還原檢查、金碟、查價與藏寶圖等功能，但雲端上傳會維持停用。

## GitHub Pages 部署

本專案已配置 GitHub Actions 部署到 GitHub Pages。

相關 workflow：

- [.github/workflows/deploy.yml](/d:/FF14_helper/.github/workflows/deploy.yml)

補充：

- Vite 的 `base` 使用 `./`，因此適用於 repo pages、user pages 與 custom domain
- 預期由 `main` 分支透過 workflow 部署

## 公開專案說明

此 repository 以公開協作為前提。

- 盡量維持使用者可讀的繁體中文文案
- 若功能參考了其他公開工具，需清楚標示來源
- 除非真的必要，否則優先維持純前端與無後端的方向
