import type { TreasureZoneConfig } from '../types'

export const treasureZones: TreasureZoneConfig[] = [
  {
    id: 'urqopacha',
    label: 'Urqopacha',
    expansion: 'dawntrail',
    defaultMarker: { x: 52, y: 47 },
    calibration: { scaleX: 0.36, scaleY: 0.36, offsetX: 1, offsetY: 1 },
  },
  {
    id: 'kozamauka',
    label: "Kozama'uka",
    expansion: 'dawntrail',
    defaultMarker: { x: 45, y: 54 },
    calibration: { scaleX: 0.34, scaleY: 0.34, offsetX: 1.5, offsetY: 1.5 },
  },
  {
    id: 'yak-tel',
    label: "Yak T'el",
    expansion: 'dawntrail',
    defaultMarker: { x: 58, y: 51 },
    calibration: { scaleX: 0.35, scaleY: 0.35, offsetX: 1.2, offsetY: 1.2 },
  },
  {
    id: 'shaaloani',
    label: 'Shaaloani',
    expansion: 'dawntrail',
    defaultMarker: { x: 49, y: 44 },
    calibration: { scaleX: 0.37, scaleY: 0.37, offsetX: 0.8, offsetY: 0.8 },
  },
  {
    id: 'heritage-found',
    label: 'Heritage Found',
    expansion: 'dawntrail',
    defaultMarker: { x: 55, y: 49 },
    calibration: { scaleX: 0.35, scaleY: 0.35, offsetX: 1, offsetY: 1 },
  },
  {
    id: 'living-memory',
    label: 'Living Memory',
    expansion: 'dawntrail',
    defaultMarker: { x: 50, y: 56 },
    calibration: { scaleX: 0.33, scaleY: 0.33, offsetX: 1.8, offsetY: 1.8 },
  },
]

export function getTreasureZoneById(zoneId: string): TreasureZoneConfig {
  return treasureZones.find((zone) => zone.id === zoneId) ?? treasureZones[0]
}
