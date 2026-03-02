import type {
  TreasureAetheryte,
  TreasureGradeInfo,
  TreasureMapInfo,
  TreasurePoint,
} from '../types'

export const treasureGrades: TreasureGradeInfo[] = [
  {
    id: 'g17',
    itemId: 43557,
    label: 'G17',
    itemName: '陳舊的獰豹革地圖',
    partySize: 8,
  },
  {
    id: 'g16',
    itemId: 43556,
    label: 'G16',
    itemName: '陳舊的銀狼革地圖',
    partySize: 1,
  },
]

export const treasureMaps: TreasureMapInfo[] = [
  {
    id: 857,
    zoneId: 4505,
    label: 'Urqopacha',
    imageUrl: 'https://xivapi.com/m/y6f1/y6f1.00.jpg',
    sizeFactor: 100,
  },
  {
    id: 858,
    zoneId: 4506,
    label: "Kozama'uka",
    imageUrl: 'https://xivapi.com/m/y6f2/y6f2.00.jpg',
    sizeFactor: 100,
  },
  {
    id: 859,
    zoneId: 4507,
    label: "Yak T'el",
    imageUrl: 'https://xivapi.com/m/y6f3/y6f3.00.jpg',
    sizeFactor: 100,
  },
  {
    id: 860,
    zoneId: 4508,
    label: 'Shaaloani',
    imageUrl: 'https://xivapi.com/m/x6f1/x6f1.00.jpg',
    sizeFactor: 100,
  },
  {
    id: 861,
    zoneId: 4509,
    label: 'Heritage Found',
    imageUrl: 'https://xivapi.com/m/x6f2/x6f2.00.jpg',
    sizeFactor: 100,
  },
]

function buildPoints(
  gradeId: string,
  mapId: number,
  partySize: 1 | 8,
  coords: Array<[number, number]>,
): TreasurePoint[] {
  return coords.map(([x, y], index) => ({
    id: `${gradeId}-${mapId}-${index + 1}`,
    gradeId,
    mapId,
    x,
    y,
    partySize,
  }))
}

export const treasurePoints: TreasurePoint[] = [
  ...buildPoints('g16', 860, 1, [
    [22.14, 27.08],
    [6.76, 15.23],
    [13.98, 25.23],
    [17.82, 33.25],
    [17.48, 9.65],
    [34.71, 26.29],
    [21.99, 14.9],
    [35.51, 11.05],
  ]),
  ...buildPoints('g16', 861, 1, [
    [18.53, 34.69],
    [26.21, 35.58],
    [25.46, 25.17],
    [10.73, 23.43],
    [18.84, 5.68],
    [15.88, 15.96],
    [25.94, 12.97],
    [34.37, 9.88],
  ]),
  ...buildPoints('g16', 857, 1, [
    [10.32, 11.7],
    [19.14, 18.61],
    [21.76, 23.84],
    [27.8, 10.27],
    [34.57, 26],
    [31.32, 21.05],
    [13.98, 22.27],
    [5.97, 23.97],
  ]),
  ...buildPoints('g16', 858, 1, [
    [38.61, 21.23],
    [25.63, 7.22],
    [17.76, 19.37],
    [11.4, 7.82],
    [35.97, 28.75],
    [26.47, 36.34],
    [24.56, 26.28],
    [7.16, 26.15],
  ]),
  ...buildPoints('g16', 859, 1, [
    [24.05, 10.79],
    [28.28, 15.13],
    [9.33, 27.09],
    [17.04, 20.19],
    [11.56, 8.52],
    [28.53, 25.89],
    [37.49, 18.82],
    [14.05, 37.85],
  ]),
  ...buildPoints('g17', 860, 8, [
    [18.23, 21.1],
    [12.6, 14.44],
    [19.73, 34.56],
    [31.98, 32.95],
    [29.37, 8.44],
    [18.58, 11.67],
    [35.6, 16.99],
    [25.68, 19.79],
  ]),
  ...buildPoints('g17', 861, 8, [
    [26.28, 30.86],
    [16.87, 35.85],
    [17.26, 22.26],
    [16.66, 13.1],
    [35.89, 25.61],
    [9.01, 21.27],
    [22.19, 19.15],
    [31.2, 8.42],
  ]),
  ...buildPoints('g17', 857, 8, [
    [34.29, 29.1],
    [13.65, 14.19],
    [21.62, 23.88],
    [21.79, 26.06],
    [15.76, 30.66],
    [16.91, 23.43],
    [28.98, 24.1],
    [34.28, 32.71],
  ]),
  ...buildPoints('g17', 858, 8, [
    [36.93, 6.28],
    [31.45, 14.97],
    [19.99, 6.99],
    [6.93, 19.43],
    [9.05, 33.92],
    [18.91, 22.53],
    [37.99, 21.73],
    [32.32, 36.15],
  ]),
  ...buildPoints('g17', 859, 8, [
    [22.78, 35.86],
    [15.46, 26.88],
    [5.67, 19.65],
    [36.73, 12.52],
    [31.21, 21.95],
    [11.26, 33.28],
    [24.76, 21],
    [22.63, 5.85],
  ]),
]

export const treasureAetherytes: TreasureAetheryte[] = [
  { zoneId: 4506, name: '哈努聚落', x: 18.1, y: 11.9 },
  { zoneId: 4506, name: '朋友的燈火', x: 32.3, y: 25.6 },
  { zoneId: 4506, name: '土陶郡', x: 11.9, y: 27.7 },
  { zoneId: 4506, name: '水果碼頭', x: 37.2, y: 16.8 },
  { zoneId: 4507, name: '紅豹村', x: 13.5, y: 12.8 },
  { zoneId: 4507, name: '瑪穆克', x: 35.9, y: 32.0 },
  { zoneId: 4508, name: '胡薩塔伊驛鎮', x: 29.1, y: 30.8 },
  { zoneId: 4508, name: '美花黑澤恩', x: 27.7, y: 10.1 },
  { zoneId: 4508, name: '謝申內青磷泉', x: 15.6, y: 19.2 },
  { zoneId: 4509, name: '亞斯拉尼站', x: 31.8, y: 25.6 },
  { zoneId: 4509, name: '雷轉質礦場', x: 17.1, y: 23.9 },
  { zoneId: 4509, name: '邊郊鎮', x: 17.0, y: 9.8 },
]

export function getTreasureGradeById(gradeId: string): TreasureGradeInfo {
  return treasureGrades.find((grade) => grade.id === gradeId) ?? treasureGrades[0]
}

export function getTreasureMapById(mapId: number): TreasureMapInfo {
  return treasureMaps.find((map) => map.id === mapId) ?? treasureMaps[0]
}

export function getTreasureMapsForGrade(gradeId: string): TreasureMapInfo[] {
  const visibleMapIds = new Set(
    treasurePoints.filter((point) => point.gradeId === gradeId).map((point) => point.mapId),
  )

  return treasureMaps.filter((map) => visibleMapIds.has(map.id))
}

export function getTreasurePointsForSelection(gradeId: string, mapId: number): TreasurePoint[] {
  return treasurePoints.filter((point) => point.gradeId === gradeId && point.mapId === mapId)
}
