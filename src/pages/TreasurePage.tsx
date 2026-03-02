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
  buildPartyRoomInviteUrl,
  buildPartyRoomSnapshot,
  clearPartyRoomInviteFromLocation,
  createPartyRoomId,
  readPartyRoomInviteFromLocation,
  type TreasurePartyRoomSnapshot,
} from '../treasure/partyRoom'
import {
  getMapsForGrade,
  getPointsForSelection,
  loadTreasureReferenceData,
  type TreasureReferenceData,
} from '../treasure/referenceData'
import type { TreasureGradeInfo, TreasureMapInfo, TreasurePoint } from '../types'
import { getErrorMessage } from '../utils/errors'

const TREASURE_STORAGE_KEY = 'ff14-helper.treasure.finder.v3'

type TreasureGroupMode = 'solo' | 'party'

interface SavedPartyRoomState {
  roomId: string
  roomName: string
  ownerName: string
}

interface SavedTreasureFinderState {
  groupMode: TreasureGroupMode
  gradeId: string
  mapId: number
  pointId: string
  partyMembers: string[]
  partyRoutes: Record<string, TreasurePartyRouteItem[]>
  partyRoom: SavedPartyRoomState
}

function getDefaultPartyRoomState(): SavedPartyRoomState {
  return {
    roomId: '',
    roomName: '',
    ownerName: '',
  }
}

function padPartyMembers(members: string[]): string[] {
  const normalizedMembers = members
    .map((entry) => entry.trim())
    .filter((entry, index, array) => Boolean(entry) && array.indexOf(entry) === index)
    .slice(0, 8)

  while (normalizedMembers.length < 8) {
    normalizedMembers.push('')
  }

  return normalizedMembers
}

