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

type TreasureGroupMode = 'solo' | 'party'

interface SavedState {
  groupMode: TreasureGroupMode
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
  return { groupMode: 'party', gradeId: '', mapId: 0, pointId: '', localMembers: [], partyRoutes: {}, realtimeNickname: '', lastRoomCode: '' }
}

function readSavedState(): SavedState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...getDefaultState(), ...(JSON.parse(raw) as Partial<SavedState>) } : getDefaultState()
  } catch {
    return getDefaultState()
  }
}

function parseMembersInput(value: string): string[] {
  return value.split(/[,\n]/gu).map((entry) => entry.trim()).filter((entry, index, array) => Boolean(entry) && array.indexOf(entry) === index).slice(0, 8)
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value)
}

function getMapPointLabel(points: TreasurePoint[], pointId: string): string {
  const index = points.findIndex((point) => point.id === pointId)
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
  const [groupMode, setGroupMode] = useState<TreasureGroupMode>(savedState.groupMode)
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

  useEffect(() => {
    let cancelled = false
    loadTreasureReferenceData()
      .then((data) => {
        if (!cancelled) {
          setReferenceData(data)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleGrades = useMemo(
    () => referenceData?.grades.filter((grade) => (groupMode === 'party' ? grade.partySize === 8 : grade.partySize === 1)) ?? [],
    [groupMode, referenceData],
  )
  const activeGrade = useMemo<TreasureGradeInfo | null>(() => visibleGrades.find((grade) => grade.id === gradeId) ?? visibleGrades[0] ?? null, [gradeId, visibleGrades])
  const availableMaps = useMemo<TreasureMapInfo[]>(() => (referenceData && activeGrade ? getMapsForGrade(referenceData, activeGrade.id) : []), [activeGrade, referenceData])
  const activeMap = useMemo<TreasureMapInfo | null>(() => availableMaps.find((map) => map.id === mapId) ?? availableMaps[0] ?? null, [availableMaps, mapId])
  const visiblePoints = useMemo<TreasurePoint[]>(() => (referenceData && activeGrade && activeMap ? getPointsForSelection(referenceData, activeGrade.id, activeMap.id) : []), [activeGrade, activeMap, referenceData])
  const activePoint = useMemo<TreasurePoint | null>(() => visiblePoints.find((point) => point.id === pointId) ?? visiblePoints[0] ?? null, [pointId, visiblePoints])
  const gradePoints = useMemo<TreasurePoint[]>(() => (referenceData && activeGrade ? referenceData.points.filter((point) => point.gradeId === activeGrade.id || point.itemId === activeGrade.itemId) : []), [activeGrade, referenceData])
  const activeRoute = useMemo<TreasurePartyRouteItem[]>(() => (activeGrade ? partyRoutes[activeGrade.id] ?? [] : []), [activeGrade, partyRoutes])
  const localMembers = useMemo(() => parseMembersInput(membersInput), [membersInput])
  const memberOptions = useMemo(() => (liveRoomState ? liveRoomState.members.map((member) => member.nickname) : localMembers), [liveRoomState, localMembers])
  const routeMapIds = useMemo(() => [...new Set(activeRoute.map((routeEntry) => gradePoints.find((point) => point.id === routeEntry.pointId)?.mapId).filter((value): value is number => typeof value === 'number'))], [activeRoute, gradePoints])
  const routeSummary = useMemo(() => {
    const completedCount = activeRoute.filter((entry) => entry.completed).length
    const assignedCount = activeRoute.filter((entry) => entry.playerName.trim().length > 0).length

    return {
      total: activeRoute.length,
      completed: completedCount,
      remaining: Math.max(0, activeRoute.length - completedCount),
      assigned: assignedCount,
      unassigned: Math.max(0, activeRoute.length - assignedCount),
    }
  }, [activeRoute])
  const inviteLink = useMemo(() => (activeRoomCode ? buildInviteLink(activeRoomCode) : ''), [activeRoomCode])
  const [previewMapId, setPreviewMapId] = useState<number>(0)

  useEffect(() => {
    if (!previewMapId && routeMapIds.length > 0) {
      setPreviewMapId(routeMapIds[0])
    }
  }, [previewMapId, routeMapIds])

  useEffect(() => {
    if (!activeGrade || !activeMap || !activePoint) {
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ groupMode, gradeId: activeGrade.id, mapId: activeMap.id, pointId: activePoint.id, localMembers, partyRoutes, realtimeNickname, lastRoomCode: activeRoomCode || roomCodeInput }))
  }, [activeGrade, activeMap, activePoint, activeRoomCode, groupMode, localMembers, partyRoutes, realtimeNickname, roomCodeInput])

  useEffect(() => {
    if (!realtimeEnabled || !activeRoomCode) {
      return
    }
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    subscribeRealtimeTreasureRoom(config, activeRoomCode, (state) => {
      if (cancelled) {
        return
      }
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
        const syncedGrade = referenceData.grades.find((grade) => grade.id === state.gradeId)
        if (syncedGrade) {
          setGroupMode('party')
          setGradeId(syncedGrade.id)
        }
      }
    }, (error) => !cancelled && setLiveError(getErrorMessage(error))).then((nextUnsubscribe) => {
      if (!cancelled) {
        unsubscribe = nextUnsubscribe
      }
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [activeRoomCode, config, realtimeEnabled, referenceData])

  useEffect(() => {
    if (!activeRoomCode) {
      setTtlDisplay('')
      ttlEpochRef.current = null
      return
    }
    const id = window.setInterval(() => {
      const epoch = ttlEpochRef.current
      if (!epoch) {
        return
      }
      const remaining = epoch.snapshotMs - (Date.now() - epoch.capturedAt)
      setTtlDisplay(formatDuration(Math.max(0, remaining)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [activeRoomCode])

  async function handleCopy(label: string, text: string): Promise<void> {
    try {
      await copyText(text)
      setCopiedLabel(label)
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1500)
    } catch (error) {
      setLiveError(getErrorMessage(error))
    }
  }

  function replaceCurrentGradeRoute(nextRoute: TreasurePartyRouteItem[]): void {
    if (!activeGrade) {
      return
    }
    setPartyRoutes((current) => ({ ...current, [activeGrade.id]: nextRoute }))
  }

  async function commitRoute(nextRoute: TreasurePartyRouteItem[], nextMessage: string): Promise<void> {
    replaceCurrentGradeRoute(nextRoute)
    setStatusMessage(nextMessage)
    if (activeRoomCode) {
      try {
        await updateRealtimeTreasureRoute(config, activeRoomCode, nextRoute)
      } catch (error) {
        setLiveError(getErrorMessage(error))
      }
    }
  }

  async function handleCreateRoom(): Promise<void> {
    if (!realtimeEnabled || !activeGrade) {
      return
    }
    setLiveBusy(true)
    setLiveError(null)
    try {
      const result = await createRealtimeTreasureRoom({
        config,
        gradeId: activeGrade.id,
        roomName,
        nickname: realtimeNickname.trim() || '隊長',
        initialRoute: activeRoute,
      })
      setLiveUserId(await getRealtimeTreasureCurrentUserId(config))
      setActiveRoomCode(result.roomCode)
      setRoomCodeInput(result.roomCode)
      setStatusMessage(`已建立房間 ${result.roomCode}。`)
      setShowCreateModal(false)
    } catch (error) {
      setLiveError(getErrorMessage(error))
    } finally {
      setLiveBusy(false)
    }
  }

  async function handleJoinRoom(): Promise<void> {
    if (!realtimeEnabled) {
      return
    }
    setLiveBusy(true)
    setLiveError(null)
    try {
      const result = await joinRealtimeTreasureRoom({
        config,
        roomCode: roomCodeInput,
        nickname: realtimeNickname.trim() || '隊員',
      })
      setLiveUserId(await getRealtimeTreasureCurrentUserId(config))
      setActiveRoomCode(result.roomCode)
      setStatusMessage(`已加入房間 ${result.roomCode}。`)
      setShowJoinModal(false)
    } catch (error) {
      setLiveError(getErrorMessage(error))
    } finally {
      setLiveBusy(false)
    }
  }

  async function handleLeaveRoom(): Promise<void> {
    if (!activeRoomCode) {
      return
    }
    setLiveBusy(true)
    try {
      await leaveRealtimeTreasureRoom(config, activeRoomCode)
      setActiveRoomCode('')
      setLiveRoomState(null)
      setStatusMessage('已離開房間。')
    } catch (error) {
      setLiveError(getErrorMessage(error))
    } finally {
      setLiveBusy(false)
    }
  }

  async function handleUpdateNickname(): Promise<void> {
    if (!activeRoomCode) {
      return
    }
    try {
      await updateRealtimeTreasureNickname(config, activeRoomCode, realtimeNickname)
      setStatusMessage('已更新你的暱稱。')
    } catch (error) {
      setLiveError(getErrorMessage(error))
    }
  }

  if (loading) {
    return (
      <div className="page-grid">
        <section className="page-card">
          <div className="section-heading">
            <h2>藏寶圖資料載入中</h2>
            <p>正在讀取本地 snapshot。</p>
          </div>
        </section>
      </div>
    )
  }

  if (errorMessage || !referenceData || !activeGrade || !activeMap || !activePoint) {
    return (
      <div className="page-grid">
        <section className="page-card">
          <div className="section-heading">
            <h2>藏寶圖頁無法載入</h2>
            <p>{errorMessage ?? '缺少可用的藏寶圖資料。'}</p>
          </div>
        </section>
      </div>
    )
  }

  const previewMap = referenceData.maps.find((map) => map.id === previewMapId) ?? activeMap
  const previewRoutePoints = activeRoute
    .map((routeEntry) => {
      const point = gradePoints.find((entry) => entry.id === routeEntry.pointId)
      return point && point.mapId === previewMap.id ? { routeEntry, point } : null
    })
    .filter((entry): entry is { routeEntry: TreasurePartyRouteItem; point: TreasurePoint } => entry !== null)

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">藏寶圖助手</p>
        <h2>全圖點位、單人檢索、8 人路線與即時房間</h2>
        <p className="lead">
          本頁參考 xiv-tc-treasure-finder 的操作方向，改成本站自己的繁中 UI。
          藏寶圖資料改用站內 snapshot，不再在執行期解析外站 JS。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">{referenceData.loadedFrom === 'cache' ? '使用本機快取' : '使用本地 snapshot'}</span>
          <span className="badge">{realtimeEnabled ? '可建立即時房間' : '未設定即時房間'}</span>
          <span className="badge badge--warning">8 人圖才需要組隊</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>步驟 1：選模式與寶圖等級</h2>
          <p>單人與 8 人分流，避免把不需要的組隊控制塞到同一個畫面。</p>
        </div>
        <div className="choice-row">
          <button className={groupMode === 'party' ? 'choice-button choice-button--active' : 'choice-button'} disabled={Boolean(activeRoomCode)} onClick={() => setGroupMode('party')} type="button">8 人寶圖</button>
          <button className={groupMode === 'solo' ? 'choice-button choice-button--active' : 'choice-button'} disabled={Boolean(activeRoomCode)} onClick={() => setGroupMode('solo')} type="button">單人寶圖</button>
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
                if (!nextMap || !nextPoint) {
                  return
                }
                setGradeId(grade.id)
                setMapId(nextMap.id)
                setPointId(nextPoint.id)
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
                if (!nextPoint) {
                  return
                }
                setMapId(map.id)
                setPointId(nextPoint.id)
              }}
              type="button"
            >
              {map.label}
            </button>
          ))}
        </div>
      </section>

      {activeGrade.partySize === 8 ? (
        <section className="page-card">
          <div className="section-heading">
            <h2>步驟 2：房間與隊伍</h2>
            <p>8 人圖才顯示此區塊。建立或加入房間後可即時同步路線，離開後資料保留本機。</p>
          </div>

          {!realtimeEnabled ? (
            <>
              <div className="callout callout--error">
                <span className="callout-title">即時房間未啟用</span>
                <span className="callout-body">此環境未設定 Firebase，無法使用建隊與入隊功能。你仍可用本機隊員清單進行離線路線規劃。</span>
              </div>
              <label className="field">
                <span className="field-label">本機隊員清單（逗號或換行分隔）</span>
                <input className="input-text" onChange={(event) => setMembersInput(event.target.value)} placeholder="隊員1, 隊員2, ..." type="text" value={membersInput} />
              </label>
              {localMembers.length > 0 ? (
                <div className="callout">
                  <span className="callout-title">離線隊員名單</span>
                  <span className="callout-body">{localMembers.join(' / ')}</span>
                </div>
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
                <div className="badge-row">
                  <span className="badge badge--positive">已連線</span>
                </div>
                {liveRoomState ? (
                  <div className="callout">
                    <span className="callout-title">目前成員</span>
                    <span className="callout-body">
                      {liveRoomState.members.map((member) => (member.userId === liveUserId ? `${member.nickname}（你）` : member.nickname)).join(' / ')}
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
                  <input className="input-text" onBlur={() => void handleUpdateNickname()} onChange={(event) => setRealtimeNickname(event.target.value)} type="text" value={realtimeNickname} />
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
                <input className="input-text" onChange={(event) => setMembersInput(event.target.value)} placeholder="隊員1, 隊員2, ..." type="text" value={membersInput} />
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
        </section>
      ) : null}

      <section className="page-card">
        <div className="section-heading">
          <h2>步驟 3：看點位與地圖</h2>
          <p>左邊看整張圖，右邊看目前點位、最近以太之光與快速複製。</p>
        </div>

        <div className="treasure-finder-layout">
          <div className="map-viewer">
            <img className="map-viewer__image" alt={activeMap.label} src={activeMap.imageUrl} />
            {visiblePoints.map((point) => {
              const percent = coordsToMapPercent(point, activeMap.sizeFactor)
              return (
                <button
                  key={point.id}
                  className={point.id === activePoint.id ? 'map-viewer__marker map-viewer__marker--active' : 'map-viewer__marker'}
                  onClick={() => setPointId(point.id)}
                  style={{ left: `${percent.x}%`, top: `${percent.y}%` }}
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
              <article className="stat-card"><div className="stat-label">座標</div><div className="stat-value">X {activePoint.x.toFixed(1)} / Y {activePoint.y.toFixed(1)}</div></article>
              <article className="stat-card"><div className="stat-label">模式</div><div className="stat-value">{activeGrade.partySize === 8 ? '8 人' : '單人'}</div></article>
            </div>

            <div className="callout">
              <span className="callout-title">最近以太之光</span>
              <span className="callout-body">
                {(() => {
                  const nearest = findNearestAetheryte(activeMap.zoneId, activePoint, referenceData.aetherytes)
                  return nearest ? `${nearest.name} (${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)})` : '這張地圖沒有對應資料'
                })()}
              </span>
              <span className="muted">複製座標為純文字，不會使用 &lt;pos&gt;。</span>
            </div>

            <div className="button-row">
              <button className="button button--ghost" onClick={() => void handleCopy(`coord-${activePoint.id}`, `${activeMap.label} X:${activePoint.x.toFixed(1)} Y:${activePoint.y.toFixed(1)}`)} type="button">{copiedLabel === `coord-${activePoint.id}` ? '已複製座標' : '複製座標文字'}</button>
              {activeGrade.partySize === 8 ? (
                <button className="button button--primary" onClick={() => void commitRoute(addPointToRoute(activeRoute, activePoint.id), '已加入路線。')} type="button">加入隊伍路線</button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>同張地圖所有點位</h2>
          <p>可直接切換點位、複製座標，8 人圖也能快速加進隊伍路線。</p>
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
                <button className="button button--ghost" onClick={() => void handleCopy(`coord-${point.id}`, `${activeMap.label} X:${point.x.toFixed(1)} Y:${point.y.toFixed(1)}`)} type="button">{copiedLabel === `coord-${point.id}` ? '已複製' : '複製座標'}</button>
                {activeGrade.partySize === 8 ? <button className="button button--primary" onClick={() => void commitRoute(addPointToRoute(activeRoute, point.id), '已加入路線。')} type="button">加入路線</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {activeGrade.partySize === 8 ? (
        <section className="page-card">
          <div className="section-heading">
            <h2>隊伍路線規劃</h2>
            <p>左側是路線清單，右側是地圖預覽。可指派成員、調整順序、複製隊頻訊息。</p>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-label">總路線數</div>
              <div className="stat-value">{routeSummary.total}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">已完成</div>
              <div className="stat-value">{routeSummary.completed}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">待處理</div>
              <div className="stat-value">{routeSummary.remaining}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">已指派</div>
              <div className="stat-value">{routeSummary.assigned}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">未指派</div>
              <div className="stat-value">{routeSummary.unassigned}</div>
            </article>
          </div>

          <div className="button-row">
            <button className="button button--ghost" onClick={() => void commitRoute(optimizePartyRoute(activeRoute, gradePoints, referenceData.maps), '已自動整理路線順序。')} type="button">自動優化路線</button>
            <button className="button button--ghost" onClick={() => void commitRoute(activeRoute.filter((entry) => !entry.completed), '已清除已完成項目。')} type="button">清除已完成</button>
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
                  const point = gradePoints.find((entry) => entry.id === routeEntry.pointId)
                  if (!point) {
                    return null
                  }
                  const routeMap = referenceData.maps.find((map) => map.id === point.mapId) ?? activeMap
                  return (
                    <article key={routeEntry.id} className={routeEntry.completed ? 'treasure-card treasure-card--done' : 'treasure-card'}>
                      <div className="history-item__top">
                        <strong>#{index + 1} | {routeMap.label} {getMapPointLabel(gradePoints.filter((entry) => entry.mapId === routeMap.id), point.id)}</strong>
                        <span className="badge">{routeEntry.completed ? '已完成' : '進行中'}</span>
                      </div>
                      <p className="treasure-card__meta">X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}</p>
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">指派成員</span>
                          <select className="input-select" onChange={(event) => void commitRoute(activeRoute.map((entry) => entry.id === routeEntry.id ? { ...entry, playerName: event.target.value } : entry), '已更新成員分配。')} value={routeEntry.playerName}>
                            <option value="">未指定</option>
                            {memberOptions.map((name) => <option key={`${routeEntry.id}-${name}`} value={name}>{name}</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">備註</span>
                          <input className="input-text" onChange={(event) => void commitRoute(activeRoute.map((entry) => entry.id === routeEntry.id ? { ...entry, note: event.target.value } : entry), '已更新路線備註。')} type="text" value={routeEntry.note} />
                        </label>
                      </div>
                      <div className="button-row">
                        <button className="button button--ghost" onClick={() => { setMapId(routeMap.id); setPointId(point.id); setPreviewMapId(routeMap.id) }} type="button">定位到地圖</button>
                        <button className="button button--ghost" disabled={index === 0} onClick={() => { const nextRoute = [...activeRoute]; [nextRoute[index - 1], nextRoute[index]] = [nextRoute[index], nextRoute[index - 1]]; void commitRoute(nextRoute, '已調整路線順序。') }} type="button">上移</button>
                        <button className="button button--ghost" disabled={index === activeRoute.length - 1} onClick={() => { const nextRoute = [...activeRoute]; [nextRoute[index + 1], nextRoute[index]] = [nextRoute[index], nextRoute[index + 1]]; void commitRoute(nextRoute, '已調整路線順序。') }} type="button">下移</button>
                        <button className="button button--ghost" onClick={() => void commitRoute(activeRoute.map((entry) => entry.id === routeEntry.id ? { ...entry, completed: !entry.completed } : entry), routeEntry.completed ? '已改回未完成。' : '已標記完成。')} type="button">{routeEntry.completed ? '改回未完成' : '標記完成'}</button>
                        <button className="button button--ghost" onClick={() => void commitRoute(activeRoute.filter((entry) => entry.id !== routeEntry.id), '已移除一個路線點。')} type="button">移除</button>
                        <button className="button button--primary" onClick={() => void handleCopy(`party-${routeEntry.id}`, buildPartyMessage(point, routeMap, referenceData.aetherytes, routeEntry.playerName))} type="button">{copiedLabel === `party-${routeEntry.id}` ? '已複製隊頻' : '複製隊頻訊息'}</button>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="page-grid">
                <div className="choice-row">
                  {routeMapIds.map((mapEntryId) => {
                    const map = referenceData.maps.find((entry) => entry.id === mapEntryId)
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
                    const percent = coordsToMapPercent(point, previewMap.sizeFactor)
                    return (
                      <button key={routeEntry.id} className={routeEntry.completed ? 'map-viewer__marker map-viewer__marker--done' : 'map-viewer__marker map-viewer__marker--active'} style={{ left: `${percent.x}%`, top: `${percent.y}%` }} type="button">
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
        </section>
      ) : (
        <section className="page-card">
          <div className="section-heading">
            <h2>單人模式說明</h2>
            <p>單人寶圖不需要組隊房間與路線清單，直接使用上方點位與複製座標即可。</p>
          </div>
        </section>
      )}

      {showCreateModal ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-panel">
            <div className="section-heading">
              <h2>建立隊伍</h2>
              <p>建立後會拿到 8 位房間代碼與邀請連結，房間有效期 24 小時。</p>
            </div>
            <label className="field">
              <span className="field-label">你的暱稱（隊長）</span>
              <input className="input-text" onChange={(event) => setRealtimeNickname(event.target.value)} placeholder="隊長" type="text" value={realtimeNickname} />
            </label>
            <label className="field">
              <span className="field-label">房間名稱</span>
              <input className="input-text" onChange={(event) => setRoomName(event.target.value)} placeholder="FF14 藏寶圖隊伍" type="text" value={roomName} />
            </label>
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
            <div className="section-heading">
              <h2>加入隊伍</h2>
              <p>請輸入 8 位房間代碼，或使用邀請連結開啟本頁。</p>
            </div>
            <label className="field">
              <span className="field-label">你的暱稱</span>
              <input className="input-text" onChange={(event) => setRealtimeNickname(event.target.value)} placeholder="隊員" type="text" value={realtimeNickname} />
            </label>
            <label className="field">
              <span className="field-label">房間代碼</span>
              <input className="input-text" onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())} placeholder="8 位代碼" type="text" value={roomCodeInput} />
            </label>
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
