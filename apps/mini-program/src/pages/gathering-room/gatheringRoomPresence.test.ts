import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { applyGatheringRoomUserConfirmed, resolveGatheringRoomMemberState, resolveGatheringRoomPresence } from './gatheringRoomPresence'
import type { GatheringRoomStateResponse } from '@shared/api'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PAGE_TSX = readFileSync(path.join(HERE, 'index.tsx'), 'utf8')
const CONTROLLER_TS = readFileSync(path.join(HERE, 'useGatheringRoomController.ts'), 'utf8')

describe('gathering room presence precedence', () => {
  it('keeps confirmed and late members seated while offline', () => {
    expect(resolveGatheringRoomPresence('confirmed', false)).toBe('confirmed')
    expect(resolveGatheringRoomPresence('late', false)).toBe('confirmed')
  })

  it('keeps confirmed members seated while online', () => {
    expect(resolveGatheringRoomPresence('confirmed', true)).toBe('confirmed')
  })

  it('uses live presence only for members without durable attendance', () => {
    expect(resolveGatheringRoomPresence('pending', true)).toBe('present')
    expect(resolveGatheringRoomPresence('pending', false)).toBe('absent')
  })

  it('keeps confirmed-online members greetable without confusing attendance and presence', () => {
    expect(PAGE_TSX).toContain('resolveGatheringRoomMemberState({')
    expect(PAGE_TSX).toContain('memberState.canPoke')
    expect(PAGE_TSX).not.toContain("presence !== 'present'")
  })

  it('stops ended-room polling and blocks disconnected poke success', () => {
    expect(CONTROLLER_TS).toContain("query.state.data?.eventPhase === 'ended'")
    const disconnectedGuard = CONTROLLER_TS.indexOf('if (!wsConnected)')
    const successAnalytics = CONTROLLER_TS.indexOf("gatheringRoomAnalytics.track('room_poke'")
    expect(disconnectedGuard).toBeGreaterThan(-1)
    expect(successAnalytics).toBeGreaterThan(disconnectedGuard)
    expect(CONTROLLER_TS).toContain('还没连上房间，稍后再试')
    expect(CONTROLLER_TS).not.toContain('已经替你传达啦')
  })

  it('keeps the last room composition while disconnected without keeping poke live', () => {
    expect(CONTROLLER_TS).toContain('lastLivePresenceRef')
    expect(CONTROLLER_TS).toContain('if (wsConnected) lastLivePresenceRef.current = livePresenceByUserId')
    expect(CONTROLLER_TS).toContain('const presenceByUserId = wsConnected')
    expect(CONTROLLER_TS).toContain('lastLivePresenceRef.current ?? livePresenceByUserId')
    expect(PAGE_TSX).toContain('isPresent: presentUserIds.has(selectedMember.userId)')
    expect(PAGE_TSX).toContain('wsConnected,')
  })

  it('explains when late reporting is available without showing it after the event', () => {
    expect(PAGE_TSX).toContain('晚到登记将在活动前 2 小时开放')
    expect(PAGE_TSX).toContain("eventPhase !== 'ended'")
  })

  it('never celebrates an all-confirmed WS payload while any member is absent', () => {
    expect(CONTROLLER_TS).toContain(
      "!roomState?.members.some((member) => member.attendanceStatus === 'absent')"
    )
    expect(CONTROLLER_TS).toContain('celebrationStatic')
  })

  it('uses the real room-state query key when applying USER_CONFIRMED', () => {
    expect(CONTROLLER_TS).toContain("['mini-program', 'gathering-room-state', groupId]")
    expect(CONTROLLER_TS).not.toContain('QUERY_KEY(groupId)')
    expect(CONTROLLER_TS).toContain('const CELEBRATION_MS = 1760')
  })

  it('keeps attendance and realtime presence independent across the full truth matrix', () => {
    for (const attendanceStatus of ['pending', 'confirmed', 'late', 'absent'] as const) {
      for (const isPresent of [false, true]) {
        for (const wsConnected of [false, true]) {
          const state = resolveGatheringRoomMemberState({
            attendanceStatus,
            isPresent,
            wsConnected,
            eventPhase: 'upcoming',
          })
          expect(state.statusLabel.length).toBeGreaterThan(0)
          expect(state.statusLabel).not.toContain('正在路上')
          expect(state.canPoke).toBe(
            attendanceStatus !== 'absent' && isPresent && wsConnected,
          )
        }
      }
      expect(resolveGatheringRoomMemberState({
        attendanceStatus,
        isPresent: true,
        wsConnected: true,
        eventPhase: 'ended',
      }).canPoke).toBe(false)
    }
    expect(resolveGatheringRoomMemberState({
      attendanceStatus: 'confirmed', isPresent: false, wsConnected: true, eventPhase: 'upcoming',
    }).statusLabel).toBe('已确认·座位已留')
    expect(resolveGatheringRoomMemberState({
      attendanceStatus: 'late', isPresent: true, wsConnected: true, eventPhase: 'live',
    }).statusLabel).toBe('会晚到·在房间')
  })

  it('persists authoritative USER_CONFIRMED counts and attendance in room state', () => {
    const state = {
      confirmedCount: 2,
      arrivingLateCount: 1,
      members: [
        { userId: 'late-member', attendanceStatus: 'late' },
        { userId: 'pending-member', attendanceStatus: 'pending' },
      ],
    } as unknown as GatheringRoomStateResponse
    const next = applyGatheringRoomUserConfirmed(state, {
      userId: 'pending-member',
      confirmedCount: 3,
    })
    expect(next?.confirmedCount).toBe(3)
    expect(next?.arrivingLateCount).toBe(1)
    expect(next?.members.find(member => member.userId === 'pending-member')?.attendanceStatus)
      .toBe('confirmed')
    const latePromoted = applyGatheringRoomUserConfirmed(next, {
      userId: 'late-member',
      confirmedCount: 3,
    })
    expect(latePromoted?.arrivingLateCount).toBe(0)
    expect(applyGatheringRoomUserConfirmed(undefined, {
      userId: 'pending-member', confirmedCount: 3,
    })).toBeUndefined()
  })
})
