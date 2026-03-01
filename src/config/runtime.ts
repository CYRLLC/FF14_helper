import type { RuntimeConfig } from '../types'

function buildDefaultRedirectUri(): string {
  return new URL(`${import.meta.env.BASE_URL}oauth/callback.html`, window.location.origin).toString()
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
    }
  } catch {
    return defaults
  }
}
