interface OAuthPopupMessage {
  type: 'ff14-helper-oauth-callback'
  payload: {
    search: string
    hash: string
  }
}

interface OAuthTokenResponse {
  access_token: string
  expires_in?: number
  scope?: string
}

export interface OAuthToken {
  accessToken: string
  expiresAt: number
  scope: string
}

export interface OAuthAuthorizeOptions {
  authorizationEndpoint: string
  tokenEndpoint: string
  clientId: string
  redirectUri: string
  scope: string
  extraAuthorizationParams?: Record<string, string>
}

function createRandomString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('')
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let output = ''

  bytes.forEach((byte) => {
    output += String.fromCharCode(byte)
  })

  return btoa(output).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)

  return toBase64Url(digest)
}

function waitForPopupResponse(popup: Window): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const timer = window.setInterval(() => {
      if (popup.closed) {
        cleanup()
        reject(new Error('登入視窗已關閉，授權流程未完成。'))
      }
    }, 400)

    const listener = (event: MessageEvent<OAuthPopupMessage>) => {
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data?.type !== 'ff14-helper-oauth-callback') {
        return
      }

      cleanup()
      popup.close()
      const combinedParams = new URLSearchParams(
        `${event.data.payload.search}${event.data.payload.hash.replace(/^#/, '&')}`,
      )
      resolve(combinedParams)
    }

    function cleanup(): void {
      window.clearInterval(timer)
      window.removeEventListener('message', listener)
    }

    window.addEventListener('message', listener)
  })
}

async function exchangeCodeForToken(
  options: OAuthAuthorizeOptions,
  code: string,
  codeVerifier: string,
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: options.redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(options.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await response.json().catch(() => ({}))) as Partial<OAuthTokenResponse> & {
    error?: string
    error_description?: string
  }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || '授權完成，但無法取得存取權杖。')
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? options.scope,
  }
}

export async function authorizeWithPkce(options: OAuthAuthorizeOptions): Promise<OAuthToken> {
  if (!options.clientId) {
    throw new Error('尚未設定對應的雲端 Client ID，請先更新 runtime-config.json。')
  }

  const state = createRandomString(32)
  const codeVerifier = createRandomString(96)
  const codeChallenge = await createCodeChallenge(codeVerifier)
  const searchParams = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: options.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  Object.entries(options.extraAuthorizationParams ?? {}).forEach(([key, value]) => {
    searchParams.set(key, value)
  })

  const popup = window.open(
    `${options.authorizationEndpoint}?${searchParams.toString()}`,
    'ff14-helper-auth',
    'popup=yes,width=540,height=720',
  )

  if (!popup) {
    throw new Error('瀏覽器阻擋了登入視窗，請允許此網站開啟彈出視窗。')
  }

  const params = await waitForPopupResponse(popup)
  const returnedState = params.get('state')
  const error = params.get('error')

  if (error) {
    throw new Error(params.get('error_description') || `授權被取消或被拒絕：${error}`)
  }

  if (!returnedState || returnedState !== state) {
    throw new Error('授權回應的狀態驗證失敗，請重新嘗試。')
  }

  const code = params.get('code')

  if (!code) {
    throw new Error('授權流程完成，但缺少授權碼。')
  }

  return exchangeCodeForToken(options, code, codeVerifier)
}
