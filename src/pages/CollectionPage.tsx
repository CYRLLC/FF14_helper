import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import {
  collectionCategories,
  collectionEntries,
  collectionExpansions,
  collectionSupportRoles,
} from '../collection/data'
import {
  createDefaultCollectionTrackerState,
  exportCollectionTrackerState,
  importCollectionTrackerState,
  loadCollectionTrackerState,
  saveCollectionTrackerState,
  setCollectionStatus,
  toggleCollectionWishlist,
} from '../collection/storage'
import type { CollectionCategoryId, CollectionStatus, CollectionSupportRole, CollectionTrackerState } from '../types'
import { getErrorMessage } from '../utils/errors'

type StatusFilter = 'all' | 'wishlist' | 'planned' | 'active' | 'completed' | 'untracked'

function CollectionPage() {
  const [trackerState, setTrackerState] = useState<CollectionTrackerState>(() => loadCollectionTrackerState())
  const [activeCategory, setActiveCategory] = useState<CollectionCategoryId | 'all'>('all')
  const [activeExpansion, setActiveExpansion] = useState<'all' | string>('all')
  const [activeRole, setActiveRole] = useState<'all' | CollectionSupportRole>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [importCode, setImportCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    saveCollectionTrackerState(trackerState)
  }, [trackerState])

  const exportCode = useMemo(() => exportCollectionTrackerState(trackerState), [trackerState])

  const filteredEntries = useMemo(() => {
    return collectionEntries.filter((entry) => {
      if (activeCategory !== 'all' && entry.category !== activeCategory) {
        return false
      }
      if (activeExpansion !== 'all' && entry.expansion !== activeExpansion) {
        return false
      }
      if (activeRole !== 'all' && !entry.supportRoles.includes(activeRole)) {
        return false
      }
      if (searchQuery.trim()) {
        const keyword = searchQuery.trim().toLocaleLowerCase('zh-TW')
        const haystack = [
          entry.name,
          entry.location,
          entry.unlockQuest,
          entry.unlockSummary,
          ...entry.rewardSummary,
        ]
          .join(' ')
          .toLocaleLowerCase('zh-TW')
        if (!haystack.includes(keyword)) {
          return false
        }
      }

      const currentStatus = trackerState.statuses[entry.id]
      const isWishlisted = trackerState.wishlist.includes(entry.id)

      switch (statusFilter) {
        case 'wishlist':
          return isWishlisted
        case 'planned':
        case 'active':
        case 'completed':
          return currentStatus === statusFilter
        case 'untracked':
          return !currentStatus
        default:
          return true
      }
    })
  }, [activeCategory, activeExpansion, activeRole, searchQuery, statusFilter, trackerState.statuses, trackerState.wishlist])

  const summary = useMemo(() => {
    const total = collectionEntries.length
    const customDeliveries = collectionEntries.filter((entry) => entry.category === 'custom-deliveries').length
    const alliedSocieties = collectionEntries.filter((entry) => entry.category === 'allied-societies').length
    const completed = Object.values(trackerState.statuses).filter((status) => status === 'completed').length
    const active = Object.values(trackerState.statuses).filter((status) => status === 'active').length
    return {
      total,
      customDeliveries,
      alliedSocieties,
      completed,
      active,
      wishlist: trackerState.wishlist.length,
    }
  }, [trackerState.statuses, trackerState.wishlist])

  function cycleStatus(entryId: string): void {
    const current = trackerState.statuses[entryId]
    const next: CollectionStatus | null =
      current === 'planned' ? 'active' : current === 'active' ? 'completed' : current === 'completed' ? null : 'planned'
    setTrackerState((state) => setCollectionStatus(state, entryId, next))
  }

  function handleWishlist(entryId: string): void {
    setTrackerState((state) => toggleCollectionWishlist(state, entryId))
  }

  async function handleCopyExport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(exportCode)
      setCopied(true)
      setMessage('已複製備份碼。')
      window.setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  function handleImport(): void {
    try {
      const imported = importCollectionTrackerState(importCode)
      setTrackerState(imported)
      setMessage('已還原收藏追蹤資料。')
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Collection Tracker</p>
        <h2>收藏 / 清單追蹤</h2>
        <p className="lead">
          這一頁把 `ffxiv-collection-tc` 的核心前端工作流整理進本站，先聚焦在你最在意的 `老主顧` 與 `友好部落`。
          你可以篩選、標記進度、加入願望清單，並用備份碼同步到其他裝置。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">來源已標示</span>
          <span className="badge">本機狀態追蹤</span>
          <span className="badge badge--warning">不保存到本站伺服器</span>
        </div>
        <div className="button-row">
          <Link className="button button--ghost" to="/craft">
            前往製作助手
          </Link>
          <a className="button button--ghost" href="https://cycleapple.github.io/ffxiv-collection-tc/" rel="noreferrer" target="_blank">
            查看參考站
          </a>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>總覽</h2>
          <p>老主顧以每週交貨規劃為主，友好部落則偏向聲望與日常進度。這裡先把兩者統一成同一套追蹤界面。</p>
        </div>
        <div className="stats-grid">
          <article className="stat-card"><div className="stat-label">總項目</div><div className="stat-value">{summary.total}</div></article>
          <article className="stat-card"><div className="stat-label">老主顧</div><div className="stat-value">{summary.customDeliveries}</div></article>
          <article className="stat-card"><div className="stat-label">友好部落</div><div className="stat-value">{summary.alliedSocieties}</div></article>
          <article className="stat-card"><div className="stat-label">進行中</div><div className="stat-value">{summary.active}</div></article>
          <article className="stat-card"><div className="stat-label">已完成</div><div className="stat-value">{summary.completed}</div></article>
          <article className="stat-card"><div className="stat-label">願望清單</div><div className="stat-value">{summary.wishlist}</div></article>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>篩選</h2>
          <p>可依類型、版本、支援職能與追蹤狀態過濾，這也是之後站內其他工具共用的任務清單資料來源。</p>
        </div>
        <div className="choice-row">
          <button className={activeCategory === 'all' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setActiveCategory('all')} type="button">全部</button>
          {collectionCategories.map((category) => (
            <button key={category.id} className={activeCategory === category.id ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setActiveCategory(category.id)} type="button">
              {category.label}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">搜尋</span>
            <input className="input-text" onChange={(event) => setSearchQuery(event.target.value)} placeholder="例如：莫古力、製作、圖拉爾" type="text" value={searchQuery} />
          </label>
          <label className="field">
            <span className="field-label">版本</span>
            <select className="input-select" onChange={(event) => setActiveExpansion(event.target.value)} value={activeExpansion}>
              <option value="all">全部</option>
              {collectionExpansions.map((expansion) => (
                <option key={expansion.id} value={expansion.id}>{expansion.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">職能</span>
            <select className="input-select" onChange={(event) => setActiveRole(event.target.value as 'all' | CollectionSupportRole)} value={activeRole}>
              <option value="all">全部</option>
              {collectionSupportRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">追蹤狀態</span>
            <select className="input-select" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              <option value="all">全部</option>
              <option value="wishlist">願望清單</option>
              <option value="planned">預計開始</option>
              <option value="active">進行中</option>
              <option value="completed">已完成</option>
              <option value="untracked">未追蹤</option>
            </select>
          </label>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>清單</h2>
          <p>卡片上的狀態會以 `未追蹤 → 預計開始 → 進行中 → 已完成` 循環切換。願望清單則獨立記錄。</p>
        </div>
        <div className="badge-row">
          <span className="badge">目前顯示 {filteredEntries.length} / {collectionEntries.length} 筆</span>
        </div>
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <strong>沒有符合目前篩選的資料</strong>
            <p>可以放寬版本、職能或搜尋條件再試一次。</p>
          </div>
        ) : (
          <div className="history-list">
            {filteredEntries.map((entry) => {
              const currentStatus = trackerState.statuses[entry.id]
              const isWishlisted = trackerState.wishlist.includes(entry.id)
              return (
                <article key={entry.id} className="history-item">
                  <div className="history-item__top">
                    <strong>{entry.name}</strong>
                    <span className="badge">{entry.category === 'custom-deliveries' ? '老主顧' : '友好部落'}</span>
                  </div>
                  <p className="muted">{entry.location} | Patch {entry.patch} | 支援：{entry.supportRoles.map((role) => collectionSupportRoles.find((value) => value.id === role)?.label ?? role).join(' / ')}</p>
                  <p className="muted">解鎖任務：{entry.unlockQuest}</p>
                  <p className="muted">{entry.unlockSummary}</p>
                  <p className="muted">重點：{entry.rewardSummary.join(' / ')}</p>
                  {entry.notes ? <p className="muted">{entry.notes}</p> : null}
                  <div className="badge-row">
                    <span className={currentStatus === 'completed' ? 'badge badge--positive' : currentStatus === 'active' ? 'badge badge--warning' : 'badge'}>
                      {currentStatus === 'planned' ? '預計開始' : currentStatus === 'active' ? '進行中' : currentStatus === 'completed' ? '已完成' : '未追蹤'}
                    </span>
                    {isWishlisted ? <span className="badge badge--positive">願望清單</span> : null}
                  </div>
                  <div className="button-row">
                    <button className="button button--ghost" onClick={() => cycleStatus(entry.id)} type="button">切換狀態</button>
                    <button className="button button--ghost" onClick={() => handleWishlist(entry.id)} type="button">
                      {isWishlisted ? '移出願望清單' : '加入願望清單'}
                    </button>
                    {entry.sourceUrl ? (
                      <a className="button button--ghost" href={entry.sourceUrl} rel="noreferrer" target="_blank">
                        查看資料來源
                      </a>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>備份碼</h2>
            <p>這套追蹤資料保存在你的瀏覽器內。可匯出備份碼後貼到其他裝置恢復。</p>
          </div>
          <label className="field">
            <span className="field-label">匯出內容</span>
            <textarea className="input-text" readOnly rows={6} value={exportCode} />
          </label>
          <div className="button-row">
            <button className="button button--primary" onClick={() => void handleCopyExport()} type="button">
              {copied ? '已複製備份碼' : '複製備份碼'}
            </button>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>匯入備份</h2>
            <p>匯入時會覆蓋目前追蹤進度與願望清單。</p>
          </div>
          <label className="field">
            <span className="field-label">備份碼</span>
            <textarea className="input-text" onChange={(event) => setImportCode(event.target.value)} rows={6} value={importCode} />
          </label>
          <div className="button-row">
            <button className="button button--ghost" onClick={handleImport} type="button">還原資料</button>
            <button className="button button--ghost" onClick={() => { setTrackerState(createDefaultCollectionTrackerState()); setImportCode(''); setMessage('已清空收藏追蹤資料。') }} type="button">清空目前資料</button>
          </div>
          {trackerState.importedAt ? <p className="muted">最近匯入：{new Date(trackerState.importedAt).toLocaleString('zh-TW', { hour12: false })}</p> : null}
        </article>
      </section>

      {message ? (
        <section className="page-card">
          <div className="callout">
            <span className="callout-title">狀態</span>
            <span className="callout-body">{message}</span>
          </div>
        </section>
      ) : null}

      <SourceAttribution entries={pageSources.collection.entries} />
    </div>
  )
}

export default CollectionPage
