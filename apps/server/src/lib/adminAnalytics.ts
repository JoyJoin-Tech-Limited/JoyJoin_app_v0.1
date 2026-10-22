/**
 * Admin read layer for product analytics.
 *
 * `discover_analytics_events` and `payment_ritual_events` have been written by
 * the mini-program since launch, but nothing ever read them back — the funnel
 * data existed and no operator could see it. This module is the read side.
 *
 * Two honesty rules govern everything here:
 *
 *  1. **Coverage before conversion.** An empty table and a 0% conversion rate
 *     look identical in a funnel chart but mean opposite things. Every payload
 *     carries `dataAvailable` so the UI can say 「数据源接入中」 instead of
 *     rendering a confident zero.
 *  2. **No inferred steps.** Funnel steps come from an explicit ordered list
 *     that mirrors the write sites (documented in `apps/server/src/README.md`
 *     §analytics). We do not guess the sequence from `timestamp` ordering.
 */

import { sql } from "drizzle-orm";

import { db } from "../db";
import { logger } from "./logger";
import type { AdminMetricRange } from "./adminMetrics";

export interface AnalyticsCoverage {
  totalEvents: number;
  distinctTypes: number;
  lastEventAt: string | null;
  /** False when the table has no rows in the window — render an empty state. */
  dataAvailable: boolean;
}

export interface AnalyticsEventCount {
  eventType: string;
  count: number;
  lastSeen: string | null;
}

export interface AnalyticsFunnelStep {
  key: string;
  label: string;
  count: number;
  /** Share of the first step; null when the first step is empty. */
  rateFromStart: number | null;
  /** Share of the immediately preceding step; null when that step is empty. */
  rateFromPrevious: number | null;
}

export interface AnalyticsFunnel {
  key: string;
  label: string;
  steps: AnalyticsFunnelStep[];
  /** Side exits that are not part of the linear path (cancel / fail / abandon). */
  branches: Array<{ key: string; label: string; count: number }>;
  dataAvailable: boolean;
  note: string | null;
}

export interface AnalyticsSurface {
  key: string;
  label: string;
  eventCount: number;
  distinctTypes: number;
}

/**
 * Surface prefixes. Order matters — the first matching prefix wins, so the more
 * specific prefixes are listed before the generic ones.
 *
 * Source of truth for these names: `apps/server/src/README.md` §analytics
 * (the endpoint-by-endpoint event vocabulary).
 */
const SURFACE_PREFIXES: Array<{ key: string; label: string; prefixes: string[] }> = [
  { key: "event_ticket", label: "单场局票支付", prefixes: ["event_ticket_", "pay_", "plan_switch", "welcome_coupon_", "refund_policy_", "ticket_", "persona_snapshot_"] },
  { key: "profile", label: "个人页", prefixes: ["profile_"] },
  { key: "squad_unboxing", label: "开箱揭晓", prefixes: ["squad_unboxing_"] },
  { key: "icebreaker", label: "破冰环节", prefixes: ["miniscript_", "warmup_", "room_", "social_", "auction_", "lie_detective_", "personality_dice_"] },
  { key: "personality", label: "性格测试", prefixes: ["insight_", "result_", "step_", "story_"] },
  { key: "flow", label: "街头盲盒", prefixes: ["flow_", "flash_", "gps_", "gate_"] },
  { key: "landing", label: "落地页", prefixes: ["landing_"] },
  { key: "discover", label: "发现页", prefixes: ["events_card_", "discover_", "coverage_", "pending_expand"] },
  { key: "auth", label: "登录校验", prefixes: ["auth_", "login"] },
];

function surfaceFor(eventType: string): string {
  const match = SURFACE_PREFIXES.find((surface) =>
    surface.prefixes.some((prefix) => eventType.startsWith(prefix)),
  );
  return match?.key ?? "other";
}

