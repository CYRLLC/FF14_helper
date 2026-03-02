import { useEffect, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { buildGateScheduleSnapshot, formatCountdown } from '../goldSaucer/gate'

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

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Gold Saucer</p>
        <h2>金碟遊樂園 GATE 參考表</h2>
        <p className="lead">
          依台灣時間顯示下一輪 GATE 時段與倒數。本站只提供時段參考，不保證當輪出現的活動名稱。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">台灣時間固定顯示</span>
          <span className="badge">每小時 :00 / :20 / :40</span>
          <span className="badge badge--warning">不做活動名稱預測</span>
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">現在時間</div>
            <div className="stat-value">{snapshot.nowTaipeiLabel}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">下一輪 GATE</div>
            <div className="stat-value">{snapshot.nextGateLabel}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">{snapshot.activeWindow ? '本輪剩餘' : '開始倒數'}</div>
            <div className="stat-value">
              {formatCountdown(snapshot.activeWindow?.countdownMs ?? snapshot.nextGateCountdownMs)}
            </div>
          </article>
        </div>
        <div className="callout">
          <span className="callout-title">資料說明</span>
          <span className="callout-body">
            時段以瀏覽器端計算，資料不會儲存在本站伺服器；實際活動內容仍以遊戲內公告與當前輪替為準。
          </span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>接下來 12 個 GATE 時段</h2>
          <p>你可以用這份表作為排程參考，特別是跨整點與跨日的時間點。</p>
        </div>

        <div className="schedule-list">
          {snapshot.windows.map((windowItem, index) => (
            <article
              key={windowItem.startAtIso}
              className={windowItem.isActive ? 'schedule-item schedule-item--active' : 'schedule-item'}
            >
              <div>
                <strong>{index === 0 ? '下一輪' : `+${index}`}</strong>
                <p className="muted">{windowItem.labelTw}</p>
              </div>
              <div className="schedule-item__meta">
                <span className={windowItem.isActive ? 'badge badge--positive' : 'badge'}>
                  {windowItem.isActive ? '進行中' : '待開始'}
                </span>
                <span className="muted">{formatCountdown(windowItem.countdownMs)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>使用說明</h2>
            <p>GATE 每輪 20 分鐘。這個頁面專注在時間窗，不做事件名稱保證。</p>
          </div>
        </article>
        <article className="page-card">
          <div className="section-heading">
            <h2>後續擴充</h2>
            <p>下一步可再加入提醒、金碟其他活動時段與本機通知，但仍維持純前端模式。</p>
          </div>
        </article>
      </section>

      <SourceAttribution entries={pageSources.goldSaucer.entries} />
    </div>
  )
}

export default GoldSaucerPage
