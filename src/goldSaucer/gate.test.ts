import { describe, expect, it } from 'vitest'
import { buildGatePrediction, buildGateScheduleSnapshot, getNextGateStart } from './gate'

describe('getNextGateStart', () => {
  it('returns the next :20 slot when inside the hour', () => {
    const next = getNextGateStart(new Date('2026-03-02T04:05:00.000Z'))

    expect(next.toISOString()).toBe('2026-03-02T04:20:00.000Z')
  })

  it('rolls over to the next hour when needed', () => {
    const next = getNextGateStart(new Date('2026-03-02T15:59:00.000Z'))

    expect(next.toISOString()).toBe('2026-03-02T16:00:00.000Z')
  })
})

describe('buildGateScheduleSnapshot', () => {
  it('marks the current slot as active and tracks remaining time', () => {
    const snapshot = buildGateScheduleSnapshot(new Date('2026-03-02T04:20:00.000Z'))

    expect(snapshot.activeWindow?.isActive).toBe(true)
    expect(snapshot.activeWindow?.startAtIso).toBe('2026-03-02T04:20:00.000Z')
    expect(snapshot.activeWindow?.countdownMs).toBe(20 * 60 * 1000)
    expect(snapshot.windows[0].isActive).toBe(true)
  })
})

describe('buildGatePrediction', () => {
  it('returns deterministic candidates for the same slot', () => {
    const first = buildGatePrediction(new Date('2026-03-02T04:20:00.000Z'))
    const second = buildGatePrediction(new Date('2026-03-02T04:39:59.000Z'))

    expect(first.slotKey).toBe(second.slotKey)
    expect(first.predictedEvent).toBe(second.predictedEvent)
    expect(first.candidateEvents).toEqual(second.candidateEvents)
    expect(first.candidateEvents).toHaveLength(3)
  })
})
