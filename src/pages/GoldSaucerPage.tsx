import { useEffect, useMemo, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { buildGatePrediction, buildGateScheduleSnapshot, formatCountdown } from '../goldSaucer/gate'

type GoldSaucerTab = 'schedule' | 'prediction'

function GoldSaucerPage() {
  const [activeTab, setActiveTab] = useState<GoldSaucerTab>('schedule')
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
    <>
      <div className="site-header">
        <div className="site-header__hero">
          <p className="eyebrow">金碟 GATE</p>
          <h2>台灣時間 GATE 時段與候選預測</h2>
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
              <div className="stat-value">
                {formatCountdown(snapshot.activeWindow?.countdownMs ?? snapshot.nextGateCountdownMs)}
              </div>
            </article>
          </div>
          {snapshot.activeWindow && (
            <div className="badge-row" style={{ marginTop: '0.5rem' }}>
              <span className="badge badge--positive">GATE 進行中</span>
              <span className="badge">優先候選：{activePrediction.predictedEvent}</span>
            </div>
          )}
        </div>

        <nav className="tool-tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'schedule'}
            className={`tool-tab${activeTab === 'schedule' ? ' tool-tab--active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            時段概覽
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'prediction'}
            className={`tool-tab${activeTab === 'prediction' ? ' tool-tab--active' : ''}`}
            onClick={() => setActiveTab('prediction')}
          >
            GATE 預測
          </button>
        </nav>
      </div>

      {activeTab === 'schedule' && (
        <div className="tool-panel">
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
                      <strong>{index === 0 ? (windowItem.isActive ? '本輪' : '下一輪') : `+${index}`}</strong>
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

          <SourceAttribution entries={pageSources.goldSaucer.entries} />
        </div>
      )}

      {activeTab === 'prediction' && (
        <div className="tool-panel">
          <section className="source-grid">
            <article className="page-card">
              <div className="section-heading">
                <h2>{snapshot.activeWindow ? '本輪候選' : '下一輪候選'}</h2>
                <p>依目前時段與固定 heuristic 產生排序，適合快速參考下一輪可能出現的活動。</p>
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
                <p>提早看下一場 GATE 的候選活動與信心值。</p>
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
              <h2>預測說明</h2>
            </div>
            <div className="badge-row">
              <span className="badge">固定使用 Asia/Taipei</span>
              <span className="badge">時段規則 :00 / :20 / :40</span>
              <span className="badge badge--warning">活動名稱僅供參考</span>
            </div>
            <p style={{ marginTop: '1rem' }}>
              GATE 時段固定以台灣時間（Asia/Taipei）的每小時 :00、:20、:40 為起點，每個時段持續 20 分鐘。
              候選活動名稱是依時段 key 做 hash 後輪替推算，屬於非官方推估（信心值 28–71%），
              僅適合快速參考下一輪可能出現什麼。實際活動仍以遊戲內公告為準。
            </p>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              {(['飛空艇大亂鬥', '狂風吹拂', '絕壁攀登', '躍升天際', '切分狂歡', '泰風挑戰'] as const).map((name) => (
                <div key={name} className="schedule-item" style={{ padding: '0.5rem 0.75rem' }}>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </section>

          <SourceAttribution entries={pageSources.goldSaucer.entries} />
        </div>
      )}
    </>
  )
}

export default GoldSaucerPage
