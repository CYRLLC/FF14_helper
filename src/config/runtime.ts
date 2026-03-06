import type { RuntimeConfig } from '../types'

function buildDefaultRedirectUri(): string {
  const documentUrl = window.location.href.split('#')[0]
  return new URL('oauth/callback.html', documentUrl).toString()
}

function sanitizeString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}

function buildDefaults(): RuntimeConfig {
  return {
    appName: 'FF14 Helper',
    version: __APP_VERSION__,
    oneDriveClientId: '',
    googleClientId: '',
    oneDriveRedirectUri: buildDefaultRedirectUri(),
    googleRedirectUri: buildDefaultRedirectUri(),
    firebaseApiKey: '',
    firebaseAuthDomain: '',
    firebaseDatabaseUrl: '',
    firebaseProjectId: '',
    firebaseStorageBucket: '',
    firebaseMessagingSenderId: '',
    firebaseAppId: '',
  }
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const defaults = buildDefaults()

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}runtime-config.json`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return defaults
    }

    const rawConfig = (await response.json()) as Partial<RuntimeConfig>

    return {
      appName: sanitizeString(rawConfig.appName, defaults.appName),
      version: sanitizeString(rawConfig.version, defaults.version),
      oneDriveClientId: sanitizeString(rawConfig.oneDriveClientId, defaults.oneDriveClientId),
      googleClientId: sanitizeString(rawConfig.googleClientId, defaults.googleClientId),
      oneDriveRedirectUri: sanitizeString(
        rawConfig.oneDriveRedirectUri,
        defaults.oneDriveRedirectUri,
      ),
      googleRedirectUri: sanitizeString(rawConfig.googleRedirectUri, defaults.googleRedirectUri),
      firebaseApiKey: sanitizeString(rawConfig.firebaseApiKey, defaults.firebaseApiKey),
      firebaseAuthDomain: sanitizeString(rawConfig.firebaseAuthDomain, defaults.firebaseAuthDomain),
      firebaseDatabaseUrl: sanitizeString(
        rawConfig.firebaseDatabaseUrl,
        defaults.firebaseDatabaseUrl,
      ),
      firebaseProjectId: sanitizeString(rawConfig.firebaseProjectId, defaults.firebaseProjectId),
      firebaseStorageBucket: sanitizeString(
        rawConfig.firebaseStorageBucket,
        defaults.firebaseStorageBucket,
      ),
      firebaseMessagingSenderId: sanitizeString(
        rawConfig.firebaseMessagingSenderId,
        defaults.firebaseMessagingSenderId,
      ),
      firebaseAppId: sanitizeString(rawConfig.firebaseAppId, defaults.firebaseAppId),
    }
  } catch {
    return defaults
  }
}
