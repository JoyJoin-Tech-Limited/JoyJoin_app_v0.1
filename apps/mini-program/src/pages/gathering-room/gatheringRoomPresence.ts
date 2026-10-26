import type { GatheringRoomMember } from '@shared/api'
import type { GatheringRoomPresence } from '../../components/gathering-room/GatheringRoomScene'

/** Attendance is durable; WS presence must never evict a confirmed seat. */
export function resolveGatheringRoomPresence(
  attendanceStatus: GatheringRoomMember['attendanceStatus'],
  isPresent: boolean,
): GatheringRoomPresence {
  if (attendanceStatus === 'confirmed' || attendanceStatus === 'late') return 'confirmed'
  return isPresent ? 'present' : 'absent'
}
