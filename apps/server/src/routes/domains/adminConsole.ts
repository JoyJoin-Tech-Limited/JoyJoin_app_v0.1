/**
 * Admin console — the operator decision surface.
 *
 * This router is deliberately separate from `adminUsers.ts` so that the console
 * lanes do not collide in one 900-line file (PRD §14 file-ownership matrix).
 * It is a pure read surface: every number comes from `lib/adminMetrics.ts`, and
 * nothing here re-derives a metric.
 *
 * Why a new file rather than extending `/api/admin/stats`:
 *   - `/api/admin/stats` loads every user into Node memory to compute
 *     distributions (an O(all users) heap cost). The console must never depend
 *     on that path.
 *   - The console needs its own freshness stamps per block, so bundling these
 *     numbers into one legacy payload would force one timestamp to speak for
 *     five differently-timed queries.
 */

import type { Express } from "express";
import { z } from "zod";

import { requireAdmin } from "../../adminAuth";
import {
  REVENUE_KPI_KEYS,
  buildAdminKpis,
  countPendingAttendanceToday,
  countPendingOperatorReviews,
  countPendingRefunds,
  countPendingReports,
  countStuckOnboarding,
  countUnassignedUpcomingVenues,
  getApprovalLatencyHours,
  getKpiSeries,
  getMatchLatencyHours,
  getUnderfilledPoolsClosingSoon,
  previousAdminRange,
  resolveAdminRange,
  describeAdminRange,
} from "../../lib/adminMetrics";
import { logger } from "../../lib/logger";
import {
  getAnalyticsCoverage,
  getAnalyticsSurfaces,
  getTicketPaymentFunnel,
  listAnalyticsEvents,
} from "../../lib/adminAnalytics";

const rangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.coerce.number().int().min(1).max(400).optional(),
});

export interface ActionQueueRow {
  key: string;
  label: string;
  count: number;
  /** The honest number behind the label, including its unit and denominator. */
  correctNumber: string;
  recommendedAction: string;
  /** Hours until the situation becomes unrecoverable; `null` = no hard clock. */
  slaHours: number | null;
  owner: "operator" | "ops" | "super_admin";
  severity: "critical" | "warning" | "info";
  href: string;
  /** Rows stay on screen when cleared so the operator sees "done", not "missing". */
  cleared: boolean;
  items?: Array<{ id: string; label: string; detail: string; href: string }>;
}

function hoursUntil(iso: string): number {
  return Math.round(((new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000)) * 10) / 10;
}

/**
 * Build the fixed 7-row action queue.
 *
 * Every row is always returned, in the same order, regardless of count — a row
 * that disappears when it hits zero trains operators to distrust the panel.
 *
 * `href` contract (2026-10-23): a row's link must land on a view that actually
 * renders the records the count was computed from. A link that 404s, or that
 * opens a list filtered to a different population, is worse than no link —
 * the operator reads a number, follows it, and sees something else. Where the
 * destination needs help to show the right slice, the href carries the tab /
 * anchor and the destination is responsible for honouring it:
 *   - `/admin/moderation?tab=users&status=pending` → `AdminModerationPage`
 *   - `/admin/finance?tab=refunds&status=…`        → `AdminFinancePage`
 *   - `/admin/war-room#card-venue-tbd`             → `AdminWarRoomPage`
 * Widening this set means teaching the destination the new parameter, not just
 * appending it here.
 */
