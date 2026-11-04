export type WarRoomAttendanceStatus = "pending" | "confirmed" | "late" | "absent";

export interface WarRoomAttendee {
  userId: string;
  displayName: string;
  archetype: string | null;
  status: string;
  estimatedLateMinutes: number | null;
  absentReason: string | null;
}

export interface AttendanceCounts {
  confirmed: number;
  late: number;
  absent: number;
  pending: number;
  arrived: number;
}

export function summarizeAttendees(attendees: WarRoomAttendee[] | undefined | null): AttendanceCounts {
  const counts: AttendanceCounts = { confirmed: 0, late: 0, absent: 0, pending: 0, arrived: 0 };
  if (!attendees) return counts;
  for (const attendee of attendees) {
    if (attendee.status === "confirmed") counts.confirmed += 1;
    else if (attendee.status === "late") counts.late += 1;
    else if (attendee.status === "absent") counts.absent += 1;
    else counts.pending += 1;
  }
  counts.arrived = counts.confirmed + counts.late;
  return counts;
}

export const ATTENDANCE_STATUS_LABELS: Record<WarRoomAttendanceStatus, string> = {
  pending: "待确认",
  confirmed: "已签到",
  late: "迟到",
  absent: "缺席",
};

export function attendanceStatusLabel(status: string): string {
  return ATTENDANCE_STATUS_LABELS[status as WarRoomAttendanceStatus] ?? "待确认";
}

export type IcebreakerLiveStatus = "active" | "stalled" | "not-started";

export interface IcebreakerSessionInfo {
  id: string;
  /** Blind-box event id when the server can resolve one; preferred join key over title */
  eventId?: string | null;
  currentPhase: string;
  phaseStartedAt: string | null;
  phaseDurationMinutes: number | null;
  expectedAttendees: number;
  checkedInCount: number;
  hostUserId: string | null;
  hostName: string | null;
  eventTitle: string;
  startedAt: string | null;
}

export const ICEBREAKER_STALL_THRESHOLD_MINUTES = 20;

/**
 * `icebreaker_sessions.id` → `social_icebreaker_sessions.id`.
 *
 * The console lists the former; every admin recovery route
 * (`/api/admin/social-icebreaker/:socialSessionId/...`) expects the latter.
 * Mirrors `toSocialSessionId` in `apps/server/src/lib/socialIcebreakerStore.ts`.
 */
export function toSocialSessionId(icebreakerSessionId: string): string {
  return `social_${icebreakerSessionId}`;
}

export function deriveIcebreakerStatus(
  session: IcebreakerSessionInfo | undefined | null,
): IcebreakerLiveStatus | null {
  if (!session) return null;
  if (!session.startedAt) return "not-started";
  if (
    typeof session.phaseDurationMinutes === "number" &&
    session.phaseDurationMinutes >= ICEBREAKER_STALL_THRESHOLD_MINUTES
  ) {
    return "stalled";
  }
  return "active";
}

export function findSessionForEvent(
  sessions: IcebreakerSessionInfo[] | undefined | null,
  event: { id: string; title: string },
): IcebreakerSessionInfo | undefined {
  if (!sessions) return undefined;
  const byId = sessions.find((s) => s.eventId && s.eventId === event.id);
  if (byId) return byId;
  return sessions.find((s) => !s.eventId && s.eventTitle === event.title);
}

/**
 * Show 「转移主持」 only once a session is actually running.
 *
 * Before `startedAt` the session is still in `waiting` — nobody is frozen yet,
 * and the first caller is by definition the host, so a transfer action would be
 * a solution without a problem. The console cannot see the roster, so whether a
 * second human exists is settled by the server (409 `NO_ELIGIBLE_PARTICIPANT`).
 */
export function shouldShowTransferHostAction(
  session: IcebreakerSessionInfo | undefined | null,
): boolean {
  return Boolean(session && session.startedAt);
}

export interface WarRoomPool {
  id: string;
  title: string;
  city: string | null;
  district: string | null;
  dateTime: string;
  registrationDeadline: string;
  minGroupSize: number | null;
  status: string;
  registrationCount: number;
}

export interface ClosingPool extends WarRoomPool {
  isLowFill: boolean;
}

export const POOL_CLOSING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function filterPoolsClosingWithin24h(
  pools: WarRoomPool[] | undefined | null,
  now: Date = new Date(),
): ClosingPool[] {
  if (!pools) return [];
  const nowMs = now.getTime();
  return pools
    .filter((pool) => {
      const deadlineMs = new Date(pool.registrationDeadline).getTime();
      if (Number.isNaN(deadlineMs)) return false;
      return deadlineMs > nowMs && deadlineMs <= nowMs + POOL_CLOSING_WINDOW_MS;
    })
    .map((pool) => ({
      ...pool,
      isLowFill: pool.registrationCount < (pool.minGroupSize ?? 0),
    }))
    .sort(
      (a, b) =>
        new Date(a.registrationDeadline).getTime() - new Date(b.registrationDeadline).getTime(),
    );
}
