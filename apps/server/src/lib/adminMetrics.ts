/**
 * Admin console metrics — the SINGLE source of truth for every number the
 * operator console renders.
 *
 * Rule (PRD §6.1 / AC-27): a metric concept has exactly one SQL implementation.
 * Routes must call the functions here; they must never re-derive a metric in
 * TypeScript or in the client. Before this file existed the same concept had
 * two implementations (`/api/admin/ops-dashboard` counted every pool closing in
 * 24h and labelled it 报名不足, while `warRoomUtils` computed it correctly), and
 * matching success was structurally ~100% because its denominator was already
 * matched-only.
 *
 * Conventions
 * - Amounts are stored in 分 (cents) — `payments.final_amount` follows the
 *   pricing seed (`monthly` = 9800 = ¥98). Convert only at the presentation edge.
 * - `event_pool_registrations.registered_at` is the registration timestamp.
 *   There is no `created_at` on that table; use the former.
 * - Test pools (`is_test_pool = true`) are excluded from every operator metric.
 * - Cancelled pools are excluded from formation-rate denominators but still
 *   count toward registration volume (people did register before the cancel).
 */

import { sql } from "drizzle-orm";

import { db } from "../db";
import { logger } from "./logger";

// ============ Range handling ============

export interface AdminMetricRange {
  /** Inclusive lower bound. */
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
}

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 400;

/**
 * Resolve an explicit `[from, to)` window, falling back to a rolling window when
 * absent. Always returns an exclusive upper bound so period comparison is exact.
 */
export function resolveAdminRange(input: {
  from?: string;
  to?: string;
  days?: number;
}): AdminMetricRange {
  if (input.from && input.to) {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
      return clampRange({ from, to });
    }
  }

  const days = Math.min(
    Math.max(Number.isFinite(input.days) ? Number(input.days) : DEFAULT_RANGE_DAYS, 1),
    MAX_RANGE_DAYS,
  );
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

function clampRange(range: AdminMetricRange): AdminMetricRange {
  const maxMs = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (range.to.getTime() - range.from.getTime() <= maxMs) return range;
  return { from: new Date(range.to.getTime() - maxMs), to: range.to };
}

/** The immediately preceding window of identical length, for deltas. */
export function previousAdminRange(range: AdminMetricRange): AdminMetricRange {
  const spanMs = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - spanMs), to: range.from };
}

export function describeAdminRange(range: AdminMetricRange): string {
  const days = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return `近 ${days} 天`;
}

// ============ KPI envelope ============

export type AdminKpiKey =
  | "new_registrations"
  | "formation_rate"
  | "match_latency_p50"
  | "revenue_per_formed_event"
  | "coupon_to_paid_rate";

export type AdminKpiUnit = "count" | "percent" | "hours" | "cny" | "cents";

export interface AdminKpiDrill {
  label: string;
  /** Client path. Query params must already be URL-encoded. */
  href: string;
}

export interface AdminKpi {
  key: AdminKpiKey;
  label: string;
  value: number | null;
  unit: AdminKpiUnit;
  previous: number | null;
  /** `null` when a delta cannot be stated honestly (see `insufficientBaseline`). */
  deltaPct: number | null;
  /**
   * True when the previous period had no base to compare against. The UI renders
   * 「基线不足」 — never 0%, never +∞%.
   */
  insufficientBaseline: boolean;
  /** Human description of what the number is compared against. Never omit. */
  baseline: string;
  drill: AdminKpiDrill;
  /** Freshness of THIS block, ISO. Blocks are computed at different times. */
  asOf: string;
}

