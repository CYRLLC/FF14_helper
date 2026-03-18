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
import type { CollectionCategoryId, CollectionEntry, CollectionStatus, CollectionSupportRole, CollectionTrackerState } from '../types'
import { getErrorMessage } from '../utils/errors'

type StatusFilter = 'all' | 'wishlist' | 'planned' | 'active' | 'completed' | 'untracked'
type FocusMode = 'all' | 'weekly' | 'daily'

function formatStatus(status: CollectionStatus | undefined): string {
  switch (status) {
    case 'planned':
      return '預計開始'
    case 'active':
      return '進行中'
    case 'completed':
      return '已完成'
    default:
      return '未追蹤'
  }
}

function getNextStatusLabel(status: CollectionStatus | undefined): string {
  switch (status) {
    case 'planned':
      return '切到進行中'
    case 'active':
      return '切到已完成'
    case 'completed':
      return '清除狀態'
    default:
      return '加入預計開始'
  }
}

function formatCategory(category: CollectionCategoryId): string {
  return category === 'custom-deliveries' ? '老主顧' : '友好部落'
}

function getEntryPriority(entry: CollectionEntry, trackerState: CollectionTrackerState): number {
  const status = trackerState.statuses[entry.id]
  const isWishlisted = trackerState.wishlist.includes(entry.id)

  if (status === 'active') return 0
  if (status === 'planned') return 1
  if (isWishlisted) return 2
  if (status === 'completed') return 4
  return 3
}

function buildRecommendation(summary: {
  wishlist: number
  planned: number
  active: number
  completed: number
}): string {
  if (summary.active > 0) {
    return `你目前有 ${summary.active} 個項目標記為進行中，先把這批日常清乾淨，再新增新的追蹤比較不會亂。`
  }

  if (summary.planned > 0) {
    return `你有 ${summary.planned} 個項目標記為預計開始，建議先挑最近會做的每週或每日內容。`
  }

  if (summary.wishlist > 0) {
    return `你目前有 ${summary.wishlist} 個願望清單項目，可以先把最常做的那幾個轉成預計開始。`
  }

  if (summary.completed > 0) {
    return '目前沒有進行中的追蹤項目。如果要重新整理日常，先從本週老主顧與一組友好部落開始。'
  }

  return '先把想做的內容加入願望清單，再逐步切成預計開始與進行中，這樣會比直接堆滿清單更好整理。'
}

function createFocusList(entries: CollectionEntry[], trackerState: CollectionTrackerState): CollectionEntry[] {
  return [...entries]
    .sort((left, right) => {
      const priorityGap = getEntryPriority(left, trackerState) - getEntryPriority(right, trackerState)
      if (priorityGap !== 0) {
        return priorityGap
      }
      return left.name.localeCompare(right.name, 'en')
    })
    .slice(0, 6)
}

