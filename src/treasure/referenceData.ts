import type { TreasureAetheryte, TreasureGradeInfo, TreasureMapInfo, TreasurePoint } from '../types'

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}treasure-snapshot.json`
const CACHE_KEY = 'ff14-helper.treasure.reference-cache'

interface TreasureSnapshotPayload {
  version: string
  source: string
  grades: TreasureGradeInfo[]
  maps: TreasureMapInfo[]
  points: TreasurePoint[]
  aetherytes: TreasureAetheryte[]
}

export interface TreasureReferenceData {
  version: string
  source: string
  grades: TreasureGradeInfo[]
  maps: TreasureMapInfo[]
  points: TreasurePoint[]
  aetherytes: TreasureAetheryte[]
  loadedFrom: 'cache' | 'snapshot'
}

let inFlightLoad: Promise<TreasureReferenceData> | null = null

function readCachedReferenceData(): TreasureReferenceData | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as TreasureReferenceData
    if (!Array.isArray(parsed.grades) || !Array.isArray(parsed.maps) || !Array.isArray(parsed.points) || !Array.isArray(parsed.aetherytes)) {
      return null
    }
    return { ...parsed, loadedFrom: 'cache' }
  } catch {
    return null
  }
}

function writeCachedReferenceData(data: TreasureReferenceData): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      version: data.version,
      source: data.source,
      grades: data.grades,
      maps: data.maps,
      points: data.points,
      aetherytes: data.aetherytes,
    }),
  )
}

export async function loadTreasureReferenceData(): Promise<TreasureReferenceData> {
  if (inFlightLoad) {
    return inFlightLoad
  }

  const cached = readCachedReferenceData()
  if (cached) {
    return cached
  }

  inFlightLoad = fetch(SNAPSHOT_URL, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load local treasure snapshot: ${response.status}`)
      }

      return (await response.json()) as TreasureSnapshotPayload
    })
    .then((payload) => {
      const normalized: TreasureReferenceData = {
        version: payload.version,
        source: payload.source,
        grades: payload.grades,
        maps: payload.maps,
        points: payload.points,
        aetherytes: payload.aetherytes,
        loadedFrom: 'snapshot',
      }
      writeCachedReferenceData(normalized)
      return normalized
    })
    .finally(() => {
      inFlightLoad = null
    })

  return inFlightLoad
}

export function getMapsForGrade(data: TreasureReferenceData, gradeId: string): TreasureMapInfo[] {
  const grade = data.grades.find((entry) => entry.id === gradeId)

  if (!grade) {
    return []
  }

  const visibleMapIds = new Set(
    data.points
      .filter((point) => point.itemId === grade.itemId || point.gradeId === grade.id)
      .map((point) => point.mapId),
  )

  return data.maps.filter((map) => visibleMapIds.has(map.id))
}

export function getPointsForSelection(
  data: TreasureReferenceData,
  gradeId: string,
  mapId: number,
): TreasurePoint[] {
  const grade = data.grades.find((entry) => entry.id === gradeId)

  if (!grade) {
    return []
  }

  return data.points.filter(
    (point) => (point.itemId === grade.itemId || point.gradeId === grade.id) && point.mapId === mapId,
  )
}
