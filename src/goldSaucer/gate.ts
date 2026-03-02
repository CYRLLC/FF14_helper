import type { GateScheduleSnapshot, GateWindow } from '../types'

export const GATE_MINUTES = [0, 20, 40] as const
const GATE_DURATION_MS = 20 * 60 * 1000

function formatTaipeiLabel(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds
      .toString()
      .padStart(2, '0')}s`
  }

  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

export function getGateWindowAt(date: Date): GateWindow {
  const start = new Date(date)
  const minute = start.getMinutes()
  const slotMinute = GATE_MINUTES.reduce((current, candidate) =>
    candidate <= minute ? candidate : current,
  )

  start.setMinutes(slotMinute, 0, 0)

  const end = new Date(start.getTime() + GATE_DURATION_MS)
  const isActive = date.getTime() >= start.getTime() && date.getTime() < end.getTime()

  return {
    startAtIso: start.toISOString(),
    endAtIso: end.toISOString(),
    labelTw: formatTaipeiLabel(start),
    countdownMs: Math.max(0, (isActive ? end : start).getTime() - date.getTime()),
    isActive,
  }
}

export function getNextGateStart(date: Date): Date {
  const next = new Date(date)
  next.setSeconds(0, 0)

  const currentMinute = next.getMinutes()
  const nextMinute = GATE_MINUTES.find((candidate) => candidate > currentMinute)

  if (typeof nextMinute === 'number') {
    next.setMinutes(nextMinute)
    return next
  }

  next.setHours(next.getHours() + 1, 0, 0, 0)
  return next
}

export function buildGateScheduleSnapshot(now = new Date(), count = 12): GateScheduleSnapshot {
  const safeCount = Math.max(1, Math.min(24, Math.round(count)))
  const windows: GateWindow[] = []
  const activeWindow = getGateWindowAt(now)
  const nextGateStart = activeWindow.isActive ? new Date(activeWindow.startAtIso) : getNextGateStart(now)

  for (let index = 0; index < safeCount; index += 1) {
    const gateStart = new Date(nextGateStart.getTime() + index * GATE_DURATION_MS)
    const gateEnd = new Date(gateStart.getTime() + GATE_DURATION_MS)

    windows.push({
      startAtIso: gateStart.toISOString(),
      endAtIso: gateEnd.toISOString(),
      labelTw: formatTaipeiLabel(gateStart),
      countdownMs: Math.max(
        0,
        (now.getTime() >= gateStart.getTime() && now.getTime() < gateEnd.getTime() ? gateEnd : gateStart).getTime() -
          now.getTime(),
      ),
      isActive: now.getTime() >= gateStart.getTime() && now.getTime() < gateEnd.getTime(),
    })
  }

  return {
    nowIso: now.toISOString(),
    nowTaipeiLabel: formatTaipeiLabel(now),
    nextGateLabel: formatTaipeiLabel(nextGateStart),
    nextGateCountdownMs: Math.max(0, nextGateStart.getTime() - now.getTime()),
    activeWindow: activeWindow.isActive ? activeWindow : null,
    windows,
  }
}
