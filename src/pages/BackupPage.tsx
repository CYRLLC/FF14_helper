import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createBackupArtifact, triggerArtifactDownload } from '../backup/archive'
import {
  canUseDirectoryPicker,
  parseDirectoryInput,
  pickDirectoryWithNativePicker,
} from '../backup/fileSources'
import { scanSelectedEntries } from '../backup/scan'
import { createGoogleDriveAdapter } from '../cloud/gdrive'
import { createOneDriveAdapter } from '../cloud/onedrive'
import { useSync } from '../sync/useSync'
import type {
  BackupArtifact,
  BackupSourceSelection,
  CloudProviderId,
  CloudUploadResult,
  LocalFileEntry,
  RuntimeConfig,
  SyncTarget,
} from '../types'
import { getErrorMessage } from '../utils/errors'
import { formatBytes, formatDateTimeLabel } from '../utils/format'

interface BackupPageProps {
  config: RuntimeConfig
}

function providerLabel(provider: CloudProviderId): string {
  return provider === 'onedrive' ? 'OneDrive' : 'Google Drive'
}

function targetLabel(target: SyncTarget): string {
  if (target === 'download') {
    return '本機下載'
  }

  return providerLabel(target)
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
  const { syncState, addHistory } = useSync()
  const quickSyncDisabled =
    Boolean(busyMessage) ||
    (syncState.preferences.preferredTarget === 'onedrive' && !config.oneDriveClientId) ||
    (syncState.preferences.preferredTarget === 'gdrive' && !config.googleClientId)

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
    setBusyMessage('正在掃描你選擇的 FF14 設定資料夾...')
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

  async function handleFallbackChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const { files } = event.target

    if (!files || files.length === 0) {
      return
    }

    await ingestSelection(async () => parseDirectoryInput(files), 'fallback')
    event.target.value = ''
  }

  function recordDownload(nextArtifact: BackupArtifact): void {
    addHistory({
      createdAt: new Date().toISOString(),
      eventType: 'downloaded',
      target: 'download',
      fileName: nextArtifact.fileName,
      size: nextArtifact.size,
      sourceRootName: nextArtifact.manifest.sourceRootName,
      characterCount: nextArtifact.manifest.characterCount,
    })
  }

  function handleDownload(): void {
    if (!artifact) {
      return
    }

    triggerArtifactDownload(artifact)
    recordDownload(artifact)
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
      addHistory({
        createdAt: new Date().toISOString(),
        eventType: 'uploaded',
        target: provider,
        fileName: artifact.fileName,
        size: artifact.size,
        sourceRootName: artifact.manifest.sourceRootName,
        characterCount: artifact.manifest.characterCount,
        remotePathLabel: result.remotePathLabel,
      })
    } catch (error: unknown) {
      setUploadResult(null)
      setErrorMessage(getErrorMessage(error))
    } finally {
      setBusyMessage(null)
      await adapter.signOut().catch(() => undefined)
    }
  }

  async function handleQuickSync(): Promise<void> {
    if (!artifact) {
      return
    }

    const preferredTarget = syncState.preferences.preferredTarget

    if (preferredTarget === 'download') {
      handleDownload()
      return
    }

    if (syncState.preferences.downloadBeforeCloudUpload) {
      handleDownload()
    }

    await handleUpload(preferredTarget)
  }

  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-heading">
          <h2>備份助手</h2>
          <p>
            Windows 預設路徑：
            <code>%USERPROFILE%\Documents\My Games\FINAL FANTASY XIV - A Realm Reborn\</code>
          </p>
        </div>

        <div className="path-panel">
          <p className="callout-title">使用方式</p>
          <p className="callout-body">
            請選擇 FF14 設定資料夾。本站會只整理必要的設定檔與角色資料夾，避免把無關檔案一起打包。
          </p>
        </div>

        <div className="detail-list">
          <div>
            <strong>預設同步目標：</strong> {targetLabel(syncState.preferences.preferredTarget)}
          </div>
          <div>
            <strong>雲端前先下載：</strong>{' '}
            {syncState.preferences.downloadBeforeCloudUpload ? '是' : '否'}
          </div>
          <div>
            <strong>目前可用方式：</strong>{' '}
            {nativePickerSupported
              ? '可使用瀏覽器原生資料夾選取'
              : '目前瀏覽器不支援原生資料夾選取，請改用回退方式'}
          </div>
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
            使用原生資料夾選取
          </button>
          <button
            className="button button--ghost"
            disabled={Boolean(busyMessage)}
            onClick={() => fallbackInputRef.current?.click()}
            type="button"
          >
            使用回退方式選取
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
                ? '回退方式'
                : '尚未選取'}
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>備份摘要</h2>
          <p>選好資料夾後，本站會先建立 ZIP，你可以選擇快速同步、只下載或上傳到自己的雲端。</p>
        </div>

        {!selection || !artifact ? (
          <div className="empty-state">
            <strong>尚未建立備份</strong>
            <p>請先選擇 FF14 設定資料夾，系統就會掃描可備份內容並建立 ZIP。</p>
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
                FFXIV.cfg {selection.summary.hasMainConfig ? '已包含' : '未包含'}
              </span>
              <span className={selection.summary.hasBootConfig ? 'badge badge--positive' : 'badge'}>
                FFXIV_BOOT.cfg {selection.summary.hasBootConfig ? '已包含' : '未包含'}
              </span>
            </div>

            <div className="button-row">
              <button
                className="button button--primary"
                disabled={quickSyncDisabled}
                onClick={() => {
                  void handleQuickSync()
                }}
                type="button"
              >
                快速同步到 {targetLabel(syncState.preferences.preferredTarget)}
              </button>
              <button
                className="button button--ghost"
                disabled={Boolean(busyMessage)}
                onClick={handleDownload}
                type="button"
              >
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
              <p className="callout-title">將納入備份的內容</p>
              <ul>
                {selection.summary.includedPaths.map((path) => (
                  <li key={path}>
                    <code>{path}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="list-panel">
              <p className="callout-title">最近同步摘要</p>
              {syncState.history.length === 0 ? (
                <p className="muted">目前還沒有同步紀錄。</p>
              ) : (
                <ul>
                  {syncState.history.slice(0, 3).map((entry) => (
                    <li key={entry.id}>
                      {formatDateTimeLabel(entry.createdAt)} | {targetLabel(entry.target)} |{' '}
                      {entry.fileName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default BackupPage
