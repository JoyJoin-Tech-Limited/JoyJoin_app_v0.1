import type { GatheringRoomMember, GatheringRoomStateResponse } from '@shared/api'
import type { GatheringRoomPresence } from '../../components/gathering-room/GatheringRoomScene'

/** Attendance is durable; WS presence must never evict a confirmed seat. */
export function resolveGatheringRoomPresence(
  attendanceStatus: GatheringRoomMember['attendanceStatus'],
  isPresent: boolean,
): GatheringRoomPresence {
  if (attendanceStatus === 'confirmed' || attendanceStatus === 'late') return 'confirmed'
  return isPresent ? 'present' : 'absent'
}

export interface GatheringRoomMemberStateInput {
  attendanceStatus: GatheringRoomMember['attendanceStatus']
  isPresent: boolean
  wsConnected: boolean
  eventPhase: 'upcoming' | 'live' | 'ended'
}

export interface GatheringRoomMemberViewState {
  statusLabel: string
  canPoke: boolean
}

/** Durable attendance and ephemeral WS presence stay independent; neither proves arrival. */
export function resolveGatheringRoomMemberState({
  attendanceStatus,
  isPresent,
  wsConnected,
  eventPhase,
}: GatheringRoomMemberStateInput): GatheringRoomMemberViewState {
  if (eventPhase === 'ended') {
    const statusLabel = attendanceStatus === 'confirmed'
      ? '已确认出席'
      : attendanceStatus === 'late'
        ? '已登记会晚到'
        : attendanceStatus === 'absent'
          ? '已告知无法出席'
          : '未确认出席'
    return { statusLabel, canPoke: false }
  }

  if (attendanceStatus === 'absent') {
    return {
      statusLabel: wsConnected && isPresent ? '无法出席·在房间' : '已告知无法出席',
      canPoke: false,
    }
  }
  if (!wsConnected) {
    const statusLabel = attendanceStatus === 'confirmed'
      ? '已确认·连接待恢复'
      : attendanceStatus === 'late'
        ? '会晚到·连接待恢复'
        : '待确认·连接待恢复'
    return { statusLabel, canPoke: false }
  }
  if (attendanceStatus === 'late') {
    return {
      statusLabel: isPresent ? '会晚到·在房间' : '已登记会晚到',
      canPoke: isPresent,
    }
  }
  if (attendanceStatus === 'confirmed') {
    return {
      statusLabel: isPresent ? '已确认·在房间' : '已确认·座位已留',
      canPoke: isPresent,
    }
  }
  return {
    statusLabel: isPresent ? '待确认·在房间' : '座位已留·待确认',
    canPoke: isPresent,
  }
}

/** Apply the authoritative USER_CONFIRMED payload to the last REST snapshot so
 * the room summary and member truth do not stay stale after the live event. */
export function applyGatheringRoomUserConfirmed(
  state: GatheringRoomStateResponse | undefined,
  data: { userId: string; confirmedCount: number },
): GatheringRoomStateResponse | undefined {
  if (!state) return state
  const members = state.members.map((member) =>
    member.userId === data.userId
      ? { ...member, attendanceStatus: 'confirmed' as const }
      : member
  )
  return {
    ...state,
    confirmedCount: data.confirmedCount,
    arrivingLateCount: members.filter((member) => member.attendanceStatus === 'late').length,
    members,
  }
}
