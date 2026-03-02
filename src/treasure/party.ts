import type { TreasurePoint, TreasureMapInfo, TreasureAetheryte } from '../types'
import { findNearestAetheryte } from './coords'

export interface TreasurePartyRouteItem {
  id: string
  pointId: string
  playerName: string
  note: string
  completed: boolean
}

function createRouteFingerprint(pointId: string): string {
  return `route-${pointId}`
}

export function buildRouteItem(pointId: string): TreasurePartyRouteItem {
  return {
    id: createRouteFingerprint(pointId),
    pointId,
    playerName: '',
    note: '',
    completed: false,
  }
}

export function addPointToRoute(
  route: TreasurePartyRouteItem[],
  pointId: string,
): TreasurePartyRouteItem[] {
  if (route.some((entry) => entry.pointId === pointId)) {
    return route
  }

  return [...route, buildRouteItem(pointId)]
}

function buildSortKey(
  point: TreasurePoint,
  map: TreasureMapInfo | undefined,
  allPoints: TreasurePoint[],
): string {
  const indexOnMap = allPoints
    .filter((entry) => entry.mapId === point.mapId)
    .sort((left, right) => left.id.localeCompare(right.id))
    .findIndex((entry) => entry.id === point.id)

  return `${map?.label ?? point.mapId}-${indexOnMap.toString().padStart(2, '0')}`
}

export function optimizePartyRoute(
  route: TreasurePartyRouteItem[],
  points: TreasurePoint[],
  maps: TreasureMapInfo[],
): TreasurePartyRouteItem[] {
  const pointById = new Map(points.map((point) => [point.id, point]))
  const mapById = new Map(maps.map((map) => [map.id, map]))

  return [...route].sort((left, right) => {
    const leftPoint = pointById.get(left.pointId)
    const rightPoint = pointById.get(right.pointId)

    if (!leftPoint || !rightPoint) {
      return 0
    }

    return buildSortKey(leftPoint, mapById.get(leftPoint.mapId), points).localeCompare(
      buildSortKey(rightPoint, mapById.get(rightPoint.mapId), points),
      'zh-TW',
    )
  })
}

export function buildPartyMessage(
  point: TreasurePoint,
  map: TreasureMapInfo,
  aetherytes: TreasureAetheryte[],
  playerName: string,
): string {
  const nearestAetheryte = findNearestAetheryte(map.zoneId, point, aetherytes)
  const namePrefix = playerName.trim() ? `${playerName.trim()} ` : ''
  const base = `/p ${namePrefix}[${map.label}] (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`

  if (!nearestAetheryte) {
    return base
  }

  return `${base} | 最近傳送水晶：[${nearestAetheryte.name}]`
}
