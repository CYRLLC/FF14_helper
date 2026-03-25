# FF14 Helper — 模組狀態總覽

最後更新：2026-03-25（v3.7）
文件性質：模組實作現況、與參考來源的差距、優先工作項目
**使用方式：給 Claude 關鍵字（例如「製作頁」「BestCraft」「solver」「查價」「OCR」「藏寶圖」「收藏」「金碟」）即可定位對應章節。**

---

## 參考來源總覽

| 參考專案 | 技術棧 | 對應本站模組 | 路徑 |
|---------|--------|------------|------|
| ffxiv-best-craft (Tnze) | Vue 3 + TypeScript + Rust/WASM | 製作頁 | `FF14_bestCraft_ZH_TW/` + https://github.com/Tnze/ffxiv-best-craft |
| collection-tc | — | 收藏頁 | 外部參考 |
| FFXIV Market | — | 查價頁 | 外部參考 |
| treasure-finder | — | 藏寶圖頁 | 外部參考 |

---

## 模組 1：製作頁 (CraftPage)

**關鍵字：製作頁、CraftPage、BestCraft、simulator、solver、macro、技能序列、配方、action**

### 主要檔案
- `src/pages/CraftPage.tsx` — 主頁面（1041 行），4 Tab 結構
- `src/craft/simulator.ts` — 模擬引擎 + solver + macro 解析
- `src/api/xivapi.ts` — 配方搜尋 / 食物藥水查詢

### 目前實作狀態

| 功能 | 狀態 | 說明 |
|------|------|------|
| 4 Tab 架構（帶入配方/技能序列/模擬結果/相關任務） | ✅ 完成 | v3.4 完成 |
| 8 職業獨立屬性（製作、加工、CP、等級） | ✅ 完成 | jobProfiles + localStorage |
| 配方搜尋（XIVAPI） | ✅ 完成 | searchRecipeResults + fetchRecipeDetails |
| 技能面板（39 種技能） | ✅ 完成 | localizedActionNames 含繁中名稱 |
| 技能序列編輯 | ✅ 完成 | 拖曳/點擊/撤銷/清空 |
| 模擬引擎（進度/品質/耐久/CP） | ✅ 完成 | simulateCraft() |
| Buff 狀態追蹤（10 種） | ✅ 完成 | CraftBuffState |
| HQ 機率表 | ✅ 完成 | 91 點查找表 |
| Solver（beam search） | ✅ 完成 | solveCraftSequence()，寬度 56，最大 24 步 |
| Macro 輸出（15 行分塊） | ✅ 完成 | buildMacroChunks() |
| Macro 匯入解析 | ✅ 完成 | parseMacroText()，含 wait tag 修正 |
| 相關任務（老主顧/友好部落） | ✅ 完成 | Tab 4 含關鍵字搜尋 + 帶入搜尋 |
| 持久狀態列（6 stat cards + 序列 chips） | ✅ 完成 | 固定在 Tab 上方 |

### 與 BestCraft 的差距（待補項目）

