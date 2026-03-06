import { useEffect, useMemo, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { coordsToMapPercent, findNearestAetheryte } from '../treasure/coords'
import {
  addPointToRoute,
  buildPartyMessage,
  optimizePartyRoute,
  type TreasurePartyRouteItem,
} from '../treasure/party'
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
import {
  getMapsForGrade,
  getPointsForSelection,
  loadTreasureReferenceData,
  type TreasureReferenceData,
} from '../treasure/referenceData'
import type { RuntimeConfig, TreasureGradeInfo, TreasureMapInfo, TreasurePoint } from '../types'
import { getErrorMessage } from '../utils/errors'

const TREASURE_STORAGE_KEY = 'ff14-helper.treasure.finder.v4'

type TreasureGroupMode = 'solo' | 'party'

interface SavedTreasureFinderState {
  groupMode: TreasureGroupMode
  gradeId: string
  mapId: number
  pointId: string
  localMembers: string[]
  partyRoutes: Record<string, TreasurePartyRouteItem[]>
  realtimeNickname: string
  lastRoomCode: string
}

function getDefaultState(): SavedTreasureFinderState {
  return {
    groupMode: 'party',
    gradeId: '',
    mapId: 0,
    pointId: '',
    localMembers: [],
    partyRoutes: {},
    realtimeNickname: '',
    lastRoomCode: '',
  }
}

function readSavedState(): SavedTreasureFinderState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(TREASURE_STORAGE_KEY)

    if (!raw) {
      return getDefaultState()
    }

    const parsed = JSON.parse(raw) as Partial<SavedTreasureFinderState>

    return {
      groupMode: parsed.groupMode === 'solo' ? 'solo' : 'party',
      gradeId: typeof parsed.gradeId === 'string' ? parsed.gradeId : '',
      mapId: typeof parsed.mapId === 'number' ? parsed.mapId : 0,
      pointId: typeof parsed.pointId === 'string' ? parsed.pointId : '',
      localMembers: Array.isArray(parsed.localMembers)
        ? parsed.localMembers.filter((entry): entry is string => typeof entry === 'string')
        : [],
      partyRoutes:
        parsed.partyRoutes && typeof parsed.partyRoutes === 'object'
          ? parsed.partyRoutes
          : {},
      realtimeNickname: typeof parsed.realtimeNickname === 'string' ? parsed.realtimeNickname : '',
      lastRoomCode: typeof parsed.lastRoomCode === 'string' ? parsed.lastRoomCode : '',
    }
  } catch {
    return getDefaultState()
  }
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false
  }

  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function getMapPointLabel(points: TreasurePoint[], pointId: string): string {
  const index = points.findIndex((point) => point.id === pointId)
  return index === -1 ? '-' : `#${index + 1}`
}

function parseMembersInput(value: string): string[] {
  return value
    .split(/[,\n]/gu)
    .map((entry) => entry.trim())
    .filter((entry, index, array) => Boolean(entry) && array.indexOf(entry) === index)
    .slice(0, 8)
}

