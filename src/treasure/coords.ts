import type {
  TreasureAetheryte,
  TreasureMarker,
  TreasurePoint,
  TreasureZoneConfig,
} from '../types'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

function roundMapCoord(value: number): number {
  return Math.round(value * 10) / 10
}

export function computeTreasureMarker(
  zone: TreasureZoneConfig,
  percentX: number,
  percentY: number,
): TreasureMarker {
  const safeX = clampPercent(percentX)
  const safeY = clampPercent(percentY)

  return {
    zoneId: zone.id,
    percentX: safeX,
    percentY: safeY,
    mapX: roundMapCoord(zone.calibration.offsetX + safeX * zone.calibration.scaleX),
    mapY: roundMapCoord(zone.calibration.offsetY + safeY * zone.calibration.scaleY),
  }
}

export function gameCoordToPercent(coord: number, sizeFactor: number): number {
  if (!Number.isFinite(coord) || !Number.isFinite(sizeFactor) || sizeFactor <= 0) {
    return 0
  }

  return clampPercent(((coord - 1) * sizeFactor) / 40.96)
}

export function coordsToMapPercent(
  point: Pick<TreasurePoint, 'x' | 'y'>,
  sizeFactor: number,
): { x: number; y: number } {
  return {
    x: gameCoordToPercent(point.x, sizeFactor),
    y: gameCoordToPercent(point.y, sizeFactor),
  }
}

export function calculateDistance(
  left: Pick<TreasurePoint, 'x' | 'y'>,
  right: Pick<TreasurePoint | TreasureAetheryte, 'x' | 'y'>,
): number {
  const dx = left.x - right.x
  const dy = left.y - right.y

  return Math.sqrt(dx * dx + dy * dy)
}

export function findNearestAetheryte(
  zoneId: number,
  point: Pick<TreasurePoint, 'x' | 'y'>,
  aetherytes: TreasureAetheryte[],
): TreasureAetheryte | null {
  const zoneAetherytes = aetherytes.filter((aetheryte) => aetheryte.zoneId === zoneId)

  if (zoneAetherytes.length === 0) {
    return null
  }

  return zoneAetherytes.reduce((closest, current) =>
    calculateDistance(point, current) < calculateDistance(point, closest) ? current : closest,
  )
}
