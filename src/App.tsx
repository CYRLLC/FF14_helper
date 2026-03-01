import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { loadRuntimeConfig } from './config/runtime'
import AboutPage from './pages/AboutPage'
import BackupPage from './pages/BackupPage'
import HomePage from './pages/HomePage'
import LabPage from './pages/LabPage'
import RestorePage from './pages/RestorePage'
import SyncPage from './pages/SyncPage'
import ToolsPage from './pages/ToolsPage'
import { SyncProvider } from './sync/SyncContext'
import type { RuntimeConfig } from './types'
import { getErrorMessage } from './utils/errors'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Backup', to: '/backup' },
  { label: 'Restore', to: '/restore' },
  { label: 'Lab', to: '/lab' },
  { label: 'Sync', to: '/sync' },
  { label: 'Tools', to: '/tools' },
  { label: 'About', to: '/about' },
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
          <h1>Unable to load site configuration</h1>
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
          <p>Loading runtime settings and cloud provider configuration...</p>
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
                Backup, inspect, search, and sync from the browser without site-side storage.
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
