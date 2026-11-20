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
  | "prepaid_deferred"
  | "coupon_to_paid_rate";

/**
 * KPI keys that expose cash figures. `/api/admin/kpi` blanks these for anyone
 * below super_admin — the list lives next to the definitions so a new money
 * metric cannot be added without deciding its redaction.
 */
export const REVENUE_KPI_KEYS: ReadonlySet<AdminKpiKey> = new Set<AdminKpiKey>([
  "revenue_per_formed_event",
  "prepaid_deferred",
]);

/**
 * `payments.payment_type` values that are cash for ONE event — money handed over
 * in exchange for the session that provides the denominator.
 *
 * Everything else is a prepayment: 三连局包/六连局包 (`event_pack`) and
 * 悦聚月卡/季卡 (`subscription` / `event_bundle`) are billed before any session is
 * delivered, and their credits are drawn down over later events.
 */
const TICKET_PAYMENT_TYPES = ["event"] as const;

/**
 * Prepaid, not-yet-delivered cash. Deliberately a superset of
 * `TICKET_PAYMENT_TYPES` and disjoint from it — a payment type that is neither
 * list is dropped from both figures rather than silently landing in revenue.
 */
const PREPAID_PAYMENT_TYPES = ["event_bundle", "subscription", "event_pack"] as const;

/**
 * Pre-built `IN (...)` lists, bound as parameters (never interpolated): the type
 * lists are constants today, but a tier added to the pricing table must not
 * become a SQL injection vector through an operator-edited payment type. Shared
 * by `getRevenueSplit` and `getKpiSeries` so the card and its sparkline can
 * never disagree about which payment types count as ticket cash.
 */
// Built lazily: these used to be module-level constants, which ran `sql.join`
// at import time. Any test that partially mocks `drizzle-orm` supplies a plain
// `sql` function without `.join`, so collection failed before an assertion ran
// (2026-10-26). Memoised, so the fragment is still constructed exactly once.
let ticketTypeList: ReturnType<typeof sql.join> | undefined;
function getTicketTypeList() {
  ticketTypeList ??= sql.join(
    TICKET_PAYMENT_TYPES.map((type) => sql`${type}`),
    sql`, `,
  );
  return ticketTypeList;
}
let prepaidTypeList: ReturnType<typeof sql.join> | undefined;
function getPrepaidTypeList() {
  prepaidTypeList ??= sql.join(
    PREPAID_PAYMENT_TYPES.map((type) => sql`${type}`),
    sql`, `,
  );
  return prepaidTypeList;
}

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
  /**
   * Weekly shape behind the number, oldest → newest. `null` marks a bucket with
   * no denominator (e.g. no pool was due that week) — drawn as a gap, never 0%.
   * Absent entirely for metrics whose series would be noise (see `getKpiSeries`).
   */
  series?: Array<number | null>;
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
 * 实收拆分 — single-ticket cash vs prepaid cash, over ONE shared denominator.
 *
 * Why this is two numbers and not one rate: the pre-2026-10-23 version divided
 * every completed payment by the formed-event count, so a ¥370 六连局包 or a ¥98
 * 悦聚月卡 sold in the same month was reported as if it were the price of the
 * sessions held that month. One six-pack plus one formed event read as ~¥458/场
 * against a real single-ticket price of ~¥88 — a systematic overstatement by
 * the prepayment multiplier, on a card operators use to judge pricing.
 *
 * `ticketCents` is the only cash that belongs to a formed event. Prepaid cash is
 * a liability (money received, delivery still owed), so it is returned as a
 * total with its order count instead of a per-event rate — dividing it by events
 * held would re-create the original error.
 *
 * Both sides are read in one statement so the numerator and denominator come
 * from the same snapshot. The two windows are anchored differently on purpose
 * and the card says so: cash is counted when it arrived (`payments.created_at`),
 * events when they are held (`event_pools.date_time`). This is a period ratio,
 * not per-event attribution — attributing each payment to its event would need
 * `payments.related_id` to be populated for every completed ticket, which it is
 * not.
 *
 * `payments.final_amount` is authoritative for cash (after discount). Per-session
 * margin is NOT computable: `venue_deals` stores `discountType`/`discountValue`
 * and no cost fields. Do not derive a margin or gross-profit number from these.
 */
