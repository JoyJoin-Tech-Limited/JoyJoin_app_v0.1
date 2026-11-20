/**
 * Display vocabulary for user-detail status fields.
 *
 * Server payloads carry machine values (`pending`, `non_refundable`,
 * `confirmed`, …). Operators read Chinese; a raw key is not a label. Unknown
 * values pass through untouched on purpose — hiding a value the console does
 * not recognise would make data bugs invisible.
 */
import { ATTENDANCE_STATUS_LABELS } from "./warRoomUtils";

export const MATCH_STATUS_LABELS: Record<string, string> = {
  pending: "待排桌",
  matched: "已排桌",
  unmatched: "未成行",
  cancelled: "已取消",
  refunded: "已退款",
};

/** `event_pool_registrations.match_status` → operator-facing Chinese. */
export function matchStatusLabel(status: string | null | undefined): string {
  if (!status) return "待处理";
  return MATCH_STATUS_LABELS[status] ?? status;
}

export const CANCEL_POLICY_LABELS: Record<string, string> = {
  refundable: "可全额退款",
  non_refundable: "不可退款",
};

/** Server-computed cancel policy code → operator-facing Chinese. */
export function cancelPolicyLabel(policy: string | null | undefined): string {
  if (!policy) return "";
  return CANCEL_POLICY_LABELS[policy] ?? policy;
}

/**
 * `event_pools.status` → operator-facing Chinese. A pool status is not a
 * registration status: the pool is the session being recruited/formed, the
 * registration is this user's seat in it. Rendering the pool row without it
 * leaves the operator unable to tell a recruiting pool from a finished one.
 */
export const POOL_STATUS_LABELS: Record<string, string> = {
  pending_match: "待排桌",
  active: "招募中",
  matching: "排桌中",
  matched: "已排桌",
  matched_pending: "待开桌",
  completed: "已结束",
  cancelled: "已取消",
  archived: "已归档",
};

export function poolStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return POOL_STATUS_LABELS[status] ?? status;
}

/**
 * `event_attendance.status` on a joined event. Reuses the War Room map so the
 * two surfaces cannot drift, but keeps an honest fallback (the War Room helper
 * coerces anything unknown to 待确认, which would be wrong on a historical row).
 */
const JOINED_EVENT_ATTENDANCE_LABELS: Record<string, string> = {
  ...ATTENDANCE_STATUS_LABELS,
  cancelled: "已取消",
};

export function joinedEventAttendanceLabel(status: string | null | undefined): string {
  if (!status) return "";
  return JOINED_EVENT_ATTENDANCE_LABELS[status] ?? status;
}

/** Last-resort identifier when a joined label is missing (never the primary display). */
export function shortId(id: string | null | undefined, length = 8): string {
  if (!id) return "—";
  return `${id.slice(0, length)}…`;
}
