import type { GatheringRoomAttendanceStatus } from "@shared/api/gatheringRoom";

export interface GatheringRoomAttendanceCounts {
  /** A commitment to attend — `confirmed` and `late` both count. */
  confirmedCount: number;
  /** Subset of confirmedCount that explicitly said they will arrive late. */
  arrivingLateCount: number;
}

/**
 * Single counting rule for both the room-state HTTP snapshot and the
 * USER_CONFIRMED WebSocket payload. Keeping this in one place prevents the
 * header count and the celebration predicate from drifting apart.
 */
export function countGatheringRoomAttendance(
  statuses: ReadonlyArray<{ status: GatheringRoomAttendanceStatus | string }>,
): GatheringRoomAttendanceCounts {
  let confirmedCount = 0;
  let arrivingLateCount = 0;

  for (const row of statuses) {
    if (row.status === "confirmed") {
      confirmedCount += 1;
    } else if (row.status === "late") {
      confirmedCount += 1;
      arrivingLateCount += 1;
    }
  }

  return { confirmedCount, arrivingLateCount };
}