function computeDelta(current: number | null, previous: number | null): {
  deltaPct: number | null;
  insufficientBaseline: boolean;
} {
  if (current === null || previous === null) {
    return { deltaPct: null, insufficientBaseline: false };
  }
  if (previous === 0) {
    // A percentage change from zero is undefined. Saying "+100%" or "0%" are
    // both lies; the UI must render 「基线不足」 instead.
    return { deltaPct: null, insufficientBaseline: true };
  }
  return {
    deltaPct: Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10,
    insufficientBaseline: false,
  };
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function scalar(query: ReturnType<typeof sql>): Promise<number | null> {
  const result = await db.execute(query);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return safeNumber(Object.values(row)[0]);
}

// ============ Individual metrics ============

/**
 * 新增报名 — registrations created in the window.
 * A cancelled pool still counts: the registration did happen.
 */
export async function countNewRegistrations(range: AdminMetricRange): Promise<number> {
  return (
    (await scalar(sql`
      SELECT COUNT(*)::int AS count
      FROM event_pool_registrations r
      JOIN event_pools p ON p.id = r.pool_id
      WHERE r.registered_at >= ${range.from}
        AND r.registered_at < ${range.to}
        AND p.is_test_pool = false
    `)) ?? 0
  );
}

/**
 * 成行率 — of the pools whose registration deadline fell in the window, how many
 * produced at least one non-cancelled group.
 *
 * Single time anchor: the deadline. The earlier draft mixed a status-based
 * numerator with a deadline-based denominator, which scored pools as unformed
 * between "released" and the +3h completion sweep.
 */
export async function getFormationRate(
  range: AdminMetricRange,
): Promise<{ rate: number | null; dueCount: number; formedCount: number }> {
  const result = await db.execute(sql`
    WITH due AS (
      SELECT p.id
      FROM event_pools p
      WHERE p.registration_deadline >= ${range.from}
        AND p.registration_deadline < ${range.to}
        AND p.is_test_pool = false
        AND p.status <> 'cancelled'
    )
    SELECT
      (SELECT COUNT(*)::int FROM due) AS due_count,
      (SELECT COUNT(*)::int FROM due d WHERE EXISTS (
        SELECT 1 FROM event_pool_groups g
        WHERE g.pool_id = d.id AND g.status <> 'cancelled'
      )) AS formed_count
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const dueCount = safeNumber(row?.due_count) ?? 0;
  const formedCount = safeNumber(row?.formed_count) ?? 0;
  return {
    rate: dueCount > 0 ? Math.round((formedCount / dueCount) * 1000) / 10 : null,
    dueCount,
    formedCount,
  };
}

/**
 * 排桌时延 P50 — hours between the registration deadline and match completion.
 *
 * This is the system-side segment: it is always measurable and always the
 * operator's real wait. The approval segment (`operator_reviewed_at -
 * matched_at`) only exists while the operator-review gate is on; callers render
 * it conditionally rather than reading `0` as "instant".
 */
export async function getMatchLatencyHours(
  range: AdminMetricRange,
): Promise<{ p50: number | null; p90: number | null; sampleSize: number }> {
  const result = await db.execute(sql`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (p.matched_at - p.registration_deadline)) / 3600.0
      ) AS p50,
      percentile_cont(0.9) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (p.matched_at - p.registration_deadline)) / 3600.0
      ) AS p90,
      COUNT(*)::int AS sample_size
    FROM event_pools p
    WHERE p.matched_at IS NOT NULL
      AND p.matched_at >= ${range.from}
      AND p.matched_at < ${range.to}
      AND p.is_test_pool = false
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    p50: round1(safeNumber(row?.p50)),
    p90: round1(safeNumber(row?.p90)),
    sampleSize: safeNumber(row?.sample_size) ?? 0,
  };
}

/**
 * Approval segment: hours from match completion to operator approval.
 * Returns `null` when no approved pools exist in the window — which is the
 * normal state while `matchingOperatorReviewEnabled` is off.
 */
