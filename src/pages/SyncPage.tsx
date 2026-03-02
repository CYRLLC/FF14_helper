import { useRef, useState, type ChangeEvent } from 'react'
import { useSync } from '../sync/useSync'
import type { SyncTarget } from '../types'
import { getErrorMessage } from '../utils/errors'
import { formatBytes, formatDateTimeLabel } from '../utils/format'

function targetLabel(target: SyncTarget): string {
  if (target === 'download') {
    return '本機下載'
  }

  return target === 'onedrive' ? 'OneDrive' : 'Google Drive'
}

function eventLabel(eventType: 'downloaded' | 'uploaded'): string {
  return eventType === 'downloaded' ? '已下載' : '已上傳'
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
    setMessage('已匯出目前的同步偏好與最近紀錄。')
    setErrorMessage(null)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      importProfile(await file.text())
      setMessage('已成功把同步偏好匯入到這個瀏覽器。')
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
          <h2>同步中心</h2>
          <p>同步偏好與最近紀錄只存在瀏覽器本機。真正的備份檔只會到你的裝置或你自己的雲端。</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">預設同步目標</span>
            <select
              className="input-select"
              onChange={(event) => {
                setPreferences({
                  preferredTarget: event.target.value as SyncTarget,
                })
              }}
              value={syncState.preferences.preferredTarget}
            >
              <option value="download">本機下載</option>
              <option value="onedrive">OneDrive</option>
              <option value="gdrive">Google Drive</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">保留最近紀錄數量</span>
            <select
              className="input-select"
              onChange={(event) => {
                setPreferences({
                  maxHistory: Number(event.target.value),
                })
              }}
              value={syncState.preferences.maxHistory}
            >
              <option value="5">5 筆</option>
              <option value="8">8 筆</option>
              <option value="12">12 筆</option>
              <option value="20">20 筆</option>
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
          <span>開始任何雲端上傳前，先保留一份本機 ZIP</span>
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
          <span>在瀏覽器中保留最近同步紀錄</span>
        </label>

        <div className="button-row">
          <button className="button button--primary" onClick={handleExport} type="button">
            匯出同步設定
          </button>
          <button
            className="button button--ghost"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            匯入同步設定
          </button>
          <button className="button button--ghost" onClick={clearHistory} type="button">
            清除最近紀錄
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
            <span className="callout-title">狀態</span>
            <span className="callout-body">{message}</span>
          </div>
        )}

        {errorMessage && (
          <div className="callout callout--error">
            <span className="callout-title">錯誤</span>
            <span className="callout-body">{errorMessage}</span>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>最近同步紀錄</h2>
          <p>
            這裡只顯示存在瀏覽器本機的摘要。
            {syncState.importedAt ? ` 最近一次匯入：${formatDateTimeLabel(syncState.importedAt)}` : ''}
          </p>
        </div>

        {syncState.history.length === 0 ? (
          <div className="empty-state">
            <strong>目前還沒有同步紀錄</strong>
            <p>從備份頁執行下載或上傳後，摘要就會顯示在這裡。</p>
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
                  來源資料夾：{entry.sourceRootName} | 角色資料夾：{entry.characterCount}
                </p>
                {entry.remotePathLabel && <p className="muted">遠端位置：{entry.remotePathLabel}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default SyncPage
