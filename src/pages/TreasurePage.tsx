import { useEffect, useMemo, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { coordsToMapPercent, findNearestAetheryte } from '../treasure/coords'
import {
  getTreasureGradeById,
  getTreasureMapsForGrade,
  getTreasurePointsForSelection,
  treasureAetherytes,
  treasureGrades,
} from '../treasure/finderData'

const TREASURE_STORAGE_KEY = 'ff14-helper.treasure.finder'

interface SavedTreasureFinderState {
  gradeId: string
  mapId: number
  pointId: string
}

function getDefaultState(): SavedTreasureFinderState {
  const defaultGrade = treasureGrades[0]
  const defaultMap = getTreasureMapsForGrade(defaultGrade.id)[0]
  const defaultPoint = getTreasurePointsForSelection(defaultGrade.id, defaultMap.id)[0]

  return {
    gradeId: defaultGrade.id,
    mapId: defaultMap.id,
    pointId: defaultPoint.id,
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

    if (
      typeof parsed.gradeId === 'string' &&
      typeof parsed.mapId === 'number' &&
      typeof parsed.pointId === 'string'
    ) {
      return {
        gradeId: parsed.gradeId,
        mapId: parsed.mapId,
        pointId: parsed.pointId,
      }
    }
  } catch {
    return getDefaultState()
  }

  return getDefaultState()
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

function TreasurePage() {
  const [savedState] = useState(() => readSavedState())
  const [gradeId, setGradeId] = useState(savedState.gradeId)
  const [mapId, setMapId] = useState(savedState.mapId)
  const [pointId, setPointId] = useState(savedState.pointId)
  const [copiedPointId, setCopiedPointId] = useState<string | null>(null)

  const grade = useMemo(() => getTreasureGradeById(gradeId), [gradeId])
  const availableMaps = useMemo(() => getTreasureMapsForGrade(grade.id), [grade.id])
  const selectedMapId = useMemo(
    () => (availableMaps.some((map) => map.id === mapId) ? mapId : availableMaps[0]!.id),
    [availableMaps, mapId],
  )
  const selectedMap = useMemo(
    () => availableMaps.find((map) => map.id === selectedMapId) ?? availableMaps[0]!,
    [availableMaps, selectedMapId],
  )
  const visiblePoints = useMemo(
    () => getTreasurePointsForSelection(grade.id, selectedMap.id),
    [grade.id, selectedMap.id],
  )
  const activePointId = useMemo(
    () => (visiblePoints.some((point) => point.id === pointId) ? pointId : visiblePoints[0]!.id),
    [pointId, visiblePoints],
  )
  const activePoint = useMemo(
    () => visiblePoints.find((point) => point.id === activePointId) ?? visiblePoints[0]!,
    [activePointId, visiblePoints],
  )
  const nearestAetheryte = useMemo(
    () => findNearestAetheryte(selectedMap.zoneId, activePoint, treasureAetherytes),
    [activePoint, selectedMap.zoneId],
  )

  useEffect(() => {
    if (!activePoint) {
      return
    }

    window.localStorage.setItem(
      TREASURE_STORAGE_KEY,
      JSON.stringify({
        gradeId: grade.id,
        mapId: selectedMapId,
        pointId: activePoint.id,
      }),
    )
  }, [activePoint, grade.id, selectedMapId])

  async function handleCopyPos(targetPointId: string, x: number, y: number): Promise<void> {
    const copied = await copyText(`<pos> ${x.toFixed(1)} ${y.toFixed(1)}`)

    if (!copied) {
      return
    }

    setCopiedPointId(targetPointId)
    window.setTimeout(() => {
      setCopiedPointId((current) => (current === targetPointId ? null : current))
    }, 1600)
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Treasure</p>
        <h2>藏寶圖定位助手</h2>
        <p className="lead">
          這一頁參考繁中 treasure finder 的操作方式，提供 G17 / G16 的 Dawntrail 地點資料、
          地圖標點與最近水晶提示。座標僅供輔助，實際判讀仍請以遊戲內地圖為準。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">Dawntrail 7.x</span>
          <span className="badge">G17 / G16</span>
          <span className="badge badge--warning">座標與最近水晶僅供參考</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>選擇寶圖等級與地圖</h2>
          <p>先選等級，再切換地圖。本站會保留你上次看的組合在本機瀏覽器。</p>
        </div>

        <div className="choice-row" role="tablist" aria-label="Treasure grades">
          {treasureGrades.map((entry) => (
            <button
              key={entry.id}
              className={entry.id === grade.id ? 'choice-button choice-button--active' : 'choice-button'}
              onClick={() => {
                const nextMaps = getTreasureMapsForGrade(entry.id)
                const nextMap = nextMaps[0]!
                const nextPoints = getTreasurePointsForSelection(entry.id, nextMap.id)
                const nextPoint = nextPoints[0]!

                setGradeId(entry.id)
                setMapId(nextMap.id)
                setPointId(nextPoint.id)
              }}
              type="button"
            >
              {entry.label} | {entry.itemName}
            </button>
          ))}
        </div>

        <div className="choice-row" role="tablist" aria-label="Treasure maps">
          {availableMaps.map((entry) => (
            <button
              key={entry.id}
              className={
                entry.id === selectedMap.id ? 'choice-button choice-button--active' : 'choice-button'
              }
              onClick={() => {
                const nextPoint = getTreasurePointsForSelection(grade.id, entry.id)[0]!

                setMapId(entry.id)
                setPointId(nextPoint.id)
              }}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>地圖與點位</h2>
          <p>
            下方地圖圖片來自 XIVAPI。點位資料參考 cycleapple 的 treasure finder，本站用自己的介面重做。
          </p>
        </div>

        <div className="treasure-finder-layout">
          <div className="map-viewer">
            <img className="map-viewer__image" alt={`${selectedMap.label} map`} src={selectedMap.imageUrl} />
            {visiblePoints.map((point, index) => {
              const percent = coordsToMapPercent(point, selectedMap.sizeFactor)

              return (
                <button
                  key={point.id}
                  aria-label={`Treasure point ${index + 1}`}
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
                  {index + 1}
                </button>
              )
            })}
          </div>

          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">寶圖等級</div>
                <div className="stat-value">{grade.label}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">地圖</div>
                <div className="stat-value">{selectedMap.label}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">建議人數</div>
                <div className="stat-value">{grade.partySize} 人</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">目前點位</div>
                <div className="stat-value">
                  X {activePoint.x.toFixed(2)} / Y {activePoint.y.toFixed(2)}
                </div>
              </article>
            </div>

            <div className="callout">
              <span className="callout-title">最近水晶</span>
              <span className="callout-body">
                {nearestAetheryte
                  ? `${nearestAetheryte.name} (${nearestAetheryte.x.toFixed(1)}, ${nearestAetheryte.y.toFixed(1)})`
                  : '這張地圖目前沒有內建最近水晶資料'}
              </span>
              <span className="muted">複製座標可直接拿去和隊友分享。</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>點位清單</h2>
          <p>選一個點位會同步在地圖上高亮，並可一鍵複製簡單座標字串。</p>
        </div>

        <div className="treasure-card-grid">
          {visiblePoints.map((point, index) => {
            const nearest = findNearestAetheryte(selectedMap.zoneId, point, treasureAetherytes)

            return (
              <article
                key={point.id}
                className={point.id === activePoint.id ? 'treasure-card treasure-card--active' : 'treasure-card'}
              >
                <div className="history-item__top">
                  <strong>點位 #{index + 1}</strong>
                  <span className="badge">{grade.label}</span>
                </div>
                <p className="treasure-card__meta">
                  座標：X {point.x.toFixed(2)} / Y {point.y.toFixed(2)}
                </p>
                <p className="treasure-card__meta">
                  最近水晶：{nearest ? nearest.name : '未提供'}
                </p>
                <p className="treasure-card__meta">
                  指令：&lt;pos&gt; {point.x.toFixed(1)} {point.y.toFixed(1)}
                </p>
                <div className="button-row">
                  <button className="button button--ghost" onClick={() => setPointId(point.id)} type="button">
                    在地圖上查看
                  </button>
                  <button
                    className="button button--ghost"
                    onClick={() => void handleCopyPos(point.id, point.x, point.y)}
                    type="button"
                  >
                    {copiedPointId === point.id ? '已複製' : '複製座標'}
                  </button>
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
            本頁不嵌入遊戲地圖資產包，只使用公開地圖圖片與整理後的點位資料。若未來加入更多寶圖、
            傳送建議或掉落整理，也會持續標示來源。
          </p>
        </div>
      </section>

      <SourceAttribution entries={pageSources.treasure.entries} />
    </div>
  )
}

export default TreasurePage
