import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { loadRuntimeConfig } from './config/runtime'
import { mainNavItems, secondaryNavItems, siteTagline } from './content/siteCopy'
import { SyncProvider } from './sync/SyncContext'
import type { RuntimeConfig } from './types'
import { getErrorMessage } from './utils/errors'

const AboutPage = lazy(() => import('./pages/AboutPage'))
const BackupPage = lazy(() => import('./pages/BackupPage'))
const CollectionPage = lazy(() => import('./pages/CollectionPage'))
const CraftPage = lazy(() => import('./pages/CraftPage'))
const GoldSaucerPage = lazy(() => import('./pages/GoldSaucerPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const LabPage = lazy(() => import('./pages/LabPage'))
const MarketPage = lazy(() => import('./pages/MarketPage'))
const RestorePage = lazy(() => import('./pages/RestorePage'))
const SyncPage = lazy(() => import('./pages/SyncPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const TreasurePage = lazy(() => import('./pages/TreasurePage'))

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
          <h1>無法載入站點設定</h1>
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
          <p>正在載入網站設定與功能模組。</p>
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
              <p className="eyebrow">FF14 Helper</p>
              <h1>{config.appName}</h1>
              <p className="subtitle">{siteTagline}</p>
            </div>

            <nav aria-label="主導覽" className="site-nav">
              {mainNavItems.map((item) => (
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

            <div aria-label="次要工具" className="site-subnav">
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    isActive ? 'nav-link nav-link--subtle nav-link--active' : 'nav-link nav-link--subtle'
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </header>

          <main className="page-shell">
            <Suspense
              fallback={
                <div className="page-grid">
                  <section className="page-card">
                    <div className="section-heading">
                      <h2>載入中</h2>
                      <p>正在準備頁面內容。</p>
                    </div>
                  </section>
                </div>
              }
            >
              <Routes>
                <Route element={<HomePage appName={config.appName} />} path="/" />
                <Route element={<BackupPage config={config} />} path="/backup" />
                <Route element={<RestorePage />} path="/restore" />
                <Route element={<MarketPage />} path="/market" />
                <Route element={<GoldSaucerPage />} path="/gold-saucer" />
                <Route element={<TreasurePage config={config} />} path="/treasure" />
                <Route element={<CraftPage />} path="/craft" />
                <Route element={<CollectionPage />} path="/collection" />
                <Route element={<ToolsPage />} path="/tools" />
                <Route element={<AboutPage />} path="/about" />
                <Route element={<SyncPage />} path="/sync" />
                <Route element={<LabPage />} path="/lab" />
              </Routes>
            </Suspense>
          </main>
        </div>
      </SyncProvider>
    </HashRouter>
  )
}

export default App
