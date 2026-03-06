import { useEffect, useMemo, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { buildGatePrediction, buildGateScheduleSnapshot, formatCountdown } from '../goldSaucer/gate'

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
  const nextPrediction = useMemo(() => buildGatePrediction(new Date(snapshot.windows[0].startAtIso)), [snapshot.windows])

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">金碟 GATE</p>
        <h2>台灣時間 GATE 時段與候選預測</h2>
        <p className="lead">
          本頁固定以 `Asia/Taipei` 顯示 GATE 時段。候選活動名稱屬於非官方推估，只適合拿來快速參考下一輪可能會出現什麼，
          不代表遊戲內一定會完全一致。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">固定使用 Asia/Taipei</span>
          <span className="badge">時段規則 :00 / :20 / :40</span>
          <span className="badge badge--warning">活動名稱僅供參考</span>
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">目前台灣時間</div>
            <div className="stat-value">{snapshot.nowTaipeiLabel}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">下一輪開始</div>
            <div className="stat-value">{snapshot.nextGateLabel}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">{snapshot.activeWindow ? '本輪剩餘' : '距離下一輪'}</div>
            <div className="stat-value">{formatCountdown(snapshot.activeWindow?.countdownMs ?? snapshot.nextGateCountdownMs)}</div>
          </article>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>{snapshot.activeWindow ? '本輪候選' : '下一輪候選'}</h2>
            <p>這份候選清單會依目前時段與固定 heuristic 產生排序，適合作為快速參考，不是官方輪替表。</p>
          </div>
          <div className="callout">
            <span className="callout-title">優先候選</span>
            <span className="callout-body">{activePrediction.predictedEvent}</span>
            <span className="muted">
              參考信心：{activePrediction.confidenceLabel} ({activePrediction.confidenceScore}%)
            </span>
          </div>
          <div className="list-panel">
            <p className="callout-title">其他候選</p>
            <p className="muted">{activePrediction.candidateEvents.slice(1).join(' / ') || '無'}</p>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>下一輪預估</h2>
            <p>如果你只是想提早看下一場 GATE，這裡會顯示下一輪時段的候選活動與信心值。</p>
          </div>
          <div className="callout">
            <span className="callout-title">優先候選</span>
            <span className="callout-body">{nextPrediction.predictedEvent}</span>
            <span className="muted">
              參考信心：{nextPrediction.confidenceLabel} ({nextPrediction.confidenceScore}%)
            </span>
          </div>
          <div className="list-panel">
            <p className="callout-title">候選列表</p>
            <p className="muted">{nextPrediction.candidateEvents.join(' / ')}</p>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>接下來 12 個時段</h2>
          <p>列表會依時間排序顯示未來 GATE 時段，方便你預先安排跑活動或提醒隊友。</p>
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
                    候選活動：{prediction.predictedEvent} | {prediction.candidateEvents.join(' / ')}
                  </p>
                </div>
                <div className="schedule-item__meta">
                  <span className={windowItem.isActive ? 'badge badge--positive' : 'badge'}>
                    {windowItem.isActive ? '進行中' : '未開始'}
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
            GATE 時段規則來自公開資料，活動名稱則是本站自行推估。若你要準確確認當前輪到哪個活動，
            仍然應以遊戲內公告與現場實際內容為準。
          </p>
        </div>
      </section>

      <SourceAttribution entries={pageSources.goldSaucer.entries} />
    </div>
  )
}

export default GoldSaucerPage
