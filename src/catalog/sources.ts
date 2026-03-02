import type { PageSourceBundle } from '../types'

export const pageSources: Record<string, PageSourceBundle> = {
  tools: {
    pageId: 'tools',
    title: '整體參考站點',
    entries: [
      {
        id: 'tools-universalis',
        name: 'Universalis',
        url: 'https://universalis.app/',
        category: 'data',
        note: '提供市場資料 API 與市場板資訊，是本站查價功能的主要資料來源。',
      },
      {
        id: 'tools-teamcraft',
        name: 'FFXIV Teamcraft',
        url: 'https://ffxivteamcraft.com/',
        category: 'inspiration',
        note: '作為多工具整合站的產品參考，本站僅擷取適合靜態網站的方向。',
      },
      {
        id: 'tools-garland',
        name: 'Garland Tools',
        url: 'https://garlandtools.org/',
        category: 'inspiration',
        note: '作為資料查詢與工具整合的參考來源，不直接複製內容或介面。',
      },
      {
        id: 'tools-xivapi',
        name: 'XIVAPI Docs',
        url: 'https://v2.xivapi.com/docs',
        category: 'data',
        note: '本站的資料搜尋使用 XIVAPI 公開搜尋 API。',
      },
      {
        id: 'tools-market-ref',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '查價頁互動流程與資訊密度參考來源之一。',
      },
      {
        id: 'tools-toolbox-ref',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '金碟與藏寶圖等輔助工具的功能切分參考來源之一。',
      },
    ],
  },
  goldSaucer: {
    pageId: 'goldSaucer',
    title: '金碟遊樂園頁',
    entries: [
      {
        id: 'gold-gate-wiki',
        name: 'Console Games Wiki: Gold Saucer Active Time Events',
        url: 'https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Time_Events',
        category: 'data',
        note: 'GATE 時段規則與活動說明的公開參考來源。',
      },
      {
        id: 'gold-toolbox',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '金碟工具整合方式與實用導向的介面參考來源。',
      },
    ],
  },
  market: {
    pageId: 'market',
    title: '查價頁',
    entries: [
      {
        id: 'market-universalis',
        name: 'Universalis',
        url: 'https://universalis.app/',
        category: 'data',
        note: '市場價格、近期成交與上架資料的主要公開 API 來源。',
      },
      {
        id: 'market-xivapi-search',
        name: 'XIVAPI Search Guide',
        url: 'https://v2.xivapi.com/docs/guides/search/',
        category: 'data',
        note: '用於先搜尋道具，再以 itemId 向 Universalis 取價。',
      },
      {
        id: 'market-ref-beherw',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '查價體驗、重點資訊呈現與操作節奏的參考來源之一。',
      },
    ],
  },
  treasure: {
    pageId: 'treasure',
    title: '藏寶圖座標頁',
    entries: [
      {
        id: 'treasure-toolbox',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '藏寶圖輔助工具的功能方向與使用情境參考來源之一。',
      },
      {
        id: 'treasure-xivapi',
        name: 'XIVAPI Docs',
        url: 'https://v2.xivapi.com/docs',
        category: 'data',
        note: '後續若擴充地圖或道具查詢，可延伸使用的公開資料來源。',
      },
    ],
  },
}
