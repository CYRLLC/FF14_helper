import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { loadRuntimeConfig } from './config/runtime'
import { SyncProvider } from './sync/SyncContext'
import type { RuntimeConfig } from './types'
import { getErrorMessage } from './utils/errors'

const AboutPage = lazy(() => import('./pages/AboutPage'))
const BackupPage = lazy(() => import('./pages/BackupPage'))
const GoldSaucerPage = lazy(() => import('./pages/GoldSaucerPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const LabPage = lazy(() => import('./pages/LabPage'))
const MarketPage = lazy(() => import('./pages/MarketPage'))
const RestorePage = lazy(() => import('./pages/RestorePage'))
const SyncPage = lazy(() => import('./pages/SyncPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const TreasurePage = lazy(() => import('./pages/TreasurePage'))

const navItems = [
  { label: '首頁', to: '/' },
  { label: '備份', to: '/backup' },
  { label: '還原檢查', to: '/restore' },
  { label: '金碟', to: '/gold-saucer' },
  { label: '查價', to: '/market' },
  { label: '藏寶圖', to: '/treasure' },
  { label: '實驗區', to: '/lab' },
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
          <h1>設定載入失敗</h1>
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
          <p>正在載入站台設定與可用功能。</p>
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
              <p className="eyebrow">FF14 網頁助手</p>
              <h1>{config.appName}</h1>
              <p className="subtitle">
                以純前端方式整理備份、查價、金碟時程與藏寶圖工具。需要第三方資料或同步服務時，
                會直接在頁面中標示來源與設定需求。
              </p>
            </div>
            <nav className="site-nav" aria-label="主導覽">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
                  end={item.to === '/'}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="page-shell">
            <Suspense
              fallback={
                <div className="page-grid">
                  <section className="page-card">
                    <div className="section-heading">
                      <h2>載入頁面中</h2>
                      <p>正在整理你要打開的功能頁。</p>
                    </div>
                  </section>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<HomePage appName={config.appName} />} />
                <Route path="/backup" element={<BackupPage config={config} />} />
                <Route path="/restore" element={<RestorePage />} />
                <Route path="/gold-saucer" element={<GoldSaucerPage />} />
                <Route path="/market" element={<MarketPage />} />
                <Route path="/treasure" element={<TreasurePage config={config} />} />
                <Route path="/lab" element={<LabPage />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/about" element={<AboutPage config={config} />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </SyncProvider>
    </HashRouter>
  )
}

export default App
