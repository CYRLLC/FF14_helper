# FF14 Helper 工具整合與功能重現規格書

最後更新：2026-03-18（本次更新：CraftPage 相關任務清單帶入搜尋功能、rewardSummary 快速搜尋按鈕）
文件性質：技術整合規格、功能落差分析、重現執行計劃
適用範圍：FF14 Helper 所有參考站台的站內重現工作

---

## 1. 文件目的

這份文件的出發點不同於藍圖（`project-blueprint.zh-TW.md`）。

藍圖描述的是「整個網站要做到哪裡」，這份文件描述的是：

> **每一個被參考的外部工具，我們打算重現哪些功能、目前做到哪裡、還差什麼、要怎麼做。**

本站的核心策略是「研究、重製、整合」，不是「搬移或嵌入」。這份文件是這個策略的執行對照表。

---

## 2. 參考工具總覽

| 工具 | 原始站 | 授權 | 本站對應模組 | 重現狀態 |
|------|--------|------|--------------|----------|
| ffxiv-best-craft | GitHub / Tauri app | AGPL-3.0 | 製作頁 | 進行中（約 80%） |
| ffxiv-collection-tc | GitHub Pages | 未明示 | 收藏頁 | 進行中（約 60%） |
| FFXIV Market (beherw) | GitHub Pages | 未明示 | 查價頁 | 進行中（約 65%） |
| xiv-tc-treasure-finder | GitHub Pages | 未明示 | 藏寶圖頁 | 進行中（約 65%） |
| xiv-tc-toolbox | GitHub Pages | 未明示 | 工具箱 / 首頁 | 已整合（狀態標籤完成） |

---

## 3. BestCraft（製作助手）

### 3.1 原始工具特性

BestCraft 是一個以 Rust + WebAssembly 為核心引擎的製作模擬器，前端使用 Vue.js，也有 Tauri 桌面版。

主要特性：

- 完整製作技能規則（含機率技、職業技、專家配方條件）
- 完整 Condition 系統（normal / good / excellent / poor / sturdy / pliant / malleable / primed / good omen）
- 高品質機率計算
- 多種 solver 策略（DFS、Raphael、NormalProgress、Reflect）
- 每步動作詳細狀態追蹤
- Macro 輸出
- 本站採用的是繁中版 fork（`FF14_bestCraft_ZH_TW`），已作為 submodule 存在於 repo 中

### 3.2 目前本站已實現

- 各製作職業獨立屬性
- 配方搜尋與自動帶入
- 技能序列編輯
- Progress / Quality / Durability / CP 模擬
- 簡易 solver（貪婪優先序列）
- Macro 匯入與輸出
- 老主顧 / 友好部落快速篩選

已實作技能（共 37 個，更新於 2026-03-17）：

`reflect`, `muscleMemory`, `veneration`, `basicSynthesis`, `carefulSynthesis`, `groundwork`, `prudentSynthesis`, `delicateSynthesis`, `focusedSynthesis`, `intensiveSynthesis`, `innovation`, `greatStrides`, `basicTouch`, `standardTouch`, `advancedTouch`, `prudentTouch`, `preparatoryTouch`, `focusedTouch`, `preciseTouch`, `byregotsBlessing`, `trainedFinesse`, `wasteNot`, `wasteNotII`, `manipulation`, `mastersMend`, `observe`, `tricksOfTheTrade`, `refinedTouch`, `finalAppraisal`, `trainedEye`, `heartAndSoul`, `immaculateMend`, `trainedPerfection`, `quickInnovation`, `rapidSynthesis`, `hastyTouch`, `daringTouch`

### 3.3 目前落差（相對於 BestCraft，更新於 2026-03-17）

#### 3.3.1 缺少的技能

上述 11 個技能已全數補齊（2026-03-17）。目前剩餘技能落差：**無**（全 37 技能已實作）。

#### 3.3.2 Condition 系統不完整

目前只支援：`normal`, `good`, `excellent`, `poor`

缺少專家配方條件：`sturdy`（耐久消耗減半）、`pliant`（CP 消耗減半）、`malleable`（進度加成）、`primed`（buff 延長 +2）、`good omen`（下一步大機率 Good）