interface TreasurePageProps {
  config: RuntimeConfig
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
  const [partyRoutes, setPartyRoutes] = useState<Record<string, TreasurePartyRouteItem[]>>(
    savedState.partyRoutes,
  )
  const [membersInput, setMembersInput] = useState(savedState.localMembers.join(', '))
  const [realtimeNickname, setRealtimeNickname] = useState(savedState.realtimeNickname)
  const [roomName, setRoomName] = useState('寶圖隊伍')
  const [roomCodeInput, setRoomCodeInput] = useState(savedState.lastRoomCode)
  const [activeRoomCode, setActiveRoomCode] = useState('')
  const [liveRoomState, setLiveRoomState] = useState<RealtimeTreasureRoomState | null>(null)
  const [liveUserId, setLiveUserId] = useState<string | null>(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

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

  const realtimeEnabled = isRealtimeTreasureAvailable(config)

  const visibleGrades = useMemo(() => {
    if (!referenceData) {
      return []
    }

    return referenceData.grades.filter((grade) =>
      groupMode === 'party' ? grade.partySize === 8 : grade.partySize === 1,
    )
  }, [groupMode, referenceData])

  const activeGrade = useMemo<TreasureGradeInfo | null>(() => {
    if (visibleGrades.length === 0) {
      return null
    }

    return visibleGrades.find((grade) => grade.id === gradeId) ?? visibleGrades[0]
  }, [gradeId, visibleGrades])

  const availableMaps = useMemo<TreasureMapInfo[]>(() => {
    if (!referenceData || !activeGrade) {
      return []
    }

    return getMapsForGrade(referenceData, activeGrade.id)
  }, [activeGrade, referenceData])

  const activeMap = useMemo<TreasureMapInfo | null>(() => {
    if (availableMaps.length === 0) {
      return null
    }

    return availableMaps.find((map) => map.id === mapId) ?? availableMaps[0]
  }, [availableMaps, mapId])

  const visiblePoints = useMemo<TreasurePoint[]>(() => {
    if (!referenceData || !activeGrade || !activeMap) {
      return []
    }

    return getPointsForSelection(referenceData, activeGrade.id, activeMap.id)
  }, [activeGrade, activeMap, referenceData])

  const activePoint = useMemo<TreasurePoint | null>(() => {
    if (visiblePoints.length === 0) {
      return null
    }

    return visiblePoints.find((point) => point.id === pointId) ?? visiblePoints[0]
  }, [pointId, visiblePoints])

  const gradePoints = useMemo<TreasurePoint[]>(() => {
    if (!referenceData || !activeGrade) {
      return []
    }

    return referenceData.points.filter(
      (point) => point.itemId === activeGrade.itemId || point.gradeId === activeGrade.id,
    )
  }, [activeGrade, referenceData])

  const activeRoute = useMemo<TreasurePartyRouteItem[]>(
    () => (activeGrade ? partyRoutes[activeGrade.id] ?? [] : []),
    [activeGrade, partyRoutes],
  )

  const pointById = useMemo(() => new Map(gradePoints.map((point) => [point.id, point])), [gradePoints])
  const mapById = useMemo(
    () => new Map((referenceData?.maps ?? []).map((map) => [map.id, map])),
    [referenceData?.maps],
  )

  const localMembers = useMemo(() => parseMembersInput(membersInput), [membersInput])
  const currentMemberOptions = useMemo(
    () => (liveRoomState ? liveRoomState.members.map((member) => member.nickname) : localMembers),
    [liveRoomState, localMembers],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !activeGrade || !activeMap || !activePoint) {
      return
    }

    window.localStorage.setItem(
      TREASURE_STORAGE_KEY,
      JSON.stringify({
        groupMode,
        gradeId: activeGrade.id,
        mapId: activeMap.id,
        pointId: activePoint.id,
        localMembers,
        partyRoutes,
        realtimeNickname,
        lastRoomCode: activeRoomCode || roomCodeInput,
      }),
    )
  }, [
    activeGrade,
    activeMap,
    activePoint,
    activeRoomCode,
    groupMode,
    localMembers,
    partyRoutes,
    realtimeNickname,
    roomCodeInput,
  ])

  useEffect(() => {
    if (!realtimeEnabled || !activeRoomCode) {
      return
    }

    let unsubscribe: (() => void) | null = null
    let cancelled = false

    subscribeRealtimeTreasureRoom(
      config,
      activeRoomCode,
      (state) => {
        if (cancelled) {
          return
        }

        if (!state) {
          setLiveRoomState(null)
          setActiveRoomCode('')
          setLiveError('這個即時隊伍房間已不存在，可能已解散')
          return
        }

        setLiveRoomState(state)
        setPartyRoutes((current) => ({
          ...current,
          [state.gradeId]: state.route,
        }))

        if (referenceData) {
          const syncedGrade = referenceData.grades.find((grade) => grade.id === state.gradeId) ?? null

          if (syncedGrade) {
            const nextMaps = getMapsForGrade(referenceData, syncedGrade.id)
            const nextMap = nextMaps.find((entry) => entry.id === mapId) ?? nextMaps[0]
            const nextPoints = nextMap ? getPointsForSelection(referenceData, syncedGrade.id, nextMap.id) : []
            const nextPoint = nextPoints.find((entry) => entry.id === pointId) ?? nextPoints[0]

            setGroupMode('party')
            setGradeId(syncedGrade.id)

            if (nextMap) {
              setMapId(nextMap.id)
            }

            if (nextPoint) {
              setPointId(nextPoint.id)
            }
          }
        }
      },
      (error) => {
        if (!cancelled) {
          setLiveError(getErrorMessage(error))
        }
      },
    ).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe()
        return
      }

      unsubscribe = nextUnsubscribe
    })

    return () => {
      cancelled = true

      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [activeRoomCode, config, mapId, pointId, realtimeEnabled, referenceData])

  async function handleCopy(label: string, text: string): Promise<void> {
    const copied = await copyText(text)

    if (!copied) {
      return
    }

    setCopiedLabel(label)
    window.setTimeout(() => {
      setCopiedLabel((current) => (current === label ? null : current))
    }, 1600)
  }

  function replaceCurrentGradeRoute(nextRoute: TreasurePartyRouteItem[]): void {
    if (!activeGrade) {
      return
    }

    setPartyRoutes((current) => ({
      ...current,
      [activeGrade.id]: nextRoute,
    }))
  }

  async function commitRoute(nextRoute: TreasurePartyRouteItem[], nextMessage: string): Promise<void> {
    if (!activeGrade) {
      return
    }

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
    if (!realtimeEnabled || !activeGrade || activeGrade.partySize !== 8) {
      return
    }

    setLiveBusy(true)
    setLiveError(null)

    try {
      const nickname = realtimeNickname.trim() || '隊長'
      const result = await createRealtimeTreasureRoom({
        config,
        gradeId: activeGrade.id,
        roomName,
        nickname,
        initialRoute: activeRoute,
      })
      const userId = await getRealtimeTreasureCurrentUserId(config)

      setLiveUserId(userId)
      setActiveRoomCode(result.roomCode)
      setRoomCodeInput(result.roomCode)
      setStatusMessage(`已建立即時隊伍房間 ${result.roomCode}`)
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
      const userId = await getRealtimeTreasureCurrentUserId(config)

      setLiveUserId(userId)
      setActiveRoomCode(result.roomCode)
      setStatusMessage(`已加入即時隊伍房間 ${result.roomCode}`)
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
    setLiveError(null)

    try {
      await leaveRealtimeTreasureRoom(config, activeRoomCode)
      setActiveRoomCode('')
      setLiveRoomState(null)
      setStatusMessage('已離開即時隊伍房間')
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
      setStatusMessage('已更新你的隊伍暱稱')
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
            <p>正在整理寶圖等級、地圖與可用點位。</p>
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
            <h2>藏寶圖資料暫時無法使用</h2>
            <p>{errorMessage ?? '目前沒有可用的藏寶圖資料，請稍後再試。'}</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">藏寶圖</p>
        <h2>藏寶圖座標與隊伍同步</h2>
        <p className="lead">
          本頁參考 xiv-tc-treasure-finder 的寶圖與組隊方向，整合公開點位、地圖切換、離線規劃與
          Firebase 即時隊伍同步。若未設定 Firebase，仍可使用本機離線規劃。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">
            {referenceData.loadedFrom === 'remote'
              ? '已載入最新公開寶圖資料'
              : referenceData.loadedFrom === 'cache'
                ? '使用本機快取資料'
                : '使用內建備援資料'}
          </span>
          <span className="badge">{realtimeEnabled ? '支援即時同步' : '目前為離線模式'}</span>
          <span className="badge badge--warning">8 人寶圖才會顯示隊伍同步</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>模式與寶圖等級</h2>
          <p>單人與 8 人寶圖分開。若你正在即時隊伍中，會鎖定為該隊伍的 8 人寶圖等級。</p>
        </div>

        <div className="choice-row">
          <button
            className={groupMode === 'party' ? 'choice-button choice-button--active' : 'choice-button'}
            disabled={Boolean(activeRoomCode)}
            onClick={() => setGroupMode('party')}
            type="button"
          >
            8 人寶圖
          </button>
          <button
            className={groupMode === 'solo' ? 'choice-button choice-button--active' : 'choice-button'}
            disabled={Boolean(activeRoomCode)}
            onClick={() => setGroupMode('solo')}
            type="button"
          >
            單人寶圖
          </button>
        </div>

        <div className="choice-row" role="tablist" aria-label="Treasure grades">
          {visibleGrades.map((grade) => {
            const disabled = Boolean(activeRoomCode) && grade.id !== activeGrade.id

            return (
              <button
                key={grade.id}
                className={
                  grade.id === activeGrade.id ? 'choice-button choice-button--active' : 'choice-button'
                }
                disabled={disabled}
                onClick={() => {
                  const nextMaps = getMapsForGrade(referenceData, grade.id)
                  const nextMap = nextMaps[0]
                  const nextPoints = nextMap ? getPointsForSelection(referenceData, grade.id, nextMap.id) : []
                  const nextPoint = nextPoints[0]

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
            )
          })}
        </div>

        <div className="choice-row" role="tablist" aria-label="Treasure maps">
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
            <h2>隊伍同步面板</h2>
            <p>這裡把建立房間、加入房間與目前成員集中在一起，減少切換視線。</p>
          </div>

          {realtimeEnabled ? (
            <>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">你的顯示名稱</span>
                  <input
                    className="input-text"
                    onBlur={() => void handleUpdateNickname()}
                    onChange={(event) => setRealtimeNickname(event.target.value)}
                    placeholder="例如：角色名"
                    type="text"
                    value={realtimeNickname}
                  />
                </label>
                <label className="field">
                  <span className="field-label">房間名稱</span>
                  <input
                    className="input-text"
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="例如：今晚 G17"
                    type="text"
                    value={roomName}
                  />
                </label>
                <label className="field">
                  <span className="field-label">房號</span>
                  <input
                    className="input-text"
                    onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                    placeholder="輸入 8 碼房號"
                    type="text"
                    value={roomCodeInput}
                  />
                </label>
              </div>

              <div className="button-row">
                <button
                  className="button button--primary"
                  disabled={liveBusy || Boolean(activeRoomCode)}
                  onClick={() => void handleCreateRoom()}
                  type="button"
                >
                  建立即時隊伍
                </button>
                <button
                  className="button button--ghost"
                  disabled={liveBusy || Boolean(activeRoomCode)}
                  onClick={() => void handleJoinRoom()}
                  type="button"
                >
                  加入房間
                </button>
                <button
                  className="button button--ghost"
                  disabled={liveBusy || !activeRoomCode}
                  onClick={() => void handleLeaveRoom()}
                  type="button"
                >
                  離開房間
                </button>
                <button
                  className="button button--ghost"
                  disabled={!activeRoomCode}
                  onClick={() => void handleCopy('room-code', activeRoomCode)}
                  type="button"
                >
                  {copiedLabel === 'room-code' ? '已複製房號' : '複製房號'}
                </button>
              </div>

              <div className="stats-grid">
                <article className="stat-card">
                  <div className="stat-label">同步狀態</div>
                  <div className="stat-value">{activeRoomCode ? '已連線' : '尚未連線'}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">目前房號</div>
                  <div className="stat-value">{activeRoomCode || '尚未加入'}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">隊伍名稱</div>
                  <div className="stat-value">{liveRoomState?.roomName ?? roomName}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">最後同步</div>
                  <div className="stat-value">{liveRoomState?.updatedAtLabel ?? '尚未同步'}</div>
                </article>
              </div>

              <div className="callout">
                <span className="callout-title">目前成員</span>
                <span className="callout-body">
                  {liveRoomState
                    ? liveRoomState.members
                        .map((member) =>
                          member.userId === liveUserId ? `${member.nickname}（你）` : member.nickname,
                        )
                        .join('、') || '目前沒有成員資料'
                    : '建立或加入房間後，這裡會顯示即時同步中的成員'}
                </span>
              </div>
            </>
          ) : (
            <div className="callout callout--error">
              <span className="callout-title">尚未設定即時同步</span>
              <span className="callout-body">
                請在 <code>public/runtime-config.json</code> 補上 Firebase 公開設定後，才能啟用多人即時隊伍。
              </span>
            </div>
          )}

          {!activeRoomCode ? (
            <label className="field">
              <span className="field-label">離線隊員名單（用逗號分隔）</span>
              <input
                className="input-text"
                onChange={(event) => setMembersInput(event.target.value)}
                placeholder="例如：A、B、C、D"
                type="text"
                value={membersInput}
              />
            </label>
          ) : null}

          {liveError ? (
            <div className="callout callout--error">
              <span className="callout-title">同步訊息</span>
              <span className="callout-body">{liveError}</span>
            </div>
          ) : null}

          {statusMessage ? (
            <div className="callout callout--success">
              <span className="callout-title">狀態</span>
              <span className="callout-body">{statusMessage}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="page-card">
        <div className="section-heading">
          <h2>地圖與目前點位</h2>
          <p>點位資料來自公開來源。可直接點地圖切換目標點位，右側會顯示座標與最近傳送水晶。</p>
        </div>

        <div className="treasure-finder-layout">
          <div className="map-viewer">
            <img className="map-viewer__image" alt={`${activeMap.label} 地圖`} src={activeMap.imageUrl} />
            {visiblePoints.map((point) => {
              const percent = coordsToMapPercent(point, activeMap.sizeFactor)

              return (
                <button
                  key={point.id}
                  aria-label={`藏寶點 ${point.id}`}
                  className={
                    point.id === activePoint.id
                      ? 'map-viewer__marker map-viewer__marker--active'
                      : 'map-viewer__marker'
                  }
                  onClick={() => setPointId(point.id)}
                  style={{
                    left: `${percent.x}%`,
                    top: `${percent.y}%`,
                  }}
                  type="button"
                >
                  {getMapPointLabel(visiblePoints, point.id).replace('#', '')}
                </button>
              )
            })}
          </div>

          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">寶圖等級</div>
                <div className="stat-value">{activeGrade.label}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">地圖區域</div>
                <div className="stat-value">{activeMap.label}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">建議人數</div>
                <div className="stat-value">{activeGrade.partySize} 人</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">目前座標</div>
                <div className="stat-value">
                  X {activePoint.x.toFixed(1)} / Y {activePoint.y.toFixed(1)}
                </div>
              </article>
            </div>

            <div className="callout">
              <span className="callout-title">最近傳送水晶</span>
              <span className="callout-body">
                {(() => {
                  const nearest = findNearestAetheryte(activeMap.zoneId, activePoint, referenceData.aetherytes)

                  if (!nearest) {
                    return '目前沒有對應的傳送水晶資料'
                  }

                  return `${nearest.name} (${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)})`
                })()}
              </span>
              <span className="muted">
                複製座標時只會輸出寶圖座標文字，不使用 <code>&lt;pos&gt;</code>。
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>目前地圖的所有點位</h2>
          <p>可切換高亮、複製純座標，或在 8 人模式下加入跑圖路線。</p>
        </div>

        <div className="treasure-card-grid">
          {visiblePoints.map((point) => {
            const nearest = findNearestAetheryte(activeMap.zoneId, point, referenceData.aetherytes)
            const pointLabel = getMapPointLabel(visiblePoints, point.id)

            return (
              <article
                key={point.id}
                className={point.id === activePoint.id ? 'treasure-card treasure-card--active' : 'treasure-card'}
              >
                <div className="history-item__top">
                  <strong>{pointLabel}</strong>
                  <span className="badge">{activeGrade.label}</span>
                </div>
                <p className="treasure-card__meta">
                  座標：X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}
                </p>
                <p className="treasure-card__meta">最近傳送：{nearest ? nearest.name : '沒有資料'}</p>
                <div className="button-row">
                  <button className="button button--ghost" onClick={() => setPointId(point.id)} type="button">
                    切到這個點
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() =>
                      void handleCopy(
                        `coord-${point.id}`,
                        `${activeMap.label} X:${point.x.toFixed(1)} Y:${point.y.toFixed(1)}`,
                      )
                    }
                    type="button"
                  >
                    {copiedLabel === `coord-${point.id}` ? '已複製' : '複製純座標'}
                  </button>
                  {activeGrade.partySize === 8 ? (
                    <button
                      className="button button--primary"
                      onClick={() => void commitRoute(addPointToRoute(activeRoute, point.id), '已加入一個路線點位')}
                      type="button"
                    >
                      加入路線
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {activeGrade.partySize === 8 ? (
        <section className="page-card">
          <div className="section-heading">
            <h2>路線清單</h2>
            <p>用更精簡的方式集中分派、排序、完成標記與隊頻文字複製。</p>
          </div>

          <div className="button-row">
            <button
              className="button button--ghost"
              onClick={() =>
                void commitRoute(
                  optimizePartyRoute(activeRoute, gradePoints, referenceData.maps),
                  '已重新整理路線順序',
                )
              }
              type="button"
            >
              自動排序
            </button>
            <button
              className="button button--ghost"
              onClick={() => void commitRoute(activeRoute.filter((entry) => !entry.completed), '已清除完成項目')}
              type="button"
            >
              清除已完成
            </button>
            <button
              className="button button--ghost"
              onClick={() => void commitRoute([], '已清空路線')}
              type="button"
            >
              清空路線
            </button>
          </div>

          {activeRoute.length === 0 ? (
            <div className="empty-state">
              <strong>目前沒有任何路線</strong>
              <p>先從上方點位卡片加入你們要跑的寶圖點位。</p>
            </div>
          ) : (
            <div className="route-list">
              {activeRoute.map((routeEntry, index) => {
                const point = pointById.get(routeEntry.pointId)

                if (!point) {
                  return null
                }

                const routeMap = mapById.get(point.mapId) ?? activeMap
                const nearest = findNearestAetheryte(routeMap.zoneId, point, referenceData.aetherytes)
                const routeMapPoints = gradePoints.filter((entry) => entry.mapId === routeMap.id)

                return (
                  <article
                    key={routeEntry.id}
                    className={routeEntry.completed ? 'treasure-card treasure-card--done' : 'treasure-card'}
                  >
                    <div className="history-item__top">
                      <strong>
                        路線 {index + 1} | {routeMap.label} {getMapPointLabel(routeMapPoints, point.id)}
                      </strong>
                      <span className="badge">{routeEntry.completed ? '已完成' : '進行中'}</span>
                    </div>

                    <p className="treasure-card__meta">
                      座標：X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}
                    </p>
                    <p className="treasure-card__meta">最近傳送：{nearest ? nearest.name : '沒有資料'}</p>

                    <div className="field-grid">
                      <label className="field">
                        <span className="field-label">指派隊員</span>
                        <select
                          className="input-select"
                          onChange={(event) =>
                            void commitRoute(
                              activeRoute.map((entry) =>
                                entry.id === routeEntry.id
                                  ? { ...entry, playerName: event.target.value }
                                  : entry,
                              ),
                              '已更新指派隊員',
                            )
                          }
                          value={routeEntry.playerName}
                        >
                          <option value="">未指定</option>
                          {currentMemberOptions.map((name) => (
                            <option key={`${routeEntry.id}-${name}`} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field-label">備註</span>
                        <input
                          className="input-text"
                          onChange={(event) =>
                            void commitRoute(
                              activeRoute.map((entry) =>
                                entry.id === routeEntry.id
                                  ? { ...entry, note: event.target.value }
                                  : entry,
                              ),
                              '已更新路線備註',
                            )
                          }
                          placeholder="例如：先集合後再進圖"
                          type="text"
                          value={routeEntry.note}
                        />
                      </label>
                    </div>

                    <div className="button-row">
                      <button
                        className="button button--ghost"
                        onClick={() => {
                          setMapId(routeMap.id)
                          setPointId(point.id)
                        }}
                        type="button"
                      >
                        定位到地圖
                      </button>
                      <button
                        className="button button--ghost"
                        disabled={index === 0}
                        onClick={() => {
                          const nextRoute = [...activeRoute]
                          const current = nextRoute[index]
                          nextRoute[index] = nextRoute[index - 1]
                          nextRoute[index - 1] = current
                          void commitRoute(nextRoute, '已上移一個路線項目')
                        }}
                        type="button"
                      >
                        上移
                      </button>
                      <button
                        className="button button--ghost"
                        disabled={index === activeRoute.length - 1}
                        onClick={() => {
                          const nextRoute = [...activeRoute]
                          const current = nextRoute[index]
                          nextRoute[index] = nextRoute[index + 1]
                          nextRoute[index + 1] = current
                          void commitRoute(nextRoute, '已下移一個路線項目')
                        }}
                        type="button"
                      >
                        下移
                      </button>
                      <button
                        className="button button--ghost"
                        onClick={() =>
                          void commitRoute(
                            activeRoute.map((entry) =>
                              entry.id === routeEntry.id
                                ? { ...entry, completed: !entry.completed }
                                : entry,
                            ),
                            routeEntry.completed ? '已標記為未完成' : '已標記為完成',
                          )
                        }
                        type="button"
                      >
                        {routeEntry.completed ? '取消完成' : '標記完成'}
                      </button>
                      <button
                        className="button button--ghost"
                        onClick={() =>
                          void commitRoute(
                            activeRoute.filter((entry) => entry.id !== routeEntry.id),
                            '已移除一個路線項目',
                          )
                        }
                        type="button"
                      >
                        移除
                      </button>
                      <button
                        className="button button--primary"
                        onClick={() =>
                          void handleCopy(
                            `party-${routeEntry.id}`,
                            buildPartyMessage(point, routeMap, referenceData.aetherytes, routeEntry.playerName),
                          )
                        }
                        type="button"
                      >
                        {copiedLabel === `party-${routeEntry.id}` ? '已複製' : '複製隊頻文字'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="page-card">
          <div className="section-heading">
            <h2>單人寶圖模式</h2>
            <p>單人寶圖不顯示隊伍同步與路線分工，但仍可用來查看點位與複製座標。</p>
          </div>
        </section>
      )}

      <SourceAttribution entries={pageSources.treasure.entries} />
    </div>
  )
}

export default TreasurePage
