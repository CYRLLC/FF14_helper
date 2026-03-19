import { useEffect, useMemo, useRef, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { coordsToMapPercent, findNearestAetheryte } from '../treasure/coords'
import { addPointToRoute, buildPartyMessage, optimizePartyRoute, type TreasurePartyRouteItem } from '../treasure/party'
import {
  createRealtimeTreasureRoom,
  getRealtimeTreasureCurrentUserId,
  isRealtimeTreasureAvailable,
  joinRealtimeTreasureRoom,
  leaveRealtimeTreasureRoom,
  subscribeRealtimeTreasureRoom,
  updateRealtimeTreasureNickname,
  updateRealtimeTreasureRoute,
  type RealtimeTreasureRoomState,
} from '../treasure/liveSync'
import { getMapsForGrade, getPointsForSelection, loadTreasureReferenceData, type TreasureReferenceData } from '../treasure/referenceData'
import type { RuntimeConfig, TreasureGradeInfo, TreasureMapInfo, TreasurePoint } from '../types'
import { getErrorMessage } from '../utils/errors'

const STORAGE_KEY = 'ff14-helper.treasure.finder.v5'

type TreasureTab = 'solo' | 'party'

const TABS: Array<{ id: TreasureTab; label: string }> = [
  { id: 'solo', label: '單人模式' },
  { id: 'party', label: '8 人模式' },
]

interface SavedState {
  activeTab: TreasureTab
  gradeId: string
  mapId: number
  pointId: string
  localMembers: string[]
  partyRoutes: Record<string, TreasurePartyRouteItem[]>
  realtimeNickname: string
  lastRoomCode: string
}

interface TreasurePageProps {
  config: RuntimeConfig
}

function getDefaultState(): SavedState {
  return { activeTab: 'party', gradeId: '', mapId: 0, pointId: '', localMembers: [], partyRoutes: {}, realtimeNickname: '', lastRoomCode: '' }
}

function readSavedState(): SavedState {
  if (typeof window === 'undefined') return getDefaultState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultState()
    const parsed = JSON.parse(raw) as Partial<SavedState & { groupMode?: string }>
    // migrate old groupMode key to activeTab
    const activeTab: TreasureTab = parsed.activeTab ?? (parsed.groupMode === 'solo' ? 'solo' : 'party')
    return { ...getDefaultState(), ...parsed, activeTab }
  } catch {
    return getDefaultState()
  }
}

function parseMembersInput(value: string): string[] {
  return value.split(/[,\n]/gu).map((e) => e.trim()).filter((e, i, a) => Boolean(e) && a.indexOf(e) === i).slice(0, 8)
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value)
}

function getMapPointLabel(points: TreasurePoint[], pointId: string): string {
  const index = points.findIndex((p) => p.id === pointId)
  return index === -1 ? '-' : `#${index + 1}`
}

function buildInviteLink(roomCode: string): string {
  return `${window.location.origin}${window.location.pathname}#/treasure?room=${roomCode}`
}

function readRoomCodeFromHash(): string {
  const match = window.location.hash.match(/room=([A-Z2-9]{8})/u)
  return match?.[1] ?? ''
}