export interface RevenueSplit {
  /** Completed cash from single-event tickets only — `payment_type = 'event'`. */
  ticketCents: number;
  /** Completed cash from prepayments (连局包 + 悦聚卡). A liability, not revenue. */
  prepaidCents: number;
  /** How many completed prepayment orders make up `prepaidCents`. */
  prepaidOrders: number;
  /** Formed events in the window — the single denominator both figures report against. */
  formedEvents: number;
  /** `ticketCents / formedEvents`; `null` when nothing formed (never 0). */
  perFormedEventCents: number | null;
}

/** Both halves read in one statement, so the shared denominator is one snapshot. */
export async function getRevenueSplit(range: AdminMetricRange): Promise<RevenueSplit> {
  const result = await db.execute(sql`
    WITH formed AS (
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
    ),
    cash AS (
      SELECT
        COALESCE(SUM(final_amount) FILTER (
          WHERE payment_type IN (${getTicketTypeList()})
        ), 0)::bigint AS ticket_cents,
        COALESCE(SUM(final_amount) FILTER (
          WHERE payment_type IN (${getPrepaidTypeList()})
        ), 0)::bigint AS prepaid_cents,
        COUNT(*) FILTER (
          WHERE payment_type IN (${getPrepaidTypeList()})
        )::int AS prepaid_orders
      FROM payments
      WHERE status = 'completed'
        AND created_at >= ${range.from}
        AND created_at < ${range.to}
    )
    SELECT
      f.formed_events,
      c.ticket_cents,
      c.prepaid_cents,
      c.prepaid_orders
    FROM formed f
    CROSS JOIN cash c
  `);

  const row = result.rows[0] as Record<string, unknown> | undefined;
  const ticketCents = safeNumber(row?.ticket_cents) ?? 0;
  const formedEvents = safeNumber(row?.formed_events) ?? 0;

  return {
    ticketCents,
    prepaidCents: safeNumber(row?.prepaid_cents) ?? 0,
    prepaidOrders: safeNumber(row?.prepaid_orders) ?? 0,
    formedEvents,
    perFormedEventCents: formedEvents > 0 ? Math.round(ticketCents / formedEvents) : null,
  };
}

/**
 * 每场实收单价 (compatibility shim) — now `getRevenueSplit` with the ticket half.
 *
 * Kept exported because the name is referenced by tooling and tests outside this
 * module. `revenueCents` here means single-ticket cash only; before the split it
 * also admitted 连局包/月卡 prepayments, which is the bug `getRevenueSplit`
 * documents. New callers should use `getRevenueSplit` so the prepaid half is not
 * silently dropped from the console.
 */