export async function getApprovalLatencyHours(
  range: AdminMetricRange,
): Promise<{ p50: number | null; sampleSize: number }> {
  const result = await db.execute(sql`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (p.operator_reviewed_at - p.matched_at)) / 3600.0
      ) AS p50,
      COUNT(*)::int AS sample_size
    FROM event_pools p
    WHERE p.operator_reviewed_at IS NOT NULL
      AND p.matched_at IS NOT NULL
      AND p.operator_reviewed_at >= ${range.from}
      AND p.operator_reviewed_at < ${range.to}
      AND p.is_test_pool = false
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    p50: round1(safeNumber(row?.p50)),
    sampleSize: safeNumber(row?.sample_size) ?? 0,
  };
}

/**
 * 每场实收单价 — completed cash in the window divided by events actually held.
 * Returns cents; the client converts to ¥.
 *
 * `payments.final_amount` is authoritative for cash (after discount). This is a
 * revenue-only figure: per-session margin is NOT computable because `venue_deals`
 * stores `discountType`/`discountValue` and no cost fields. Do not render a
 * margin or gross-profit number derived from it.
 */
export async function getRevenuePerFormedEvent(
  range: AdminMetricRange,
): Promise<{ cents: number | null; revenueCents: number; formedEvents: number }> {
  const revenueResult = await db.execute(sql`
    SELECT COALESCE(SUM(final_amount), 0)::bigint AS revenue_cents
    FROM payments
    WHERE status = 'completed'
      AND created_at >= ${range.from}
      AND created_at < ${range.to}
  `);
  const revenueCents =
    safeNumber((revenueResult.rows[0] as Record<string, unknown> | undefined)?.revenue_cents) ?? 0;

  const formedResult = await db.execute(sql`
    SELECT COUNT(*)::int AS formed_events
    FROM event_pools p
    WHERE p.date_time >= ${range.from}
      AND p.date_time < ${range.to}
      AND p.is_test_pool = false
      AND p.status <> 'cancelled'
      AND EXISTS (
        SELECT 1 FROM event_pool_groups g
        WHERE g.pool_id = p.id AND g.status <> 'cancelled'
      )
  `);
  const formedEvents =
    safeNumber((formedResult.rows[0] as Record<string, unknown> | undefined)?.formed_events) ?? 0;

  return {
    cents: formedEvents > 0 ? Math.round(revenueCents / formedEvents) : null,
    revenueCents,
    formedEvents,
  };
}

/**
 * 券核销→支付转化 — of the coupons redeemed in the window, what share is
 * attached to a completed payment.
 */
export async function getCouponToPaidRate(
  range: AdminMetricRange,
): Promise<{ rate: number | null; redeemed: number; converted: number }> {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM user_coupons
        WHERE is_used = true
          AND used_at >= ${range.from}
          AND used_at < ${range.to}) AS redeemed,
      (SELECT COUNT(*)::int FROM payments
        WHERE status = 'completed'
          AND coupon_id IS NOT NULL
          AND created_at >= ${range.from}
          AND created_at < ${range.to}) AS converted
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const redeemed = safeNumber(row?.redeemed) ?? 0;
  const converted = safeNumber(row?.converted) ?? 0;
  return {
    rate: redeemed > 0 ? Math.round((converted / redeemed) * 1000) / 10 : null,
    redeemed,
    converted,
  };
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

// ============ KPI assembly ============

/**
 * Build the five KPI cards. Each carries its own `asOf` and an explicit
 * baseline description, because they are computed from different tables at
 * different instants — a single header timestamp would be a lie.
 */
export async function buildAdminKpis(range: AdminMetricRange): Promise<AdminKpi[]> {
  const prev = previousAdminRange(range);
  const baseline = describeAdminRange(range);
  const prevBaseline = `上一${baseline.replace("近 ", "")}期`;

  const [
    regCurrent,
    regPrevious,
    formationCurrent,
    formationPrevious,
    latencyCurrent,
    latencyPrevious,
    revenueCurrent,
    revenuePrevious,
    couponCurrent,
    couponPrevious,
  ] = await Promise.all([
    countNewRegistrations(range),
    countNewRegistrations(prev),
    getFormationRate(range),
    getFormationRate(prev),
    getMatchLatencyHours(range),
    getMatchLatencyHours(prev),
    getRevenuePerFormedEvent(range),
    getRevenuePerFormedEvent(prev),
    getCouponToPaidRate(range),
    getCouponToPaidRate(prev),
  ]);

  const registrationsDelta = computeDelta(regCurrent, regPrevious);
  const formationDelta = computeDelta(formationCurrent.rate, formationPrevious.rate);
  const latencyDelta = computeDelta(latencyCurrent.p50, latencyPrevious.p50);
  const revenueDelta = computeDelta(revenueCurrent.cents, revenuePrevious.cents);
  const couponDelta = computeDelta(couponCurrent.rate, couponPrevious.rate);

  const asOf = new Date().toISOString();

  return [
    {
      key: "new_registrations",
      label: "新增报名",
      value: regCurrent,
      unit: "count",
      previous: regPrevious,
      ...registrationsDelta,
      baseline: `对比${prevBaseline}`,
      drill: {
        label: "查看报名",
        href: `/admin/event-pools?registeredFrom=${encodeURIComponent(range.from.toISOString())}`,
      },
      asOf,
    },
    {
      key: "formation_rate",
      label: "成行率",
      value: formationCurrent.rate,
      unit: "percent",
      previous: formationPrevious.rate,
      ...formationDelta,
      baseline: `${formationCurrent.dueCount} 场到期 · ${formationCurrent.formedCount} 场成行；对比${prevBaseline}`,
      drill: {
        label: "查看到期场次",
        href: `/admin/event-pools?deadlineFrom=${encodeURIComponent(
          range.from.toISOString(),
        )}&deadlineTo=${encodeURIComponent(range.to.toISOString())}`,
      },
      asOf,
    },
    {
      key: "match_latency_p50",
      label: "排桌时延 P50",
      value: latencyCurrent.p50,
      unit: "hours",
      previous: latencyPrevious.p50,
      ...latencyDelta,
      baseline: `${latencyCurrent.sampleSize} 场样本；从报名截止到排桌完成；对比${prevBaseline}`,
      drill: {
        label: "查看排桌记录",
        href: "/admin/matching-logs",
      },
      asOf,
    },
    {
      key: "revenue_per_formed_event",
      label: "每场实收单价",
      value: revenueCurrent.cents,
      unit: "cents",
      previous: revenuePrevious.cents,
      ...revenueDelta,
      baseline: `实收 ¥${(revenueCurrent.revenueCents / 100).toFixed(0)} ÷ ${
        revenueCurrent.formedEvents
      } 场；对比${prevBaseline}`,
      drill: {
        label: "查看财务",
        href: "/admin/finance",
      },
      asOf,
    },
    {
      key: "coupon_to_paid_rate",
      label: "券核销→支付转化",
      value: couponCurrent.rate,
      unit: "percent",
      previous: couponPrevious.rate,
      ...couponDelta,
      baseline: `${couponCurrent.redeemed} 张核销 · ${couponCurrent.converted} 笔支付；对比${prevBaseline}`,
      drill: {
        label: "查看优惠券",
        href: "/admin/coupons",
      },
      asOf,
    },
  ];
}

// ============ Action queue signals ============

export interface LowFillPool {
  id: string;
  title: string;
  city: string;
  registrationDeadline: string;
  registrationCount: number;
  requiredCount: number;
}

/**
 * Pools closing soon that are genuinely under-filled.
 *
 * The pre-2026-10-22 query counted every pool closing in 24h with no fill
 * condition at all, while the tile claimed 报名不足. Threshold is
 * `min_group_size * target_groups` so multi-group pools are not under-reported.
 */
export async function getUnderfilledPoolsClosingSoon(hoursAhead = 24): Promise<LowFillPool[]> {
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.city,
      p.registration_deadline,
      (SELECT COUNT(*)::int FROM event_pool_registrations r WHERE r.pool_id = p.id) AS registration_count,
      (p.min_group_size * p.target_groups)::int AS required_count
    FROM event_pools p
    WHERE p.registration_deadline > NOW()
      AND p.registration_deadline <= NOW() + (${hoursAhead} * INTERVAL '1 hour')
      AND p.is_test_pool = false
      AND p.status = 'active'
      AND (SELECT COUNT(*) FROM event_pool_registrations r WHERE r.pool_id = p.id)
          < (p.min_group_size * p.target_groups)
    ORDER BY p.registration_deadline ASC
    LIMIT 50
  `);

  return (result.rows as Array<Record<string, unknown>>)
    .map((row) => {
      // A row whose deadline cannot be parsed is not actionable — it cannot be
      // sorted, cannot show a countdown, and `new Date("undefined").toISOString()`
      // throws. Drop it rather than fabricate a timestamp.
      const deadline = row.registration_deadline
        ? new Date(String(row.registration_deadline))
        : null;
      if (!deadline || Number.isNaN(deadline.getTime())) return null;

      return {
        id: String(row.id),
        title: String(row.title ?? ""),
        city: String(row.city ?? ""),
        registrationDeadline: deadline.toISOString(),
        registrationCount: safeNumber(row.registration_count) ?? 0,
        requiredCount: safeNumber(row.required_count) ?? 0,
      } satisfies LowFillPool;
    })
    .filter((pool): pool is LowFillPool => pool !== null);
}

