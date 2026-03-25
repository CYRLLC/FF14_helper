# OCR 精準度調查筆記

更新日期：2026-03-25

## 1. 結論先講

參考站的 OCR 看起來很準，不是因為它單純換了一個更神的 OCR 引擎，而是因為它把下面幾層一起做了：

1. 專門針對 FF14 繁中截圖的影像前處理。
2. 先偵測文字區域再裁切，避免把整張圖都丟進 OCR。
3. 以「全台版道具名稱資料庫」作為 whitelist 與搜尋修正來源。
4. OCR 後不是直接相信 raw text，而是走一整條候選比對與排序流程。
5. UI 會保留 OCR 排序結果，而不是再被一般搜尋排序洗掉。

更關鍵的是：參考站目前主力 OCR 是「截圖搜尋道具名稱」，不是把市場板整張多欄位畫面直接精準拆成「品名 + 單價 + 數量」的結構化資料。  
這點和本站目前的市場板匯入場景不同，不能直接拿來一比一套用。

## 2. 參考站實際怎麼做

參考來源：

- `src/components/OCRButton.tsx`
- `src/utils/ocr/ocrCore.ts`
- `src/utils/ocr/imageUtils.ts`
- `src/utils/ocr/tesseractConfig.ts`
- `src/utils/ocr/whitelist.ts`
- `src/services/itemDatabase.js`
- `src/services/itemsDatabaseMsgpack.js`
- `src/services/gameData.js`

Repo:

- <https://github.com/beherw/FFXIV_Market>

### 2.1 它的 OCR 入口其實是「搜尋 OCR」

`SearchBar.jsx` 內的 `OCRButton` 只是把辨識到的文字回傳給搜尋列，接著交給 `searchItemsOCR()` 做後處理。  
也就是說，它不是在 OCR 階段就決定最終品名，而是把 OCR 當成候選輸入。

### 2.2 它有一套專門給繁中 FF14 的 Tesseract 設定

`src/utils/ocr/config.ts` 的預設值很激進：

- `imageScale: 8`
- `maxImageDimension: 3000`
- `enableAdvancedProcessing: true`
- `enableAutoThreshold: true`
- `invertForLightText: true`
- `useItemtwWhitelist: true`
- `enableAutoTextDetection: true`
- `enableMorphologyClose: true`
- `morphologyCloseKernelSize: 3`
- `sharpenStrength: 'strong'`

這代表它預設就把圖放大很多，再做強化、裁切、閉運算與銳化，不是失敗了才補救。

### 2.3 它先抓文字區域，不讓背景干擾整張圖

`ocrCore.ts` 的 `detectTextRegion()` 會先用 Tesseract 跑一次文字區域偵測，再依 bounding box 算出要裁切的區塊，之後真正 OCR 才吃裁切後的圖片。

這對 FF14 截圖很重要，因為 UI 邊框、背景紋理、黑邊與圖示都會干擾辨識。

### 2.4 它的前處理比我們現在完整很多

`imageUtils.ts` 裡不是只有灰階 + Otsu，而是整條管線：

- 灰階化
- 對比度增強
- 深底淺字偵測與反相
- 雙邊濾波
- 去網格線
- 中值濾波
- 強銳化
- Otsu 自動閾值
- 形態學開運算
- 形態學閉運算
- 黑邊裁切

這一套是為了把 FF14 常見的暗底、發光字、背景紋理、細筆畫繁中字，盡量壓成 OCR 比較好吃的黑白字形。

### 2.5 它不是只靠 `chi_tra`，還把全道具名稱變成 whitelist

`whitelist.ts` 會從 `tw-items.msgpack` 讀出台版全道具名稱，建立：

- 字元集合
- bigram 集合
- trigram 集合

其中字元集合會直接拿去當 Tesseract `tessedit_char_whitelist`，bigram / trigram 則用在後續驗證與相似度計算。

也就是說，它在辨識之前就已經縮小「合理字元空間」，不是任由 OCR 在整個字集裡亂猜。

### 2.6 真正的精準度核心在 `searchItemsOCR()`

`src/services/itemDatabase.js` 的 `searchItemsOCR()` 才是關鍵。它不是拿到 OCR 結果就結束，而是走分層 fallback：

1. 先做 `normalizeOCRText()`
2. exact / substring match
3. 有空白時，做保序 fuzzy match
4. substring recall
5. n-gram fuzzy search

其中 `normalizeOCRText()` 會：

- 去掉 `.` `,` `-` `_`
- 去掉所有空白
- 視情況把簡中轉回繁中

這一步會把 OCR 常見的「字被切開」「中間夾空白」「標點被誤插入」先收斂。

### 2.7 它的 fuzzy search 不是一般 levenshtein 而已

`calcOcrFriendlySimilarity()` 不是只看 edit distance，而是混合多種分數：

- `orderFirstScore`
- `consecutiveRunScore`
- `ngramOverlapScore`
- `levenshteinDistance`
- `positionMatchScore`

權重大致是：

- order: 0.45
- consecutive run: 0.15
- n-gram: 0.20
- edit distance: 0.15
- position: 0.05

這組合非常符合 OCR 場景，因為 OCR 常見不是整串完全亂掉，而是：

- 少幾個字
- 某些字錯
- 字序大致正確
- 某幾段連續字是對的

### 2.8 它還會把 OCR 信心度往後傳，影響搜尋分數

`OCRButton.tsx` 會把：

- `ocrWords`
- `ocrConfidence`

一起傳給 `searchItemsOCR()`。

`buildCharWeightsFromOcrWords()` 會把低信心字的權重壓低，讓排序更偏向相信高信心字。  
也就是說，它不是只有「辨識文字」，還有「辨識可信度」參與排名。

### 2.9 它保留 OCR 排序結果

