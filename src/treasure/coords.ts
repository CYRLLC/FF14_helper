import type { TreasureMarker, TreasureZoneConfig } from '../types'

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