function getDefaultState(): SavedTreasureFinderState {
  return {
    groupMode: 'party',
    gradeId: '',
    mapId: 0,
    pointId: '',
    partyMembers: ['', '', '', '', '', '', '', ''],
    partyRoutes: {},
    partyRoom: getDefaultPartyRoomState(),
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
      partyMembers:
        Array.isArray(parsed.partyMembers) && parsed.partyMembers.length === 8
          ? parsed.partyMembers.map((entry) => (typeof entry === 'string' ? entry : ''))
          : ['', '', '', '', '', '', '', ''],
      partyRoutes:
        parsed.partyRoutes && typeof parsed.partyRoutes === 'object'
          ? parsed.partyRoutes
          : {},
      partyRoom:
        parsed.partyRoom &&
        typeof parsed.partyRoom === 'object' &&
        typeof parsed.partyRoom.roomId === 'string' &&
        typeof parsed.partyRoom.roomName === 'string' &&
        typeof parsed.partyRoom.ownerName === 'string'
          ? parsed.partyRoom
          : getDefaultPartyRoomState(),
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

function TreasurePage() {
  const [savedState] = useState(() => readSavedState())
  const [referenceData, setReferenceData] = useState<TreasureReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<TreasureGroupMode>(savedState.groupMode)
  const [gradeId, setGradeId] = useState(savedState.gradeId)
  const [mapId, setMapId] = useState(savedState.mapId)
  const [pointId, setPointId] = useState(savedState.pointId)
  const [partyMembers, setPartyMembers] = useState<string[]>(savedState.partyMembers)
  const [partyRoutes, setPartyRoutes] = useState<Record<string, TreasurePartyRouteItem[]>>(
    savedState.partyRoutes,
  )
  const [partyRoom, setPartyRoom] = useState<SavedPartyRoomState>(savedState.partyRoom)
  const [incomingInvite, setIncomingInvite] = useState<TreasurePartyRoomSnapshot | null>(() =>
    readPartyRoomInviteFromLocation(),
  )
  const [joinName, setJoinName] = useState('')
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('')
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

  const normalizedPartyMembers = useMemo(
    () => partyMembers.map((name) => name.trim()).filter(Boolean),
    [partyMembers],
  )

  function replaceCurrentGradeRoute(nextRoute: TreasurePartyRouteItem[]): void {
    if (!activeGrade) {
      return
    }

    setPartyRoutes((current) => ({
      ...current,
      [activeGrade.id]: nextRoute,
    }))
  }

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

  function resolveCurrentPartyRoom(): SavedPartyRoomState {
    const nextRoom = {
      roomId: partyRoom.roomId || createPartyRoomId(),
      roomName: partyRoom.roomName.trim() || `${activeGrade?.label ?? '8 人'} 寶圖隊伍`,
      ownerName: partyRoom.ownerName.trim() || normalizedPartyMembers[0] || '隊長',
    }

    setPartyRoom(nextRoom)

    return nextRoom
  }

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
        partyMembers,
        partyRoutes,
        partyRoom,
      }),
    )
  }, [activeGrade, activeMap, activePoint, groupMode, partyMembers, partyRoom, partyRoutes])

  async function handleCopyInviteLink(): Promise<void> {
    if (!activeGrade || activeGrade.partySize !== 8) {
      return
    }

    const currentRoom = resolveCurrentPartyRoom()
    const snapshot = buildPartyRoomSnapshot({
      roomId: currentRoom.roomId,
      roomName: currentRoom.roomName,
      ownerName: currentRoom.ownerName,
      gradeId: activeGrade.id,
      members: partyMembers,
      route: activeRoute,
    })
    const inviteUrl = buildPartyRoomInviteUrl(snapshot)

    setGeneratedInviteUrl(inviteUrl)
    await handleCopy('room-link', inviteUrl)
  }

  function applyIncomingInvite(includeJoinName: boolean): void {
    if (!incomingInvite || !referenceData) {
      return
    }

    const nextGrade =
      referenceData.grades.find(
        (grade) => grade.id === incomingInvite.gradeId && grade.partySize === 8,
      ) ?? referenceData.grades.find((grade) => grade.partySize === 8)

    if (!nextGrade) {
      return
    }

    const nextMaps = getMapsForGrade(referenceData, nextGrade.id)

    if (nextMaps.length === 0) {
      return
    }

    const validPointIds = new Set(
      referenceData.points
        .filter((point) => point.itemId === nextGrade.itemId || point.gradeId === nextGrade.id)
        .map((point) => point.id),
    )
    const importedRoute = incomingInvite.route.filter((entry) => validPointIds.has(entry.pointId))
    const routeFirstPoint =
      importedRoute.length > 0
        ? referenceData.points.find((point) => point.id === importedRoute[0].pointId) ?? null
        : null
    const nextMap =
      (routeFirstPoint ? nextMaps.find((map) => map.id === routeFirstPoint.mapId) : null) ?? nextMaps[0]
    const nextPoints = getPointsForSelection(referenceData, nextGrade.id, nextMap.id)
    const nextPoint =
      (routeFirstPoint ? nextPoints.find((point) => point.id === routeFirstPoint.id) : null) ?? nextPoints[0]

    if (!nextPoint) {
      return
    }

    const mergedMembers = [...incomingInvite.members]
    const requestedJoinName = joinName.trim()

    if (
      includeJoinName &&
      requestedJoinName &&
      !mergedMembers.includes(requestedJoinName) &&
      mergedMembers.length < 8
    ) {
      mergedMembers.push(requestedJoinName)
    }

    setGroupMode('party')
    setGradeId(nextGrade.id)
    setMapId(nextMap.id)
    setPointId(nextPoint.id)
    setPartyMembers(padPartyMembers(mergedMembers))
    setPartyRoutes((current) => ({
      ...current,
      [nextGrade.id]: importedRoute,
    }))
    setPartyRoom({
      roomId: incomingInvite.roomId,
      roomName: incomingInvite.roomName,
      ownerName: incomingInvite.ownerName,
    })
    setGeneratedInviteUrl('')
    setIncomingInvite(null)
    clearPartyRoomInviteFromLocation()
  }

  if (loading) {
    return (
      <div className="page-grid">
        <section className="page-card">
          <div className="section-heading">
            <h2>藏寶圖資料載入中</h2>
            <p>正在整理地圖、點位與可用的組隊規劃資料。</p>
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
        <h2>藏寶圖座標與組隊輔助</h2>
        <p className="lead">
          本頁參考 <code>xiv-tc-treasure-finder</code> 的操作方向，整理公開可用的寶圖點位、
          地圖切換與隊伍規劃。本站改用前端分享連結同步，不把隊伍資料存到本站伺服器。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">
            {referenceData.loadedFrom === 'remote'
              ? '已載入最新公開資料'
              : referenceData.loadedFrom === 'cache'
                ? '使用本機快取資料'
                : '使用內建備援資料'}
          </span>
          <span className="badge">單人與 8 人分流</span>
          <span className="badge badge--warning">隊伍分享為連結快照，非即時同步</span>
        </div>
      </section>

      {incomingInvite ? (
        <section className="page-card">
          <div className="section-heading">
            <h2>收到隊伍邀請</h2>
            <p>你開啟了一個寶圖隊伍邀請連結，可以先檢查內容，再決定是否載入並加入。</p>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-label">房號</div>
              <div className="stat-value">{incomingInvite.roomId}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">隊伍名稱</div>
              <div className="stat-value">{incomingInvite.roomName}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">建立者</div>
              <div className="stat-value">{incomingInvite.ownerName}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">已登記成員</div>
              <div className="stat-value">{incomingInvite.members.length} / 8</div>
            </article>
          </div>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">加入時顯示名稱</span>
              <input
                className="input-text"
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="例如：角色名或常用暱稱"
                type="text"
                value={joinName}
              />
            </label>
          </div>

          <div className="button-row">
            <button
              className="button button--primary"
              onClick={() => applyIncomingInvite(true)}
              type="button"
            >
              載入並加入這個隊伍
            </button>
            <button
              className="button button--ghost"
              onClick={() => applyIncomingInvite(false)}
              type="button"
            >
              只載入隊伍資料
            </button>
            <button
              className="button button--ghost"
              onClick={() => {
                setIncomingInvite(null)
                clearPartyRoomInviteFromLocation()
              }}
              type="button"
            >
              忽略這次邀請
            </button>
          </div>
        </section>
      ) : null}

      <section className="page-card">
        <div className="section-heading">
          <h2>模式與寶圖等級</h2>
          <p>8 人寶圖才會顯示建房與入隊功能。單人寶圖只保留點位查找與座標複製。</p>
        </div>

        <div className="choice-row">
          <button
            className={groupMode === 'party' ? 'choice-button choice-button--active' : 'choice-button'}
            onClick={() => setGroupMode('party')}
            type="button"
          >
            8 人寶圖
          </button>
          <button
            className={groupMode === 'solo' ? 'choice-button choice-button--active' : 'choice-button'}
            onClick={() => setGroupMode('solo')}
            type="button"
          >
            單人寶圖
          </button>
        </div>

        <div className="choice-row" role="tablist" aria-label="Treasure grades">
          {visibleGrades.map((grade) => (
            <button
              key={grade.id}
              className={
                grade.id === activeGrade.id ? 'choice-button choice-button--active' : 'choice-button'
              }
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
          ))}
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

      <section className="page-card">
        <div className="section-heading">
          <h2>地圖與目前點位</h2>
          <p>地圖影像來自公開資料來源，點位資料參考 cycleapple 的 treasure finder 並由本站重新整理。</p>
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
                座標複製使用純文字，不使用 <code>&lt;pos&gt;</code>，避免貼出你角色當前位置。
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>目前地圖的所有點位</h2>
          <p>可直接切換高亮、複製座標，或在 8 人寶圖模式下加入組隊路線。</p>
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
                <p className="treasure-card__meta">
                  最近傳送：{nearest ? nearest.name : '沒有資料'}
                </p>
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
                      onClick={() => replaceCurrentGradeRoute(addPointToRoute(activeRoute, point.id))}
                      type="button"
                    >
                      加入組隊路線
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {activeGrade.partySize === 8 ? (
        <>
          <section className="page-card">
            <div className="section-heading">
              <h2>隊伍房與邀請連結</h2>
              <p>
                參考 <code>xiv-tc-treasure-finder</code> 的組隊方向。原站使用外部即時同步服務，
                本站改成不經本站伺服器的分享連結模式。
              </p>
            </div>

            <div className="field-grid">
              <label className="field">
                <span className="field-label">隊伍名稱</span>
                <input
                  className="input-text"
                  onChange={(event) =>
                    setPartyRoom((current) => ({
                      ...current,
                      roomName: event.target.value,
                    }))
                  }
                  placeholder={`${activeGrade.label} 寶圖隊伍`}
                  type="text"
                  value={partyRoom.roomName}
                />
              </label>
              <label className="field">
                <span className="field-label">建立者名稱</span>
                <input
                  className="input-text"
                  onChange={(event) =>
                    setPartyRoom((current) => ({
                      ...current,
                      ownerName: event.target.value,
                    }))
                  }
                  placeholder="例如：團長名稱"
                  type="text"
                  value={partyRoom.ownerName}
                />
              </label>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">目前房號</div>
                <div className="stat-value">{partyRoom.roomId || '尚未建立'}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">目前成員</div>
                <div className="stat-value">{normalizedPartyMembers.length} / 8</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">規劃點位</div>
                <div className="stat-value">{activeRoute.length}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">模式說明</div>
                <div className="stat-value">分享連結快照</div>
              </article>
            </div>

            <div className="button-row">
              <button className="button button--primary" onClick={() => void handleCopyInviteLink()} type="button">
                {partyRoom.roomId ? '更新並複製邀請連結' : '建立隊伍並複製邀請連結'}
              </button>
              <button
                className="button button--ghost"
                onClick={() => {
                  setPartyRoom(getDefaultPartyRoomState())
                  setGeneratedInviteUrl('')
                }}
                type="button"
              >
                重新建立新房間
              </button>
            </div>

            {generatedInviteUrl ? (
              <label className="field">
                <span className="field-label">最近產生的邀請連結</span>
                <textarea className="input-text" readOnly rows={3} value={generatedInviteUrl} />
              </label>
            ) : null}

            <div className="callout">
              <span className="callout-title">使用方式</span>
              <span className="callout-body">
                建立者先複製邀請連結給隊友。隊友開啟後可帶名字加入，再把更新後的連結傳回來。
                整個流程不走本站後端，因此不會有即時雙向同步。
              </span>
            </div>
          </section>

          <section className="page-card">
            <div className="section-heading">
              <h2>8 人隊伍名單</h2>
              <p>可手動填寫 8 位成員，也可由邀請連結匯入。隊伍名單會保存在你自己的瀏覽器。</p>
            </div>

            <div className="party-member-grid">
              {partyMembers.map((member, index) => (
                <label key={`member-${index + 1}`} className="field">
                  <span className="field-label">隊員 {index + 1}</span>
                  <input
                    className="input-text"
                    onChange={(event) =>
                      setPartyMembers((current) =>
                        current.map((entry, memberIndex) =>
                          memberIndex === index ? event.target.value : entry,
                        ),
                      )
                    }
                    placeholder={`隊員 ${index + 1}`}
                    type="text"
                    value={member}
                  />
                </label>
              ))}
            </div>

            <div className="button-row">
              <button
                className="button button--ghost"
                onClick={() => replaceCurrentGradeRoute(optimizePartyRoute(activeRoute, gradePoints, referenceData.maps))}
                type="button"
              >
                自動整理路線順序
              </button>
              <button
                className="button button--ghost"
                onClick={() => replaceCurrentGradeRoute(activeRoute.filter((entry) => !entry.completed))}
                type="button"
              >
                移除已完成項目
              </button>
              <button className="button button--ghost" onClick={() => replaceCurrentGradeRoute([])} type="button">
                清空目前路線
              </button>
            </div>
          </section>

          <section className="page-card">
            <div className="section-heading">
              <h2>組隊路線清單</h2>
              <p>這裡可以分配隊員、加註備註、調整順序，並複製可貼進隊頻的座標文字。</p>
            </div>

            {activeRoute.length === 0 ? (
              <div className="empty-state">
                <strong>目前還沒有加入任何點位</strong>
                <p>先從上方點位卡片把要跑的寶圖加入組隊路線，這裡才會出現清單。</p>
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
                      className={
                        routeEntry.completed ? 'treasure-card treasure-card--done' : 'treasure-card'
                      }
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
                      <p className="treasure-card__meta">
                        最近傳送：{nearest ? nearest.name : '沒有資料'}
                      </p>

                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">指派隊員</span>
                          <select
                            className="input-select"
                            onChange={(event) =>
                              replaceCurrentGradeRoute(
                                activeRoute.map((entry) =>
                                  entry.id === routeEntry.id
                                    ? { ...entry, playerName: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            value={routeEntry.playerName}
                          >
                            <option value="">未指定</option>
                            {normalizedPartyMembers.map((name) => (
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
                              replaceCurrentGradeRoute(
                                activeRoute.map((entry) =>
                                  entry.id === routeEntry.id
                                    ? { ...entry, note: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="例如：先飛主城、集合後再進圖"
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
                          切到這個點
                        </button>
                        <button
                          className="button button--ghost"
                          disabled={index === 0}
                          onClick={() => {
                            const nextRoute = [...activeRoute]
                            const current = nextRoute[index]
                            nextRoute[index] = nextRoute[index - 1]
                            nextRoute[index - 1] = current
                            replaceCurrentGradeRoute(nextRoute)
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
                            replaceCurrentGradeRoute(nextRoute)
                          }}
                          type="button"
                        >
                          下移
                        </button>
                        <button
                          className="button button--ghost"
                          onClick={() =>
                            replaceCurrentGradeRoute(
                              activeRoute.map((entry) =>
                                entry.id === routeEntry.id
                                  ? { ...entry, completed: !entry.completed }
                                  : entry,
                              ),
                            )
                          }
                          type="button"
                        >
                          {routeEntry.completed ? '標記為未完成' : '標記完成'}
                        </button>
                        <button
                          className="button button--ghost"
                          onClick={() =>
                            replaceCurrentGradeRoute(
                              activeRoute.filter((entry) => entry.id !== routeEntry.id),
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

                      {routeEntry.note ? <p className="treasure-card__meta">備註：{routeEntry.note}</p> : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="page-card">
          <div className="section-heading">
            <h2>單人寶圖模式</h2>
            <p>
              單人寶圖不會顯示建房與組隊功能。你仍然可以切換點位、查看最近傳送點，並複製寶圖座標。
            </p>
          </div>
        </section>
      )}

      <SourceAttribution entries={pageSources.treasure.entries} />
    </div>
  )
}

export default TreasurePage
