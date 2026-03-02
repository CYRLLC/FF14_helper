export type CloudProviderId = 'onedrive' | 'gdrive'
export type SyncTarget = 'download' | CloudProviderId
export type SyncEventType = 'downloaded' | 'uploaded'

export interface LocalFileEntry {
  relativePath: string
  name: string
  getFile(): Promise<File>
}

export interface BackupSourceSummary {
  rootName: string
  hasBootConfig: boolean
  hasMainConfig: boolean
  characterDirs: string[]
  includedPaths: string[]
}

export interface BackupSourceSelection {
  rootName: string
  entries: LocalFileEntry[]
  summary: BackupSourceSummary
}

export interface BackupManifest {
  version: string
  createdAt: string
  platform: 'windows'
  sourceRootName: string
  characterCount: number
  includedPaths: string[]
}

export interface BackupArtifact {
  fileName: string
  blob: Blob
  size: number
  manifest: BackupManifest
}

export interface CloudUploadResult {
  provider: CloudProviderId
  remoteFileId: string
  remoteFileName: string
  remotePathLabel: string
}

export interface CloudProviderAdapter {
  id: CloudProviderId
  signIn(): Promise<void>
  upload(artifact: BackupArtifact): Promise<CloudUploadResult>
  signOut(): Promise<void>
}

export interface RuntimeConfig {
  appName: string
  version: string
  oneDriveClientId: string
  googleClientId: string
  oneDriveRedirectUri: string
  googleRedirectUri: string
}

export interface ToolDirectoryEntry {
  id: string
  name: string
  category: string
  description: string
  url: string
  futureIntegration: boolean
}

export interface SyncPreferences {
  preferredTarget: SyncTarget
  downloadBeforeCloudUpload: boolean
  keepHistory: boolean
  maxHistory: number
}

export interface SyncHistoryEntry {
  id: string
  createdAt: string
  eventType: SyncEventType
  target: SyncTarget
  fileName: string
  size: number
  sourceRootName: string
  characterCount: number
  remotePathLabel?: string
}

export interface SyncState {
  preferences: SyncPreferences
  history: SyncHistoryEntry[]
  importedAt: string | null
}

export interface RestoreInspection {
  fileName: string
  size: number
  entries: string[]
  manifest: BackupManifest | null
}

export interface SourceLink {
  id: string
  name: string
  url: string
  category: 'inspiration' | 'data'
  note: string
}

export interface PageSourceBundle {
  pageId: string
  title: string
  entries: SourceLink[]
}

export interface GateWindow {
  startAtIso: string
  endAtIso: string
  labelTw: string
  countdownMs: number
  isActive: boolean
}

export interface GateScheduleSnapshot {
  nowIso: string
  nowTaipeiLabel: string
  nextGateLabel: string
  nextGateCountdownMs: number
  activeWindow: GateWindow | null
  windows: GateWindow[]
}

export interface GatePrediction {
  slotKey: string
  predictedEvent: string
  confidenceLabel: string
  confidenceScore: number
  candidateEvents: string[]
  note: string
}

export type MarketScopeMode = 'dc' | 'world'
export type MarketRegion = 'JP' | 'NA' | 'EU' | 'OCE'

export interface MarketScopeSelection {
  region: MarketRegion
  mode: MarketScopeMode
  scopeKey: string
}

export interface UniversalisListing {
  pricePerUnit: number
  quantity: number
  worldName: string
  hq: boolean
  total: number
  lastReviewTime?: number
}

export interface UniversalisSaleEntry {
  pricePerUnit: number
  quantity: number
  worldName: string
  hq: boolean
  timestamp: number
}

export interface UniversalisMarketSnapshot {
  itemId: number
  scopeLabel: string
  lowestPrice?: number
  highestPrice?: number
  averagePrice?: number
  averagePriceNq?: number
  averagePriceHq?: number
  regularSaleVelocity?: number
  recentHistoryCount: number
  listings: UniversalisListing[]
  recentHistory: UniversalisSaleEntry[]
  fetchedAt: string
}

export interface TreasureZoneConfig {
  id: string
  label: string
  expansion: 'dawntrail'
  defaultMarker: { x: number; y: number }
  calibration: {
    scaleX: number
    scaleY: number
    offsetX: number
    offsetY: number
  }
}

export interface TreasureMarker {
  zoneId: string
  percentX: number
  percentY: number
  mapX: number
  mapY: number
}

export interface TreasureGradeInfo {
  id: string
  itemId: number
  label: string
  itemName: string
  partySize: 1 | 8
}

export interface TreasureMapInfo {
  id: number
  zoneId: number
  label: string
  imageUrl: string
  sizeFactor: number
}

export interface TreasurePoint {
  id: string
  gradeId: string
  mapId: number
  x: number
  y: number
  partySize: 1 | 8
}

export interface TreasureAetheryte {
  zoneId: number
  name: string
  x: number
  y: number
}
