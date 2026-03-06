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
  return eventType === 'downloaded' ? '下載' : '上傳'
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
    setMessage('已匯出同步設定檔。')
    setErrorMessage(null)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      importProfile(await file.text())
      setMessage('已匯入同步設定。')
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
          <h2>同步設定</h2>
          <p>這些偏好只會保存在目前瀏覽器，用來決定備份頁的預設同步目標與歷史紀錄保留方式。</p>
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
            <span className="field-label">歷史紀錄上限</span>
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
          <span>上傳雲端前先保留一份本機 ZIP</span>
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
          <span>保存同步歷史紀錄</span>
        </label>

        <div className="button-row">
          <button className="button button--primary" onClick={handleExport} type="button">
            匯出設定
          </button>
          <button className="button button--ghost" onClick={() => fileInputRef.current?.click()} type="button">
            匯入設定
          </button>
          <button className="button button--ghost" onClick={clearHistory} type="button">
            清空歷史
          </button>
        </div>

        <input
          ref={fileInputRef}
          accept="application/json"
          className="sr-only"
          onChange={(event) => {
            void handleImport(event)
          }}
          type="file"
        />

        {message ? (
          <div className="callout callout--success">
            <span className="callout-title">完成</span>
            <span className="callout-body">{message}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="callout callout--error">
            <span className="callout-title">設定錯誤</span>
            <span className="callout-body">{errorMessage}</span>
          </div>
        ) : null}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>最近同步紀錄</h2>
          <p>
            這些紀錄只保存在目前瀏覽器。
            {syncState.importedAt ? ` 最近一次匯入時間：${formatDateTimeLabel(syncState.importedAt)}` : ''}
          </p>
        </div>

        {syncState.history.length === 0 ? (
          <div className="empty-state">
            <strong>目前沒有歷史紀錄</strong>
            <p>當你在備份頁完成下載或上傳後，這裡會顯示最近幾次操作摘要。</p>
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
                  {formatDateTimeLabel(entry.createdAt)} | {targetLabel(entry.target)} | {formatBytes(entry.size)}
                </p>
                <p className="muted">
                  來源資料夾：{entry.sourceRootName} | 角色資料夾：{entry.characterCount}
                </p>
                {entry.remotePathLabel ? <p className="muted">遠端位置：{entry.remotePathLabel}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default SyncPage