export async function getRevenuePerFormedEvent(
  range: AdminMetricRange,
): Promise<{ cents: number | null; revenueCents: number; formedEvents: number }> {
  const split = await getRevenueSplit(range);
  return {
    cents: split.perFormedEventCents,
    revenueCents: split.ticketCents,
    formedEvents: split.formedEvents,
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
 * Build the six KPI cards. Each carries its own `asOf` and an explicit
 * baseline description, because they are computed from different tables at
 * different instants — a single header timestamp would be a lie.
 *
 * Revenue is deliberately two cards sharing one denominator
 * (`getRevenueSplit`): 单场票实收/场 is cash for the sessions held, and
 * 预付递延 is cash received for sessions not yet delivered. Folding them into one
 * rate is what made the old 每场实收单价 read ~¥458 instead of ~¥88.
 */
/**
 * Weekly shape behind the KPI strip.
 *
 * A delta chip says "+12.4%", but not whether that came from one spike day or a
 * month-long slide — which is the one judgement a six-card strip exists to
 * support. Buckets are generated in SQL so they are authoritative; computing
 * week boundaries in Node drifts from the query's own boundaries.
 *
 * Deliberately absent: `match_latency_p50`, `coupon_to_paid_rate` and
 * `prepaid_deferred`. Latency is a percentile over roughly 0.25 samples per week
 * here, so a weekly line would be noise drawn as signal; the coupon/ritual
 * source tables are empty; and prepaid cash is a liability whose weekly flow is
 * not a balance — a line would read as "how much we earned". A card with no
 * series renders no sparkline — never a flat line at zero, which would read as
 * "stable".
 */
export async function getKpiSeries(
  range: AdminMetricRange,
): Promise<Record<string, Array<number | null>>> {
  const [registrationRows, poolRows] = await Promise.all([
    db.execute(sql`
      WITH buckets AS (
        SELECT generate_series(
          ${range.from}::timestamptz,
          ${range.to}::timestamptz - interval '1 second',
          interval '7 days'
        ) AS bucket_start
      )
      SELECT
        b.bucket_start AS bucket,
        (
          SELECT COUNT(*)::int
          FROM event_pool_registrations r
          JOIN event_pools p ON p.id = r.pool_id
          WHERE r.registered_at >= b.bucket_start
            AND r.registered_at < LEAST(b.bucket_start + interval '7 days', ${range.to}::timestamptz)
            AND p.is_test_pool = false
        ) AS value
      FROM buckets b
      ORDER BY b.bucket_start
    `),
    db.execute(sql`
      WITH buckets AS (
        SELECT generate_series(
          ${range.from}::timestamptz,
          ${range.to}::timestamptz - interval '1 second',
          interval '7 days'
        ) AS bucket_start
      )
      SELECT
        b.bucket_start AS bucket,
        (
          SELECT COUNT(*)::int FROM event_pools p
          WHERE p.registration_deadline >= b.bucket_start
            AND p.registration_deadline < LEAST(b.bucket_start + interval '7 days', ${range.to}::timestamptz)
            AND p.is_test_pool = false
            AND p.status <> 'cancelled'
        ) AS due,
        (
          SELECT COUNT(*)::int FROM event_pools p
          WHERE p.registration_deadline >= b.bucket_start
            AND p.registration_deadline < LEAST(b.bucket_start + interval '7 days', ${range.to}::timestamptz)
            AND p.is_test_pool = false
            AND p.status <> 'cancelled'
            AND EXISTS (
              SELECT 1 FROM event_pool_groups g
              WHERE g.pool_id = p.id AND g.status <> 'cancelled'
            )
        ) AS formed,
        (
          -- Ticket cash only: the card it draws is 单场票实收/场, so a sparkline
          -- built from all completed payments (prepayments included) would trend
          -- differently from the number above it. Prepaid cash deliberately has
          -- no series here — a weekly FLOW of liability read as a balance line
          -- would misstate how much delivery is still owed.
          SELECT COALESCE(SUM(pm.final_amount), 0)::bigint FROM payments pm
          WHERE pm.status = 'completed'
            AND pm.payment_type IN (${getTicketTypeList()})
            AND pm.created_at >= b.bucket_start
            AND pm.created_at < LEAST(b.bucket_start + interval '7 days', ${range.to}::timestamptz)
        ) AS revenue
      FROM buckets b
      ORDER BY b.bucket_start
    `),
  ]);

  const registrations = (registrationRows.rows as Array<{ value: number | string }>).map(
    (row) => Number(row.value) || 0,
  );

  const poolBuckets = poolRows.rows as Array<{
    due: number | string;
    formed: number | string;
    revenue: number | string;
  }>;

  const formationRate = poolBuckets.map((row) => {
    const due = Number(row.due) || 0;
    if (due === 0) return null;
    return Math.round((Number(row.formed) / due) * 1000) / 10;
  });

  const revenuePerEvent = poolBuckets.map((row) => {
    const formed = Number(row.formed) || 0;
    if (formed === 0) return null;
    return Math.round(Number(row.revenue) / formed);
  });

  return {
    new_registrations: registrations,
    formation_rate: formationRate,
    revenue_per_formed_event: revenuePerEvent,
  };
}

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
    getRevenueSplit(range),
    getRevenueSplit(prev),
    getCouponToPaidRate(range),
    getCouponToPaidRate(prev),
  ]);

  const registrationsDelta = computeDelta(regCurrent, regPrevious);
  const formationDelta = computeDelta(formationCurrent.rate, formationPrevious.rate);
  const latencyDelta = computeDelta(latencyCurrent.p50, latencyPrevious.p50);
  const revenueDelta = computeDelta(
    revenueCurrent.perFormedEventCents,
    revenuePrevious.perFormedEventCents,
  );
  // A rising liability is not growth. The delta is still useful (cash collected
  // vs. the previous period), so it is shown — the baseline sentence says which
  // way to read it.
  const prepaidDelta = computeDelta(revenueCurrent.prepaidCents, revenuePrevious.prepaidCents);
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
      label: "单场票实收/场",
      value: revenueCurrent.perFormedEventCents,
      unit: "cents",
      previous: revenuePrevious.perFormedEventCents,
      ...revenueDelta,
      baseline: `仅单场局票现金 ¥${(revenueCurrent.ticketCents / 100).toFixed(0)} ÷ ${
        revenueCurrent.formedEvents
      } 场成行（按活动日归集）；不含连局包与月卡预付款；对比${prevBaseline}`,
      drill: {
        label: "查看财务",
        href: "/admin/finance",
      },
      asOf,
    },
    {
      key: "prepaid_deferred",
      label: "预付递延 · 已收未交付",
      value: revenueCurrent.prepaidCents,
      unit: "cents",
      previous: revenuePrevious.prepaidCents,
      ...prepaidDelta,
      baseline: `${revenueCurrent.prepaidOrders} 笔连局包/月卡已收款在账；已收钱但尚未交付的场次，属于负债不是收入；不含单场局票；对比${prevBaseline}`,
      drill: {
        label: "查看预付订单",
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
export interface MatchingQualityCohortRow {
  day: string;
  policy: "legacy" | "curve_v1" | "unknown";
  groups: number;
  scoredGroups: number;
  sizedGroups: number;
  below45: number;
  below47: number;
  below50: number;
  underfilledGroups: number;
  sumAvgPair: number | null;
  meanAvgPair: number | null;
  p25AvgPair: number | null;
  shareBelow45: number | null;
  shareBelow47: number | null;
  shareBelow50: number | null;
  underfilledShare: number | null;
  attended: number;
  attendanceTotal: number;
  attendanceRate: number | null;
  atmosphereSum: number;
  atmosphereResponses: number;
  atmosphereMean: number | null;
}

export interface MatchingQualityCohortSummary {
  groups: number;
  scoredGroups: number;
  sizedGroups: number;
  meanAvgPair: number | null;
  shareBelow45: number | null;
  shareBelow47: number | null;
  shareBelow50: number | null;
  underfilledShare: number | null;
  attendanceRate: number | null;
  atmosphereMean: number | null;
  atmosphereResponses: number;
}

interface MatchingQualityTotals {
  groups: number;
  scoredGroups: number;
  sizedGroups: number;
  below45: number;
  below47: number;
  below50: number;
  underfilledGroups: number;
  sumAvgPair: number;
  attended: number;
  attendanceTotal: number;
  atmosphereSum: number;
  atmosphereResponses: number;
}

function summarizeMatchingQualityTotals(totals: MatchingQualityTotals): MatchingQualityCohortSummary {
  return {
    groups: totals.groups,
    scoredGroups: totals.scoredGroups,
    sizedGroups: totals.sizedGroups,
    meanAvgPair: totals.scoredGroups > 0 ? totals.sumAvgPair / totals.scoredGroups : null,
    shareBelow45: totals.scoredGroups > 0 ? totals.below45 / totals.scoredGroups : null,
    shareBelow47: totals.scoredGroups > 0 ? totals.below47 / totals.scoredGroups : null,
    shareBelow50: totals.scoredGroups > 0 ? totals.below50 / totals.scoredGroups : null,
    underfilledShare: totals.sizedGroups > 0 ? totals.underfilledGroups / totals.sizedGroups : null,
    attendanceRate: totals.attendanceTotal > 0 ? totals.attended / totals.attendanceTotal : null,
    atmosphereMean: totals.atmosphereResponses > 0 ? totals.atmosphereSum / totals.atmosphereResponses : null,
    atmosphereResponses: totals.atmosphereResponses,
  };
}

function addMatchingQualityTotals(rows: MatchingQualityCohortRow[]): MatchingQualityTotals {
  return rows.reduce<MatchingQualityTotals>((acc, row) => ({
    groups: acc.groups + row.groups,
    scoredGroups: acc.scoredGroups + row.scoredGroups,
    sizedGroups: acc.sizedGroups + row.sizedGroups,
    below45: acc.below45 + row.below45,
    below47: acc.below47 + row.below47,
    below50: acc.below50 + row.below50,
    underfilledGroups: acc.underfilledGroups + row.underfilledGroups,
    sumAvgPair: acc.sumAvgPair + (row.sumAvgPair ?? 0),
    attended: acc.attended + row.attended,
    attendanceTotal: acc.attendanceTotal + row.attendanceTotal,
    atmosphereSum: acc.atmosphereSum + row.atmosphereSum,
    atmosphereResponses: acc.atmosphereResponses + row.atmosphereResponses,
  }), {
    groups: 0,
    scoredGroups: 0,
    sizedGroups: 0,
    below45: 0,
    below47: 0,
    below50: 0,
    underfilledGroups: 0,
    sumAvgPair: 0,
    attended: 0,
    attendanceTotal: 0,
    atmosphereSum: 0,
    atmosphereResponses: 0,
  });
}

async function queryMatchingQualityCohorts(from: Date, to: Date): Promise<MatchingQualityCohortRow[]> {
  const result = await db.execute(sql`
    WITH group_rows AS (
      SELECT
        g.created_at::date AS cohort_day,
        COALESCE(g.pair_floor_policy, 'unknown') AS policy,
        g.avg_pair_score,
        g.formed_member_count,
        COALESCE(p.max_group_size, 6) AS max_group_size,
        COALESCE((
          SELECT COUNT(*)::int
          FROM event_attendance a
          WHERE a.event_id = g.event_id AND a.status <> 'cancelled'
        ), 0) AS attendance_total,
        COALESCE((
          SELECT COUNT(*)::int
          FROM event_attendance a
          WHERE a.event_id = g.event_id AND a.status = 'attended'
        ), 0) AS attendance_attended,
        COALESCE((
          SELECT SUM(o.atmosphere_score)::int
          FROM event_group_outcomes o
          WHERE o.group_id = g.id
        ), 0) AS atmosphere_sum,
        COALESCE((
          SELECT COUNT(*)::int
          FROM event_group_outcomes o
          WHERE o.group_id = g.id
        ), 0) AS atmosphere_responses
      FROM event_pool_groups g
      JOIN event_pools p ON p.id = g.pool_id
      WHERE g.created_at >= ${from}
        AND g.created_at < ${to}
        AND p.is_test_pool = false
        AND g.status <> 'cancelled'
        AND COALESCE(g.operator_review_status, 'none') NOT IN ('pending', 'rejected')
    )
    SELECT
      cohort_day AS day,
      policy,
      COUNT(*)::int AS groups,
      COUNT(avg_pair_score)::int AS scored_groups,
      COUNT(formed_member_count)::int AS sized_groups,
      COUNT(*) FILTER (WHERE avg_pair_score < 45)::int AS below_45,
      COUNT(*) FILTER (WHERE avg_pair_score < 47)::int AS below_47,
      COUNT(*) FILTER (WHERE avg_pair_score < 50)::int AS below_50,
      COUNT(*) FILTER (
        WHERE formed_member_count IS NOT NULL AND formed_member_count < max_group_size
      )::int AS underfilled_groups,
      SUM(avg_pair_score)::float AS sum_avg_pair,
      AVG(avg_pair_score)::float AS mean_avg_pair,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY avg_pair_score)::float AS p25_avg_pair,
      SUM(attendance_attended)::int AS attended,
      SUM(attendance_total)::int AS attendance_total,
      SUM(atmosphere_sum)::int AS atmosphere_sum,
      SUM(atmosphere_responses)::int AS atmosphere_responses
    FROM group_rows
    GROUP BY cohort_day, policy
    ORDER BY cohort_day, policy
  `);

  return (result.rows as Array<Record<string, unknown>>).map((row) => {
    const groups = safeNumber(row.groups) ?? 0;
    const scoredGroups = safeNumber(row.scored_groups) ?? 0;
    const sizedGroups = safeNumber(row.sized_groups) ?? 0;
    const below45 = safeNumber(row.below_45) ?? 0;
    const below47 = safeNumber(row.below_47) ?? 0;
    const below50 = safeNumber(row.below_50) ?? 0;
    const underfilledGroups = safeNumber(row.underfilled_groups) ?? 0;
    const sumAvgPair = safeNumber(row.sum_avg_pair);
    const attended = safeNumber(row.attended) ?? 0;
    const attendanceTotal = safeNumber(row.attendance_total) ?? 0;
    const atmosphereSum = safeNumber(row.atmosphere_sum) ?? 0;
    const atmosphereResponses = safeNumber(row.atmosphere_responses) ?? 0;
    const rawDay = row.day;
    const day = rawDay instanceof Date
      ? rawDay.toISOString().slice(0, 10)
      : String(rawDay ?? "");

    return {
      day,
      policy: row.policy === "legacy" || row.policy === "curve_v1" ? row.policy : "unknown",
      groups,
      scoredGroups,
      sizedGroups,
      below45,
      below47,
      below50,
      underfilledGroups,
      sumAvgPair,
      meanAvgPair: safeNumber(row.mean_avg_pair),
      p25AvgPair: safeNumber(row.p25_avg_pair),
      shareBelow45: scoredGroups > 0 ? below45 / scoredGroups : null,
      shareBelow47: scoredGroups > 0 ? below47 / scoredGroups : null,
      shareBelow50: scoredGroups > 0 ? below50 / scoredGroups : null,
      underfilledShare: sizedGroups > 0 ? underfilledGroups / sizedGroups : null,
      attended,
      attendanceTotal,
      attendanceRate: attendanceTotal > 0 ? attended / attendanceTotal : null,
      atmosphereSum,
      atmosphereResponses,
      atmosphereMean: atmosphereResponses > 0 ? atmosphereSum / atmosphereResponses : null,
    };
  });
}

/**
 * D3 (AC-11) — cohort truth for the pair-floor rollout.
 *
 * Daily rows are split by persisted `pair_floor_policy` so a flag-on cohort can
 * be compared with a prospective legacy baseline. Historical rows with a NULL
 * policy and NULL avg_pair_score remain `unknown` / unscored; they never become
 * zero. The baseline is the 28 days immediately before `range.from`.
 */
export async function getMatchingQualityCohorts(range: AdminMetricRange) {
  const baselineTo = range.from;
  const baselineFrom = new Date(baselineTo.getTime() - 28 * 24 * 60 * 60 * 1000);
  const [cohorts, baselineCohorts] = await Promise.all([
    queryMatchingQualityCohorts(range.from, range.to),
    queryMatchingQualityCohorts(baselineFrom, baselineTo),
  ]);

  const curveTotals = addMatchingQualityTotals(cohorts.filter((row) => row.policy === "curve_v1"));
  const legacyTotals = addMatchingQualityTotals(
    baselineCohorts.filter((row) => row.policy === "legacy" || row.policy === "unknown"),
  );
  const curve = summarizeMatchingQualityTotals(curveTotals);
  const legacy = summarizeMatchingQualityTotals(legacyTotals);

  const triggers: string[] = [];
  const dataGaps: string[] = [];
  if (curve.scoredGroups === 0) dataGaps.push("avg_pair_score");
  if (curve.sizedGroups === 0) dataGaps.push("formed_member_count");
  if (curve.attendanceRate === null) dataGaps.push("attendance");

  let status: "OK" | "REVIEW" | "INSUFFICIENT_DATA" = "OK";
  if (curve.groups < 30 || legacy.groups < 30 || curve.scoredGroups === 0) {
    status = "INSUFFICIENT_DATA";
  } else {
    if ((curve.shareBelow47 ?? 0) > 0.10) triggers.push("curve_share_below_47_gt_10pp");
    if ((curve.shareBelow45 ?? 0) > 0.02) triggers.push("curve_share_below_45_gt_2pct");
    if (
      curve.underfilledShare !== null
      && legacy.underfilledShare !== null
      && curve.underfilledShare - legacy.underfilledShare > 0.10
    ) {
      triggers.push("underfilled_share_worse_by_10pp");
    }
    if (
      curve.attendanceRate !== null
      && legacy.attendanceRate !== null
      && legacy.attendanceRate - curve.attendanceRate > 0.10
    ) {
      triggers.push("attendance_rate_worse_by_10pp");
    }
    if (triggers.length > 0) status = "REVIEW";
  }

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: describeAdminRange(range),
    },
    baseline: {
      from: baselineFrom.toISOString(),
      to: baselineTo.toISOString(),
      label: "前 28 天",
    },
    cohorts,
    baselineCohorts,
    totals: { curve, legacy },
    goNoGo: {
      status,
      triggers,
      dataGaps,
      minCohortGroups: 30,
      thresholds: {
        shareBelow47: 0.10,
        shareBelow45: 0.02,
        underfilledDelta: 0.10,
        attendanceDelta: 0.10,
      },
    },
  };
}

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