/**
 * 今日签到未确认 — attendance rows for today whose check-in is still pending.
 *
 * Reads `attendance_status`. The lifecycle column `status` is written as
 * 'confirmed' at match persistence, so counting `status = 'pending'` returns
 * zero forever and reads as "everyone showed up".
 */
export async function countPendingAttendanceToday(): Promise<number> {
  return (
    (await scalar(sql`
      SELECT COUNT(DISTINCT user_id)::int AS count
      FROM event_attendance
      WHERE attendance_status = 'pending'
        AND joined_at >= CURRENT_DATE
        AND joined_at < CURRENT_DATE + INTERVAL '1 day'
    `)) ?? 0
  );
}

/** Pools waiting on the operator-review gate. */
export async function countPendingOperatorReviews(): Promise<number> {
  return (
    (await scalar(sql`
      SELECT COUNT(*)::int AS count
      FROM event_pools
      WHERE operator_review_status = 'pending'
        AND is_test_pool = false
    `)) ?? 0
  );
}

/**
 * 退款待处理 — payments whose refund has been claimed but not settled.
 * Authoritative signal is `payments.status = 'refund_pending'` (matches the
 * ops-dashboard query); `refund_attempts` is the audit trail, not the queue.
 */
export async function countPendingRefunds(): Promise<number> {
  return (
    (await scalar(sql`
      SELECT COUNT(*)::int AS count
      FROM payments
      WHERE status = 'refund_pending'
    `)) ?? 0
  );
}