| 功能 | BestCraft 有 | 本站狀態 | 優先度 |
|------|------------|---------|--------|
| **Conditions（11 種製作狀態）** | ✅ Good/Excellent/Poor/Centered/Sturdy/Pliant/Malleable/Primed/GoodOmen/Robust | ✅ v3.6 完成（效果全實作，goodOmen 轉換邏輯完成） | — |
| **每步模擬明細視圖** | ✅ | ✅ v3.6 完成（Tab 3 逐步表格，含條件/增量/備註） | — |
| **隨機技能失敗追蹤**（RapidSynthesisFail、HastyTouchFail、DaringTouchFail） | ✅ | ❌ 未追蹤 | 🟡 中 |
| **Combo 連擊系統**（BasicTouch→StandardTouch→AdvancedTouch） | ✅ | ✅ v3.7 完成（observed flag 修正，Focused 系列動作現已可正確觸發） | — |
| **Specialist 技能**（heart_and_soul, trained_perfection, quick_innovation） | ✅ | ⚠️ 部分 | 🟡 中 |
| **StellarSteadyHand（7.4+ 技能）** | ✅ | ❌ 未實作 | 🟡 中 |
| **ImmaculateMend（7.0+ 技能）** | ✅ | ❌ 未實作 | 🟡 中 |
| **Raphael Solver（最高品質演算法）** | ✅ WASM/Rust | ❌ 只有 beam search | 🔴 高 |
| **NQ Solver（只追求完成）** | ✅ | ❌ | 🟡 中 |
| **DP/Reflect Solver（耐久最佳化）** | ✅ | ❌ | 🟡 中 |
| **每步模擬明細**（逐步 CP/耐久/buff 變化） | ✅ | ❌ 只有最終結果 | 🔴 高 |
| **食物/藥水屬性加成計算** | ✅ Enhancer.ts | ❌ | 🟡 中 |
| **職業裝備組管理（gearsets）** | ✅ 多組可命名 | ⚠️ 每職業只有一組固定值 | 🟡 中 |
| **Collectable 模式（交件閾值）** | ✅ | ❌ | 🟠 低 |
| **BOM 食材需求計算** | ✅ DAG + 拓樸排序 | ❌（在查價頁做部分） | 🟡 中 |
| **Analyzer（序列品質分析）** | ✅ Worker | ❌ | 🟠 低 |
| **多語系 data source**（xivapi/cafe-xivapi/local） | ✅ | ⚠️ 只有 xivapi EN/CHS | 🟠 低 |

### 建議執行順序（製作頁深化）
1. **Conditions 狀態系統** — 影響所有模擬精度，最優先
2. **每步模擬明細視圖** — Tab 3 加入逐步表格
3. **Solver 升級** — 研究 Raphael 演算法，或整合現有 beam search 改進
4. **食物/藥水加成** — 讀取 XIVAPI meals/medicine，計算最終屬性
5. **combo 系統驗證與修正**

---

## 模組 2：查價頁 (MarketPage)

**關鍵字：查價頁、MarketPage、OCR、Universalis、Chocobo、Moogle、道具查詢、工作表、試算**

補充筆記：
[`ocr-investigation.zh-TW.md`](./ocr-investigation.zh-TW.md) — 參考站 OCR 精準度調查、差距分析與重構順序。

查價模組的完整對齊規格已另寫成 [`market-parity-spec.zh-TW.md`](./market-parity-spec.zh-TW.md)。  
本章保留目前程式狀態摘要；若要規劃和參考站對齊的下一階段開發，請以該文件為主。

補記（2026-03-25）：
- `MarketPage` 已完成第一版「主線裝備查價」面板，支援以 `ilvl + 裝備部位` 搜尋裝備並直接比較陸行鳥 / 莫古力價格。
- `MarketPage` 已完成第一版「製作職找價」面板，支援以 `製作職 + 物品等級範圍` 搜尋可製作成果並直接比較雙服價格。
- OCR 名稱校正已接入本地 `tw-items.msgpack` 索引，匯入預覽與查詢 OCR 會先做 normalize + candidate ranking，再 fallback 到 XIVAPI。
- 查價結果可直接打開單品市場詳情，並沿用既有工作表匯入流程。
- 目前仍未拆出獨立 route，也還沒有把製作頁 BOM / 收藏頁材料清單匯入查價流程。

### 主要檔案
- `src/pages/MarketPage.tsx` — 主頁面（1215 行），4 Tab 結構
- `src/tools/marketOcr.ts` — OCR 解析 + 道具名稱提取
- `src/tools/marketItemSearch.ts` — 本地道具名稱索引、OCR normalize 與候選排序
- `src/tools/market.ts` — 比價計算、工作表彙總
- `src/tools/marketFormat.ts` — 格式化工具
- `src/api/universalis.ts` — 市場 API（單筆 + 批次）
- `src/api/xivapi.ts` — 道具搜尋

### 目前 4 Tab 狀態

| Tab | 功能 | 狀態 |
|-----|------|------|
| 截圖匯入 | 拖曳/貼上/上傳圖片 → PaddleOCR/Tesseract → 本地道具索引校正 → 逐列預覽校對 | ✅ |
| 工作表 | 比價清單（陸行鳥/莫古力雙服）、批次操作、彙總統計 | ✅ |
| 試算 | 市場板稅後利潤計算 | ✅ |
| 道具查詢 | 截圖 OCR → 本地道具索引校正 → XIVAPI 搜尋 → Universalis 批次查價 + Garland Tools 連結 | ✅ v3.8 |