#### 3.3.3 Solver 品質落差

BestCraft 採用多策略：
- `Raphael`：目前業界最佳品質，基於完整狀態搜尋
- `ReflectSolver`：Reflect 起手最優解
- `NormalProgressSolver`：特定配方快速解
- `DepthFirstSearch`：通用 DFS

本站目前只有貪婪排序的單一 solver，缺少：
- 回溯能力
- Condition 感知
- 結果最優化評分

#### 3.3.4 其他功能落差

- ~~缺少 Specialist 職業模式（HeartAndSoul / DaringTouch / QuickInnovation / TrainedPerfection）~~ **已完成 2026-03-17**
- 缺少高品質機率顯示（完成後顯示 HQ%）
- 缺少每步詳細 Buff 狀態追蹤視圖
- 缺少 gear set 管理（多套屬性預設）
- 每職業無法儲存多套 rotation 草稿

### 3.4 重現執行計劃

#### 階段一：補齊核心技能（近期）

1. 新增 `tricksOfTheTrade`、`finalAppraisal`、`refinedTouch` 的模擬邏輯
2. 新增 `trainedEye` 的特殊判斷（職等差距條件）
3. 補齊 `rapidSynthesis`、`hastyTouch`、`daringTouch` 的機率處理模型

#### 階段二：專家配方 Condition（中期）

1. 在 `CraftCondition` 型別加入專家條件
2. 在模擬核心加入每種條件的效果邏輯
3. Solver 需感知 Condition 機率分布

#### 階段三：Solver 品質提升（中期）

1. 參考 BestCraft `DepthFirstSearch` 策略，重寫本站 solver 為具備回溯能力的搜尋器
2. 加入評分函數：`progress_efficiency`, `quality_per_cp`, `durability_margin`
3. 長期：評估是否引入 WASM 模組重用 BestCraft Raphael solver（需確認 AGPL 邊界）

#### 階段四：UX 對齊（長期）

1. 每步詳細模擬視圖（Buff 狀態、CP 餘量、耐久軌跡）
2. Gear set 管理
3. 多套 rotation 草稿（各職業）

---

## 4. ffxiv-collection-tc（收藏頁）

### 4.1 原始工具特性

cycleapple 的 collection-tc 是一個專為繁中服玩家設計的收藏追蹤工具，以 GitHub Pages 靜態部署。

主要特性：

- 老主顧（Custom Deliveries）完整清單
- 友好部落（Allied Societies）完整清單
- 搜尋、篩選、狀態追蹤
- 可切換版本 / 資料來源

### 4.2 目前本站已實現

- 老主顧與友好部落清單
- 搜尋、版本篩選、職業篩選
- 狀態切換（未解鎖 / 進行中 / 已完成）
- 願望清單
- 焦點模式（Focus Mode）
- 備份碼匯出 / 匯入（localStorage only）

### 4.3 目前落差

- 缺少真正可操作的每日 / 每週 checklist 視圖（今日進行中面板已加，但缺「今天還剩幾次」的回饋）
- 缺少「今天還剩幾次」的追蹤回饋
- ~~缺少與製作頁的跳轉整合~~ **已完成 2026-03-17**（今日任務面板與完整清單的製作職業項目均加入製作助手按鈕）
- 缺少與查價頁的跳轉整合
- 清單資料更新策略未明文化（版本資料何時更新、如何通知使用者）
- 缺少「本週最適合先做哪幾個」的建議面板

### 4.4 重現執行計劃

1. 加入每日 / 每週重置節奏：交件次數計算、重置日提示
2. 建立「本週推薦」面板（依當前角色進度與節奏）
3. ~~與製作頁串接~~ 已完成，見上
4. 與查價頁串接：對任務所需材料提供查價捷徑

---

## 5. FFXIV Market（查價頁）

### 5.1 原始工具特性

beherw 的 FFXIV Market 是一個市場比價工具，主要針對中文伺服器玩家。

主要特性：

- 各伺服器市場資料匯入
- 比價邏輯
- OCR 截圖匯入

