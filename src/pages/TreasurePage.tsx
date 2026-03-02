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
  getMapsForGrade,
  getPointsForSelection,
  loadTreasureReferenceData,
  type TreasureReferenceData,
} from '../treasure/referenceData'
import type { TreasureGradeInfo, TreasureMapInfo, TreasurePoint } from '../types'
import { getErrorMessage } from '../utils/errors'

const TREASURE_STORAGE_KEY = 'ff14-helper.treasure.finder.v2'

type TreasureGroupMode = 'solo' | 'party'

interface SavedTreasureFinderState {
  groupMode: TreasureGroupMode
  gradeId: string
  mapId: number
  pointId: string
  partyMembers: string[]
  partyRoutes: Record<string, TreasurePartyRouteItem[]>
}

function getDefaultState(): SavedTreasureFinderState {
  return {
    groupMode: 'party',
    gradeId: '',
    mapId: 0,
    pointId: '',
    partyMembers: ['', '', '', '', '', '', '', ''],
    partyRoutes: {},
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

  const routePointById = useMemo(() => new Map(gradePoints.map((point) => [point.id, point])), [gradePoints])
  const mapById = useMemo(
    () => new Map((referenceData?.maps ?? []).map((map) => [map.id, map])),
    [referenceData?.maps],
  )

  const normalizedPartyMembers = useMemo(
    () => partyMembers.map((name) => name.trim()).filter(Boolean),
    [partyMembers],
  )

  useEffect(() => {
    if (!activeGrade || !activeMap || !activePoint) {
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
      }),
    )
  }, [activeGrade, activeMap, activePoint, groupMode, partyMembers, partyRoutes])

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

  if (loading) {
    return (
      <div className="page-grid">
        <section className="page-card">
          <div className="section-heading">
            <h2>藏寶圖資料載入中</h2>
            <p>正在整理參考站的藏寶圖資料與地圖資訊...</p>
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
            <h2>無法載入藏寶圖資料</h2>
            <p>{errorMessage ?? '目前沒有可用的藏寶圖資料。'}</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">藏寶圖</p>
        <h2>完整藏寶圖定位助手</h2>
        <p className="lead">
          這一頁參考 `xiv-tc-treasure-finder` 的操作方式，納入它目前公開的全數寶圖資料，並在站內
          重新實作成自己的地圖查看、座標整理與 8 人組隊規劃工具。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">
            {referenceData.loadedFrom === 'remote'
              ? '已載入參考站最新資料'
              : referenceData.loadedFrom === 'cache'
                ? '使用本機快取資料'
                : '使用站內備援資料'}
          </span>
          <span className="badge">單人與 8 人分開顯示</span>
          <span className="badge badge--warning">8 人寶圖才顯示組隊規劃</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>先選寶圖類型</h2>
          <p>單人與 8 人寶圖分開整理，避免切換時混在一起。</p>
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
          <p>地圖圖片來自 XIVAPI，點位資料參考 cycleapple 的 treasure finder。</p>
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
                <div className="stat-label">目前寶圖</div>
                <div className="stat-value">{activeGrade.label}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">地圖名稱</div>
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
                  const nearest = findNearestAetheryte(referenceData.maps.find((map) => map.id === activeMap.id)?.zoneId ?? activeMap.zoneId, activePoint, referenceData.aetherytes)

                  if (!nearest) {
                    return '這張地圖目前沒有內建傳送水晶資料。'
                  }

                  return `${nearest.name} (${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)})`
                })()}
              </span>
              <span className="muted">複製功能會複製純文字座標，不再使用會被遊戲當成目前位置的 &lt;pos&gt;。</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>目前地圖的藏寶點</h2>
          <p>可直接點選查看，也可複製純文字座標。8 人寶圖額外提供加入組隊清單。</p>
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
                <p className="treasure-card__meta">最近傳送水晶：{nearest ? nearest.name : '未提供'}</p>
                <div className="button-row">
                  <button className="button button--ghost" onClick={() => setPointId(point.id)} type="button">
                    定位此點
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
                  {activeGrade.partySize === 8 && (
                    <button
                      className="button button--primary"
                      onClick={() => replaceCurrentGradeRoute(addPointToRoute(activeRoute, point.id))}
                      type="button"
                    >
                      加入組隊清單
                    </button>
                  )}
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
              <h2>8 人組隊規劃</h2>
              <p>
                這個區塊參考 `xiv-tc-treasure-finder` 的隊伍工具概念，但改成純前端、本機儲存的組隊清單。
              </p>
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
                自動整理路線
              </button>
              <button
                className="button button--ghost"
                onClick={() =>
                  replaceCurrentGradeRoute(activeRoute.filter((entry) => !entry.completed))
                }
                type="button"
              >
                清除已完成
              </button>
              <button className="button button--ghost" onClick={() => replaceCurrentGradeRoute([])} type="button">
                清空整份路線
              </button>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">路線總數</div>
                <div className="stat-value">{activeRoute.length}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">已完成</div>
                <div className="stat-value">{activeRoute.filter((entry) => entry.completed).length}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">待處理</div>
                <div className="stat-value">{activeRoute.filter((entry) => !entry.completed).length}</div>
              </article>
            </div>
          </section>

          <section className="page-card">
            <div className="section-heading">
              <h2>目前組隊路線</h2>
              <p>這份路線只存在你的瀏覽器。每個點位都可指定隊員、加註備註與複製隊頻文字。</p>
            </div>

            {activeRoute.length === 0 ? (
              <div className="empty-state">
                <strong>目前還沒有加入任何 8 人寶圖點位</strong>
                <p>先從上面的卡片把目標點位加入組隊清單。</p>
              </div>
            ) : (
              <div className="route-list">
                {activeRoute.map((routeEntry, index) => {
                  const point = routePointById.get(routeEntry.pointId)

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
                      <p className="treasure-card__meta">最近傳送水晶：{nearest ? nearest.name : '未提供'}</p>

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
                            placeholder="例如：先飛這張、這張離水晶近"
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
                          跳到此點
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
                          {routeEntry.completed ? '標記未完成' : '標記完成'}
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

                      {routeEntry.note && <p className="treasure-card__meta">備註：{routeEntry.note}</p>}
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
            <h2>單人寶圖說明</h2>
            <p>
              單人寶圖不顯示組隊規劃，避免操作過重。你仍然可以查看所有地圖、切換點位並複製純文字座標。
            </p>
          </div>
        </section>
      )}

      <SourceAttribution entries={pageSources.treasure.entries} />
    </div>
  )
}

export default TreasurePage