### API 整合

| API | 端點 | 用途 | 狀態 |
|-----|------|------|------|
| Universalis | `/api/v2/{world}/{id}` | 單筆查價 | ✅ |
| Universalis | `/api/v2/{world}/{id1,id2,...}?listings=3&entries=0` | 批次查價 | ✅ v3.5 |
| XIVAPI | `/api/search?sheets=Item&language=chs/en` | 道具 ID 搜尋 | ✅ v3.5 |
| XIVAPI | `/api/search?sheets=Recipe` | 配方搜尋 | ✅ |

### 伺服器範圍

| 伺服器 | 資料中心 | scopeKey |
|--------|---------|---------|
| 陸行鳥 (Chocobo) | Mana DC（JP） | `Chocobo` |
| 莫古力 (Moogle) | Chaos DC（EU） | `Moogle` |

### 待補項目

| 功能 | 優先度 | 說明 |
|------|--------|------|
| OCR 校對體驗強化（逐列刪除、批次確認） | ✅ v3.7 | checkbox 全選/全消/刪除未勾選，寫入只寫勾選列 |
| 道具查詢結果快取（避免重複查） | 🟡 中 | 目前每次都重查 |
| 常用材料模板 | 🟡 中 | 快速帶入常見製作材料 |
| 工作表排序（依差價/依名稱） | 🟡 中 | |
| 資料新鮮度說明 | 🟠 低 | 顯示 Universalis 資料時間 |
| 與收藏頁串接（從收藏頁帶入材料清單） | 🟠 低 | |

---

## 模組 3：藏寶圖頁 (TreasurePage)

**關鍵字：藏寶圖、TreasurePage、treasure、Firebase、房間、多人、路線、地圖、solo、party**

### 主要檔案
- `src/pages/TreasurePage.tsx` — 主頁面（810 行）
- `src/treasure/referenceData.ts` — 地圖/點位靜態資料（public/treasure-snapshot.json）
- `src/treasure/coords.ts` — 座標工具
- `src/treasure/party.ts` — 路線規劃、成員指派、訊息生成
- `src/treasure/liveSync.ts` — Firebase 即時同步

### 目前狀態

| 功能 | 狀態 | 說明 |
|------|------|------|
| 單人/多人模式切換 | ✅ | groupMode state |
| 點位資料（多地圖/多等級） | ✅ | treasure-snapshot.json |
| 地圖預覽（拖曳標記 + 座標顯示） | ✅ | |
| 路線規劃（點位排序 + 成員指派） | ✅ | optimizePartyRoute() |
| 座標複製 | ✅ | |
| Firebase 即時房間（24hr TTL） | ✅ | createRealtimeTreasureRoom |
| 房間建立/加入/離開 | ✅ | |
| 完成標記即時同步 | ✅ | |
| 隊伍訊息生成（含傳送點建議） | ✅ | buildPartyMessage() |

### Tab 遷移狀態

| Tab | 計劃 | 狀態 |
|-----|------|------|
| 單人模式 | 地圖選擇/點位/座標 | ✅ v3.6 完成 |
| 8 人模式 | 建立/加入/即時協作/路線分配 | ✅ v3.6 完成 |

### 待補項目

| 功能 | 優先度 | 說明 |
|------|--------|------|
| **Tab 架構遷移**（單人/多人分頁） | 🔴 高 | Blueprint Phase 5 |
| 房間面板整併（房名/房號/連結/TTL/成員/同步狀態） | 🔴 高 | 目前分散 |
| 離線 fallback UX | 🟡 中 | Firebase 斷線時的降級顯示 |
| 房間過期 UX | 🟡 中 | TTL 倒數更清楚 |
| 地圖預覽與路線高亮同步 | 🟡 中 | 點位選中時地圖對應標記 |
| 手機版 8 人模式簡化 | 🟠 低 | |

---

## 模組 4：收藏頁 (CollectionPage)

**關鍵字：收藏頁、CollectionPage、老主顧、友好部落、collection、tracker、每日、每週、願望清單**

