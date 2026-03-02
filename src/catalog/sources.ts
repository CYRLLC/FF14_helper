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
        note: '國際市場資料網站。本站目前不直接拿它做繁中服價格，但保留作工具導覽與後續功能參考。',
      },
      {
        id: 'tools-teamcraft',
        name: 'FFXIV Teamcraft',
        url: 'https://ffxivteamcraft.com/',
        category: 'inspiration',
        note: '大型製作與清單管理工具，適合作為未來站內整合流程的參考。',
      },
      {
        id: 'tools-garland',
        name: 'Garland Tools',
        url: 'https://garlandtools.org/',
        category: 'inspiration',
        note: '資料整理與查詢架構完整，適合作為站內資料工具的設計靈感。',
      },
      {
        id: 'tools-xivapi',
        name: 'XIVAPI Docs',
        url: 'https://v2.xivapi.com/docs',
        category: 'data',
        note: '公開 API 文件來源，供站內查詢與地圖資源顯示使用。',
      },
      {
        id: 'tools-market-ref',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '本站雙服比價工作表主要參考其繁中服使用情境，改用本站自己的互動方式重做。',
      },
      {
        id: 'tools-toolbox-ref',
        name: 'xiv-tc-toolbox (cycleapple)',
        url: 'https://cycleapple.github.io/xiv-tc-toolbox/',
        category: 'inspiration',
        note: '繁中玩家常用工具箱，金碟與藏寶圖頁的整體方向有參考其整理方式。',
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
        note: '金碟小工具的方向參考。本站的活動預測為站內啟發式推估，不是官方輪替資料。',
      },
    ],
  },
  market: {
    pageId: 'market',
    title: '雙服比價來源說明',
    entries: [
      {
        id: 'market-ref-beherw',
        name: 'FFXIV Market (beherw)',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'inspiration',
        note: '本站查價頁參考其繁中服比價工作流，改成多項目清單與站內試算。',
      },
      {
        id: 'market-manual',
        name: '使用者手動輸入',
        url: 'https://beherw.github.io/FFXIV_Market/',
        category: 'data',
        note: '本站目前不宣稱提供即時繁中服價格 API，價格由使用者自行整理並儲存在瀏覽器。',
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
        note: '本站藏寶圖頁參考其等級切換、地圖切換與組隊規劃方向；原站有即時隊伍功能，本站則改成不經本站伺服器的分享連結入隊流程。',
      },
      {
        id: 'treasure-data-cycleapple',
        name: 'cycleapple treasure data.js',
        url: 'https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js',
        category: 'data',
        note: '本站完整寶圖資料來源，包含目前公開的寶圖等級、地圖與點位座標。',
      },
      {
        id: 'treasure-data-xivapi',
        name: 'XIVAPI',
        url: 'https://xivapi.com/',
        category: 'data',
        note: '本站地圖圖片使用 XIVAPI 公開資源。',
      },
      {
        id: 'treasure-data-formula',
        name: 'XIVAPI MapCoordinates.md',
        url: 'https://github.com/xivapi/ffxiv-datamining/blob/master/docs/MapCoordinates.md',
        category: 'data',
        note: '遊戲座標換算成地圖百分比位置的公式參考來源。',
      },
    ],
  },
}