/**
 * 用户停留在注册流程 — accounts whose onboarding checkpoint has not advanced in
 * 7 days. Semantics are carried over verbatim from the ops-dashboard query
 * (`adminUsers.ts`), including the `profile-review` exclusion, so Phase 1 fixes
 * the metrics that were named and does not silently redefine others.
 */
export async function countStuckOnboarding(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return (
    (await scalar(sql`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE (
        onboarding_checkpoint IS NULL
        OR onboarding_checkpoint NOT IN ('profile-review')
      )
      AND COALESCE(onboarding_checkpoint_timestamp, created_at) < ${sevenDaysAgo}
      AND created_at < ${sevenDaysAgo}
    `)) ?? 0
  );
}

/**
 * 场地待定 — formed groups attached to an upcoming event with no venue yet.
 * These block the participant-facing 地点待定 card, so they are operationally
 * urgent in a way a plain "unassigned" count is not.
 */
export async function countUnassignedUpcomingVenues(): Promise<number> {
  return (
    (await scalar(sql`
      SELECT COUNT(*)::int AS count
      FROM event_pool_groups g
      JOIN event_pools p ON p.id = g.pool_id
      WHERE g.venue_assignment_status = 'unassigned'
        AND g.status <> 'cancelled'
        AND p.is_test_pool = false
        AND COALESCE(g.final_date_time, p.date_time) >= NOW()
    `)) ?? 0
  );
}

/** Reports awaiting moderation. */
export async function countPendingReports(): Promise<number> {
  try {
    return (
      (await scalar(sql`
        SELECT COUNT(*)::int AS count
        FROM reports
        WHERE status = 'pending'
      `)) ?? 0
    );
  } catch (error) {
    logger.warn("[adminMetrics] pending reports query failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
