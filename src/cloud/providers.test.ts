import { describe, expect, it } from 'vitest'
import { buildGoogleDriveFolderLookupUrl } from './gdrive'
import { buildOneDriveFolderLookupUrl, buildOneDriveUploadSessionUrl } from './onedrive'

describe('cloud provider request builders', () => {
  it('builds OneDrive endpoints from stable helper functions', () => {
    expect(buildOneDriveFolderLookupUrl()).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/FF14Helper',
    )
    expect(buildOneDriveUploadSessionUrl('folder123', 'report 2026.zip')).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/folder123:/report%202026.zip:/createUploadSession',
    )
  })

  it('builds Google Drive folder query URL with encoded filters', () => {
    const url = buildGoogleDriveFolderLookupUrl()

    expect(url).toContain('https://www.googleapis.com/drive/v3/files?')
    expect(url).toContain('mimeType%3D%27application%2Fvnd.google-apps.folder%27')
    expect(url).toContain('FF14+Helper')
  })
})
