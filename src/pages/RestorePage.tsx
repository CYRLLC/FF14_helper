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
          <h2>還原檢查</h2>
          <p>載入備份 ZIP 後先檢查內容與 manifest。這一頁只讀不寫，所有處理都留在瀏覽器內。</p>
        </div>

        <label className="field">
          <span className="field-label">選擇備份 ZIP</span>
          <input accept=".zip,application/zip" onChange={(event) => void handleFileChange(event)} type="file" />
        </label>

        {busy && (
          <div className="callout">
            <span className="callout-title">處理中</span>
            <span className="callout-body">正在檢查備份檔內容...</span>
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
          <h2>封存摘要</h2>
          <p>可先確認這份備份實際包含哪些檔案，降低還原時的意外。</p>
        </div>

        {!inspection ? (
          <div className="empty-state">
            <strong>尚未載入備份檔</strong>
            <p>請選擇由本站備份流程產生的 ZIP 來檢查。</p>
          </div>
        ) : (
          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">檔名</div>
                <div className="stat-value">{inspection.fileName}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">大小</div>
                <div className="stat-value">{formatBytes(inspection.size)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">項目數量</div>
                <div className="stat-value">{inspection.entries.length}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">Manifest</div>
                <div className="stat-value">{inspection.manifest ? '已偵測' : '缺少'}</div>
              </article>
            </div>

            {inspection.manifest ? (
              <div className="list-panel">
                <p className="callout-title">Manifest 內容</p>
                <p className="muted">
                  建立時間：{formatDateTimeLabel(inspection.manifest.createdAt)} | 來源資料夾：
                  {inspection.manifest.sourceRootName}
                </p>
                <p className="muted">
                  角色資料夾：{inspection.manifest.characterCount} | 版本：{inspection.manifest.version}
                </p>
              </div>
            ) : (
              <div className="callout callout--error">
                <span className="callout-title">缺少 Manifest</span>
                <span className="callout-body">
                  這份 ZIP 仍可打開，但沒有有效的 `backup-manifest.json`，請自行確認來源。
                </span>
              </div>
            )}

            <div className="list-panel">
              <p className="callout-title">封存內容清單</p>
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