function TreasurePage({ config }: TreasurePageProps) {
  const [savedState] = useState(() => readSavedState())
  const [referenceData, setReferenceData] = useState<TreasureReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TreasureTab>(savedState.activeTab)
  const [gradeId, setGradeId] = useState(savedState.gradeId)
  const [mapId, setMapId] = useState(savedState.mapId)
  const [pointId, setPointId] = useState(savedState.pointId)
  const [partyRoutes, setPartyRoutes] = useState<Record<string, TreasurePartyRouteItem[]>>(savedState.partyRoutes)
  const [membersInput, setMembersInput] = useState(savedState.localMembers.join(', '))
  const [realtimeNickname, setRealtimeNickname] = useState(savedState.realtimeNickname)
  const [roomName, setRoomName] = useState('FF14 藏寶圖隊伍')
  const [roomCodeInput, setRoomCodeInput] = useState(savedState.lastRoomCode || readRoomCodeFromHash())
  const [activeRoomCode, setActiveRoomCode] = useState('')
  const [liveRoomState, setLiveRoomState] = useState<RealtimeTreasureRoomState | null>(null)
  const [liveUserId, setLiveUserId] = useState<string | null>(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(Boolean(readRoomCodeFromHash()))
  const realtimeEnabled = isRealtimeTreasureAvailable(config)

  const [ttlDisplay, setTtlDisplay] = useState<string>('')
  const ttlEpochRef = useRef<{ snapshotMs: number; capturedAt: number } | null>(null)

  // derive groupMode from activeTab
  const groupMode = activeTab

  useEffect(() => {
    let cancelled = false
    loadTreasureReferenceData()
      .then((data) => { if (!cancelled) setReferenceData(data) })
      .catch((error: unknown) => { if (!cancelled) setErrorMessage(getErrorMessage(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const visibleGrades = useMemo(
    () => referenceData?.grades.filter((grade) => (groupMode === 'party' ? grade.partySize === 8 : grade.partySize === 1)) ?? [],
    [groupMode, referenceData],
  )
  const activeGrade = useMemo<TreasureGradeInfo | null>(
    () => visibleGrades.find((g) => g.id === gradeId) ?? visibleGrades[0] ?? null,
    [gradeId, visibleGrades],
  )
  const availableMaps = useMemo<TreasureMapInfo[]>(
    () => (referenceData && activeGrade ? getMapsForGrade(referenceData, activeGrade.id) : []),
    [activeGrade, referenceData],
  )
  const activeMap = useMemo<TreasureMapInfo | null>(
    () => availableMaps.find((m) => m.id === mapId) ?? availableMaps[0] ?? null,
    [availableMaps, mapId],
  )
  const visiblePoints = useMemo<TreasurePoint[]>(
    () => (referenceData && activeGrade && activeMap ? getPointsForSelection(referenceData, activeGrade.id, activeMap.id) : []),
    [activeGrade, activeMap, referenceData],
  )
  const activePoint = useMemo<TreasurePoint | null>(
    () => visiblePoints.find((p) => p.id === pointId) ?? visiblePoints[0] ?? null,
    [pointId, visiblePoints],
  )
  const gradePoints = useMemo<TreasurePoint[]>(
    () => (referenceData && activeGrade ? referenceData.points.filter((p) => p.gradeId === activeGrade.id || p.itemId === activeGrade.itemId) : []),
    [activeGrade, referenceData],
  )
  const activeRoute = useMemo<TreasurePartyRouteItem[]>(
    () => (activeGrade ? partyRoutes[activeGrade.id] ?? [] : []),
    [activeGrade, partyRoutes],
  )
  const localMembers = useMemo(() => parseMembersInput(membersInput), [membersInput])
  const memberOptions = useMemo(
    () => (liveRoomState ? liveRoomState.members.map((m) => m.nickname) : localMembers),
    [liveRoomState, localMembers],
  )
  const routeMapIds = useMemo(
    () => [...new Set(activeRoute.map((r) => gradePoints.find((p) => p.id === r.pointId)?.mapId).filter((v): v is number => typeof v === 'number'))],
    [activeRoute, gradePoints],
  )
  const routeSummary = useMemo(() => {
    const completed = activeRoute.filter((e) => e.completed).length
    const assigned = activeRoute.filter((e) => e.playerName.trim().length > 0).length
    return { total: activeRoute.length, completed, remaining: Math.max(0, activeRoute.length - completed), assigned, unassigned: Math.max(0, activeRoute.length - assigned) }
  }, [activeRoute])
  const inviteLink = useMemo(() => (activeRoomCode ? buildInviteLink(activeRoomCode) : ''), [activeRoomCode])
  const [previewMapId, setPreviewMapId] = useState<number>(0)

  useEffect(() => {
    if (!previewMapId && routeMapIds.length > 0) setPreviewMapId(routeMapIds[0])
  }, [previewMapId, routeMapIds])

  useEffect(() => {
    if (!activeGrade || !activeMap || !activePoint) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeTab,
      gradeId: activeGrade.id, mapId: activeMap.id, pointId: activePoint.id,
      localMembers, partyRoutes, realtimeNickname, lastRoomCode: activeRoomCode || roomCodeInput,
    }))
  }, [activeGrade, activeMap, activePoint, activeRoomCode, activeTab, localMembers, partyRoutes, realtimeNickname, roomCodeInput])

  useEffect(() => {
    if (!realtimeEnabled || !activeRoomCode) return
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    subscribeRealtimeTreasureRoom(config, activeRoomCode, (state) => {
      if (cancelled) return
      if (!state) {
        ttlEpochRef.current = null
        setTtlDisplay('')
        setLiveRoomState(null)
        setActiveRoomCode('')
        setLiveError('房間不存在或已過期。')
        return
      }
      setLiveRoomState(state)
      ttlEpochRef.current = { snapshotMs: state.expiresInMs, capturedAt: Date.now() }
      setPartyRoutes((current) => ({ ...current, [state.gradeId]: state.route }))
      if (referenceData) {
        const syncedGrade = referenceData.grades.find((g) => g.id === state.gradeId)
        if (syncedGrade) {
          setActiveTab('party')
          setGradeId(syncedGrade.id)
        }
      }
    }, (error) => !cancelled && setLiveError(getErrorMessage(error))).then((next) => { if (!cancelled) unsubscribe = next })
    return () => { cancelled = true; unsubscribe?.() }
  }, [activeRoomCode, config, realtimeEnabled, referenceData])

  useEffect(() => {
    if (!activeRoomCode) { setTtlDisplay(''); ttlEpochRef.current = null; return }
    const id = window.setInterval(() => {
      const epoch = ttlEpochRef.current
      if (!epoch) return
      setTtlDisplay(formatDuration(Math.max(0, epoch.snapshotMs - (Date.now() - epoch.capturedAt))))
    }, 1000)
    return () => window.clearInterval(id)
  }, [activeRoomCode])

  async function handleCopy(label: string, text: string): Promise<void> {
    try {
      await copyText(text)
      setCopiedLabel(label)
      window.setTimeout(() => setCopiedLabel((c) => (c === label ? null : c)), 1500)
    } catch (error) {
      setLiveError(getErrorMessage(error))
    }
  }

  function replaceCurrentGradeRoute(nextRoute: TreasurePartyRouteItem[]): void {
    if (!activeGrade) return
    setPartyRoutes((current) => ({ ...current, [activeGrade.id]: nextRoute }))
  }

  async function commitRoute(nextRoute: TreasurePartyRouteItem[], msg: string): Promise<void> {
    replaceCurrentGradeRoute(nextRoute)
    setStatusMessage(msg)
    if (activeRoomCode) {
      try { await updateRealtimeTreasureRoute(config, activeRoomCode, nextRoute) }
      catch (error) { setLiveError(getErrorMessage(error)) }
    }
  }

  async function handleCreateRoom(): Promise<void> {
    if (!realtimeEnabled || !activeGrade) return
    setLiveBusy(true); setLiveError(null)
    try {
      const result = await createRealtimeTreasureRoom({ config, gradeId: activeGrade.id, roomName, nickname: realtimeNickname.trim() || '隊長', initialRoute: activeRoute })
      setLiveUserId(await getRealtimeTreasureCurrentUserId(config))
      setActiveRoomCode(result.roomCode)
      setRoomCodeInput(result.roomCode)
      setStatusMessage(`已建立房間 ${result.roomCode}。`)
      setShowCreateModal(false)
    } catch (error) { setLiveError(getErrorMessage(error)) }
    finally { setLiveBusy(false) }
  }

  async function handleJoinRoom(): Promise<void> {
    if (!realtimeEnabled) return
    setLiveBusy(true); setLiveError(null)
    try {
      const result = await joinRealtimeTreasureRoom({ config, roomCode: roomCodeInput, nickname: realtimeNickname.trim() || '隊員' })
      setLiveUserId(await getRealtimeTreasureCurrentUserId(config))
      setActiveRoomCode(result.roomCode)
      setStatusMessage(`已加入房間 ${result.roomCode}。`)
      setShowJoinModal(false)
    } catch (error) { setLiveError(getErrorMessage(error)) }
    finally { setLiveBusy(false) }
  }

  async function handleLeaveRoom(): Promise<void> {
    if (!activeRoomCode) return
    setLiveBusy(true)
    try {
      await leaveRealtimeTreasureRoom(config, activeRoomCode)
      setActiveRoomCode(''); setLiveRoomState(null); setStatusMessage('已離開房間。')
    } catch (error) { setLiveError(getErrorMessage(error)) }
    finally { setLiveBusy(false) }
  }

  async function handleUpdateNickname(): Promise<void> {
    if (!activeRoomCode) return
    try { await updateRealtimeTreasureNickname(config, activeRoomCode, realtimeNickname); setStatusMessage('已更新你的暱稱。') }
    catch (error) { setLiveError(getErrorMessage(error)) }
  }

  function handleTabSwitch(tab: TreasureTab): void {
    setActiveTab(tab)
    // reset grade/map/point to first available for new mode
    if (referenceData) {
      const grades = referenceData.grades.filter((g) => (tab === 'party' ? g.partySize === 8 : g.partySize === 1))
      const firstGrade = grades[0]
      if (firstGrade) {
        const maps = getMapsForGrade(referenceData, firstGrade.id)
        const firstMap = maps[0]
        const firstPoint = firstMap ? getPointsForSelection(referenceData, firstGrade.id, firstMap.id)[0] : null
        if (firstMap && firstPoint) {
          setGradeId(firstGrade.id)
          setMapId(firstMap.id)
          setPointId(firstPoint.id)
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="page-grid">
        <section className="page-card">
          <div className="section-heading"><h2>藏寶圖資料載入中</h2><p>正在讀取本地 snapshot。</p></div>
        </section>
      </div>
    )
  }

  if (errorMessage || !referenceData || !activeGrade || !activeMap || !activePoint) {
    return (
      <div className="page-grid">
        <section className="page-card">
          <div className="section-heading"><h2>藏寶圖頁無法載入</h2><p>{errorMessage ?? '缺少可用的藏寶圖資料。'}</p></div>
        </section>
      </div>
    )
  }

  const previewMap = referenceData.maps.find((m) => m.id === previewMapId) ?? activeMap
  const previewRoutePoints = activeRoute
    .map((r) => { const p = gradePoints.find((e) => e.id === r.pointId); return p && p.mapId === previewMap.id ? { routeEntry: r, point: p } : null })
    .filter((e): e is { routeEntry: TreasurePartyRouteItem; point: TreasurePoint } => e !== null)

  return (
    <div className="page-grid">
      <section className="site-header">
        <p className="eyebrow">藏寶圖助手</p>
        <h2>全圖點位、單人檢索、8 人路線與即時房間</h2>
        <div className="badge-row">
          <span className="badge badge--positive">{referenceData.loadedFrom === 'cache' ? '使用本機快取' : '使用本地 snapshot'}</span>
          <span className="badge">{realtimeEnabled ? '可建立即時房間' : '未設定即時房間'}</span>
          {activeRoomCode ? <span className="badge badge--positive">已連線房間 {activeRoomCode}</span> : null}
        </div>
        <div className="tool-tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tool-tab tool-tab--active' : 'tool-tab'}
              onClick={() => handleTabSwitch(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab: 單人模式 */}
      {activeTab === 'solo' && (
        <div className="tool-panel">
          <article className="page-card">
            <div className="section-heading">
              <h2>選寶圖等級與地圖</h2>
              <p>單人模式只看點位與座標，不需要組隊房間。</p>
            </div>
            <div className="choice-row">
              {visibleGrades.map((grade) => (
                <button
                  key={grade.id}
                  className={grade.id === activeGrade.id ? 'choice-button choice-button--active' : 'choice-button'}
                  onClick={() => {
                    const nextMap = getMapsForGrade(referenceData, grade.id)[0]
                    const nextPoint = nextMap ? getPointsForSelection(referenceData, grade.id, nextMap.id)[0] : null
                    if (!nextMap || !nextPoint) return
                    setGradeId(grade.id); setMapId(nextMap.id); setPointId(nextPoint.id)
                  }}
                  type="button"
                >
                  {grade.label} | {grade.itemName}
                </button>
              ))}
            </div>
            <div className="choice-row">
              {availableMaps.map((map) => (
                <button
                  key={map.id}
                  className={map.id === activeMap.id ? 'choice-button choice-button--active' : 'choice-button'}
                  onClick={() => {
                    const nextPoint = getPointsForSelection(referenceData, activeGrade.id, map.id)[0]
                    if (!nextPoint) return
                    setMapId(map.id); setPointId(nextPoint.id)
                  }}
                  type="button"
                >
                  {map.label}
                </button>
              ))}
            </div>
          </article>

          <article className="page-card">
            <div className="section-heading">
              <h2>點位與地圖</h2>
              <p>點擊地圖上的標記或下方點位卡片來切換目前點位，再複製座標。</p>
            </div>
            <div className="treasure-finder-layout">
              <div className="map-viewer">
                <img className="map-viewer__image" alt={activeMap.label} src={activeMap.imageUrl} />
                {visiblePoints.map((point) => {
                  const pct = coordsToMapPercent(point, activeMap.sizeFactor)
                  return (
                    <button
                      key={point.id}
                      className={point.id === activePoint.id ? 'map-viewer__marker map-viewer__marker--active' : 'map-viewer__marker'}
                      onClick={() => setPointId(point.id)}
                      style={{ left: `${pct.x}%`, top: `${pct.y}%` }}
                      type="button"
                    >
                      {getMapPointLabel(visiblePoints, point.id).replace('#', '')}
                    </button>
                  )
                })}
              </div>
              <div className="page-grid">
                <div className="stats-grid">
                  <article className="stat-card"><div className="stat-label">寶圖等級</div><div className="stat-value">{activeGrade.label}</div></article>
                  <article className="stat-card"><div className="stat-label">地圖</div><div className="stat-value">{activeMap.label}</div></article>
                  <article className="stat-card"><div className="stat-label">座標 X</div><div className="stat-value">{activePoint.x.toFixed(1)}</div></article>
                  <article className="stat-card"><div className="stat-label">座標 Y</div><div className="stat-value">{activePoint.y.toFixed(1)}</div></article>
                </div>
                <div className="callout">
                  <span className="callout-title">最近以太之光</span>
                  <span className="callout-body">
                    {(() => {
                      const nearest = findNearestAetheryte(activeMap.zoneId, activePoint, referenceData.aetherytes)
                      return nearest ? `${nearest.name} (${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)})` : '這張地圖沒有對應資料'
                    })()}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="button button--ghost"
                    onClick={() => void handleCopy(`coord-${activePoint.id}`, `${activeMap.label} X:${activePoint.x.toFixed(1)} Y:${activePoint.y.toFixed(1)}`)}
                    type="button"
                  >
                    {copiedLabel === `coord-${activePoint.id}` ? '已複製座標' : '複製座標文字'}
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="page-card">
            <div className="section-heading">
              <h2>同張地圖所有點位</h2>
              <p>可直接切換點位、複製座標。</p>
            </div>
            <div className="treasure-card-grid">
              {visiblePoints.map((point) => (
                <article key={point.id} className={point.id === activePoint.id ? 'treasure-card treasure-card--active' : 'treasure-card'}>
                  <div className="history-item__top">
                    <strong>{getMapPointLabel(visiblePoints, point.id)}</strong>
                    <span className="badge">{activeGrade.label}</span>
                  </div>
                  <p className="treasure-card__meta">X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}</p>
                  <p className="treasure-card__meta">
                    最近以太之光：{findNearestAetheryte(activeMap.zoneId, point, referenceData.aetherytes)?.name ?? '無資料'}
                  </p>
                  <div className="button-row">
                    <button className="button button--ghost" onClick={() => setPointId(point.id)} type="button">切換到這個點</button>
                    <button
                      className="button button--ghost"
                      onClick={() => void handleCopy(`coord-${point.id}`, `${activeMap.label} X:${point.x.toFixed(1)} Y:${point.y.toFixed(1)}`)}
                      type="button"
                    >
                      {copiedLabel === `coord-${point.id}` ? '已複製' : '複製座標'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      )}

      {/* Tab: 8 人模式 */}
      {activeTab === 'party' && (
        <div className="tool-panel">
          <article className="page-card">
            <div className="section-heading">
              <h2>選寶圖等級與地圖</h2>
              <p>選好等級後可建立或加入即時房間，再一起規劃路線。</p>
            </div>
            <div className="choice-row">
              {visibleGrades.map((grade) => (
                <button
                  key={grade.id}
                  className={grade.id === activeGrade.id ? 'choice-button choice-button--active' : 'choice-button'}
                  disabled={Boolean(activeRoomCode) && grade.id !== activeGrade.id}
                  onClick={() => {
                    const nextMap = getMapsForGrade(referenceData, grade.id)[0]
                    const nextPoint = nextMap ? getPointsForSelection(referenceData, grade.id, nextMap.id)[0] : null
                    if (!nextMap || !nextPoint) return
                    setGradeId(grade.id); setMapId(nextMap.id); setPointId(nextPoint.id)
                  }}
                  type="button"
                >
                  {grade.label} | {grade.itemName}
                </button>
              ))}
            </div>
            <div className="choice-row">
              {availableMaps.map((map) => (
                <button
                  key={map.id}
                  className={map.id === activeMap.id ? 'choice-button choice-button--active' : 'choice-button'}
                  onClick={() => {
                    const nextPoint = getPointsForSelection(referenceData, activeGrade.id, map.id)[0]
                    if (!nextPoint) return
                    setMapId(map.id); setPointId(nextPoint.id)
                  }}
                  type="button"
                >
                  {map.label}
                </button>
              ))}
            </div>
          </article>

          <article className="page-card">
            <div className="section-heading">
              <h2>房間與隊伍</h2>
              <p>建立或加入房間後可即時同步路線，離開後資料保留本機。房間有效期 24 小時。</p>
            </div>
            {!realtimeEnabled ? (
              <>
                <div className="callout callout--error">
                  <span className="callout-title">即時房間未啟用</span>
                  <span className="callout-body">此環境未設定 Firebase，無法使用建隊與入隊功能。你仍可用本機隊員清單進行離線路線規劃。</span>
                </div>
                <label className="field">
                  <span className="field-label">本機隊員清單（逗號或換行分隔）</span>
                  <input className="input-text" onChange={(e) => setMembersInput(e.target.value)} placeholder="隊員1, 隊員2, ..." type="text" value={membersInput} />
                </label>
                {localMembers.length > 0 ? (
                  <div className="callout"><span className="callout-title">離線隊員名單</span><span className="callout-body">{localMembers.join(' / ')}</span></div>
                ) : null}
              </>
            ) : activeRoomCode ? (
              <div className="source-grid">
                <div className="page-grid">
                  <div className="stats-grid">
                    <article className="stat-card"><div className="stat-label">房間代碼</div><div className="stat-value">{activeRoomCode}</div></article>
                    <article className="stat-card"><div className="stat-label">房間名稱</div><div className="stat-value">{liveRoomState?.roomName ?? roomName}</div></article>
                    <article className="stat-card"><div className="stat-label">到期倒數</div><div className="stat-value">{ttlDisplay || formatDuration(liveRoomState?.expiresInMs ?? 0)}</div></article>
                    <article className="stat-card"><div className="stat-label">到期時間</div><div className="stat-value">{liveRoomState?.expiresAtLabel ?? '未知'}</div></article>
                    <article className="stat-card"><div className="stat-label">最近更新</div><div className="stat-value">{liveRoomState?.updatedAtLabel ?? '尚未更新'}</div></article>
                    <article className="stat-card"><div className="stat-label">成員人數</div><div className="stat-value">{liveRoomState?.members.length ?? 1}</div></article>
                  </div>
                  <div className="badge-row"><span className="badge badge--positive">已連線</span></div>
                  {liveRoomState ? (
                    <div className="callout">
                      <span className="callout-title">目前成員</span>
                      <span className="callout-body">
                        {liveRoomState.members.map((m) => (m.userId === liveUserId ? `${m.nickname}（你）` : m.nickname)).join(' / ')}
                      </span>
                    </div>
                  ) : null}
                  <label className="field">
                    <span className="field-label">邀請連結</span>
                    <input className="input-text" readOnly type="text" value={inviteLink} />
                  </label>
                </div>
                <div className="page-grid">
                  <label className="field">
                    <span className="field-label">你的暱稱</span>
                    <input className="input-text" onBlur={() => void handleUpdateNickname()} onChange={(e) => setRealtimeNickname(e.target.value)} type="text" value={realtimeNickname} />
                  </label>
                  <div className="button-row">
                    <button className="button button--ghost" onClick={() => void handleCopy('room-code', activeRoomCode)} type="button">{copiedLabel === 'room-code' ? '已複製代碼' : '複製房間代碼'}</button>
                    <button className="button button--ghost" onClick={() => void handleCopy('invite-link', buildInviteLink(activeRoomCode))} type="button">{copiedLabel === 'invite-link' ? '已複製邀請連結' : '複製邀請連結'}</button>
                    <button className="button button--ghost" disabled={liveBusy} onClick={() => void handleLeaveRoom()} type="button">離開隊伍</button>
                  </div>
                  {liveError ? (
                    <div className="callout callout--error">
                      <span className="callout-title">房間錯誤</span>
                      <span className="callout-body">{liveError}</span>
                      <div className="button-row">
                        <button className="button button--primary" onClick={() => { setLiveError(null); setShowCreateModal(true) }} type="button">建立新房間</button>
                        <button className="button button--ghost" onClick={() => { setLiveError(null); setShowJoinModal(true) }} type="button">加入其他房間</button>
                      </div>
                    </div>
                  ) : null}
                  {statusMessage ? <div className="callout callout--success"><span className="callout-title">狀態</span><span className="callout-body">{statusMessage}</span></div> : null}
                </div>
              </div>
            ) : (
              <>
                {liveError ? (
                  <div className="callout callout--error">
                    <span className="callout-title">房間錯誤</span>
                    <span className="callout-body">{liveError}</span>
                    <div className="button-row">
                      <button className="button button--primary" disabled={liveBusy} onClick={() => { setLiveError(null); setShowCreateModal(true) }} type="button">建立新房間</button>
                      <button className="button button--ghost" disabled={liveBusy} onClick={() => { setLiveError(null); setShowJoinModal(true) }} type="button">加入其他房間</button>
                    </div>
                  </div>
                ) : (
                  <div className="button-row">
                    <button className="button button--primary" disabled={liveBusy} onClick={() => setShowCreateModal(true)} type="button">建立隊伍</button>
                    <button className="button button--ghost" disabled={liveBusy} onClick={() => setShowJoinModal(true)} type="button">加入隊伍</button>
                  </div>
                )}
                <label className="field">
                  <span className="field-label">本機隊員清單（離線規劃用）</span>
                  <input className="input-text" onChange={(e) => setMembersInput(e.target.value)} placeholder="隊員1, 隊員2, ..." type="text" value={membersInput} />
                </label>
                {localMembers.length > 0 ? (
                  <div className="callout">
                    <span className="callout-title">離線隊員名單</span>
                    <span className="callout-body">{localMembers.join(' / ')}</span>
                    <span className="muted">尚未連到即時房間時，路線指派會先使用這份本機隊員名單。</span>
                  </div>
                ) : null}
                {statusMessage ? <div className="callout callout--success"><span className="callout-title">狀態</span><span className="callout-body">{statusMessage}</span></div> : null}
              </>
            )}
          </article>

          <article className="page-card">
            <div className="section-heading">
              <h2>點位與地圖</h2>
              <p>點擊地圖標記選點位，再加入隊伍路線。</p>
            </div>
            <div className="treasure-finder-layout">
              <div className="map-viewer">
                <img className="map-viewer__image" alt={activeMap.label} src={activeMap.imageUrl} />
                {visiblePoints.map((point) => {
                  const pct = coordsToMapPercent(point, activeMap.sizeFactor)
                  return (
                    <button
                      key={point.id}
                      className={point.id === activePoint.id ? 'map-viewer__marker map-viewer__marker--active' : 'map-viewer__marker'}
                      onClick={() => setPointId(point.id)}
                      style={{ left: `${pct.x}%`, top: `${pct.y}%` }}
                      type="button"
                    >
                      {getMapPointLabel(visiblePoints, point.id).replace('#', '')}
                    </button>
                  )
                })}
              </div>
              <div className="page-grid">
                <div className="stats-grid">
                  <article className="stat-card"><div className="stat-label">寶圖等級</div><div className="stat-value">{activeGrade.label}</div></article>
                  <article className="stat-card"><div className="stat-label">地圖</div><div className="stat-value">{activeMap.label}</div></article>
                  <article className="stat-card"><div className="stat-label">座標 X</div><div className="stat-value">{activePoint.x.toFixed(1)}</div></article>
                  <article className="stat-card"><div className="stat-label">座標 Y</div><div className="stat-value">{activePoint.y.toFixed(1)}</div></article>
                </div>
                <div className="callout">
                  <span className="callout-title">最近以太之光</span>
                  <span className="callout-body">
                    {(() => {
                      const nearest = findNearestAetheryte(activeMap.zoneId, activePoint, referenceData.aetherytes)
                      return nearest ? `${nearest.name} (${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)})` : '這張地圖沒有對應資料'
                    })()}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="button button--ghost"
                    onClick={() => void handleCopy(`coord-${activePoint.id}`, `${activeMap.label} X:${activePoint.x.toFixed(1)} Y:${activePoint.y.toFixed(1)}`)}
                    type="button"
                  >
                    {copiedLabel === `coord-${activePoint.id}` ? '已複製座標' : '複製座標文字'}
                  </button>
                  <button className="button button--primary" onClick={() => void commitRoute(addPointToRoute(activeRoute, activePoint.id), '已加入路線。')} type="button">加入隊伍路線</button>
                </div>
              </div>
            </div>
          </article>

          <article className="page-card">
            <div className="section-heading">
              <h2>同張地圖所有點位</h2>
              <p>可直接切換點位、複製座標，或加進隊伍路線。</p>
            </div>
            <div className="treasure-card-grid">
              {visiblePoints.map((point) => (
                <article key={point.id} className={point.id === activePoint.id ? 'treasure-card treasure-card--active' : 'treasure-card'}>
                  <div className="history-item__top">
                    <strong>{getMapPointLabel(visiblePoints, point.id)}</strong>
                    <span className="badge">{activeGrade.label}</span>
                  </div>
                  <p className="treasure-card__meta">X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}</p>
                  <p className="treasure-card__meta">最近以太之光：{findNearestAetheryte(activeMap.zoneId, point, referenceData.aetherytes)?.name ?? '無資料'}</p>
                  <div className="button-row">
                    <button className="button button--ghost" onClick={() => setPointId(point.id)} type="button">切換到這個點</button>
                    <button className="button button--ghost" onClick={() => void handleCopy(`coord-${point.id}`, `${activeMap.label} X:${point.x.toFixed(1)} Y:${point.y.toFixed(1)}`)} type="button">
                      {copiedLabel === `coord-${point.id}` ? '已複製' : '複製座標'}
                    </button>
                    <button className="button button--primary" onClick={() => void commitRoute(addPointToRoute(activeRoute, point.id), '已加入路線。')} type="button">加入路線</button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="page-card">
            <div className="section-heading">
              <h2>隊伍路線規劃</h2>
              <p>左側是路線清單，右側是地圖預覽。可指派成員、調整順序、複製隊頻訊息。</p>
            </div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-label">總路線數</div><div className="stat-value">{routeSummary.total}</div></article>
              <article className="stat-card"><div className="stat-label">已完成</div><div className="stat-value">{routeSummary.completed}</div></article>
              <article className="stat-card"><div className="stat-label">待處理</div><div className="stat-value">{routeSummary.remaining}</div></article>
              <article className="stat-card"><div className="stat-label">已指派</div><div className="stat-value">{routeSummary.assigned}</div></article>
              <article className="stat-card"><div className="stat-label">未指派</div><div className="stat-value">{routeSummary.unassigned}</div></article>
            </div>
            <div className="button-row">
              <button className="button button--ghost" onClick={() => void commitRoute(optimizePartyRoute(activeRoute, gradePoints, referenceData.maps), '已自動整理路線順序。')} type="button">自動優化路線</button>
              <button className="button button--ghost" onClick={() => void commitRoute(activeRoute.filter((e) => !e.completed), '已清除已完成項目。')} type="button">清除已完成</button>
              <button className="button button--ghost" onClick={() => void commitRoute([], '已清空整條路線。')} type="button">清空路線</button>
            </div>
            {activeRoute.length === 0 ? (
              <div className="empty-state">
                <strong>目前沒有路線</strong>
                <p>從上方點位卡片把寶點加入隊伍路線後，這裡就會顯示規劃內容。</p>
              </div>
            ) : (
              <div className="route-planner-layout">
                <div className="route-list">
                  {activeRoute.map((routeEntry, index) => {
                    const point = gradePoints.find((e) => e.id === routeEntry.pointId)
                    if (!point) return null
                    const routeMap = referenceData.maps.find((m) => m.id === point.mapId) ?? activeMap
                    return (
                      <article key={routeEntry.id} className={routeEntry.completed ? 'treasure-card treasure-card--done' : 'treasure-card'}>
                        <div className="history-item__top">
                          <strong>#{index + 1} | {routeMap.label} {getMapPointLabel(gradePoints.filter((e) => e.mapId === routeMap.id), point.id)}</strong>
                          <span className="badge">{routeEntry.completed ? '已完成' : '進行中'}</span>
                        </div>
                        <p className="treasure-card__meta">X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}</p>
                        <div className="field-grid">
                          <label className="field">
                            <span className="field-label">指派成員</span>
                            <select className="input-select" onChange={(e) => void commitRoute(activeRoute.map((r) => r.id === routeEntry.id ? { ...r, playerName: e.target.value } : r), '已更新成員分配。')} value={routeEntry.playerName}>
                              <option value="">未指定</option>
                              {memberOptions.map((name) => <option key={`${routeEntry.id}-${name}`} value={name}>{name}</option>)}
                            </select>
                          </label>
                          <label className="field">
                            <span className="field-label">備註</span>
                            <input className="input-text" onChange={(e) => void commitRoute(activeRoute.map((r) => r.id === routeEntry.id ? { ...r, note: e.target.value } : r), '已更新路線備註。')} type="text" value={routeEntry.note} />
                          </label>
                        </div>
                        <div className="button-row">
                          <button className="button button--ghost" onClick={() => { setMapId(routeMap.id); setPointId(point.id); setPreviewMapId(routeMap.id) }} type="button">定位到地圖</button>
                          <button className="button button--ghost" disabled={index === 0} onClick={() => { const r = [...activeRoute]; [r[index - 1], r[index]] = [r[index], r[index - 1]]; void commitRoute(r, '已調整路線順序。') }} type="button">上移</button>
                          <button className="button button--ghost" disabled={index === activeRoute.length - 1} onClick={() => { const r = [...activeRoute]; [r[index + 1], r[index]] = [r[index], r[index + 1]]; void commitRoute(r, '已調整路線順序。') }} type="button">下移</button>
                          <button className="button button--ghost" onClick={() => void commitRoute(activeRoute.map((r) => r.id === routeEntry.id ? { ...r, completed: !r.completed } : r), routeEntry.completed ? '已改回未完成。' : '已標記完成。')} type="button">{routeEntry.completed ? '改回未完成' : '標記完成'}</button>
                          <button className="button button--ghost" onClick={() => void commitRoute(activeRoute.filter((r) => r.id !== routeEntry.id), '已移除一個路線點。')} type="button">移除</button>
                          <button className="button button--primary" onClick={() => void handleCopy(`party-${routeEntry.id}`, buildPartyMessage(point, routeMap, referenceData.aetherytes, routeEntry.playerName))} type="button">{copiedLabel === `party-${routeEntry.id}` ? '已複製隊頻' : '複製隊頻訊息'}</button>
                        </div>
                      </article>
                    )
                  })}
                </div>
                <div className="page-grid">
                  <div className="choice-row">
                    {routeMapIds.map((mapEntryId) => {
                      const map = referenceData.maps.find((m) => m.id === mapEntryId)
                      return map ? (
                        <button key={map.id} className={previewMap.id === map.id ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setPreviewMapId(map.id)} type="button">
                          {map.label}
                        </button>
                      ) : null
                    })}
                  </div>
                  <div className="map-viewer map-viewer--preview">
                    <img className="map-viewer__image" alt={previewMap.label} src={previewMap.imageUrl} />
                    {previewRoutePoints.map(({ routeEntry, point }, index) => {
                      const pct = coordsToMapPercent(point, previewMap.sizeFactor)
                      return (
                        <button key={routeEntry.id} className={routeEntry.completed ? 'map-viewer__marker map-viewer__marker--done' : 'map-viewer__marker map-viewer__marker--active'} style={{ left: `${pct.x}%`, top: `${pct.y}%` }} type="button">
                          {index + 1}
                        </button>
                      )
                    })}
                  </div>
                  <div className="callout">
                    <span className="callout-title">目前預覽地圖</span>
                    <span className="callout-body">{previewMap.label}</span>
                    <span className="muted">這一區只顯示目前路線中屬於此地圖的點位。</span>
                  </div>
                </div>
              </div>
            )}
          </article>
        </div>
      )}

      {showCreateModal ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-panel">
            <div className="section-heading"><h2>建立隊伍</h2><p>建立後會拿到 8 位房間代碼與邀請連結，房間有效期 24 小時。</p></div>
            <label className="field"><span className="field-label">你的暱稱（隊長）</span><input className="input-text" onChange={(e) => setRealtimeNickname(e.target.value)} placeholder="隊長" type="text" value={realtimeNickname} /></label>
            <label className="field"><span className="field-label">房間名稱</span><input className="input-text" onChange={(e) => setRoomName(e.target.value)} placeholder="FF14 藏寶圖隊伍" type="text" value={roomName} /></label>
            {liveError ? <div className="callout callout--error"><span className="callout-title">建立失敗</span><span className="callout-body">{liveError}</span></div> : null}
            <div className="button-row">
              <button className="button button--primary" disabled={liveBusy} onClick={() => void handleCreateRoom()} type="button">確認建立</button>
              <button className="button button--ghost" onClick={() => { setShowCreateModal(false); setLiveError(null) }} type="button">取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {showJoinModal ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-panel">
            <div className="section-heading"><h2>加入隊伍</h2><p>請輸入 8 位房間代碼，或使用邀請連結開啟本頁。</p></div>
            <label className="field"><span className="field-label">你的暱稱</span><input className="input-text" onChange={(e) => setRealtimeNickname(e.target.value)} placeholder="隊員" type="text" value={realtimeNickname} /></label>
            <label className="field"><span className="field-label">房間代碼</span><input className="input-text" onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="8 位代碼" type="text" value={roomCodeInput} /></label>
            {liveError ? <div className="callout callout--error"><span className="callout-title">加入失敗</span><span className="callout-body">{liveError}</span></div> : null}
            <div className="button-row">
              <button className="button button--primary" disabled={liveBusy} onClick={() => void handleJoinRoom()} type="button">確認加入</button>
              <button className="button button--ghost" onClick={() => { setShowJoinModal(false); setLiveError(null) }} type="button">取消</button>
            </div>
          </div>
        </div>
      ) : null}

      <SourceAttribution entries={pageSources.treasure.entries} />
    </div>
  )
}

export default TreasurePage