async function buildActionQueue(): Promise<ActionQueueRow[]> {
  const [
    pendingReports,
    pendingRefunds,
    pendingReviews,
    underfilledPools,
    pendingAttendance,
    stuckOnboarding,
    unassignedVenues,
  ] = await Promise.all([
    countPendingReports(),
    countPendingRefunds(),
    countPendingOperatorReviews(),
    getUnderfilledPoolsClosingSoon(24),
    countPendingAttendanceToday(),
    countStuckOnboarding(),
    countUnassignedUpcomingVenues(),
  ]);

  const lowFillCount = underfilledPools.length;
  const soonestDeadline = underfilledPools[0]?.registrationDeadline;

  return [
    {
      key: "pending_reports",
      label: "举报待审核",
      count: pendingReports,
      // `countPendingReports()` counts `reports WHERE status = 'pending'`. That
      // table is the 用户举报 list (`/api/admin/moderation/reports` →
      // moderationRepo.getAllReports), which also carries the AI-content rows;
      // 聊天举报 lives in `chat_reports` and is NOT part of this number, so the
      // deep link must not pre-select the chat tab. `/admin/safety-center` used
      // to be the target and is a sidebar badge key only — no route existed.
      //
      // `status=pending` is what makes the destination show THIS population: the
      // tab's filter defaults to 全部, so `?tab=users` alone opened every report
      // and the operator had to re-apply the filter to find the number they
      // clicked. The parameter is only meaningful on `tab=users`, and the page
      // drops it when the operator leaves that tab.
      correctNumber: `${pendingReports} 条举报（reports 表，不含聊天举报）等待处理`,
      recommendedAction: "逐条判定，超过 24h 未处理的优先",
      slaHours: 24,
      owner: "operator",
      severity: pendingReports > 0 ? "critical" : "info",
      href: "/admin/moderation?tab=users&status=pending",
      cleared: pendingReports === 0,
    },
    {
      key: "pending_refunds",
      label: "退款待处理",
      count: pendingRefunds,
      correctNumber: `${pendingRefunds} 笔支付处于 refund_pending`,
      recommendedAction: "核对退款结果并结清，避免用户二次催问",
      slaHours: 48,
      owner: "super_admin",
      severity: pendingRefunds > 0 ? "critical" : "info",
      // Lands on the 退款历史 tab (the payments list cannot filter by status) with
      // the 待处理 filter applied. `refund_pending` is a `payments.status`; the
      // finance page maps it onto the equivalent `refund_attempts.status='pending'`.
      href: "/admin/finance?tab=refunds&status=refund_pending",
      cleared: pendingRefunds === 0,
    },
    {
      key: "pending_reviews",
      label: "排桌待审批",
      count: pendingReviews,
      correctNumber: `${pendingReviews} 个场次等待审批`,
      recommendedAction: "批量通过已核对的分组，单次不超过 20 个",
      slaHours: 12,
      owner: "operator",
      severity: pendingReviews > 0 ? "warning" : "info",
      href: "/admin/matching-reviews",
      cleared: pendingReviews === 0,
    },
    {
      key: "underfilled_pools",
      label: "即将截止 · 报名不足",
      count: lowFillCount,
      correctNumber: `${lowFillCount} 个场次 24h 内截止且未达 min_group_size × target_groups`,
      recommendedAction: "补推或在截止前合并场次",
      slaHours: soonestDeadline ? Math.max(0, hoursUntil(soonestDeadline)) : null,
      owner: "ops",
      severity: lowFillCount > 0 ? "warning" : "info",
      href: "/admin/event-pools?lowFill=1",
      cleared: lowFillCount === 0,
      items: underfilledPools.slice(0, 5).map((pool) => ({
        id: pool.id,
        label: pool.title,
        detail: `${pool.city} · ${pool.registrationCount}/${pool.requiredCount} 人 · ${new Date(
          pool.registrationDeadline,
        ).toLocaleString("zh-CN", { hour12: false })} 截止`,
        href: `/admin/event-pools?focus=${encodeURIComponent(pool.id)}`,
      })),
    },
    {
      key: "pending_attendance",
      label: "今日签到未确认",
      count: pendingAttendance,
      correctNumber: `${pendingAttendance} 人签到状态仍为 pending`,
      recommendedAction: "联系未确认的参与者或标记缺席",
      slaHours: 6,
      owner: "ops",
      severity: pendingAttendance > 0 ? "warning" : "info",
      href: "/admin/war-room",
      cleared: pendingAttendance === 0,
    },
    {
      key: "stuck_onboarding",
      // Item 2(d), 2026-10-23: the number and the only list we can link to are
      // DIFFERENT POPULATIONS, and this row used to imply otherwise.
      //   count  = `countStuckOnboarding()` → users whose
      //            `onboarding_checkpoint` has not advanced in 7 days
      //            (adminMetrics.ts, carried over from the ops dashboard).
      //   list   = `/admin/users?maxCompleteness=50` → a 资料完整度 ≤50% sample
      //            of ALL users, from an unrelated predicate.
      // There is no stuck-onboarding list endpoint. Until one exists, the label
      // and copy name the sample, and the recommendation says the two numbers
      // must not be reconciled against each other.
      label: "注册卡点 · 资料完整度抽样",
      count: stuckOnboarding,
      correctNumber: `${stuckOnboarding} 个账号 7 天未推进注册步骤；链接打开的是资料完整度 ≤50% 抽样列表（不同集合）`,
      recommendedAction: "在取样列表中定位卡点步骤，必要时人工触达；两个数字不可互相校验",
      slaHours: null,
      owner: "operator",
      severity: stuckOnboarding > 0 ? "warning" : "info",
      href: "/admin/users?maxCompleteness=50",
      cleared: stuckOnboarding === 0,
    },
    {
      key: "unassigned_venues",
      label: "场地待定",
      count: unassignedVenues,
      correctNumber: `${unassignedVenues} 个未开始场次尚未分配场地`,
      recommendedAction: "手动指定场地，否则参与者看到「地点待定」",
      slaHours: 24,
      owner: "ops",
      severity: unassignedVenues > 0 ? "critical" : "info",
      // 场地管理 has no unassigned view; the records live on the war-room card,
      // which now lists the groups and anchors itself for this deep link.
      href: "/admin/war-room#card-venue-tbd",
      cleared: unassignedVenues === 0,
    },
  ];
}

