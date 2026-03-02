import { useEffect, useMemo, useRef, useState } from 'react'
import { pageSources } from '../catalog/sources'
import SourceAttribution from '../components/SourceAttribution'
import { computeTreasureMarker } from '../treasure/coords'
import { getTreasureZoneById, treasureZones } from '../treasure/data'

const TREASURE_STORAGE_KEY = 'ff14-helper.treasure.selection'

interface SavedTreasureState {
  zoneId: string
  percentX: number
  percentY: number
}

function getDefaultTreasureState(): SavedTreasureState {
  return {
    zoneId: treasureZones[0].id,
    percentX: treasureZones[0].defaultMarker.x,
    percentY: treasureZones[0].defaultMarker.y,
  }
}

function readSavedTreasureState(): SavedTreasureState {
  if (typeof window === 'undefined') {
    return getDefaultTreasureState()
  }

  try {
    const raw = window.localStorage.getItem(TREASURE_STORAGE_KEY)

    if (!raw) {
      return getDefaultTreasureState()
    }

    const parsed = JSON.parse(raw) as Partial<SavedTreasureState>

    if (
      typeof parsed.zoneId === 'string' &&
      typeof parsed.percentX === 'number' &&
      typeof parsed.percentY === 'number'
    ) {
      return {
        zoneId: parsed.zoneId,
        percentX: parsed.percentX,
        percentY: parsed.percentY,
      }
    }
  } catch {
    return getDefaultTreasureState()
  }

  return getDefaultTreasureState()
}

function TreasurePage() {
  const savedState = readSavedTreasureState()
  const [zoneId, setZoneId] = useState(savedState.zoneId)
  const [percentX, setPercentX] = useState(savedState.percentX)
  const [percentY, setPercentY] = useState(savedState.percentY)
  const [dragging, setDragging] = useState(false)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const zone = useMemo(() => getTreasureZoneById(zoneId), [zoneId])
  const marker = useMemo(() => computeTreasureMarker(zone, percentX, percentY), [zone, percentX, percentY])

  useEffect(() => {
    window.localStorage.setItem(
      TREASURE_STORAGE_KEY,
      JSON.stringify({
        zoneId,
        percentX: marker.percentX,
        percentY: marker.percentY,
      }),
    )
  }, [marker.percentX, marker.percentY, zoneId])

  useEffect(() => {
    if (!dragging) {
      return
    }

    function stopDragging(): void {
      setDragging(false)
    }

    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [dragging])

  function updateMarkerFromPoint(clientX: number, clientY: number): void {
    const element = boardRef.current

    if (!element) {
      return
    }

    const rect = element.getBoundingClientRect()
    const nextX = ((clientX - rect.left) / rect.width) * 100
    const nextY = ((clientY - rect.top) / rect.height) * 100

    setPercentX(nextX)
    setPercentY(nextY)
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Treasure</p>
        <h2>藏寶圖座標輔助</h2>
        <p className="lead">
          先選區域，再用格線座標板做點位估算。這是站內輔助工具，不會使用遊戲地圖圖片，也不保存到本站伺服器。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">Dawntrail 六區</span>
          <span className="badge">可點擊與拖曳</span>
          <span className="badge badge--warning">座標為估算值</span>
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>區域與座標板</h2>
          <p>座標板使用站內比例格線，不嵌入第三方地圖資產。拖曳或點擊都會即時更新 X / Y。</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">區域</span>
            <select
              className="input-select"
              onChange={(event) => {
                const nextZone = getTreasureZoneById(event.target.value)
                setZoneId(nextZone.id)
                setPercentX(nextZone.defaultMarker.x)
                setPercentY(nextZone.defaultMarker.y)
              }}
              value={zoneId}
            >
              {treasureZones.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="treasure-layout">
          <div
            ref={boardRef}
            className="treasure-board"
            onPointerDown={(event) => {
              setDragging(true)
              updateMarkerFromPoint(event.clientX, event.clientY)
            }}
            onPointerMove={(event) => {
              if (dragging) {
                updateMarkerFromPoint(event.clientX, event.clientY)
              }
            }}
            role="presentation"
          >
            <div className="treasure-board__grid" />
            <div className="treasure-board__crosshair treasure-board__crosshair--vertical" />
            <div className="treasure-board__crosshair treasure-board__crosshair--horizontal" />
            <button
              aria-label="Treasure marker"
              className="treasure-marker"
              onPointerDown={(event) => {
                event.stopPropagation()
                setDragging(true)
              }}
              style={{
                left: `${marker.percentX}%`,
                top: `${marker.percentY}%`,
              }}
              type="button"
            />
          </div>

          <div className="page-grid">
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-label">Map X</div>
                <div className="stat-value">{marker.mapX.toFixed(1)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">Map Y</div>
                <div className="stat-value">{marker.mapY.toFixed(1)}</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">畫面 X%</div>
                <div className="stat-value">{marker.percentX.toFixed(1)}%</div>
              </article>
              <article className="stat-card">
                <div className="stat-label">畫面 Y%</div>
                <div className="stat-value">{marker.percentY.toFixed(1)}%</div>
              </article>
            </div>

            <div className="list-panel">
              <p className="callout-title">使用提示</p>
              <p className="muted">
                本工具適合先做大致定位，再回遊戲內確認地形、海拔與可到達路線。若之後要補掉落表，可再另外擴充。
              </p>
            </div>
          </div>
        </div>
      </section>

      <SourceAttribution entries={pageSources.treasure.entries} />
    </div>
  )
}

export default TreasurePage
