/**
 * Pure view-model for the admin user-detail drawer.
 *
 * Everything here answers a question the raw payload cannot answer honestly on
 * its own: which joined events are really the user's own events (not derived
 * pool events), what a "match history" row actually represents, and how a
 * commercial/entitlement snapshot should read. Keeping it out of the component
 * lets each rule be tested without rendering a Radix Sheet.
 */

import { resolveArchetype } from "@shared/personality/archetypeNames";
import { formatMoneyCents } from "@/lib/currency";
import { fmtDate } from "@/lib/dateUtils";
import type {
  CommercialSnapshot,
  JoinedEvent,
  MatchHistoryEntry,
  UserEntitlement,
  UserPoolRegistration,
} from "./types";

/**
 * Server caps for 活动池报名 / 连接关系 / 同桌历史 in
 * `GET /api/admin/users/:id/detail` (`.limit(20)`). When a list hits the cap it
 * is a recent slice, not a total, and the drawer must say so.
 */
export const DETAIL_LIST_LIMIT = 20;

/** `${shown}` when the list is complete, `最近 N 条` when the server capped it. */
export function listCountLabel(shown: number, limit = DETAIL_LIST_LIMIT): string {
  if (shown >= limit) return `最近 ${shown} 条`;
  return `${shown}`;
}

export interface ArchetypeDisplay {
  /** Chinese display name — always the primary label. */
  name: string;
  /** Stable machine id, rendered only as a muted caption. */
  id: string | null;
  /** Canonical id for colour lookup (raw value when unresolvable). */
  styleKey: string;
}

/**
 * Resolve an archetype identifier (id, current Chinese name, or legacy name)
 * into what the drawer should render: Chinese first, machine id as a caption.
 * Unknown values pass through — the console must not hide a data bug.
 */
export function resolveArchetypeDisplay(
  value?: string | null,
): ArchetypeDisplay | null {
  const raw = value?.trim();
  if (!raw) return null;
  const definition = resolveArchetype(raw);
  if (!definition) return { name: raw, id: null, styleKey: raw };
  return { name: definition.nameCn, id: definition.id, styleKey: definition.id };
}

/**
 * What the drawer may say about one event's attendance.
 *
 * Only `attendanceStatus` answers "did they show up?". `rsvpStatus` exists
 * because `event_attendance.status` defaults to 'confirmed' when matching
 * persists seats — reading it as attendance would claim a check-in for an event
 * that has not happened yet.
 */
export function joinedEventAttendanceDisplay(
  event: Pick<JoinedEvent, "rsvpStatus" | "attendanceStatus">,
): string | null {
  if (event.rsvpStatus === "cancelled") return "已取消报名";
  switch (event.attendanceStatus) {
    case "confirmed":
      return "已签到";
    case "late":
      return "迟到";
    case "absent":
      return "缺席";
    case "pending":
      return "待确认";
    default:
      return null;
  }
}

export interface ActivitySplit {
  /** Joined events that belong to this user alone (no registered pool). */
  standaloneEvents: JoinedEvent[];
  /** Derived pool event per pool id (`${pool.title} - 第N组`). */
  eventByPoolId: Map<string, JoinedEvent>;
  /** Events the platform cancelled — they are not participation. */
  cancelledCount: number;
}

/**
 * Generated events are titled `${pool.title} - 第N组`, so the same session can
 * appear twice in the drawer: once as a pool registration and once as a joined
 * event. The pool row is the richer one (status, group, cancel policy), so the
 * derived event is attached there and removed from 参与活动.
 *
 * A separator is required after the pool title: a pool named 周五饭局 must not
 * swallow a separate 周五饭局加场 event.
 */
