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
        <p className="eyebrow">Gold Saucer</p>
        <h2>金碟遊樂園 GATE 參考表</h2>
        <p className="lead">
          依台灣時間顯示 GATE 的固定時段與倒數，並加上本站自訂的活動預測。預測只供參考，
          不保證與遊戲內當輪活動相同。
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
            <h2>{snapshot.activeWindow ? '目前時段的活動預測' : '下一輪活動預測'}</h2>
            <p>這是用固定種子與簡單權重做出的參考值，方便排程，不是實際公告。</p>
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
            <h2>下一個時段的活動預測</h2>
            <p>如果你正在等下一輪，這裡提供站內的預估方向與候選列表。</p>
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
          <p>列表會持續更新倒數，並顯示每個時段的預測活動與其他候選。</p>
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
            本頁只做時段參考與活動預測。真正出現哪個 GATE，仍以遊戲內公告與現場活動為準。
            如果之後要加入提醒或通知，會另外在站內標示為新功能。
          </p>
        </div>
      </section>

      <SourceAttribution entries={pageSources.goldSaucer.entries} />
    </div>
  )
}

export default GoldSaucerPage
