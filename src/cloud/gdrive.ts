import { authorizeWithPkce } from './oauth'
import type { BackupArtifact, CloudProviderAdapter, CloudUploadResult, RuntimeConfig } from '../types'

const DRIVE_API_ROOT = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_ROOT = 'https://www.googleapis.com/upload/drive/v3/files'
const APP_FOLDER_NAME = 'FF14 Helper'

async function readDriveError(response: Response, fallbackMessage: string): Promise<never> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null

  throw new Error(payload?.error?.message || `${fallbackMessage}（HTTP ${response.status}）`)
}

export function buildGoogleDriveFolderLookupUrl(folderName = APP_FOLDER_NAME): string {
  const params = new URLSearchParams({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id,name)',
  })

  return `${DRIVE_API_ROOT}/files?${params.toString()}`
}

class GoogleDriveAdapter implements CloudProviderAdapter {
  id = 'gdrive' as const
  private accessToken: string | null = null
  private readonly config: RuntimeConfig

  constructor(config: RuntimeConfig) {
    this.config = config
  }

  async signIn(): Promise<void> {
    const token = await authorizeWithPkce({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      clientId: this.config.googleClientId,
      redirectUri: this.config.googleRedirectUri,
      scope: 'https://www.googleapis.com/auth/drive.file',
      extraAuthorizationParams: {
        access_type: 'online',
        include_granted_scopes: 'true',
        prompt: 'consent',
      },
    })

    this.accessToken = token.accessToken
  }

  async upload(artifact: BackupArtifact): Promise<CloudUploadResult> {
    if (!this.accessToken) {
      throw new Error('請先登入 Google Drive，再進行上傳。')
    }

    const folderId = await this.ensureAppFolder()
    const uploadUrl = await this.createUploadSession(folderId, artifact)
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
      },
      body: artifact.blob,
    })

    if (!response.ok) {
      await readDriveError(
        response,
        response.status === 429 ? 'Google Drive 暫時限流，請稍後再試' : 'Google Drive 上傳失敗',
      )
    }

    const payload = (await response.json()) as {
      id: string
      name: string
    }

    return {
      provider: this.id,
      remoteFileId: payload.id,
      remoteFileName: payload.name,
      remotePathLabel: 'Google Drive > FF14 Helper',
    }
  }

  async signOut(): Promise<void> {
    this.accessToken = null
  }

  private async driveFetch(input: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(init?.headers ?? {}),
      },
    })

    if (response.status === 401) {
      this.accessToken = null
      throw new Error('Google Drive 登入已過期，請重新登入後再試。')
    }

    return response
  }

  private async ensureAppFolder(): Promise<string> {
    const lookupResponse = await this.driveFetch(buildGoogleDriveFolderLookupUrl())

    if (!lookupResponse.ok) {
      await readDriveError(lookupResponse, '無法讀取 Google Drive 應用資料夾')
    }

    const lookupPayload = (await lookupResponse.json()) as {
      files?: Array<{ id: string }>
    }

    const existingFolder = lookupPayload.files?.[0]

    if (existingFolder?.id) {
      return existingFolder.id
    }

    const createResponse = await this.driveFetch(`${DRIVE_API_ROOT}/files?fields=id,name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })

    if (!createResponse.ok) {
      await readDriveError(createResponse, '無法建立 Google Drive 應用資料夾')
    }

    const createPayload = (await createResponse.json()) as { id: string }
    return createPayload.id
  }

  private async createUploadSession(
    folderId: string,
    artifact: BackupArtifact,
  ): Promise<string> {
    const response = await this.driveFetch(
      `${DRIVE_UPLOAD_ROOT}?uploadType=resumable&fields=id,name,size,webViewLink`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/zip',
          'X-Upload-Content-Length': artifact.size.toString(),
        },
        body: JSON.stringify({
          name: artifact.fileName,
          parents: [folderId],
        }),
      },
    )

    if (!response.ok) {
      await readDriveError(response, '無法建立 Google Drive 上傳工作階段')
    }

    const uploadUrl = response.headers.get('Location')

    if (!uploadUrl) {
      throw new Error('Google Drive 沒有回傳可用的上傳位置。')
    }

    return uploadUrl
  }
}

export function createGoogleDriveAdapter(config: RuntimeConfig): CloudProviderAdapter {
  return new GoogleDriveAdapter(config)
}
