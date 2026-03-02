import type { TreasurePartyRouteItem } from './party'

const PARTY_INVITE_PARAM = 'treasureParty'
const PARTY_ROOM_VERSION = 1

export interface TreasurePartyRoomSnapshot {
  version: number
  roomId: string
  roomName: string
  ownerName: string
  gradeId: string
  members: string[]
  route: TreasurePartyRouteItem[]
  updatedAt: string
}

interface BuildPartyRoomSnapshotOptions {
  roomId: string
  roomName: string
  ownerName: string
  gradeId: string
  members: string[]
  route: TreasurePartyRouteItem[]
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function sanitizeMembers(members: string[]): string[] {
  const uniqueMembers = new Set<string>()

  members.forEach((member) => {
    const normalized = member.trim()

    if (normalized) {
      uniqueMembers.add(normalized)
    }
  })

  return [...uniqueMembers].slice(0, 8)
}

function sanitizeRoute(route: TreasurePartyRouteItem[]): TreasurePartyRouteItem[] {
  return route.map((entry) => ({
    id: entry.id,
    pointId: entry.pointId,
    playerName: entry.playerName.trim(),
    note: entry.note.trim(),
    completed: Boolean(entry.completed),
  }))
}

export function createPartyRoomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }

  return Math.random().toString(36).slice(2, 10)
}

export function buildPartyRoomSnapshot(
  options: BuildPartyRoomSnapshotOptions,
): TreasurePartyRoomSnapshot {
  return {
    version: PARTY_ROOM_VERSION,
    roomId: options.roomId.trim() || createPartyRoomId(),
    roomName: options.roomName.trim() || '寶圖隊伍',
    ownerName: options.ownerName.trim() || '隊長',
    gradeId: options.gradeId,
    members: sanitizeMembers(options.members),
    route: sanitizeRoute(options.route),
    updatedAt: new Date().toISOString(),
  }
}

export function encodePartyRoomSnapshot(snapshot: TreasurePartyRoomSnapshot): string {
  return base64UrlEncode(JSON.stringify(snapshot))
}

export function decodePartyRoomSnapshot(value: string): TreasurePartyRoomSnapshot | null {
  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as Partial<TreasurePartyRoomSnapshot>

    if (
      parsed.version !== PARTY_ROOM_VERSION ||
      typeof parsed.roomId !== 'string' ||
      typeof parsed.roomName !== 'string' ||
      typeof parsed.ownerName !== 'string' ||
      typeof parsed.gradeId !== 'string' ||
      !Array.isArray(parsed.members) ||
      !Array.isArray(parsed.route) ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null
    }

    return {
      version: PARTY_ROOM_VERSION,
      roomId: parsed.roomId,
      roomName: parsed.roomName,
      ownerName: parsed.ownerName,
      gradeId: parsed.gradeId,
      members: sanitizeMembers(parsed.members.filter((entry): entry is string => typeof entry === 'string')),
      route: sanitizeRoute(
        parsed.route.filter(
          (entry): entry is TreasurePartyRouteItem =>
            Boolean(entry) &&
            typeof entry.id === 'string' &&
            typeof entry.pointId === 'string' &&
            typeof entry.playerName === 'string' &&
            typeof entry.note === 'string',
        ),
      ),
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

export function buildPartyRoomInviteUrl(snapshot: TreasurePartyRoomSnapshot): string {
  const encodedSnapshot = encodePartyRoomSnapshot(snapshot)

  if (typeof window === 'undefined') {
    return `?${PARTY_INVITE_PARAM}=${encodedSnapshot}#/treasure`
  }

  const inviteUrl = new URL(window.location.href)
  inviteUrl.searchParams.set(PARTY_INVITE_PARAM, encodedSnapshot)
  inviteUrl.hash = '#/treasure'

  return inviteUrl.toString()
}

export function readPartyRoomInviteFromLocation(
  search = typeof window === 'undefined' ? '' : window.location.search,
): TreasurePartyRoomSnapshot | null {
  const params = new URLSearchParams(search)
  const encodedSnapshot = params.get(PARTY_INVITE_PARAM)

  if (!encodedSnapshot) {
    return null
  }

  return decodePartyRoomSnapshot(encodedSnapshot)
}

export function clearPartyRoomInviteFromLocation(): void {
  if (typeof window === 'undefined') {
    return
  }

  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.delete(PARTY_INVITE_PARAM)

  const nextSearch = nextUrl.searchParams.toString()
  const cleanUrl = `${nextUrl.origin}${nextUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextUrl.hash}`

  window.history.replaceState({}, '', cleanUrl)
}
