import type { ToolDirectoryEntry } from '../types'

export const toolDirectory: ToolDirectoryEntry[] = [
  {
    id: 'universalis',
    name: 'Universalis',
    category: '市場查價',
    description: '跨資料中心與世界市場板價格查詢，是後續價格助手最值得參考的資料來源。',
    url: 'https://universalis.app/',
    futureIntegration: true,
  },
  {
    id: 'teamcraft',
    name: 'FFXIV Teamcraft',
    category: '製作與清單管理',
    description: '從清單規劃到採集排程都很成熟，適合做功能分流而不是重新造輪子。',
    url: 'https://ffxivteamcraft.com/',
    futureIntegration: false,
  },
  {
    id: 'garland-tools',
    name: 'Garland Tools',
    category: '道具 / 任務資料庫',
    description: '老牌資料庫工具，對資料探索與查找關聯內容仍很有參考價值。',
    url: 'https://garlandtools.org/',
    futureIntegration: true,
  },
  {
    id: 'xivapi',
    name: 'XIVAPI',
    category: '資料 API',
    description: '未來若要內建道具查詢或百科功能，這會是首要評估的 API 來源。',
    url: 'https://v2.xivapi.com/docs',
    futureIntegration: true,
  },
  {
    id: 'gate-placeholder',
    name: 'Gold Saucer / GATE 參考工具',
    category: '其他預留',
    description: 'v1 先保留規劃欄位，後續可做時間窗、活動說明與外部參考整理。',
    url: 'https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Help_Events',
    futureIntegration: true,
  },
]
