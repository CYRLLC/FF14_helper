import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { loadRuntimeConfig } from './config/runtime'
import AboutPage from './pages/AboutPage'
import BackupPage from './pages/BackupPage'
import GoldSaucerPage from './pages/GoldSaucerPage'
import HomePage from './pages/HomePage'
import LabPage from './pages/LabPage'
import MarketPage from './pages/MarketPage'
import RestorePage from './pages/RestorePage'
import SyncPage from './pages/SyncPage'
import ToolsPage from './pages/ToolsPage'
import TreasurePage from './pages/TreasurePage'
import { SyncProvider } from './sync/SyncContext'
import type { RuntimeConfig } from './types'
import { getErrorMessage } from './utils/errors'

const navItems = [
  { label: '首頁', to: '/' },
  { label: '備份', to: '/backup' },
  { label: '還原檢查', to: '/restore' },
  { label: '金碟', to: '/gold-saucer' },
  { label: '查價', to: '/market' },
  { label: '藏寶圖', to: '/treasure' },
  { label: 'Lab', to: '/lab' },
  { label: '同步', to: '/sync' },
  { label: '工具', to: '/tools' },
  { label: '關於', to: '/about' },
]

function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadRuntimeConfig()
      .then((nextConfig) => {
        if (!cancelled) {
          setConfig(nextConfig)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) {
    return (
        <div className="app-shell">
          <div className="status-panel status-panel--error">
            <h1>無法載入網站設定</h1>
            <p>{loadError}</p>
          </div>
        </div>
      )
  }

  if (!config) {
    return (
        <div className="app-shell">
          <div className="status-panel">
            <h1>FF14 Helper</h1>
            <p>正在載入執行期設定與雲端服務資訊...</p>
          </div>
        </div>
      )
  }

  return (
    <HashRouter>
      <SyncProvider>
        <div className="app-shell">
          <header className="site-header">
            <div className="brand-lockup">
              <p className="eyebrow">Browser-only FF14 Helper</p>
              <h1>{config.appName}</h1>
              <p className="subtitle">
                盡量在瀏覽器內完成備份、檢查、查詢與同步，不把資料存到本站伺服器。
              </p>
            </div>
            <nav className="site-nav" aria-label="Primary navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    isActive ? 'nav-link nav-link--active' : 'nav-link'
                  }
                  end={item.to === '/'}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="page-shell">
            <Routes>
              <Route path="/" element={<HomePage appName={config.appName} />} />
              <Route path="/backup" element={<BackupPage config={config} />} />
              <Route path="/restore" element={<RestorePage />} />
              <Route path="/gold-saucer" element={<GoldSaucerPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/treasure" element={<TreasurePage />} />
              <Route path="/lab" element={<LabPage />} />
              <Route path="/sync" element={<SyncPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/about" element={<AboutPage config={config} />} />
            </Routes>
          </main>
        </div>
      </SyncProvider>
    </HashRouter>
  )
}

export default App