export function registerAdminConsoleRoutes(app: Express): void {
  /**
   * GET /api/admin/kpi?from&to&days
   *
   * The six console KPIs. Revenue is redacted for non-super_admin into a
   * placeholder card rather than a 403 — an operator still needs the layout.
   * Revenue is two cards by design: 单场票实收/场 (cash for sessions held) and
   * 预付递延 (cash received, delivery owed). See `getRevenueSplit`.
   */
  app.get("/api/admin/kpi", requireAdmin, async (req, res) => {
    try {
      const parsed = rangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ code: "INVALID_RANGE", message: "时间范围参数无效" });
      }

      const range = resolveAdminRange(parsed.data);
      const previousRange = previousAdminRange(range);

      const [kpis, systemLatency, approvalLatency, series] = await Promise.all([
        buildAdminKpis(range),
        getMatchLatencyHours(range),
        getApprovalLatencyHours(range),
        getKpiSeries(range),
      ]);

      // Attach the weekly shape here rather than inside buildAdminKpis so the
      // KPI definitions stay one concern and the series stay another.
      const kpisWithSeries = kpis.map((kpi) =>
        series[kpi.key] ? { ...kpi, series: series[kpi.key] } : kpi,
      );

      const isSuperAdmin = req.adminRole === "super_admin";

      // Redaction is driven by the metric definitions (`REVENUE_KPI_KEYS`), not
      // by a key literal here: adding a cash metric must not silently ship an
      // unredacted money figure to operators.
      const visibleKpis = kpisWithSeries.map((kpi) => {
        if (REVENUE_KPI_KEYS.has(kpi.key) && !isSuperAdmin) {
          return {
            ...kpi,
            value: null,
            previous: null,
            deltaPct: null,
            insufficientBaseline: false,
            restricted: true,
          };
        }
        return kpi;
      });

      res.json({
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          previousFrom: previousRange.from.toISOString(),
          description: describeAdminRange(range),
        },
        kpis: visibleKpis,
        latency: {
          // Primary metric is the system segment — always measurable.
          system: systemLatency,
          // Secondary only exists while the operator-review gate is on.
          approval: approvalLatency.sampleSize > 0 ? approvalLatency : null,
        },
        asOf: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[adminConsole] kpi query failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ code: "KPI_QUERY_FAILED", message: "指标加载失败" });
    }
  });

  /**
   * GET /api/admin/action-queue
   *
   * The decision surface. Sorted by severity, then by how overdue the row is.
   */
  app.get("/api/admin/action-queue", requireAdmin, async (_req, res) => {
    try {
      const rows = await buildActionQueue();
      const severityRank: Record<ActionQueueRow["severity"], number> = {
        critical: 0,
        warning: 1,
        info: 2,
      };

      const sorted = [...rows].sort((a, b) => {
        const bySeverity = severityRank[a.severity] - severityRank[b.severity];
        if (bySeverity !== 0) return bySeverity;
        return b.count - a.count;
      });

      res.json({
        rows: sorted,
        totals: {
          open: rows.filter((row) => !row.cleared).length,
          critical: rows.filter((row) => !row.cleared && row.severity === "critical").length,
        },
        asOf: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[adminConsole] action queue query failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ code: "QUEUE_QUERY_FAILED", message: "待办加载失败" });
    }
  });

  /**
   * GET /api/admin/nav-badges
   *
   * Counts for the sidebar. Contract: a badge equals the number of items in the
   * list it links to. Because both come from the same functions here, the two
   * cannot drift.
   */
  app.get("/api/admin/nav-badges", requireAdmin, async (_req, res) => {
    try {
      const [reports, refunds, reviews, lowFill, attendance, venues] = await Promise.all([
        countPendingReports(),
        countPendingRefunds(),
        countPendingOperatorReviews(),
        getUnderfilledPoolsClosingSoon(24),
        countPendingAttendanceToday(),
        countUnassignedUpcomingVenues(),
      ]);

      res.json({
        badges: {
          "/admin/safety-center": reports,
          "/admin/finance": refunds,
          "/admin/matching-reviews": reviews,
          "/admin/event-pools": lowFill.length,
          "/admin/war-room": attendance,
          "/admin/venues": venues,
        },
        asOf: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[adminConsole] nav badge query failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ code: "BADGES_QUERY_FAILED", message: "角标加载失败" });
    }
  });

  /**
   * GET /api/admin/analytics/funnel?days
   *
   * The product funnel that has been recorded since launch and never readable.
   * `dataAvailable: false` means "no events in this window" — the client must
   * render an empty state, not a 0% conversion rate.
   */
  app.get("/api/admin/analytics/funnel", requireAdmin, async (req, res) => {
    try {
      const parsed = rangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ code: "INVALID_RANGE", message: "时间范围参数无效" });
      }

      const range = resolveAdminRange(parsed.data);
      const [funnel, coverage, surfaces] = await Promise.all([
        getTicketPaymentFunnel(range),
        getAnalyticsCoverage(range),
        getAnalyticsSurfaces(range),
      ]);

      res.json({
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          description: describeAdminRange(range),
        },
        funnel,
        coverage,
        surfaces,
        asOf: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[adminConsole] analytics funnel query failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ code: "FUNNEL_QUERY_FAILED", message: "漏斗加载失败" });
    }
  });

  /**
   * GET /api/admin/analytics/events?days&limit
   *
   * Raw event-type counts, so an operator can answer "is this event even being
   * fired?" without a database console.
   */
  app.get("/api/admin/analytics/events", requireAdmin, async (req, res) => {
    try {
      const parsed = rangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ code: "INVALID_RANGE", message: "时间范围参数无效" });
      }
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

      const range = resolveAdminRange(parsed.data);
      const [events, coverage] = await Promise.all([
        listAnalyticsEvents(range, limit),
        getAnalyticsCoverage(range),
      ]);

      res.json({
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          description: describeAdminRange(range),
        },
        events,
        coverage,
        asOf: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[adminConsole] analytics events query failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ code: "EVENTS_QUERY_FAILED", message: "事件列表加载失败" });
    }
  });
}
