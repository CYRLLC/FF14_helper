import type { PageSourceBundle } from '../types'

export const pageSources: Record<string, PageSourceBundle> = {
  tools: {
    pageId: 'tools',
    title: '站內參考與外部工具',
    entries: [
      {
        id: 'tools-universalis',
        name: 'Universalis',
        url: 'https://universalis.app/',
        category: 'data',
        note: '國際市場資料網站。本站目前不直接用它做繁中服價格，而是保留作社群工具導覽。',
      },
      {
        id: 'tools-teamcraft',
        name: 'FFXIV Teamcraft',
        url: 'https://ffxivteamcraft.com/',
        category: 'inspiration',
        note: '大型製作與清單管理工具，作為未來站內整理與流程設計的參考。',
      },
      {
        id: 'tools-garland',
        name: 'Garland Tools',
        url: 'https://garlandtools.org/',
        category: 'inspiration',
        note: '資料庫與查詢站的整理方式值得參考，本站會以自己的版面重新實作需要的功能。',
      },
      {
        id: 'tools-xivapi',
        name: 'XIVAPI Docs',
        url: 'https://v2.xivapi.com/docs',
        category: 'data',
        note: '公開 API 文件來源，供站內查詢與地圖顯示邏輯參考。',
      },
      {
        id: 'tools-market-ref',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '繁中服查價工作流的主要參考來源，本站改做成繁中服雙服比價與試算工具。',
      },
      {
        id: 'tools-toolbox-ref',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '繁中玩家工具箱集合頁，本站的金碟與藏寶圖頁都有參考其功能方向。',
      },
    ],
  },
  goldSaucer: {
    pageId: 'goldSaucer',
    title: '金碟遊樂園來源說明',
    entries: [
      {
        id: 'gold-gate-wiki',
        name: 'Console Games Wiki: Gold Saucer Active Time Events',
        url: 'https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Time_Events',
        category: 'data',
        note: 'GATE 每小時 :00 / :20 / :40 的時段規則參考來源。',
      },
      {
        id: 'gold-toolbox',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '金碟工具的功能方向參考。本站的活動預測是站內自訂啟發式推估，不是官方輪替資料。',
      },
    ],
  },
  market: {
    pageId: 'market',
    title: '繁中服查價來源說明',
    entries: [
      {
        id: 'market-ref-beherw',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '本站繁中服查價頁以其工作流為靈感，但改成站內手動輸入比價與試算。',
      },
      {
        id: 'market-manual',
        name: 'Manual user input',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'data',
        note: '本頁價格資料由使用者自行輸入，本站不宣稱提供即時繁中服公開價格 API。',
      },
    ],
  },
  treasure: {
    pageId: 'treasure',
    title: '藏寶圖來源說明',
    entries: [
      {
        id: 'treasure-toolbox',
        name: 'xiv-tc-treasure-finder (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-treasure-finder/',
        category: 'inspiration',
        note: '本站藏寶圖頁參考其等級切換、地圖切換與標記顯示流程，改用本站自己的介面重新實作。',
      },
      {
        id: 'treasure-data-cycleapple',
        name: 'cycleapple treasure data.js',
        url: 'https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js',
        category: 'data',
        note: 'Dawntrail 地圖 ID、地點與藏寶點座標資料的主要參考來源。',
      },
      {
        id: 'treasure-data-xivapi',
        name: 'XIVAPI',
        url: 'https://xivapi.com/',
        category: 'data',
        note: '本頁的地圖圖片使用 XIVAPI 公開地圖資源。',
      },
      {
        id: 'treasure-data-formula',
        name: 'XIVAPI MapCoordinates.md',
        url: 'https://github.com/xivapi/ffxiv-datamining/blob/master/docs/MapCoordinates.md',
        category: 'data',
        note: '遊戲座標換算到地圖百分比位置的公式參考來源。',
      },
    ],
  },
}
