import { useEffect, useMemo, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import {
  buildGatePrediction,
  buildGateScheduleSnapshot,
  formatCountdown,
} from '../goldSaucer/gate'

function GoldSaucerPage() {
  const [snapshot, setSnapshot] = useState(() => buildGateScheduleSnapshot())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot(buildGateScheduleSnapshot())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const activePrediction = useMemo(
    () => buildGatePrediction(new Date(snapshot.activeWindow?.startAtIso ?? snapshot.windows[0].startAtIso)),
    [snapshot.activeWindow?.startAtIso, snapshot.windows],
  )
  const nextPrediction = useMemo(
    () => buildGatePrediction(new Date(snapshot.windows[0].startAtIso)),
    [snapshot.windows],
  )

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">金碟遊樂園</p>
        <h2>GATE 參考表與活動預測</h2>
        <p className="lead">
          依台灣時間顯示 GATE 的固定時段與倒數，並加入站內的參考預測。活動預測只供安排時間用，
          不保證與遊戲內實際出現的內容一致。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">固定以 Asia/Taipei 顯示</span>
          <span className="badge">每小時 :00 / :20 / :40</span>
          <span className="badge badge--warning">活動預測不保證準確</span>
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">目前台灣時間</div>
            <div className="stat-value">{snapshot.nowTaipeiLabel}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">下一輪 GATE</div>
            <div className="stat-value">{snapshot.nextGateLabel}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">{snapshot.activeWindow ? '本輪剩餘' : '距離開始'}</div>
            <div className="stat-value">
              {formatCountdown(snapshot.activeWindow?.countdownMs ?? snapshot.nextGateCountdownMs)}
            </div>
          </article>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>{snapshot.activeWindow ? '目前時段的預測' : '下一輪的預測'}</h2>
            <p>這是站內用固定種子與簡單權重做出的參考值，不是官方公告。</p>
          </div>
          <div className="callout">
            <span className="callout-title">主要預測</span>
            <span className="callout-body">{activePrediction.predictedEvent}</span>
            <span className="muted">
              信心等級：{activePrediction.confidenceLabel} ({activePrediction.confidenceScore}%)
            </span>
          </div>
          <div className="list-panel">
            <p className="callout-title">其他候選</p>
            <p className="muted">{activePrediction.candidateEvents.slice(1).join(' / ') || '無'}</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>下一個時段的預測</h2>
            <p>如果你在等下一輪，可以先用這裡的候選活動做參考。</p>
          </div>
          <div className="callout">
            <span className="callout-title">主要預測</span>
            <span className="callout-body">{nextPrediction.predictedEvent}</span>
            <span className="muted">
              信心等級：{nextPrediction.confidenceLabel} ({nextPrediction.confidenceScore}%)
            </span>
          </div>
          <div className="list-panel">
            <p className="callout-title">候選順序</p>
            <p className="muted">{nextPrediction.candidateEvents.join(' / ')}</p>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>接下來 12 個 GATE 時段</h2>
          <p>列表會持續更新倒數，並顯示每個時段的活動預測與候選項目。</p>
        </div>

        <div className="schedule-list">
          {snapshot.windows.map((windowItem, index) => {
            const prediction = buildGatePrediction(new Date(windowItem.startAtIso))

            return (
              <article
                key={windowItem.startAtIso}
                className={windowItem.isActive ? 'schedule-item schedule-item--active' : 'schedule-item'}
              >
                <div>
                  <strong>{index === 0 ? '下一輪' : `+${index}`}</strong>
                  <p className="muted">{windowItem.labelTw}</p>
                  <p className="muted">
                    預測：{prediction.predictedEvent} | 候選：{prediction.candidateEvents.join(' / ')}
                  </p>
                </div>
                <div className="schedule-item__meta">
                  <span className={windowItem.isActive ? 'badge badge--positive' : 'badge'}>
                    {windowItem.isActive ? '進行中' : '尚未開始'}
                  </span>
                  <span className="muted">{formatCountdown(windowItem.countdownMs)}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>使用說明</h2>
          <p>
            本頁只做時段參考與活動預測。真正出現哪個 GATE，仍請以遊戲內實際活動為準。未來若加入提醒
            功能，也會另外標示為新功能。
          </p>
        </div>
      </section>

      <SourceAttribution entries={pageSources.goldSaucer.entries} />
    </div>
  )
}

export default GoldSaucerPage
