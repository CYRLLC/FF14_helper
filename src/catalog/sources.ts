import type { PageSourceBundle } from '../types'

export const pageSources: Record<string, PageSourceBundle> = {
  tools: {
    pageId: 'tools',
    title: '外部工具來源',
    entries: [
      {
        id: 'tools-universalis',
        name: 'Universalis',
        url: 'https://universalis.app/',
        category: 'data',
        note: '常見的 FFXIV 市場資料來源，本站工具頁保留為外部參考連結。',
      },
      {
        id: 'tools-teamcraft',
        name: 'FFXIV Teamcraft',
        url: 'https://ffxivteamcraft.com/',
        category: 'inspiration',
        note: '提供製作、清單與配裝等功能方向的長期參考。',
      },
      {
        id: 'tools-garland',
        name: 'Garland Tools',
        url: 'https://garlandtools.org/',
        category: 'inspiration',
        note: '資料整合與工具導覽的老牌參考站。',
      },
      {
        id: 'tools-xivapi',
        name: 'XIVAPI Docs',
        url: 'https://v2.xivapi.com/docs',
        category: 'data',
        note: 'XIVAPI 官方文件，供站內資料查詢功能參考。',
      },
      {
        id: 'tools-market-ref',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '本站查價頁參考其繁中服工作流、最近更新區塊與 OCR 截圖辨識方向。',
      },
      {
        id: 'tools-toolbox-ref',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '整體 FF14 工具集設計方向的參考來源之一。',
      },
    ],
  },
  goldSaucer: {
    pageId: 'goldSaucer',
    title: '金碟參考來源',
    entries: [
      {
        id: 'gold-gate-wiki',
        name: 'Console Games Wiki: Gold Saucer Active Time Events',
        url: 'https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Time_Events',
        category: 'data',
        note: 'GATE 時段規則的公開資料參考，本站依此整理整點、20 分與 40 分輪替。',
      },
      {
        id: 'gold-toolbox',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '金碟與時間工具的介面方向參考。',
      },
    ],
  },
  market: {
    pageId: 'market',
    title: '查價參考來源',
    entries: [
      {
        id: 'market-ref-beherw',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '本站查價頁參考其繁中服工作流程、最近更新卡片、拖放或貼上圖片進行 OCR 的設計方向。',
      },
      {
        id: 'market-tesseract',
        name: 'Tesseract.js',
        url: 'https://github.com/naptha/tesseract.js',
        category: 'data',
        note: '本站截圖查價使用的 OCR 套件。',
      },
    ],
  },
  treasure: {
    pageId: 'treasure',
    title: '藏寶圖參考來源',
    entries: [
      {
        id: 'treasure-toolbox',
        name: 'xiv-tc-treasure-finder (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-treasure-finder/',
        category: 'inspiration',
        note: '本站藏寶圖頁參考其等級切換、地圖切換、組隊規劃與即時同步的操作方向。',
      },
      {
        id: 'treasure-data-cycleapple',
        name: 'cycleapple treasure data.js',
        url: 'https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js',
        category: 'data',
        note: '本站完整寶圖等級、地圖與點位資料的主要公開來源。',
      },
      {
        id: 'treasure-firebase-ref',
        name: 'cycleapple firebase-config.js',
        url: 'https://cycleapple.github.io/xiv-tc-treasure-finder/js/party/firebase-config.js',
        category: 'data',
        note: '本站即時隊伍同步參考其 Firebase Realtime Database 的整體作法。',
      },
      {
        id: 'treasure-data-xivapi',
        name: 'XIVAPI',
        url: 'https://xivapi.com/',
        category: 'data',
        note: '本站地圖與圖示相關資料也會參考 XIVAPI。',
      },
      {
        id: 'treasure-data-formula',
        name: 'XIVAPI MapCoordinates.md',
        url: 'https://github.com/xivapi/ffxiv-datamining/blob/master/docs/MapCoordinates.md',
        category: 'data',
        note: '座標換算公式參考來源。',
      },
    ],
  },
}