export function isDerivedPoolEventTitle(
  eventTitle: string,
  poolTitle: string,
): boolean {
  const title = eventTitle.trim();
  const pool = poolTitle.trim();
  if (!title || !pool) return false;
  if (title === pool) return true;
  if (!title.startsWith(pool)) return false;
  return /^[\s\-—–·:：|(（]/.test(title.slice(pool.length));
}

export function splitActivityEvents(
  joinedEvents: JoinedEvent[],
  poolRegistrations: UserPoolRegistration[],
): ActivitySplit {
  const poolTitles = poolRegistrations
    .map((registration) => ({
      poolId: registration.poolId,
      title: registration.poolTitle?.trim() ?? "",
    }))
    .filter((entry) => entry.title.length > 0)
    // Longest prefix first: a pool titled 周五饭局 must not claim
    // 周五饭局 · 加场 when that longer pool is also registered.
    .sort((left, right) => right.title.length - left.title.length);

  const eventByPoolId = new Map<string, JoinedEvent>();
  const standaloneEvents: JoinedEvent[] = [];
  let cancelledCount = 0;

  for (const event of joinedEvents) {
    if (event.status === "cancelled") {
      cancelledCount += 1;
      continue;
    }

    const title = event.title?.trim() ?? "";
    const owner = title
      ? poolTitles.find((pool) => isDerivedPoolEventTitle(title, pool.title))
      : undefined;

    if (owner) {
      // Server orders joined events newest-first, so the first hit is the most
      // recent group the user was seated in for that pool.
      if (!eventByPoolId.has(owner.poolId)) eventByPoolId.set(owner.poolId, event);
      continue;
    }

    standaloneEvents.push(event);
  }

  return { standaloneEvents, eventByPoolId, cancelledCount };
}

export interface MatchHistoryPartner {
  key: string;
  name: string;
  archetype: ArchetypeDisplay | null;
}

export interface MatchHistoryGroup {
  eventId: string;
  eventTitle: string | null;
  eventDateTime: string | null;
  /** Latest derivation timestamp inside the group, for a stable secondary line. */
  matchedAt: string | null;
  partners: MatchHistoryPartner[];
  /** Pairs with a definite verdict (`wouldMeetAgain` is true or false). */
  answeredPairs: number;
  /** Pairs where both sides were positive. */
  willingPairs: number;
  /** Distinct partners + the viewed user themself. */
  tableSize: number;
}

/**
 * `match_history` is derived one row per unordered member pair: a 6-person table
 * yields 15 rows for one event. The drawer must present one card per table, not
 * 15 "matches", so rows are grouped by `eventId` and partners are de-duplicated.
 *
 * `wouldMeetAgain` is pair-level (true only if both submitted true, false if
 * either submitted false, null when none did), which is why the UI labels the
 * ratio as 配对 rather than 同桌.
 */
export function groupMatchHistoryByEvent(
  rows: MatchHistoryEntry[],
  viewerUserId: string,
): MatchHistoryGroup[] {
  const groups = new Map<
    string,
    {
      eventId: string;
      eventTitle: string | null;
      eventDateTime: string | null;
      matchedAt: string | null;
      partners: Map<string, MatchHistoryPartner>;
      answeredPairs: number;
      willingPairs: number;
    }
  >();

  for (const row of rows) {
    const otherUserId = row.user1Id === viewerUserId ? row.user2Id : row.user1Id;
    const partnerName = row.partnerName?.trim() || null;
    const partnerKey = partnerName ?? otherUserId ?? row.id;

    const group =
      groups.get(row.eventId) ??
      {
        eventId: row.eventId,
        eventTitle: null,
        eventDateTime: null,
        matchedAt: null,
        partners: new Map<string, MatchHistoryPartner>(),
        answeredPairs: 0,
        willingPairs: 0,
      };

    if (!group.eventTitle && row.eventTitle) group.eventTitle = row.eventTitle;
    if (!group.eventDateTime && row.eventDateTime) group.eventDateTime = row.eventDateTime;
    if (!group.matchedAt && row.matchedAt) group.matchedAt = row.matchedAt;

    if (!group.partners.has(partnerKey)) {
      group.partners.set(partnerKey, {
        key: partnerKey,
        name: partnerName ?? "未知同桌",
        archetype: resolveArchetypeDisplay(row.partnerArchetype),
      });
    }

    if (typeof row.wouldMeetAgain === "boolean") {
      group.answeredPairs += 1;
      if (row.wouldMeetAgain) group.willingPairs += 1;
    }

    groups.set(row.eventId, group);
  }

  return Array.from(groups.values()).map((group) => ({
    eventId: group.eventId,
    eventTitle: group.eventTitle,
    eventDateTime: group.eventDateTime,
    matchedAt: group.matchedAt,
    partners: Array.from(group.partners.values()),
    answeredPairs: group.answeredPairs,
    willingPairs: group.willingPairs,
    tableSize: group.partners.size + 1,
  }));
}

export interface EntitlementDisplay {
  modeLabel: string;
  detail: string;
  tone: "active" | "credits" | "none" | "test";
}

/** Mirrors the server resolver's four branches — no client re-derivation. */
export function entitlementDisplay(
  entitlement: UserEntitlement | null | undefined,
): EntitlementDisplay {
  if (!entitlement) {
    return { modeLabel: "权益未知", detail: "详情接口未返回权益快照", tone: "none" };
  }

  switch (entitlement.mode) {
    case "subscription": {
      const planLabel =
        entitlement.subscription?.planType === "quarterly" ? "悦聚季卡" : "悦聚月卡";
      const days = entitlement.subscription?.daysRemaining;
      return {
        modeLabel: "订阅中",
        detail: `${planLabel} · ${typeof days === "number" ? `剩余 ${days} 天` : "到期时间未知"}`,
        tone: "active",
      };
    }
    case "event_pack":
      return {
        modeLabel: "局包",
        detail: `剩余 ${entitlement.availableEventCredits} 次`,
        tone: "credits",
      };
    case "test":
      return { modeLabel: "测试模式", detail: "测试环境不校验真实权益", tone: "test" };
    default:
      return { modeLabel: "无权益", detail: "报名前需先购买月卡 / 季卡 / 局包", tone: "none" };
  }
}

export interface CommercialDisplay {
  totalPaid: string;
  paidOrders: string;
  attended: string;
  /** `N/M（xx%）`; null when the ratio would be misleading or has no denominator. */
  attendanceRate: string | null;
  /**
   * Explains why a rate is withheld when attendance is higher than the matched
   * registrations — attendance also counts blind-box / non-pool events, so a
   * raw percentage can exceed 100%.
   */
  attendanceRateNote: string | null;
  recentAttended: string;
  repeat: string;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export function commercialDisplay(
  snapshot: CommercialSnapshot | null | undefined,
): CommercialDisplay | null {
  if (!snapshot) return null;
  const hasMatched = snapshot.matchedRegistrationCount > 0;
  // Attendance counts every event (blind-box and non-pool included), while the
  // denominator only counts matched pool registrations. Beyond that ceiling the
  // percentage is not a rate any more, so it is withheld and explained instead.
  const comparable =
    snapshot.attendanceRate !== null &&
    hasMatched &&
    snapshot.attendedCount <= snapshot.matchedRegistrationCount;
  return {
    totalPaid: formatMoneyCents(snapshot.totalPaidCents),
    paidOrders: `${snapshot.paidOrderCount} 笔`,
    attended: `${snapshot.attendedCount} 次`,
    attendanceRate: comparable
      ? `${snapshot.attendedCount}/${snapshot.matchedRegistrationCount}（${formatPercent(snapshot.attendanceRate as number)}）`
      : null,
    attendanceRateNote:
      !comparable && snapshot.attendedCount > snapshot.matchedRegistrationCount
        ? `出席 ${snapshot.attendedCount} 次 · 已排桌 ${snapshot.matchedRegistrationCount} 次`
        : null,
    recentAttended: snapshot.recentAttendedAt
      ? fmtDate(snapshot.recentAttendedAt)
      : "暂无出席记录",
    repeat: snapshot.isRepeat ? "复购用户" : "未复购",
  };
}
