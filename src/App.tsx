import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { loadRuntimeConfig } from './config/runtime'
import AboutPage from './pages/AboutPage'
import BackupPage from './pages/BackupPage'
import HomePage from './pages/HomePage'
import ToolsPage from './pages/ToolsPage'
import type { RuntimeConfig } from './types'
import { getErrorMessage } from './utils/errors'

const navItems = [
  { label: '首頁', to: '/' },
  { label: '備份助手', to: '/backup' },
  { label: '工具導覽', to: '/tools' },
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
          <p>正在載入網站設定與雲端上傳參數...</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <div className="app-shell">
        <header className="site-header">
          <div className="brand-lockup">
            <p className="eyebrow">Windows 設定備份助手</p>
            <h1>{config.appName}</h1>
            <p className="subtitle">
              在瀏覽器內完成 FF14 個人設定打包，並支援 OneDrive / Google Drive 直傳。
            </p>
          </div>
          <nav className="site-nav" aria-label="主要導覽">
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
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/about" element={<AboutPage config={config} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
