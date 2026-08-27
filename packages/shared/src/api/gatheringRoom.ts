import type { ApiTransport } from './core.js'
import type { EquipmentItemView, EquipmentOutfitView } from '../schema/equipment.js'

/**
 * Gathering room (集结房间) — shared client contract.
 *
 * The room is the online pre-event waiting space for one matched pool group:
 * 4–6 members see their existing avatars (with equipped looks) around a table
 * before the offline event. Presence is real-time over WebSocket (ROOM_*
 * events in wsEvents.ts); this module holds the REST snapshot DTO and the
 * analytics event whitelist.
 *
 * Server authority: GET /api/pool-groups/:groupId/room-state (403 non-member,
 * 404 unknown group). See docs/product/gathering-room-prd.md.
 */

export type GatheringRoomAttendanceStatus = 'pending' | 'confirmed' | 'late' | 'absent'

export interface GatheringRoomMember {
  userId: string
  displayName?: string | null
  archetype?: string | null
  attendanceStatus: GatheringRoomAttendanceStatus
  topInterests?: string[] | null
  ageVisible?: boolean | null
  industryVisible?: boolean | null
  /** Present only when ageVisible is true. */
  ageLabel?: string | null
  /** Present only when industryVisible is true. */
  industryNicheLabel?: string | null
  /** Profile avatar URL, same exposure as pool-group-detail member list. */
  avatarUrl?: string | null
  gender?: string | null
  /** Current equipped outfit from the profile equipment system. */
  outfit?: EquipmentOutfitView | null
  /** Resolved equipped item details for the slots in `outfit`. */
  equippedItems?: EquipmentItemView[]
}

export interface GatheringRoomStateResponse {
  groupId: string
  /** WS room id (USER_JOINED eventId). Null when the blind-box event row has
   *  not been created yet — clients must skip the WS join in that case. */
  blindBoxEventId: string | null
  totalParticipants: number
  confirmedCount: number
  /** Event date/time (ISO string) so the room can show a live countdown. */
  eventDateTime: string | null
  members: GatheringRoomMember[]
}

export function getPoolGroupRoomState(
  api: ApiTransport,
  groupId: string,
): Promise<GatheringRoomStateResponse> {
  return api<GatheringRoomStateResponse>({
    path: `/api/pool-groups/${encodeURIComponent(groupId)}/room-state`,
  })
}

/**
 * Analytics whitelist for the gathering room. Mirrored server-side at
 * apps/server/src/routes/domains/analytics.ts — keep both in sync.
 */
export const GATHERING_ROOM_ANALYTICS_EVENT_TYPES = [
  'room_entered',
  'room_poke',
  'room_confirm_attendance',
  'room_all_present',
] as const

export type GatheringRoomAnalyticsEventType =
  (typeof GATHERING_ROOM_ANALYTICS_EVENT_TYPES)[number]
