export type CloudProviderId = 'onedrive' | 'gdrive'

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
