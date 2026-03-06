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
          <p>上傳你先前建立的備份 ZIP，檢查內容、manifest 與基本結構是否完整。</p>
        </div>

        <label className="field">
          <span className="field-label">選取備份 ZIP</span>
          <input accept=".zip,application/zip" onChange={(event) => void handleFileChange(event)} type="file" />
        </label>

        {busy ? (
          <div className="callout">
            <span className="callout-title">檢查中</span>
            <span className="callout-body">正在分析備份檔內容。</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="callout callout--error">
            <span className="callout-title">解析失敗</span>
            <span className="callout-body">{errorMessage}</span>
          </div>
        ) : null}
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>檢查結果</h2>
          <p>這裡只做結構檢查，不會直接把內容寫回你的 FF14 設定資料夾。</p>
        </div>

        {!inspection ? (
          <div className="empty-state">
            <strong>尚未選取備份檔</strong>
            <p>請先上傳一個由本站建立或相容格式的 FF14 備份 ZIP。</p>
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
                <div className="stat-label">Entries</div>
                <div className="stat-value">{inspection.entries.length}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">Manifest</div>
                <div className="stat-value">{inspection.manifest ? '存在' : '缺少'}</div>
              </article>
            </div>

            {inspection.manifest ? (
              <div className="list-panel">
                <p className="callout-title">Manifest 摘要</p>
                <p className="muted">
                  建立時間：{formatDateTimeLabel(inspection.manifest.createdAt)} | 來源資料夾：{inspection.manifest.sourceRootName}
                </p>
                <p className="muted">
                  角色資料夾：{inspection.manifest.characterCount} | 版本：{inspection.manifest.version}
                </p>
              </div>
            ) : (
              <div className="callout callout--error">
                <span className="callout-title">缺少 manifest</span>
                <span className="callout-body">
                  這個 ZIP 沒有偵測到 `backup-manifest.json`。若不是本站建立的備份檔，請自行確認內容來源。
                </span>
              </div>
            )}

            <div className="list-panel">
              <p className="callout-title">檔案列表</p>
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
