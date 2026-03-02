import type {
  TreasureAetheryte,
  TreasureGradeInfo,
  TreasureMapInfo,
  TreasurePoint,
} from '../types'
import {
  treasureAetherytes as fallbackAetherytes,
  treasureGrades as fallbackGrades,
  treasureMaps as fallbackMaps,
  treasurePoints as fallbackPoints,
} from './finderData'

const REMOTE_DATA_URL = 'https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js'
const CACHE_KEY = 'ff14-helper.treasure.reference-cache'
const CACHE_VERSION = '2026-03-02'

interface RemoteGradeEntry {
  grade: string
  itemId: number
  name: string
  partySize: 1 | 8
  expansion: string
}

interface RemoteMapEntry {
  id: number
  placename_id: number
  image: string
  size_factor: number
}

interface RemoteAetheryteEntry {
  name: string
  coords: {
    x: number
    y: number
  }
}

export interface TreasureReferenceData {
  grades: TreasureGradeInfo[]
  maps: TreasureMapInfo[]
  points: TreasurePoint[]
  aetherytes: TreasureAetheryte[]
  loadedFrom: 'cache' | 'remote' | 'fallback'
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

    const parsed = JSON.parse(raw) as Partial<TreasureReferenceData> & {
      version?: string
    }

    if (
      parsed.version !== CACHE_VERSION ||
      !Array.isArray(parsed.grades) ||
      !Array.isArray(parsed.maps) ||
      !Array.isArray(parsed.points) ||
      !Array.isArray(parsed.aetherytes)
    ) {
      return null
    }

    return {
      grades: parsed.grades,
      maps: parsed.maps,
      points: parsed.points,
      aetherytes: parsed.aetherytes,
      loadedFrom: 'cache',
    }
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
      version: CACHE_VERSION,
      grades: data.grades,
      maps: data.maps,
      points: data.points,
      aetherytes: data.aetherytes,
    }),
  )
}

function extractLiteralBlock(source: string, marker: string, terminator: string): string {
  const markerIndex = source.indexOf(marker)

  if (markerIndex === -1) {
    throw new Error(`Missing source marker: ${marker}`)
  }

  const startIndex = markerIndex + marker.length
  const endIndex = source.indexOf(terminator, startIndex)

  if (endIndex === -1) {
    throw new Error(`Missing source terminator: ${terminator}`)
  }

  return source.slice(startIndex, endIndex + terminator.length - 1).trim()
}

function parseLiteralValue<T>(source: string, marker: string, terminator: string): T {
  const literal = extractLiteralBlock(source, marker, terminator)

  return Function(`"use strict"; return (${literal});`)() as T
}

function parseTreasureRawString(source: string): string {
  const marker = 'const TREASURES_RAW = "'
  const startIndex = source.indexOf(marker)

  if (startIndex === -1) {
    throw new Error('Missing treasure raw source marker')
  }

  const fromIndex = startIndex + marker.length
  const endIndex = source.indexOf('";', fromIndex)

  if (endIndex === -1) {
    throw new Error('Missing treasure raw source terminator')
  }

  return source.slice(fromIndex, endIndex)
}

function buildFallbackReferenceData(): TreasureReferenceData {
  return {
    grades: fallbackGrades,
    maps: fallbackMaps,
    points: fallbackPoints,
    aetherytes: fallbackAetherytes,
    loadedFrom: 'fallback',
  }
}

function normalizeRemoteData(source: string): TreasureReferenceData {
  const grades = parseLiteralValue<RemoteGradeEntry[]>(source, 'const GRADE_DATA = ', '];').map(
    (entry) => ({
      id: `item-${entry.itemId}`,
      itemId: entry.itemId,
      label: entry.grade,
      itemName: entry.name,
      partySize: entry.partySize,
    }),
  )
  const placeNames = parseLiteralValue<Record<number, string>>(source, 'const PLACE_NAMES = ', '};')
  const mapsObject = parseLiteralValue<Record<number, RemoteMapEntry>>(source, 'const MAP_DATA = ', '};')
  const aetherytesObject = parseLiteralValue<Record<number, RemoteAetheryteEntry[]>>(
    source,
    'const ZONE_AETHERYTES = ',
    '};',
  )
  const treasuresRaw = parseTreasureRawString(source)
  const gradeByItemId = new Map(grades.map((grade) => [grade.itemId, grade]))

  const maps = Object.values(mapsObject)
    .map((entry) => ({
      id: entry.id,
      zoneId: entry.placename_id,
      label: placeNames[entry.placename_id] ?? `地圖 ${entry.id}`,
      imageUrl: entry.image,
      sizeFactor: entry.size_factor,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-TW'))

  const points: TreasurePoint[] = treasuresRaw
    .split('|')
    .map<TreasurePoint | null>((row) => {
      const [id, x, y, mapId, partySize, itemId] = row.split(',')
      const parsedItemId = Number(itemId)
      const grade = gradeByItemId.get(parsedItemId)

      if (!grade) {
        return null
      }

      return {
        id,
        gradeId: grade.id,
        mapId: Number(mapId),
        x: Number(x),
        y: Number(y),
        partySize: (Number(partySize) === 8 ? 8 : 1) as 1 | 8,
        itemId: parsedItemId,
      }
    })
    .filter((point): point is TreasurePoint => point !== null)

  const aetherytes = Object.entries(aetherytesObject).flatMap(([zoneId, entries]) =>
    entries.map((entry) => ({
      zoneId: Number(zoneId),
      name: entry.name,
      x: entry.coords.x,
      y: entry.coords.y,
    })),
  )

  return {
    grades,
    maps,
    points,
    aetherytes,
    loadedFrom: 'remote',
  }
}

export async function loadTreasureReferenceData(): Promise<TreasureReferenceData> {
  if (inFlightLoad) {
    return inFlightLoad
  }

  const cached = readCachedReferenceData()

  if (cached) {
    return cached
  }

  inFlightLoad = fetch(REMOTE_DATA_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load treasure reference data: ${response.status}`)
      }

      return response.text()
    })
    .then((source) => {
      const normalized = normalizeRemoteData(source)
      writeCachedReferenceData(normalized)
      return normalized
    })
    .catch(() => buildFallbackReferenceData())
    .finally(() => {
      inFlightLoad = null
    })

  return inFlightLoad
}

export function getMapsForGrade(
  data: TreasureReferenceData,
  gradeId: string,
): TreasureMapInfo[] {
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
    (point) =>
      (point.itemId === grade.itemId || point.gradeId === grade.id) && point.mapId === mapId,
  )
}