`App.jsx` 內有 `isOCRSearchResult`。  
OCR 搜尋結果會保留 OCR ranking，不再套一般的 item level 排序。這點很重要，否則再好的 OCR candidate ranking 都會被 UI 排序洗掉。

## 3. 和本站目前的差距

本站目前相關實作：

- [src/api/paddleOcr.ts](/D:/FF14_helper/src/api/paddleOcr.ts)
- [src/tools/marketOcr.ts](/D:/FF14_helper/src/tools/marketOcr.ts)
- [src/pages/MarketPage.tsx](/D:/FF14_helper/src/pages/MarketPage.tsx)

### 3.1 我們有 PaddleOCR，但後處理仍然偏薄

目前 [src/api/paddleOcr.ts](/D:/FF14_helper/src/api/paddleOcr.ts#L127) 的前處理主要是：

- 判斷暗底
- 必要時反相
- 對比增強

Paddle market 模式雖然已經比純 Tesseract 好，還能靠 bounding box 分行 [src/api/paddleOcr.ts](/D:/FF14_helper/src/api/paddleOcr.ts#L188)，但它仍然缺少參考站那種：

- auto text region crop
- 去網格
- morphology close
- OCR confidence 驅動的候選修正
- 本地 item whitelist 搜尋修正

### 3.2 我們的 Tesseract fallback 很簡單

[src/pages/MarketPage.tsx](/D:/FF14_helper/src/pages/MarketPage.tsx#L301) 的 `preprocessImageForOcr()` 目前是：

- 小圖 2x 放大
- 灰階
- 深色判斷與反相
- 對比
- Laplacian 銳化
- Otsu 二值化

相較參考站：

- 放大倍數低很多
- 沒有 auto crop
- 沒有 bilateral / median / remove grid lines
- 沒有 morphology open / close
- 沒有 whitelist
- 沒有調整過的 Tesseract runtime params

### 3.3 我們現在的名稱修正過弱

[src/pages/MarketPage.tsx](/D:/FF14_helper/src/pages/MarketPage.tsx#L844) 的 `autoVerifyOcrNames()` 是逐列丟 XIVAPI 搜尋，拿第一筆結果，如果字元重疊率大於 0.5 才修正。

這和參考站的差距很大：

- 我們只看第一筆結果
- 沒有完整候選排序
- 沒有 OCR 專用 similarity score
- 沒有 substring recall
- 沒有 n-gram fallback
- 沒有 char confidence weighting
- 沒有本地全道具 whitelist

### 3.4 我們的市場板 OCR 跟參考站其實不是同一道題

目前市場板匯入 [src/pages/MarketPage.tsx](/D:/FF14_helper/src/pages/MarketPage.tsx#L757) 要讀的是：

- 品名
- 價格
- 數量

而且畫面還有：

- 稀有度星號
- 道具 icon
- 裝備圖示
- 持有數量
- 右側欄位

參考站主力 OCR 是「從截圖找道具名稱」，不是把市場板整列精準結構化。  
所以你現在看到的錯誤 raw text，很多不是因為我們 OCR 引擎太差，而是因為我們在做一個更難的任務。

## 4. 這張截圖為什麼會爛成那樣

從你提供的畫面來看，OCR raw text 混進了：

- icon 誤判
- 數字欄位
- 右側持有數量欄位
- 稀有度星號
- 非品名字元

目前流程如果沒把欄位拆開，OCR 會把整列當一個雜訊很多的區域去猜，接著再用 regex 從混亂文字裡反推。  
這在市場板畫面特別吃虧。

反過來說，參考站之所以看起來很穩，是因為它盡量只處理「物品名稱」這件事，然後把剩下的容錯交給 whitelist search。

## 5. 建議的實作順序

### P0：先補資料層

建立本地全道具名稱索引：

- `public/market/items.tw.msgpack`
- 或 `public/market/items.tw.json`

至少要能提供：

- item id
- 繁中名
- 可交易與否

沒有這層，就無法把參考站那套 OCR correction 真正搬進來。

### P0：把 OCR 分成兩種模式

1. 搜尋 OCR
2. 市場板 OCR

搜尋 OCR 可以直接參考對方：

- 只讀名稱
- OCR 後交給 whitelist search ranking

市場板 OCR 則要走另一套：

- 分欄裁切
- 名稱欄 OCR
- 價格欄 OCR
- 數量欄 OCR

不要再讓整列一起讀。

### P0：把名稱驗證從「第一筆 XIVAPI」升級成「候選排序」

把現在的 [autoVerifyOcrNames()](/D:/FF14_helper/src/pages/MarketPage.tsx#L844) 改成：

- exact
- 保序 fuzzy
- substring recall
- n-gram fuzzy
- top 3 候選提示

而不是只取第一筆 search result。

### P1：補進 auto crop 與 morphology

優先補：

- auto text region detection
- black border crop
- morphology close
- bilateral / median denoise
- grid line removal

這會先拉高 fallback Tesseract 的底線。

### P1：市場板畫面做欄位導向 OCR

針對市場板 row，至少要拆成：

- 左側名稱區
- 右側價格區
- 最右數量區

名稱區可以套 whitelist search。  
數字區則應該用數字專用 OCR 或更嚴格的數字 regex，不要和名稱一起讀。

## 6. 實際判斷

如果目標是「讓本站 OCR 體感接近參考站」：

- 對搜尋 OCR：可直接借鏡，成功率會明顯提升。
- 對市場板 OCR：不能直接照搬，因為題目更難，必須加上分欄與結構化解析。

換句話說，真正該抄的不是單一 OCR library，而是：

- whitelist
- normalization
- candidate ranking
- fallback ladder
- preserve OCR order

這幾層才是精準度來源。