### 主要檔案
- `src/pages/CollectionPage.tsx` — 主頁面
- `src/collection/data.ts` — 80+ 條目靜態資料
- `src/collection/storage.ts` — 狀態存取/匯出/匯入

### 目前狀態

| 功能 | 狀態 |
|------|------|
| 老主顧/友好部落清單 | ✅ |
| 搜尋/篩選（職業/版本/狀態） | ✅ |
| 3 狀態切換（計劃中/進行中/已完成） | ✅ |
| 願望清單 toggle | ✅ |
| 焦點模式（每週/每日分流） | ✅ |
| 匯出/匯入（Base64） | ✅ |
| 與製作頁串接（帶入搜尋） | ✅ |

### Tab 遷移狀態

| Tab | 計劃 | 狀態 |
|-----|------|------|
| 今日任務 | 進行中/每日重置提示 | ✅ v3.6 完成 |
| 清單瀏覽 | 搜尋/篩選/狀態切換 | ✅ v3.6 完成 |
| 願望清單 | 已收藏/備忘 + 備份匯出入 | ✅ v3.6 完成 |

### 待補項目

| 功能 | 優先度 | 說明 |
|------|--------|------|
| **Tab 架構遷移**（今日任務/清單瀏覽/願望清單） | 🔴 高 | Blueprint Phase 4 |
| **每日/每週視角**（今天還有什麼、本週還剩什麼） | 🔴 高 | 日常使用核心 |
| 建議下一步面板 | 🟡 中 | 根據狀態自動推薦 |
| 常用項目 pin | 🟡 中 | |
| 與查價頁串接（材料清單 → 查價） | 🟠 低 | |

---

## 模組 5：金碟頁 (GoldSaucerPage)

**關鍵字：金碟、GoldSaucerPage、GATE、時段、預測、倒數**

### 主要檔案
- `src/pages/GoldSaucerPage.tsx`
- `src/goldSaucer/gate.ts` — 時段計算 + hash 預測

### 目前狀態

| 功能 | 狀態 | 說明 |
|------|------|------|
| 12 時段 GATE 清單（20 分鐘間隔） | ✅ | |
| 倒數計時（每秒更新） | ✅ | |
| Hash 預測（28–71% 信心度） | ✅ | 非官方 |
| 台北時區 | ✅ | Asia/Taipei hardcoded |

### Tab 遷移狀態

| Tab | 計劃 | 狀態 |
|-----|------|------|
| 時段概覽 | 當前 GATE / 倒數 + 12 時段清單 | ✅ v3.7 完成 |
| GATE 預測 | 候選分析/說明/活動清單 | ✅ v3.7 完成 |

### 待補項目

| 功能 | 優先度 | 說明 |
|------|--------|------|
| **Tab 架構遷移**（時段概覽/GATE 預測） | ✅ v3.7 | Blueprint Phase 6 完成 |
| 預測模型改進 | 🟡 中 | 目前 hash-based，可靠度待驗證 |
| 活動分類與重點提示 | 🟠 低 | |

---

## 模組 6：備份頁 (BackupPage) + 還原頁 (RestorePage)

**關鍵字：備份、BackupPage、還原、RestorePage、ZIP、OneDrive、Google Drive、cloud**

### 主要檔案
- `src/pages/BackupPage.tsx`
- `src/pages/RestorePage.tsx`
- `src/backup/archive.ts` — ZIP 打包
- `src/backup/fileSources.ts` — 資料夾選擇
- `src/backup/scan.ts` — 設定檔掃描（FFXIV.cfg 白名單）
- `src/backup/restore.ts` — ZIP 還原
- `src/cloud/gdrive.ts` + `onedrive.ts` — OAuth2 雲端上傳

### 目前狀態

| 功能 | 狀態 |
|------|------|
| 本機資料夾選擇（WebkitDirectory + 原生 picker） | ✅ |
| ZIP 打包（fflate/jszip） | ✅ |
| 下載 ZIP | ✅ |
| OneDrive / Google Drive OAuth2 上傳 | ✅ |
| 還原 ZIP 檢查 | ✅ |
| 同步偏好設定（SyncPage） | ✅ |

