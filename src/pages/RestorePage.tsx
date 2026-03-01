import { useState, type ChangeEvent } from 'react'
import { inspectBackupArchive } from '../backup/restore'
import type { RestoreInspection } from '../types'
import { getErrorMessage } from '../utils/errors'
import { formatBytes, formatDateTimeLabel } from '../utils/format'

function RestorePage() {
  const [inspection, setInspection] = useState<RestoreInspection | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBusy(true)
    setErrorMessage(null)

    try {
      const nextInspection = await inspectBackupArchive(file)
      setInspection(nextInspection)
    } catch (error: unknown) {
      setInspection(null)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>Restore Inspector</h2>
          <p>
            Load a backup ZIP and inspect its manifest before restoring anything. This is read-only
            and stays inside the browser.
          </p>
        </div>

        <label className="field">
          <span className="field-label">Backup ZIP file</span>
          <input accept=".zip,application/zip" onChange={(event) => void handleFileChange(event)} type="file" />
        </label>

        {busy && (
          <div className="callout">
            <span className="callout-title">Working</span>
            <span className="callout-body">Inspecting the backup archive...</span>
          </div>
        )}

        {errorMessage && (
          <div className="callout callout--error">
            <span className="callout-title">Error</span>
            <span className="callout-body">{errorMessage}</span>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>Archive Summary</h2>
          <p>
            This helps confirm what was included in the backup, so users can restore with fewer
            surprises.
          </p>
        </div>

        {!inspection ? (
          <div className="empty-state">
            <strong>No archive loaded yet</strong>
            <p>Select a ZIP file from this site&apos;s backup flow to inspect it.</p>
          </div>
        ) : (
          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">File</div>
                <div className="stat-value">{inspection.fileName}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">Size</div>
                <div className="stat-value">{formatBytes(inspection.size)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">Entries</div>
                <div className="stat-value">{inspection.entries.length}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">Manifest</div>
                <div className="stat-value">{inspection.manifest ? 'Detected' : 'Missing'}</div>
              </article>
            </div>

            {inspection.manifest ? (
              <div className="list-panel">
                <p className="callout-title">Manifest</p>
                <p className="muted">
                  Created: {formatDateTimeLabel(inspection.manifest.createdAt)} | Source:{' '}
                  {inspection.manifest.sourceRootName}
                </p>
                <p className="muted">
                  Characters: {inspection.manifest.characterCount} | Version:{' '}
                  {inspection.manifest.version}
                </p>
              </div>
            ) : (
              <div className="callout callout--error">
                <span className="callout-title">Manifest Missing</span>
                <span className="callout-body">
                  This ZIP can still be opened, but it does not contain a valid
                  `backup-manifest.json`.
                </span>
              </div>
            )}

            <div className="list-panel">
              <p className="callout-title">Archive Entries</p>
              <ul>
                {inspection.entries.map((entry) => (
                  <li key={entry}>
                    <code>{entry}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default RestorePage