function CollectionPage() {
  const [trackerState, setTrackerState] = useState<CollectionTrackerState>(() => loadCollectionTrackerState())
  const [activeCategory, setActiveCategory] = useState<CollectionCategoryId | 'all'>('all')
  const [activeExpansion, setActiveExpansion] = useState<'all' | string>('all')
  const [activeRole, setActiveRole] = useState<'all' | CollectionSupportRole>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [focusMode, setFocusMode] = useState<FocusMode>('all')
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
      if (focusMode === 'weekly' && entry.category !== 'custom-deliveries') {
        return false
      }

      if (focusMode === 'daily' && entry.category !== 'allied-societies') {
        return false
      }

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
        const keyword = searchQuery.trim().toLocaleLowerCase('en-US')
        const haystack = [entry.name, entry.location, entry.unlockQuest, entry.unlockSummary, ...entry.rewardSummary]
          .join(' ')
          .toLocaleLowerCase('en-US')
        if (!haystack.includes(keyword)) {
          return false
        }
      }

      const status = trackerState.statuses[entry.id]
      const isWishlisted = trackerState.wishlist.includes(entry.id)

      switch (statusFilter) {
        case 'wishlist':
          return isWishlisted
        case 'planned':
        case 'active':
        case 'completed':
          return status === statusFilter
        case 'untracked':
          return !status
        default:
          return true
      }
    })
  }, [activeCategory, activeExpansion, activeRole, focusMode, searchQuery, statusFilter, trackerState.statuses, trackerState.wishlist])

  const summary = useMemo(() => {
    const statuses = Object.values(trackerState.statuses)
    const trackedCount = statuses.length
    const completed = statuses.filter((status) => status === 'completed').length
    return {
      total: collectionEntries.length,
      customDeliveries: collectionEntries.filter((entry) => entry.category === 'custom-deliveries').length,
      alliedSocieties: collectionEntries.filter((entry) => entry.category === 'allied-societies').length,
      planned: statuses.filter((status) => status === 'planned').length,
      active: statuses.filter((status) => status === 'active').length,
      completed,
      wishlist: trackerState.wishlist.length,
      trackedCount,
      trackedCompletionRate: trackedCount === 0 ? 0 : Math.round((completed / trackedCount) * 100),
    }
  }, [trackerState.statuses, trackerState.wishlist])

  const weeklyFocus = useMemo(
    () => createFocusList(collectionEntries.filter((entry) => entry.category === 'custom-deliveries'), trackerState),
    [trackerState],
  )
  const dailyFocus = useMemo(
    () => createFocusList(collectionEntries.filter((entry) => entry.category === 'allied-societies'), trackerState),
    [trackerState],
  )

  const groupedEntries = useMemo(
    () => [
      {
        id: 'custom-deliveries',
        title: '老主顧',
        description: '每週交件內容，適合集中安排白票、紫票與經驗值。',
        items: filteredEntries.filter((entry) => entry.category === 'custom-deliveries'),
      },
      {
        id: 'allied-societies',
        title: '友好部落',
        description: '每日任務內容，依戰鬥 / 製作 / 採集職能分流。',
        items: filteredEntries.filter((entry) => entry.category === 'allied-societies'),
      },
    ],
    [filteredEntries],
  )

  const recommendation = useMemo(
    () =>
      buildRecommendation({
        wishlist: summary.wishlist,
        planned: summary.planned,
        active: summary.active,
        completed: summary.completed,
      }),
    [summary.active, summary.completed, summary.planned, summary.wishlist],
  )

  const activeTasks = useMemo(
    () => collectionEntries.filter((entry) => trackerState.statuses[entry.id] === 'active'),
    [trackerState.statuses],
  )

  function cycleStatus(entryId: string): void {
    const current = trackerState.statuses[entryId]
    const next: CollectionStatus | null =
      current === 'planned' ? 'active' : current === 'active' ? 'completed' : current === 'completed' ? null : 'planned'
    setTrackerState((state) => setCollectionStatus(state, entryId, next))
  }

  function handleWishlist(entryId: string): void {
    setTrackerState((state) => toggleCollectionWishlist(state, entryId))
  }

  function handleFocusMode(nextMode: FocusMode): void {
    setFocusMode(nextMode)
    if (nextMode === 'weekly') {
      setActiveCategory('custom-deliveries')
    } else if (nextMode === 'daily') {
      setActiveCategory('allied-societies')
    } else {
      setActiveCategory('all')
    }
  }

  async function handleCopyExport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(exportCode)
      setCopied(true)
      setMessage('已複製收藏追蹤備份碼。')
      window.setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  function handleImport(): void {
    try {
      const imported = importCollectionTrackerState(importCode)
      setTrackerState(imported)
      setMessage('已匯入收藏追蹤資料。')
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Collection Tracker</p>
        <h2>收藏追蹤</h2>
        <p className="lead">
          這一頁把老主顧與友好部落整理成可持續維護的追蹤清單。你可以先用願望清單收集想做的內容，
          再切成預計開始、進行中與已完成。資料只存瀏覽器本機，不會上傳到本站。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">老主顧與友好部落整合追蹤</span>
          <span className="badge">本機儲存，不綁帳號</span>
          <span className="badge badge--warning">資料以公開來源整理，實際條件仍以遊戲內為準</span>
        </div>
        <div className="button-row">
          <Link className="button button--ghost" to="/craft">前往製作助手</Link>
          <a className="button button--ghost" href="https://cycleapple.github.io/ffxiv-collection-tc/" rel="noreferrer" target="_blank">
            參考來源網站
          </a>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>進度總覽</h2>
            <p>先看整體追蹤狀態，再決定這次要整理每週老主顧還是每日友好部落。</p>
          </div>
          <div className="stats-grid">
            <article className="stat-card"><div className="stat-label">總項目</div><div className="stat-value">{summary.total}</div></article>
            <article className="stat-card"><div className="stat-label">老主顧</div><div className="stat-value">{summary.customDeliveries}</div></article>
            <article className="stat-card"><div className="stat-label">友好部落</div><div className="stat-value">{summary.alliedSocieties}</div></article>
            <article className="stat-card"><div className="stat-label">進行中</div><div className="stat-value">{summary.active}</div></article>
            <article className="stat-card"><div className="stat-label">預計開始</div><div className="stat-value">{summary.planned}</div></article>
            <article className="stat-card"><div className="stat-label">願望清單</div><div className="stat-value">{summary.wishlist}</div></article>
          </div>
          <div className="callout">
            <span className="callout-title">追蹤完成率</span>
            <span className="callout-body">
              已追蹤 {summary.trackedCount} 項，完成率 {summary.trackedCompletionRate}%。
            </span>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>建議下一步</h2>
            <p>{recommendation}</p>
          </div>
          <div className="detail-list">
            <span><strong>每週視角：</strong>優先看老主顧。</span>
            <span><strong>每日視角：</strong>優先看友好部落。</span>
            <span><strong>回鍋整理：</strong>先把常做內容加入願望清單，再慢慢轉成追蹤。</span>
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>快速視角</h2>
          <p>用每週 / 每日兩種視角快速切換，不需要每次都重新手動篩選。</p>
        </div>
        <div className="choice-row">
          <button className={focusMode === 'all' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => handleFocusMode('all')} type="button">
            全部內容
          </button>
          <button className={focusMode === 'weekly' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => handleFocusMode('weekly')} type="button">
            本週老主顧
          </button>
          <button className={focusMode === 'daily' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => handleFocusMode('daily')} type="button">
            每日友好部落
          </button>
        </div>
      </section>

      {activeTasks.length > 0 ? (
        <section className="page-card">
          <div className="section-heading">
            <h2>今日進行中任務</h2>
            <p>這些是你目前標記為「進行中」的內容。把它們清掉後再挑下一批，比較好維持節奏。</p>
          </div>
          <div className="history-list">
            {activeTasks.map((entry) => (
              <article key={entry.id} className="history-item">
                <div className="history-item__top">
                  <strong>{entry.name}</strong>
                  <span className="badge badge--warning">進行中</span>
                  <span className="badge">{formatCategory(entry.category)}</span>
                </div>
                <p className="muted">{entry.location} | Patch {entry.patch}</p>
                <div className="button-row">
                  <button className="button button--primary" onClick={() => cycleStatus(entry.id)} type="button">
                    切到已完成
                  </button>
                  {entry.supportRoles.includes('crafting') ? (
                    <Link className="button button--ghost" to="/craft">製作助手</Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>本週老主顧焦點</h2>
            <p>優先把這幾個每週內容標記好，就不容易漏掉交件節奏。</p>
          </div>
          <div className="history-list">
            {weeklyFocus.map((entry) => (
              <article key={entry.id} className="history-item">
                <div className="history-item__top">
                  <strong>{entry.name}</strong>
                  <span className="badge">{formatStatus(trackerState.statuses[entry.id])}</span>
                </div>
                <p className="muted">{entry.location} | Patch {entry.patch}</p>
                <div className="button-row">
                  <button className="button button--ghost" onClick={() => cycleStatus(entry.id)} type="button">
                    {getNextStatusLabel(trackerState.statuses[entry.id])}
                  </button>
                  <button className="button button--ghost" onClick={() => handleWishlist(entry.id)} type="button">
                    {trackerState.wishlist.includes(entry.id) ? '移出願望清單' : '加入願望清單'}
                  </button>
                  {entry.supportRoles.includes('crafting') ? (
                    <Link className="button button--ghost" to="/craft">製作助手</Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>每日友好部落焦點</h2>
            <p>把常跑的每日任務固定在這裡，會比整頁翻找更快。</p>
          </div>
          <div className="history-list">
            {dailyFocus.map((entry) => (
              <article key={entry.id} className="history-item">
                <div className="history-item__top">
                  <strong>{entry.name}</strong>
                  <span className="badge">{entry.supportRoles.map((role) => collectionSupportRoles.find((item) => item.id === role)?.label ?? role).join(' / ')}</span>
                </div>
                <p className="muted">{entry.location} | Patch {entry.patch}</p>
                <div className="button-row">
                  <button className="button button--ghost" onClick={() => cycleStatus(entry.id)} type="button">
                    {getNextStatusLabel(trackerState.statuses[entry.id])}
                  </button>
                  <button className="button button--ghost" onClick={() => handleWishlist(entry.id)} type="button">
                    {trackerState.wishlist.includes(entry.id) ? '移出願望清單' : '加入願望清單'}
                  </button>
                  {entry.supportRoles.includes('crafting') ? (
                    <Link className="button button--ghost" to="/craft">製作助手</Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>篩選與搜尋</h2>
          <p>把範圍縮到你這次真正要整理的內容，避免一次看到太多資料。</p>
        </div>
        <div className="choice-row">
          <button className={activeCategory === 'all' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setActiveCategory('all')} type="button">全部分類</button>
          {collectionCategories.map((category) => (
            <button
              key={category.id}
              className={activeCategory === category.id ? 'choice-button choice-button--active' : 'choice-button'}
              onClick={() => setActiveCategory(category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">搜尋關鍵字</span>
            <input
              className="input-text"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="可搜 NPC 名稱、地點、任務名、獎勵"
              type="text"
              value={searchQuery}
            />
          </label>
          <label className="field">
            <span className="field-label">版本</span>
            <select className="input-select" onChange={(event) => setActiveExpansion(event.target.value)} value={activeExpansion}>
              <option value="all">全部版本</option>
              {collectionExpansions.map((expansion) => (
                <option key={expansion.id} value={expansion.id}>{expansion.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">支援職能</span>
            <select className="input-select" onChange={(event) => setActiveRole(event.target.value as 'all' | CollectionSupportRole)} value={activeRole}>
              <option value="all">全部職能</option>
              {collectionSupportRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">追蹤狀態</span>
            <select className="input-select" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              <option value="all">全部狀態</option>
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
          <h2>目前篩選結果</h2>
          <p>目前共有 {filteredEntries.length} / {collectionEntries.length} 筆結果。你可以直接在清單裡切換狀態。</p>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <strong>沒有符合條件的項目</strong>
            <p>先放寬版本、職能或狀態篩選，再重新檢查一次。</p>
          </div>
        ) : (
          <div className="history-list">
            {groupedEntries
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <article key={group.id} className="list-panel">
                  <p className="callout-title">{group.title}</p>
                  <p className="muted">{group.description}</p>
                  <div className="history-list">
                    {group.items.map((entry) => {
                      const currentStatus = trackerState.statuses[entry.id]
                      const isWishlisted = trackerState.wishlist.includes(entry.id)

                      return (
                        <article key={entry.id} className="history-item">
                          <div className="history-item__top">
                            <strong>{entry.name}</strong>
                            <span className="badge">{formatCategory(entry.category)}</span>
                          </div>
                          <p className="muted">
                            {entry.location} | Patch {entry.patch} |{' '}
                            {entry.supportRoles.map((role) => collectionSupportRoles.find((value) => value.id === role)?.label ?? role).join(' / ')}
                          </p>
                          <p className="muted"><strong>解鎖任務：</strong>{entry.unlockQuest}</p>
                          <p className="muted">{entry.unlockSummary}</p>
                          <p className="muted"><strong>常見獎勵：</strong>{entry.rewardSummary.join(' / ')}</p>
                          {entry.notes ? <p className="muted">{entry.notes}</p> : null}
                          <div className="badge-row">
                            <span className={currentStatus === 'completed' ? 'badge badge--positive' : currentStatus === 'active' ? 'badge badge--warning' : 'badge'}>
                              {formatStatus(currentStatus)}
                            </span>
                            {isWishlisted ? <span className="badge badge--positive">願望清單</span> : null}
                          </div>
                          <div className="button-row">
                            <button className="button button--ghost" onClick={() => cycleStatus(entry.id)} type="button">
                              {getNextStatusLabel(currentStatus)}
                            </button>
                            <button className="button button--ghost" onClick={() => handleWishlist(entry.id)} type="button">
                              {isWishlisted ? '移出願望清單' : '加入願望清單'}
                            </button>
                            {entry.supportRoles.includes('crafting') ? (
                              <Link className="button button--ghost" to="/craft">製作助手</Link>
                            ) : null}
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
                </article>
              ))}
          </div>
        )}
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>備份與匯出</h2>
            <p>收藏追蹤資料只存瀏覽器本機。你可以手動匯出 / 匯入備份碼，不會上傳到本站。</p>
          </div>
          <label className="field">
            <span className="field-label">匯出備份碼</span>
            <textarea className="input-text" readOnly rows={6} value={exportCode} />
          </label>
          <div className="button-row">
            <button className="button button--primary" onClick={() => void handleCopyExport()} type="button">
              {copied ? '已複製' : '複製備份碼'}
            </button>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>匯入與重設</h2>
            <p>貼上之前匯出的備份碼即可還原。若要重新開始，也可以直接清空目前的追蹤狀態。</p>
          </div>
          <label className="field">
            <span className="field-label">貼上備份碼</span>
            <textarea className="input-text" onChange={(event) => setImportCode(event.target.value)} rows={6} value={importCode} />
          </label>
          <div className="button-row">
            <button className="button button--ghost" onClick={handleImport} type="button">匯入追蹤資料</button>
            <button
              className="button button--ghost"
              onClick={() => {
                setTrackerState(createDefaultCollectionTrackerState())
                setImportCode('')
                setMessage('已清空目前的收藏追蹤狀態。')
              }}
              type="button"
            >
              清空目前狀態
            </button>
          </div>
          {trackerState.importedAt ? (
            <p className="muted">
              最近一次匯入時間：{new Date(trackerState.importedAt).toLocaleString('zh-TW', { hour12: false })}
            </p>
          ) : null}
        </article>
      </section>

      {message ? (
        <section className="page-card">
          <div className="callout">
            <span className="callout-title">狀態訊息</span>
            <span className="callout-body">{message}</span>
          </div>
        </section>
      ) : null}

      <SourceAttribution entries={pageSources.collection.entries} />
    </div>
  )
}

export default CollectionPage
