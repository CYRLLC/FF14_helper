import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth'
import {
  get,
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type Database,
  type Unsubscribe,
} from 'firebase/database'
import type { RuntimeConfig } from '../types'
import type { TreasurePartyRouteItem } from './party'

const ROOM_KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ROOM_KEY_LENGTH = 8
const MAX_MEMBERS = 8
const ROOM_TTL_MS = 24 * 60 * 60 * 1000

interface FirebaseContext {
  app: FirebaseApp
  auth: Auth
  db: Database
}

export interface RealtimeTreasureMember {
  userId: string
  nickname: string
  isLeader: boolean
}

export interface RealtimeTreasureRoomState {
  roomCode: string
  roomName: string
  gradeId: string
  updatedAtLabel: string
  expiresAtLabel: string
  expiresInMs: number
  members: RealtimeTreasureMember[]
  route: TreasurePartyRouteItem[]
}

let firebaseContext: FirebaseContext | null = null

function hasFirebaseConfig(config: RuntimeConfig): boolean {
  return [
    config.firebaseApiKey,
    config.firebaseAuthDomain,
    config.firebaseDatabaseUrl,
    config.firebaseProjectId,
    config.firebaseAppId,
  ].every((value) => value.trim().length > 0)
}

function createRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_KEY_LENGTH))
  let code = ''

  for (const byte of bytes) {
    code += ROOM_KEY_CHARS[byte % ROOM_KEY_CHARS.length]
  }

  return code
}

function normalizeRoute(route: TreasurePartyRouteItem[]): TreasurePartyRouteItem[] {
  return route
    .filter(
      (entry) =>
        Boolean(entry) &&
        typeof entry.id === 'string' &&
        typeof entry.pointId === 'string' &&
        typeof entry.playerName === 'string' &&
        typeof entry.note === 'string',
    )
    .map((entry) => ({
      id: entry.id,
      pointId: entry.pointId,
      playerName: entry.playerName.trim(),
      note: entry.note.trim(),
      completed: Boolean(entry.completed),
    }))
}

function toDateTimeLabel(value: unknown): string {
  if (typeof value === 'number') {
    return new Date(value).toLocaleString('zh-TW', { hour12: false })
  }

  return '尚未更新'
}

async function ensureFirebase(config: RuntimeConfig): Promise<FirebaseContext> {
  if (!hasFirebaseConfig(config)) {
    throw new Error('未設定 Firebase，無法啟用即時隊伍同步。')
  }

  if (firebaseContext) {
    return firebaseContext
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: config.firebaseApiKey,
          authDomain: config.firebaseAuthDomain,
          databaseURL: config.firebaseDatabaseUrl,
          projectId: config.firebaseProjectId,
          storageBucket: config.firebaseStorageBucket || undefined,
          messagingSenderId: config.firebaseMessagingSenderId || undefined,
          appId: config.firebaseAppId,
        })

  firebaseContext = { app, auth: getAuth(app), db: getDatabase(app) }
  return firebaseContext
}

async function ensureSignedIn(config: RuntimeConfig): Promise<{ auth: Auth; db: Database; user: User }> {
  const context = await ensureFirebase(config)

  if (!context.auth.currentUser) {
    await signInAnonymously(context.auth)
  }

  if (context.auth.currentUser) {
    return { auth: context.auth, db: context.db, user: context.auth.currentUser }
  }

  const user = await new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      context.auth,
      (nextUser) => {
        if (nextUser) {
          unsubscribe()
          resolve(nextUser)
        }
      },
      (error) => {
        unsubscribe()
        reject(error)
      },
    )
  })

  return { auth: context.auth, db: context.db, user }
}

async function roomExists(db: Database, roomCode: string): Promise<boolean> {
  const snapshot = await get(ref(db, `treasureRooms/${roomCode}`))
  return snapshot.exists()
}

async function createUniqueRoomCode(db: Database): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = createRoomCode()
    if (!(await roomExists(db, roomCode))) {
      return roomCode
    }
  }

  throw new Error('無法建立新的房間代碼，請稍後再試。')
}

async function removeIfExpired(db: Database, roomCode: string): Promise<boolean> {
  const snapshot = await get(ref(db, `treasureRooms/${roomCode}/meta/expiresAt`))
  const expiresAt = snapshot.val()

  if (typeof expiresAt === 'number' && expiresAt <= Date.now()) {
    await remove(ref(db, `treasureRooms/${roomCode}`))
    return true
  }

  return false
}

export function isRealtimeTreasureAvailable(config: RuntimeConfig): boolean {
  return hasFirebaseConfig(config)
}

