import { authorizeWithPkce } from './oauth'
import type { BackupArtifact, CloudProviderAdapter, CloudUploadResult, RuntimeConfig } from '../types'

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'
const APP_FOLDER_NAME = 'FF14Helper'

async function readResponseError(response: Response, fallbackMessage: string): Promise<never> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null

  throw new Error(payload?.error?.message || `${fallbackMessage}（HTTP ${response.status}）`)
}

export function buildOneDriveFolderLookupUrl(): string {
  return `${GRAPH_ROOT}/me/drive/special/approot:/FF14Helper`
}

export function buildOneDriveUploadSessionUrl(folderId: string, fileName: string): string {
  return `${GRAPH_ROOT}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/createUploadSession`
}

class OneDriveAdapter implements CloudProviderAdapter {
  id = 'onedrive' as const
  private accessToken: string | null = null
  private readonly config: RuntimeConfig

  constructor(config: RuntimeConfig) {
    this.config = config
  }

  async signIn(): Promise<void> {
    const token = await authorizeWithPkce({
      authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      clientId: this.config.oneDriveClientId,
      redirectUri: this.config.oneDriveRedirectUri,
      scope: 'Files.ReadWrite.AppFolder offline_access',
    })

    this.accessToken = token.accessToken
  }

  async upload(artifact: BackupArtifact): Promise<CloudUploadResult> {
    if (!this.accessToken) {
      throw new Error('請先登入 OneDrive，再進行上傳。')
    }

    const folderId = await this.ensureAppFolder()
    const uploadSession = await this.createUploadSession(folderId, artifact.fileName)
    const response = await fetch(uploadSession.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': artifact.size.toString(),
        'Content-Range': `bytes 0-${artifact.size - 1}/${artifact.size}`,
      },
      body: artifact.blob,
    })

    if (!response.ok) {
      await readResponseError(response, 'OneDrive 上傳失敗')
    }

    const payload = (await response.json()) as {
      id: string
      name: string
    }

    return {
      provider: this.id,
      remoteFileId: payload.id,
      remoteFileName: payload.name,
      remotePathLabel: 'OneDrive > Apps > FF14Helper',
    }
  }

  async signOut(): Promise<void> {
    this.accessToken = null
  }

  private async graphFetch(input: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(init?.headers ?? {}),
      },
    })

    if (response.status === 401) {
      this.accessToken = null
      throw new Error('OneDrive 登入已過期，請重新登入後再試。')
    }

    return response
  }

  private async ensureAppFolder(): Promise<string> {
    const lookupResponse = await this.graphFetch(buildOneDriveFolderLookupUrl())

    if (lookupResponse.ok) {
      const payload = (await lookupResponse.json()) as { id: string }
      return payload.id
    }

    if (lookupResponse.status !== 404) {
      await readResponseError(lookupResponse, '無法讀取 OneDrive 應用資料夾')
    }

    const createResponse = await this.graphFetch(`${GRAPH_ROOT}/me/drive/special/approot/children`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    })

    if (!createResponse.ok) {
      await readResponseError(createResponse, '無法建立 OneDrive 應用資料夾')
    }

    const payload = (await createResponse.json()) as { id: string }
    return payload.id
  }

  private async createUploadSession(
    folderId: string,
    fileName: string,
  ): Promise<{ uploadUrl: string }> {
    const response = await this.graphFetch(buildOneDriveUploadSessionUrl(folderId, fileName), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'replace',
          name: fileName,
        },
      }),
    })

    if (!response.ok) {
      await readResponseError(response, '無法建立 OneDrive 上傳工作階段')
    }

    const payload = (await response.json()) as { uploadUrl: string }
    return payload
  }
}

export function createOneDriveAdapter(config: RuntimeConfig): CloudProviderAdapter {
  return new OneDriveAdapter(config)
}
