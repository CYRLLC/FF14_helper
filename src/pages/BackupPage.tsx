import { useEffect, useRef, useState } from 'react'
import { createBackupArtifact, triggerArtifactDownload } from '../backup/archive'
import {
  canUseDirectoryPicker,
  parseDirectoryInput,
  pickDirectoryWithNativePicker,
} from '../backup/fileSources'
import { scanSelectedEntries } from '../backup/scan'
import { createGoogleDriveAdapter } from '../cloud/gdrive'
import { createOneDriveAdapter } from '../cloud/onedrive'
import type {
  BackupArtifact,
  BackupSourceSelection,
  CloudProviderId,
  CloudUploadResult,
  LocalFileEntry,
  RuntimeConfig,
} from '../types'
import { getErrorMessage } from '../utils/errors'
import { formatBytes, formatDateTimeLabel } from '../utils/format'

interface BackupPageProps {
  config: RuntimeConfig
}

function providerLabel(provider: CloudProviderId): string {
  return provider === 'onedrive' ? 'OneDrive' : 'Google Drive'
}

function BackupPage({ config }: BackupPageProps) {
  const fallbackInputRef = useRef<HTMLInputElement>(null)
  const [selection, setSelection] = useState<BackupSourceSelection | null>(null)
  const [artifact, setArtifact] = useState<BackupArtifact | null>(null)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<CloudUploadResult | null>(null)
  const [sourceMethod, setSourceMethod] = useState<'native' | 'fallback' | null>(null)
  const nativePickerSupported = canUseDirectoryPicker()

  useEffect(() => {
    const input = fallbackInputRef.current

    if (!input) {
      return
    }

    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

  async function ingestSelection(
    loader: () => Promise<{ rootName: string; entries: LocalFileEntry[] }>,
    method: 'native' | 'fallback',
  ): Promise<void> {
    setBusyMessage('正在讀取與分析 FF14 設定資料夾...')
    setErrorMessage(null)
    setDownloadedAt(null)
    setUploadResult(null)

    try {
      const nextSource = await loader()
      const nextSelection = scanSelectedEntries(nextSource.rootName, nextSource.entries)
      const nextArtifact = await createBackupArtifact(nextSelection, config.version)

      setSelection(nextSelection)
      setArtifact(nextArtifact)
      setSourceMethod(method)
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setSelection(null)
      setArtifact(null)
      setSourceMethod(null)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setBusyMessage(null)
    }
  }

  async function handleNativePicker(): Promise<void> {
    await ingestSelection(() => pickDirectoryWithNativePicker(), 'native')
  }

  async function handleFallbackChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const { files } = event.target

    if (!files || files.length === 0) {
      return
    }

    await ingestSelection(async () => parseDirectoryInput(files), 'fallback')
    event.target.value = ''
  }

  function handleDownload(): void {
    if (!artifact) {
      return
    }

    triggerArtifactDownload(artifact)
    setDownloadedAt(new Date().toISOString())
    setUploadResult(null)
    setErrorMessage(null)
  }

  async function handleUpload(provider: CloudProviderId): Promise<void> {
    if (!artifact) {
      return
    }

    const adapter =
      provider === 'onedrive' ? createOneDriveAdapter(config) : createGoogleDriveAdapter(config)

    setBusyMessage(`正在連線至 ${providerLabel(provider)}...`)
    setErrorMessage(null)

    try {
      await adapter.signIn()
      setBusyMessage(`正在上傳備份到 ${providerLabel(provider)}...`)
      const result = await adapter.upload(artifact)
      setUploadResult(result)
      setDownloadedAt(null)
    } catch (error: unknown) {
      setUploadResult(null)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setBusyMessage(null)
      await adapter.signOut().catch(() => undefined)
    }
  }

  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>備份助手</h2>
          <p>
            預設路徑：
            <code>%USERPROFILE%\Documents\My Games\FINAL FANTASY XIV - A Realm Reborn\</code>
          </p>
        </div>

        <div className="path-panel">
          <p className="callout-title">操作原則</p>
          <p className="callout-body">
            只會打包 FF14 設定檔與角色資料夾，不會把整個 Documents 內容一起納入。
          </p>
        </div>

        <div className="button-row">
          <button
            className="button button--primary"
            disabled={!nativePickerSupported || Boolean(busyMessage)}
            onClick={() => {
              void handleNativePicker()
            }}
            type="button"
          >
            原生選取資料夾（推薦）
          </button>
          <button
            className="button button--ghost"
            disabled={Boolean(busyMessage)}
            onClick={() => fallbackInputRef.current?.click()}
            type="button"
          >
            回退模式：手動選資料夾
          </button>
        </div>

        <input
          ref={fallbackInputRef}
          className="sr-only"
          multiple
          onChange={(event) => {
            void handleFallbackChange(event)
          }}
          type="file"
        />

        <div className="detail-list">
          <div>
            <strong>瀏覽器能力：</strong>
            {nativePickerSupported
              ? '已偵測到原生資料夾選取 API，可直接讀取資料夾結構。'
              : '目前瀏覽器不支援原生資料夾選取，請改用回退模式。'}
          </div>
          <div>
            <strong>雲端授權：</strong>
            只有在你按下上傳時才會觸發，ZIP 建立與下載都在本機完成。
          </div>
        </div>
      </section>

      {(busyMessage || errorMessage || downloadedAt || uploadResult) && (
        <section className="page-grid">
          {busyMessage && (
            <div className="callout">
              <span className="callout-title">處理中</span>
              <span className="callout-body">{busyMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="callout callout--error">
              <span className="callout-title">錯誤</span>
              <span className="callout-body">{errorMessage}</span>
            </div>
          )}
          {downloadedAt && artifact && (
            <div className="callout callout--success">
              <span className="callout-title">下載完成</span>
              <span className="callout-body">
                {artifact.fileName} 已於 {formatDateTimeLabel(downloadedAt)} 下載。
              </span>
            </div>
          )}
          {uploadResult && (
            <div className="callout callout--success">
              <span className="callout-title">上傳完成</span>
              <span className="callout-body">
                {uploadResult.remoteFileName} 已上傳到 {uploadResult.remotePathLabel}。
              </span>
            </div>
          )}
        </section>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-label">OneDrive</div>
          <div className="stat-value">
            {config.oneDriveClientId ? '已設定 Client ID' : '尚未設定 Client ID'}
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Google Drive</div>
          <div className="stat-value">
            {config.googleClientId ? '已設定 Client ID' : '尚未設定 Client ID'}
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-label">資料來源</div>
          <div className="stat-value">
            {sourceMethod === 'native'
              ? '原生資料夾選取'
              : sourceMethod === 'fallback'
                ? '回退模式'
                : '尚未選取'}
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>備份摘要</h2>
          <p>選取資料夾後，會先建立 ZIP 並顯示可下載或可上傳的備份檔。</p>
        </div>

        {!selection || !artifact ? (
          <div className="empty-state">
            <strong>尚未建立備份檔</strong>
            <p>請先選取你的 FF14 設定資料夾。成功後會顯示掃描摘要與可執行動作。</p>
          </div>
        ) : (
          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">來源資料夾</div>
                <div className="stat-value">{selection.rootName}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">角色資料夾</div>
                <div className="stat-value">{selection.summary.characterDirs.length} 個</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">ZIP 大小</div>
                <div className="stat-value">{formatBytes(artifact.size)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">檔名</div>
                <div className="stat-value">{artifact.fileName}</div>
              </article>
            </div>

            <div className="badge-row">
              <span className={selection.summary.hasMainConfig ? 'badge badge--positive' : 'badge'}>
                FFXIV.cfg {selection.summary.hasMainConfig ? '已找到' : '未找到'}
              </span>
              <span className={selection.summary.hasBootConfig ? 'badge badge--positive' : 'badge'}>
                FFXIV_BOOT.cfg {selection.summary.hasBootConfig ? '已找到' : '未找到'}
              </span>
            </div>

            <div className="button-row">
              <button className="button button--primary" onClick={handleDownload} type="button">
                下載 ZIP
              </button>
              <button
                className="button button--upload"
                disabled={!config.oneDriveClientId || Boolean(busyMessage)}
                onClick={() => {
                  void handleUpload('onedrive')
                }}
                type="button"
              >
                上傳到 OneDrive
              </button>
              <button
                className="button button--upload"
                disabled={!config.googleClientId || Boolean(busyMessage)}
                onClick={() => {
                  void handleUpload('gdrive')
                }}
                type="button"
              >
                上傳到 Google Drive
              </button>
            </div>

            <div className="list-panel">
              <p className="callout-title">納入備份的內容</p>
              <ul>
                {selection.summary.includedPaths.map((path: string) => (
                  <li key={path}>
                    <code>{path}</code>
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

export default BackupPage