export async function createRealtimeTreasureRoom(options: {
  config: RuntimeConfig
  gradeId: string
  roomName: string
  nickname: string
  initialRoute: TreasurePartyRouteItem[]
}): Promise<{ roomCode: string; currentUserId: string }> {
  const { db, user } = await ensureSignedIn(options.config)
  const roomCode = await createUniqueRoomCode(db)
  const roomRef = ref(db, `treasureRooms/${roomCode}`)
  const memberRef = ref(db, `treasureRooms/${roomCode}/members/${user.uid}`)

  await set(roomRef, {
    meta: {
      roomName: options.roomName.trim() || 'FF14 藏寶圖隊伍',
      gradeId: options.gradeId,
      createdAt: serverTimestamp(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + ROOM_TTL_MS,
      createdBy: user.uid,
    },
    members: {
      [user.uid]: {
        nickname: options.nickname.trim() || '隊長',
        isLeader: true,
        joinedAt: serverTimestamp(),
      },
    },
    route: normalizeRoute(options.initialRoute),
  })

  await onDisconnect(memberRef).remove()

  return { roomCode, currentUserId: user.uid }
}

export async function joinRealtimeTreasureRoom(options: {
  config: RuntimeConfig
  roomCode: string
  nickname: string
}): Promise<{ roomCode: string; currentUserId: string }> {
  const normalizedRoomCode = options.roomCode.trim().toUpperCase()

  if (!/^[A-Z2-9]{8}$/u.test(normalizedRoomCode)) {
    throw new Error('房間代碼格式錯誤，請輸入 8 碼英數字。')
  }

  const { db, user } = await ensureSignedIn(options.config)

  if (await removeIfExpired(db, normalizedRoomCode)) {
    throw new Error('這個房間已過期。')
  }

  const roomRef = ref(db, `treasureRooms/${normalizedRoomCode}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    throw new Error('找不到指定房間，請確認邀請連結或房間代碼。')
  }

  const rawRoom = snapshot.val() as { members?: Record<string, unknown> }
  const memberCount = Object.keys(rawRoom.members ?? {}).length
  const currentUserExists = Boolean(rawRoom.members && rawRoom.members[user.uid])

  if (!currentUserExists && memberCount >= MAX_MEMBERS) {
    throw new Error('房間已滿。')
  }

  const memberRef = ref(db, `treasureRooms/${normalizedRoomCode}/members/${user.uid}`)

  await set(memberRef, {
    nickname: options.nickname.trim() || `隊員 ${user.uid.slice(0, 4)}`,
    isLeader: false,
    joinedAt: serverTimestamp(),
  })
  await update(ref(db, `treasureRooms/${normalizedRoomCode}/meta`), { updatedAt: Date.now() })
  await onDisconnect(memberRef).remove()

  return { roomCode: normalizedRoomCode, currentUserId: user.uid }
}

export async function leaveRealtimeTreasureRoom(config: RuntimeConfig, roomCode: string): Promise<void> {
  const { db, user } = await ensureSignedIn(config)
  await remove(ref(db, `treasureRooms/${roomCode}/members/${user.uid}`))

  const membersSnapshot = await get(ref(db, `treasureRooms/${roomCode}/members`))

  if (!membersSnapshot.exists() || Object.keys(membersSnapshot.val() ?? {}).length === 0) {
    await remove(ref(db, `treasureRooms/${roomCode}`))
    return
  }

  await update(ref(db, `treasureRooms/${roomCode}/meta`), { updatedAt: Date.now() })
}

export async function updateRealtimeTreasureNickname(
  config: RuntimeConfig,
  roomCode: string,
  nickname: string,
): Promise<void> {
  const { db, user } = await ensureSignedIn(config)
  await update(ref(db, `treasureRooms/${roomCode}/members/${user.uid}`), {
    nickname: nickname.trim() || `隊員 ${user.uid.slice(0, 4)}`,
  })
  await update(ref(db, `treasureRooms/${roomCode}/meta`), { updatedAt: Date.now() })
}

export async function updateRealtimeTreasureRoute(
  config: RuntimeConfig,
  roomCode: string,
  route: TreasurePartyRouteItem[],
): Promise<void> {
  const { db } = await ensureSignedIn(config)
  await set(ref(db, `treasureRooms/${roomCode}/route`), normalizeRoute(route))
  await update(ref(db, `treasureRooms/${roomCode}/meta`), { updatedAt: Date.now() })
}

export async function getRealtimeTreasureCurrentUserId(config: RuntimeConfig): Promise<string | null> {
  const { user } = await ensureSignedIn(config)
  return user.uid
}

export async function subscribeRealtimeTreasureRoom(
  config: RuntimeConfig,
  roomCode: string,
  onState: (state: RealtimeTreasureRoomState | null) => void,
  onError: (error: unknown) => void,
): Promise<Unsubscribe> {
  const { db } = await ensureSignedIn(config)
  const roomRef = ref(db, `treasureRooms/${roomCode}`)

  return onValue(
    roomRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        onState(null)
        return
      }

      const rawRoom = snapshot.val() as {
        meta?: { roomName?: string; gradeId?: string; updatedAt?: number; expiresAt?: number }
        members?: Record<string, { nickname?: string; isLeader?: boolean }>
        route?: TreasurePartyRouteItem[]
      }

      if (typeof rawRoom.meta?.expiresAt === 'number' && rawRoom.meta.expiresAt <= Date.now()) {
        await remove(ref(db, `treasureRooms/${roomCode}`))
        onState(null)
        return
      }

      const members = Object.entries(rawRoom.members ?? {})
        .map(([userId, entry]) => ({
          userId,
          nickname: typeof entry?.nickname === 'string' ? entry.nickname.trim() || '未命名成員' : '未命名成員',
          isLeader: Boolean(entry?.isLeader),
        }))
        .sort((left, right) => {
          if (left.isLeader && !right.isLeader) {
            return -1
          }

          if (!left.isLeader && right.isLeader) {
            return 1
          }

          return left.nickname.localeCompare(right.nickname, 'zh-TW')
        })

      onState({
        roomCode,
        roomName: rawRoom.meta?.roomName?.trim() || 'FF14 藏寶圖隊伍',
        gradeId: rawRoom.meta?.gradeId?.trim() || '',
        updatedAtLabel: toDateTimeLabel(rawRoom.meta?.updatedAt),
        expiresAtLabel: toDateTimeLabel(rawRoom.meta?.expiresAt),
        expiresInMs:
          typeof rawRoom.meta?.expiresAt === 'number' ? Math.max(0, rawRoom.meta.expiresAt - Date.now()) : 0,
        members,
        route: normalizeRoute(Array.isArray(rawRoom.route) ? rawRoom.route : []),
      })
    },
    onError,
  )
}