// ============ Per-user commercial snapshot ============

/**
 * One user's money + attendance facts for the admin user-detail drawer.
 *
 * Single statement on purpose: the counts describe one snapshot, and separate
 * queries let a webhook land between them. Sources:
 *
 * - 实付 / 订单 — `payments.status = 'completed'`, summing `final_amount` (分).
 *   Refunds leave the row at `status = 'refunded'`, so they drop out of both.
 * - 出席 — `event_attendance.attendance_status IN ('confirmed','late')`, the
 *   check-in column. `status` is the RSVP lifecycle and defaults to
 *   'confirmed' at match persistence, so it can never answer "did they show
 *   up?" and must not be read here.
 * - 出席率分母 — matched pool registrations: a user can only attend an event
 *   they were seated for.
 *
 * `attendanceRate` is a percentage (0–100, one decimal) like `getFormationRate`,
 * and `null` when nothing formed — never 0%, which would read as "never shows
 * up" instead of "no evidence yet".
 */
export interface AdminUserCommercialSnapshot {
  totalPaidCents: number;
  paidOrderCount: number;
  attendedCount: number;
  /** Venue date of the most recent check-in (falls back to joined_at). */
  recentAttendedAt: string | null;
  /** attendedCount / matchedRegistrationCount as 0–100; null when denominator is 0. */
  attendanceRate: number | null;
  matchedRegistrationCount: number;
  isRepeat: boolean;
}

function toIsoStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function getAdminUserCommercialSnapshot(
  userId: string,
): Promise<AdminUserCommercialSnapshot> {
  const result = await db.execute(sql`
    WITH paid AS (
      SELECT
        COUNT(*)::int AS paid_order_count,
        COALESCE(SUM(final_amount), 0)::bigint AS total_paid_cents
      FROM payments
      WHERE user_id = ${userId}
        AND status = 'completed'
    ),
    attended AS (
      SELECT
        COUNT(DISTINCT COALESCE(ea.event_id, ea.blind_box_event_id, ea.id))::int AS attended_count,
        MAX(COALESCE(e.date_time, bbe.date_time, ea.joined_at)) AS recent_attended_at
      FROM event_attendance ea
      LEFT JOIN events e ON e.id = ea.event_id
      LEFT JOIN blind_box_events bbe ON bbe.id = ea.blind_box_event_id
      WHERE ea.user_id = ${userId}
        AND ea.attendance_status IN ('confirmed', 'late')
    ),
    seated AS (
      SELECT COUNT(*)::int AS matched_registrations
      FROM event_pool_registrations
      WHERE user_id = ${userId}
        AND match_status = 'matched'
    )
    SELECT
      p.total_paid_cents,
      p.paid_order_count,
      a.attended_count,
      a.recent_attended_at,
      s.matched_registrations
    FROM paid p
    CROSS JOIN attended a
    CROSS JOIN seated s
  `);

  const row = result.rows[0] as Record<string, unknown> | undefined;
  const totalPaidCents = safeNumber(row?.total_paid_cents) ?? 0;
  const paidOrderCount = safeNumber(row?.paid_order_count) ?? 0;
  const attendedCount = safeNumber(row?.attended_count) ?? 0;
  const matchedRegistrationCount = safeNumber(row?.matched_registrations) ?? 0;

  return {
    totalPaidCents,
    paidOrderCount,
    attendedCount,
    recentAttendedAt: toIsoStringOrNull(row?.recent_attended_at),
    attendanceRate:
      matchedRegistrationCount > 0
        ? Math.round((attendedCount / matchedRegistrationCount) * 1000) / 10
        : null,
    matchedRegistrationCount,
    isRepeat: attendedCount >= 2 || paidOrderCount >= 2,
  };
}
