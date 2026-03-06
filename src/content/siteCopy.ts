export const mainNavItems = [
  { label: '首頁', to: '/' },
  { label: '備份', to: '/backup' },
  { label: '查價', to: '/market' },
  { label: '金碟', to: '/gold-saucer' },
  { label: '藏寶圖', to: '/treasure' },
  { label: '製作', to: '/craft' },
  { label: '收藏', to: '/collection' },
  { label: '工具箱', to: '/tools' },
  { label: '關於', to: '/about' },
] as const

export const secondaryNavItems = [
  { label: '還原檢查', to: '/restore' },
  { label: '同步中心', to: '/sync' },
  { label: '實驗室', to: '/lab' },
] as const

export const siteTagline =
  '以台灣玩家常用流程為核心的 FF14 前端工具站，涵蓋設定備份、查價、金碟、藏寶圖、製作與收藏追蹤。'

export const workInProgressLabel =
  '本站為持續開發中的公開專案，功能可用但仍會持續調整文案、流程與介面細節。'