function pct(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function getAnalyticsCoverage(range: AdminMetricRange): Promise<AnalyticsCoverage> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(DISTINCT event_type)::int AS distinct_types,
        MAX(timestamp) AS last_event_at
      FROM discover_analytics_events
      WHERE timestamp >= ${range.from} AND timestamp < ${range.to}
    `);
    const row = (result.rows[0] ?? {}) as any;
    const totalEvents = Number(row.total) || 0;
    return {
      totalEvents,
      distinctTypes: Number(row.distinct_types) || 0,
      lastEventAt: row.last_event_at ? new Date(row.last_event_at).toISOString() : null,
      dataAvailable: totalEvents > 0,
    };
  } catch (error) {
    logger.warn("[adminAnalytics] coverage query failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { totalEvents: 0, distinctTypes: 0, lastEventAt: null, dataAvailable: false };
  }
}

export async function listAnalyticsEvents(
  range: AdminMetricRange,
  limit = 100,
): Promise<AnalyticsEventCount[]> {
  const result = await db.execute(sql`
    SELECT
      event_type,
      COUNT(*)::int AS count,
      MAX(timestamp) AS last_seen
    FROM discover_analytics_events
    WHERE timestamp >= ${range.from} AND timestamp < ${range.to}
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT ${limit}
  `);
  return result.rows.map((row: any) => ({
    eventType: row.event_type,
    count: Number(row.count) || 0,
    lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
  }));
}

export async function getAnalyticsSurfaces(range: AdminMetricRange): Promise<AnalyticsSurface[]> {
  const events = await listAnalyticsEvents(range, 500);
  const buckets = new Map<string, { eventCount: number; types: Set<string> }>();

  for (const event of events) {
    const key = surfaceFor(event.eventType);
    const bucket = buckets.get(key) ?? { eventCount: 0, types: new Set<string>() };
    bucket.eventCount += event.count;
    bucket.types.add(event.eventType);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      label: SURFACE_PREFIXES.find((s) => s.key === key)?.label ?? "未归类",
      eventCount: bucket.eventCount,
      distinctTypes: bucket.types.size,
    }))
    .sort((a, b) => b.eventCount - a.eventCount);
}

/**
 * 单场局票支付漏斗 — the one sequence in the analytics vocabulary that is a real
 * ordered funnel rather than a bag of interaction events.
 *
 * Steps mirror the mini-program ticket payment page:
 *   浏览支付页 → 切换方案 → 发起支付 → 支付成功
 * Side exits (取消/失败/超时/放弃) are returned as branches, never folded into
 * the linear path — a cancel is not a failed success.
 */
const TICKET_FUNNEL_STEPS: Array<{ key: string; label: string }> = [
  { key: "event_ticket_payment_view", label: "浏览支付页" },
  { key: "plan_switch", label: "切换方案" },
  { key: "pay_start", label: "发起支付" },
  { key: "pay_success", label: "支付成功" },
];

const TICKET_FUNNEL_BRANCHES: Array<{ key: string; label: string }> = [
  { key: "pay_cancel", label: "用户取消" },
  { key: "pay_fail", label: "支付失败" },
  { key: "pay_timeout", label: "支付超时" },
  { key: "event_ticket_payment_abandon", label: "中途离开" },
];

export async function getTicketPaymentFunnel(range: AdminMetricRange): Promise<AnalyticsFunnel> {
  const coverage = await getAnalyticsCoverage(range);
  const keys = [...TICKET_FUNNEL_STEPS, ...TICKET_FUNNEL_BRANCHES].map((s) => s.key);

  const result = await db.execute(sql`
    SELECT event_type, COUNT(*)::int AS count
    FROM discover_analytics_events
    WHERE timestamp >= ${range.from} AND timestamp < ${range.to}
      AND event_type = ANY(${keys})
    GROUP BY event_type
  `);

  const counts = new Map<string, number>();
  for (const row of result.rows as any[]) {
    counts.set(row.event_type, Number(row.count) || 0);
  }

  const first = counts.get(TICKET_FUNNEL_STEPS[0].key) ?? 0;
  let previous = 0;

  const steps = TICKET_FUNNEL_STEPS.map((step, index) => {
    const count = counts.get(step.key) ?? 0;
    const rateFromPrevious = index === 0 ? null : pct(count, previous);
    previous = count;
    return { ...step, count, rateFromStart: pct(count, first), rateFromPrevious };
  });

  const branches = TICKET_FUNNEL_BRANCHES.map((branch) => ({
    ...branch,
    count: counts.get(branch.key) ?? 0,
  }));

  const funnelTotal = steps.reduce((sum, step) => sum + step.count, 0);

  return {
    key: "ticket_payment",
    label: "单场局票支付漏斗",
    steps,
    branches,
    dataAvailable: coverage.dataAvailable && funnelTotal > 0,
    note:
      coverage.dataAvailable && funnelTotal === 0
        ? "分析事件已接入，但本周期没有支付页事件 — 可能该周期无人进入支付流程。"
        : null,
  };
}
