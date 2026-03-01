import { Link } from 'react-router-dom'

interface HomePageProps {
  appName: string
}

function HomePage({ appName }: HomePageProps) {
  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">FF14 Helper</p>
        <h2>{appName}</h2>
        <p className="lead">
          A browser-first toolkit for backing up FF14 settings, inspecting backup ZIP files,
          searching reference data, and keeping sync preferences locally on the device.
        </p>
        <div className="badge-row">
          <span className="badge">Work in Progress</span>
          <span className="badge badge--positive">No server-side storage</span>
          <span className="badge badge--warning">Best on Windows + Chromium</span>
          <span className="badge">Expandable multi-tool foundation</span>
        </div>
        <div className="callout">
          <span className="callout-title">Project Status</span>
          <span className="callout-body">
            This is an active public project. Core backup features work now, and more FF14 helper
            tools are being added in ongoing updates.
          </span>
        </div>
        <div className="button-row">
          <Link className="button button--primary" to="/backup">
            Start Backup
          </Link>
          <Link className="button button--ghost" to="/restore">
            Inspect a Backup ZIP
          </Link>
          <Link className="button button--ghost" to="/lab">
            Open Helper Lab
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>Backup</h2>
            <p>Create ZIP backups in the browser and optionally upload them to your own cloud.</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>Restore Inspector</h2>
            <p>Open an existing backup ZIP and inspect the manifest before doing a manual restore.</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>Helper Lab</h2>
            <p>Search XIVAPI data and run marketboard math inspired by common FF14 helper sites.</p>
          </div>
        </article>
      </section>
    </div>
  )
}

export default HomePage
