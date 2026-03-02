import { describe, expect, it } from 'vitest'
import {
  buildPartyRoomInviteUrl,
  buildPartyRoomSnapshot,
  decodePartyRoomSnapshot,
  encodePartyRoomSnapshot,
  readPartyRoomInviteFromLocation,
} from './partyRoom'

describe('partyRoom helpers', () => {
  it('encodes and decodes a snapshot', () => {
    const snapshot = buildPartyRoomSnapshot({
      roomId: 'room-123',
      roomName: '晚間八人團',
      ownerName: '隊長A',
      gradeId: 'item-9001',
      members: ['隊長A', '隊員B', '隊長A'],
      route: [
        {
          id: 'route-point-1',
          pointId: 'point-1',
          playerName: '隊長A',
          note: '先飛主水晶',
          completed: false,
        },
      ],
    })

    const encoded = encodePartyRoomSnapshot(snapshot)
    const decoded = decodePartyRoomSnapshot(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded?.roomName).toBe('晚間八人團')
    expect(decoded?.members).toEqual(['隊長A', '隊員B'])
    expect(decoded?.route).toHaveLength(1)
  })

  it('reads a snapshot from a query string', () => {
    const snapshot = buildPartyRoomSnapshot({
      roomId: 'room-456',
      roomName: '測試房',
      ownerName: '測試者',
      gradeId: 'item-1234',
      members: ['測試者'],
      route: [],
    })
    const inviteUrl = buildPartyRoomInviteUrl(snapshot)
    const queryString = new URL(inviteUrl).search
    const decoded = readPartyRoomInviteFromLocation(queryString)

    expect(decoded).not.toBeNull()
    expect(decoded?.roomId).toBe('room-456')
    expect(decoded?.ownerName).toBe('測試者')
  })
})