### 5.2 目前本站已實現

- 繁中服雙伺服器（陸行鳥 / 莫古力）比價
- OCR 截圖匯入（Tesseract.js）
- OCR 預覽卡（逐列校對）
- 批次文字貼上
- 手動欄位輸入
- 比價工作表（差價計算）
- 市場板試算
- 最新匯入摘要

### 5.3 目前落差

- OCR 完成後校對流程仍需要跳離當前區塊
- ~~工作表缺少批次刪除操作~~ **已完成 2026-03-17**（加入「清空全部」按鈕）
- 缺少常用材料模板（依任務類型預設清單）
- 缺少資料新鮮度說明（資料來自使用者截圖，非即時 API）
- ~~初次進入頁面的引導不夠強~~ **已完成 2026-03-17**（加入三步驟快速上手 callout，僅在工作表為空時顯示）
- ~~無法針對收藏頁任務自動生成所需材料清單~~ **已移至製作頁 2026-03-18**（相關任務清單加入「帶入搜尋」按鈕與 rewardSummary 快速搜尋）

### 5.4 重現執行計劃

1. OCR 卡改為原地校對模式（不需捲動離開）
2. ~~工作表批次刪除~~ 已完成
3. 建立繁中服常用材料模板（依老主顧 / 友好部落分類）
4. ~~頁面引導文字~~ 已完成
5. 加入「本站不提供即時市場 API」的資料說明

---

## 6. xiv-tc-treasure-finder（藏寶圖頁）

### 6.1 原始工具特性

cycleapple 的 treasure-finder 是一個藏寶圖協作工具，支援 8 人隊伍的路線規劃與 Firebase 即時同步。

主要特性：

- 各地圖點位資料（本站已作為快照靜態化）
- 地圖預覽
- 多人房間（Firebase Realtime Database）
- 成員指派與路線同步

### 6.2 目前本站已實現

- 單人 / 8 人模式分流
- 各地圖點位資料（快照版）
- 地圖預覽
- 房間建立與加入
- Firebase 即時同步（房號、成員暱稱、路線資料、TTL）
- 路線整理與座標複製

### 6.3 目前落差

- 8 人模式的房間管理面板仍不夠集中（房名、房號、連結、TTL、在線成員分散）
- 路線與成員指派的互動還不直覺
- 地圖預覽與路線清單之間缺少即時高亮同步
- 離線 / 同步失敗時缺少明確的 UX fallback
- 房間過期通知未做
- 手機版 8 人模式資訊過於密集，需要分頁策略

### 6.4 重現執行計劃

1. 整併房間管理面板為單一區塊（含所有元資料與狀態）
2. 地圖預覽與路線清單雙向高亮（點擊點位反映路線、點擊路線高亮地圖）
3. 建立離線偵測與同步失敗 UX（降級為本地模式）
4. 房間 TTL 倒數 / 過期警示
5. 手機版改為分頁（地圖 / 路線 / 成員）

---

## 7. xiv-tc-toolbox（工具箱）

### 7.1 原始工具特性

cycleapple 的 toolbox 是一個外部工具整理入口，收錄各種 FF14 社群工具的連結與說明。

### 7.2 目前本站已實現

- 外部工具連結清單
- 基本分類

### 7.3 目前落差

- ~~缺少「已站內化 / 未站內化」狀態標示~~ **已完成 2026-03-17**（加入 `integrationStatus` 類型系統，四種狀態：`integrated` / `partial` / `reference` / `external`）
- ~~缺少授權邊界摘要卡~~ **已完成 2026-03-17**（`licenseNote` 欄位與 badge 顯示）
- ~~缺少與站內功能的映射關係說明~~ **已完成 2026-03-17**（`internalPath` 欄位，直接顯示站內工具按鈕）

### 7.4 重現執行計劃

1. ~~每個外部工具加入狀態標籤~~ 已完成
2. ~~加入授權 / 來源摘要資訊~~ 已完成
3. ~~明確說明本站工具與原始工具的關係~~ 已完成

---

## 8. 功能落差優先度矩陣

依「對核心使用者價值的影響」排序：