### 待補項目（中期）

| 功能 | 優先度 |
|------|--------|
| 雲端備份清單瀏覽 | 🟡 中 |
| 備份檔案版本比較 | 🟡 中 |
| 還原步驟導引 UX | 🟡 中 |
| 失敗排除說明 | 🟠 低 |

---

## 模組 7：全站基礎架構

**關鍵字：架構、Router、localStorage、CSS、Tab、sticky header、SyncContext**

### 技術棧
- React 19.2 + TypeScript 5.9 + Vite 7.3
- react-router-dom 7.13 (HashRouter)
- Firebase 12.10 (藏寶圖房間)
- Tesseract.js 7.0 (OCR)
- jszip 3.10 + fflate 0.8 (壓縮)
- Vitest + @testing-library/react (測試)

### localStorage 鍵值
| 鍵 | 對應模組 |
|----|---------|
| `ff14-helper.craft.workbench.v3` | CraftPage |
| `ff14-helper.market.workbench.v3` | MarketPage |
| `ff14-helper.treasure.finder.v5` | TreasurePage |
| `ff14-helper.collection.tracker.v1` | CollectionPage |
| `ff14-helper.treasure.reference-cache` | Treasure 靜態資料快取 |

### CSS 架構（index.css）
| 類別 | 用途 |
|------|------|
| `.site-header` | `position: sticky; top: 0; z-index: 20; backdrop-filter: blur(18px)` |
| `.tool-tab-bar` | flex 橫排 Tab 按鈕，overflow-x: auto |
| `.tool-tab` | 單一 Tab 按鈕，border-bottom: 2px solid transparent |
| `.tool-tab--active` | 選中 Tab，accent 色底線 |
| `.tool-panel` | Tab 內容容器，margin-top: 1.25rem + riseIn 動畫 |
| `.source-grid` | 2 欄 grid（左操作/右結果），用於 Tab 內部 |
| `.page-card` | 單欄卡片，用於 Tab 3/4 |
| `.page-grid` | 靜態頁面網格（About/Home 等） |

### Tab 遷移進度（Blueprint）
| Phase | 頁面 | 狀態 |
|-------|------|------|
| Phase 1 | CSS 基礎建設 | ✅ 完成 |
| Phase 2 | CraftPage（4 Tab） | ✅ 完成 v3.4 |
| Phase 3 | MarketPage（4 Tab） | ✅ 完成 v3.5 |
| Phase 4 | CollectionPage（3 Tab） | ✅ 完成 v3.6 |
| Phase 5 | TreasurePage（2 Tab） | ✅ 完成 v3.6 |
| Phase 6 | GoldSaucerPage（2 Tab） | ✅ 完成 v3.7 |

---

## 模組 8：工具箱 + 關於頁

**關鍵字：工具箱、ToolsPage、關於、AboutPage、來源、attribution**

### 目前狀態
- `ToolsPage.tsx`：30+ 外部工具清單，含整合狀態標籤（已整合/部分/參考/外部）
- `AboutPage.tsx`：授權/來源說明
- `SourceAttribution.tsx`：每頁底部來源區塊（component）

### 待補項目
| 功能 | 優先度 |
|------|--------|
| About 頁改為公開專案說明頁 | 🟡 中 |
| 工具箱已站內化/未站內化狀態更清楚 | 🟠 低 |

---

## 快速查閱索引

| 關鍵字 | 對應章節 |
|--------|---------|
| 製作、CraftPage、BestCraft、macro、solver、simulator、action、技能、配方 | 模組 1 |
| 查價、MarketPage、OCR、Universalis、市場、道具查詢、Chocobo、Moogle | 模組 2 |
| 藏寶圖、TreasurePage、treasure、Firebase、房間、多人、路線 | 模組 3 |
| 收藏、CollectionPage、老主顧、友好部落、每日、每週 | 模組 4 |
| 金碟、GoldSaucerPage、GATE、時段、預測 | 模組 5 |
| 備份、BackupPage、還原、ZIP、雲端 | 模組 6 |
| 架構、CSS、Tab、sticky、localStorage、Router | 模組 7 |
| 工具箱、ToolsPage、關於、來源 | 模組 8 |
