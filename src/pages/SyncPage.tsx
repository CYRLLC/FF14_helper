import { useRef, useState, type ChangeEvent } from 'react'
import { useSync } from '../sync/useSync'
import type { SyncTarget } from '../types'
import { getErrorMessage } from '../utils/errors'
import { formatBytes, formatDateTimeLabel } from '../utils/format'

function targetLabel(target: SyncTarget): string {
  if (target === 'download') {
    return 'Local Download'
  }

  return target === 'onedrive' ? 'OneDrive' : 'Google Drive'
}

function eventLabel(eventType: 'downloaded' | 'uploaded'): string {
  return eventType === 'downloaded' ? 'Downloaded' : 'Uploaded'
}

function SyncPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { syncState, setPreferences, clearHistory, exportProfile, importProfile } = useSync()
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleExport(): void {
    const blob = new Blob([exportProfile()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'ff14-helper-sync-profile.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage('Exported the current sync preferences and recent history to JSON.')
    setErrorMessage(null)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      importProfile(await file.text())
      setMessage('Imported sync preferences into this browser successfully.')
      setErrorMessage(null)
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
      setMessage(null)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>Sync Center</h2>
          <p>
            Sync preferences and recent activity stay in local browser storage. Only backup files
            go to your device or your own cloud target.
          </p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Default sync target</span>
            <select
              className="input-select"
              onChange={(event) => {
                setPreferences({
                  preferredTarget: event.target.value as SyncTarget,
                })
              }}
              value={syncState.preferences.preferredTarget}
            >
              <option value="download">Local Download</option>
              <option value="onedrive">OneDrive</option>
              <option value="gdrive">Google Drive</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Keep this many recent entries</span>
            <select
              className="input-select"
              onChange={(event) => {
                setPreferences({
                  maxHistory: Number(event.target.value),
                })
              }}
              value={syncState.preferences.maxHistory}
            >
              <option value="5">5 entries</option>
              <option value="8">8 entries</option>
              <option value="12">12 entries</option>
              <option value="20">20 entries</option>
            </select>
          </label>
        </div>

        <label className="checkbox-row">
          <input
            checked={syncState.preferences.downloadBeforeCloudUpload}
            onChange={(event) => {
              setPreferences({
                downloadBeforeCloudUpload: event.target.checked,
              })
            }}
            type="checkbox"
          />
          <span>Save a local ZIP before starting any cloud upload</span>
        </label>

        <label className="checkbox-row">
          <input
            checked={syncState.preferences.keepHistory}
            onChange={(event) => {
              setPreferences({
                keepHistory: event.target.checked,
              })
            }}
            type="checkbox"
          />
          <span>Keep recent sync history in browser storage</span>
        </label>

        <div className="button-row">
          <button className="button button--primary" onClick={handleExport} type="button">
            Export Sync Profile
          </button>
          <button
            className="button button--ghost"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Import Sync Profile
          </button>
          <button className="button button--ghost" onClick={clearHistory} type="button">
            Clear Recent History
          </button>
        </div>

        <input
          ref={fileInputRef}
          className="sr-only"
          accept="application/json"
          onChange={(event) => {
            void handleImport(event)
          }}
          type="file"
        />

        {message && (
          <div className="callout callout--success">
            <span className="callout-title">Success</span>
            <span className="callout-body">{message}</span>
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
          <h2>Recent Sync History</h2>
          <p>
            This is a browser-local activity summary only.
            {syncState.importedAt
              ? ` Last imported profile: ${formatDateTimeLabel(syncState.importedAt)}`
              : ''}
          </p>
        </div>

        {syncState.history.length === 0 ? (
          <div className="empty-state">
            <strong>No sync history yet</strong>
            <p>Download or upload a backup from the Backup page and it will appear here.</p>
          </div>
        ) : (
          <div className="history-list">
            {syncState.history.map((entry) => (
              <article key={entry.id} className="history-item">
                <div className="history-item__top">
                  <strong>{entry.fileName}</strong>
                  <span className="badge">{eventLabel(entry.eventType)}</span>
                </div>
                <p className="muted">
                  {formatDateTimeLabel(entry.createdAt)} | {targetLabel(entry.target)} |{' '}
                  {formatBytes(entry.size)}
                </p>
                <p className="muted">
                  Source: {entry.sourceRootName} | Character folders: {entry.characterCount}
                </p>
                {entry.remotePathLabel && <p className="muted">Remote path: {entry.remotePathLabel}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default SyncPage