| 優先 | 模組 | 具體落差 | 難度 |
|------|------|----------|------|
| ~~P0~~ | ~~製作頁~~ | ~~缺少 11 技能（含 Specialist）~~ | 已完成 2026-03-17 |
| P0 | 製作頁 | Solver 缺少回溯與評分優化 | 高 |
| P1 | 查價頁 | OCR 原地校對流程 | 中 |
| ~~P1~~ | ~~查價頁~~ | ~~批次刪除 + 新用戶引導~~ | 已完成 2026-03-17 |
| P1 | 藏寶圖頁 | 房間面板整併 | 中 |
| P1 | 收藏頁 | 每日 / 每週 checklist 化（含重置計數） | 中 |
| P2 | 製作頁 | 專家配方 Condition 系統 | 高 |
| P2 | 藏寶圖頁 | 地圖 ↔ 路線高亮同步 | 中 |
| ~~P2~~ | ~~收藏頁~~ | ~~與製作頁串接~~ | 已完成 2026-03-17 |
| P3 | 查價頁 | 常用材料模板 | 低 |
| P3 | 藏寶圖頁 | 離線 fallback UX | 中 |
| P3 | 製作頁 | 每步詳細 Buff 視圖 | 低 |
| ~~P4~~ | ~~工具箱~~ | ~~已站內化 / 未站內化標示~~ | 已完成 2026-03-17 |

---

## 9. 授權邊界與重製聲明

### BestCraft（AGPL-3.0）

AGPL-3.0 要求：若修改後的程式碼在網路上提供服務，需開放源碼。

本站策略：
- 以 TypeScript 重新實作模擬核心，不直接引入 Rust / WASM 編譯結果
- 若未來評估直接使用 BestCraft WASM 模組，需確認整站是否需要以 AGPL 發布
- 目前 `FF14_bestCraft_ZH_TW` 只作為研究參考存於 repo，不部署為本站依賴

### 其他參考工具（未明示授權）

以下工具未在 repo 中明文說明授權：

- `ffxiv-collection-tc`
- `FFXIV Market`
- `xiv-tc-treasure-finder`
- `xiv-tc-toolbox`

本站策略：
- 只研究工作流、資料結構、演算法方向
- 不直接複製 UI 版型、文案、素材
- 所有頁面內的來源區塊明確列出參考站名稱與連結
- 若使用公開資料（如 treasure-finder 的地圖點位快照），需在頁面來源區說明出處

---

## 10. 資料快照策略

部分外部工具依賴執行期解析第三方網站的 JS 資料，本站採快照靜態化策略：

| 資料 | 原始來源 | 本站處理方式 | 更新節奏 |
|------|----------|--------------|----------|
| 藏寶圖點位資料 | cycleapple data.js | 已靜態化為 `finderData.ts` | 版本更新時人工更新 |
| 配方資料 | 手動整理 / XIVAPI | 靜態 TypeScript 資料 | 版本更新時人工更新 |
| 老主顧 / 友好部落清單 | Console Games Wiki / Soktai | 靜態 TypeScript 資料 | 版本更新時人工更新 |
| GATE 時段 | Console Games Wiki | 計算邏輯 + 靜態定義 | 機制變更時更新 |

---

## 11. 與藍圖的對應關係

| 藍圖里程碑 | 本文件對應項目 |
|-----------|---------------|
| Milestone A（基礎收斂） | 工具箱、查價頁引導、全站來源標示 |
| Milestone B（查價 + 藏寶圖成熟化） | 第 5、6 節的 P0–P1 項目 |
| Milestone C（製作深化） | 第 3 節的 P0–P2 項目 |
| Milestone D（功能串接） | 收藏 → 製作、收藏 → 查價 |
| Milestone E（公開成熟化） | 第 9 節授權邊界、來源標示完整化 |

---

## 12. 文件維護規則

- 每當一個功能落差被補齊，對應的表格列狀態應更新
- 新增參考工具時在第 2 節加入新行，並新增對應章節
- 若授權資訊有異動（原始工具更改授權），需立即更新第 9 節並同步 README
- 重現比例（第 2 節）每次里程碑完成時更新
