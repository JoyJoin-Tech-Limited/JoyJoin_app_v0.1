/**
 * Pool Deadline Match Scheduler (报名截止后兜底排桌)
 *
 * 背景（2026-11-10）：
 * 排桌是事件驱动的 —— 报名、支付、管理员手动都会触发一次扫描；
 * 报名截止本身并不会触发任何排桌。结果是：一个始终没有踩中质量阈值的池子
 * 会一直停在 active，直到活动结束后才被 poolCompletionSweep 收尾，期间
 * 已付费的用户既没有成局，也没有退款。
 *
 * 这个调度器补上截止后的兜底：
 * 1. 找出 status='active' 且报名截止已过（含 5 分钟宽限）的非测试池；
 * 2. 用 cron_job 身份跑一次常规扫描（此时排桌时机闸门已进入截止窗口，必定放行）；
 * 3. 能成局 → 正常保存；不能成局 → 走既有「场次未成行」退款通道
 *    （REFUND_CONTEXTS.seat_not_allocated），然后把池子置为 cancelled，
 *    让下一次 tick 天然幂等。
 *
 * 失败开放：单个池子出错只记录日志，下一轮继续重试；不会阻断其他池子。
 */

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "../db";
import { eventPools } from "@shared/schema";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";
import { scanPoolAndMatch } from "../poolRealtimeMatchingService";
import { refundUnmatchedRegistrations } from "../services/autoRefundService";

/** 15 分钟一轮：截止后的兜底排桌不需要更密。 */
export const POOL_DEADLINE_MATCH_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/** 截止后再等 5 分钟，避开正在提交的报名/支付。 */
export const POOL_DEADLINE_MATCH_GRACE_MS = 5 * 60 * 1000;

export interface PoolDeadlineMatchSweepResult {
  scannedPools: number;
  matchedPools: number;
  closedPools: number;
  failedPools: number;
}

/**
 * 扫描所有已过报名截止、仍在招募中的池子，排桌或退款关池。
 */
export async function sweepDeadlinePools(
  now: Date
): Promise<PoolDeadlineMatchSweepResult> {
  const cutoff = new Date(now.getTime() - POOL_DEADLINE_MATCH_GRACE_MS);

  const duePools = await db
    .select()
    .from(eventPools)
    .where(
      and(
        eq(eventPools.status, "active"),
        eq(eventPools.isTestPool, false),
        isNotNull(eventPools.registrationDeadline),
        lte(eventPools.registrationDeadline, cutoff)
      )
    );

  let matchedPools = 0;
  let closedPools = 0;
  let failedPools = 0;

  for (const pool of duePools) {
    try {
      const result = await scanPoolAndMatch(pool.id, "scheduled", "cron_job");

      if (result.decision === "matched") {
        matchedPools += 1;
        continue;
      }

      // 无法成局：按「本轮排桌未能为你安排到合适的座位」退款，再关闭活动池。
      // 退款服务自身幂等；状态 CAS 保证同一池子不会被重复结算。
      const refundSummary = await refundUnmatchedRegistrations(
        pool.id,
        pool.title
      );

      await db
        .update(eventPools)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(eq(eventPools.id, pool.id), eq(eventPools.status, "active"))
        );

      closedPools += 1;
      logger.info("[PoolDeadlineMatch] closed unmatched pool after deadline", {
        poolId: pool.id,
        poolTitle: pool.title,
        reason: result.reason,
        refundedPayments: refundSummary.refundedPayments,
        refundedCredits: refundSummary.refundedCredits,
        failedRefunds: refundSummary.failedRefunds,
      });
    } catch (error) {
      failedPools += 1;
      logger.warn("[PoolDeadlineMatch] pool sweep failed; will retry next tick", {
        poolId: pool.id,
        error: String(error),
      });
    }
  }

  return {
    scannedPools: duePools.length,
    matchedPools,
    closedPools,
    failedPools,
  };
}

export interface PoolDeadlineMatchSchedulerDependencies {
  logger: typeof logger;
  isEnabled: () => Promise<boolean>;
  sweep: (now: Date) => Promise<PoolDeadlineMatchSweepResult>;
  now: () => Date;
  intervalMs: number;
}

export function createPoolDeadlineMatchScheduler(
  dependencies: PoolDeadlineMatchSchedulerDependencies = {
    logger,
    isEnabled: () => getFeatureFlag("poolDeadlineMatchSweepEnabled", true),
    sweep: (now) => sweepDeadlinePools(now),
    now: () => new Date(),
    intervalMs: POOL_DEADLINE_MATCH_SWEEP_INTERVAL_MS,
  }
) {
  let interval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const run = async () => {
    if (stopped) return;

    try {
      if (!(await dependencies.isEnabled())) return;

      const result = await dependencies.sweep(dependencies.now());
      if (
        result.scannedPools > 0 ||
        result.matchedPools > 0 ||
        result.closedPools > 0
      ) {
        dependencies.logger.info("[PoolDeadlineMatch] tick finished", {
          ...result,
        });
      }
    } catch (error) {
      dependencies.logger.warn(
        "[PoolDeadlineMatch] tick failed; will retry next interval",
        { error: String(error) }
      );
    }
  };

  return {
    start() {
      if (interval) return;
      void run();
      interval = setInterval(() => void run(), dependencies.intervalMs);
      if (typeof interval.unref === "function") interval.unref();
      dependencies.logger.info("[PoolDeadlineMatch] scheduler started", {
        intervalMs: dependencies.intervalMs,
      });
    },
    stop() {
      stopped = true;
      clear();
    },
    /** Test hook: run one tick immediately. */
    runOnce: run,
  };
}

let singleton: ReturnType<typeof createPoolDeadlineMatchScheduler> | null =
  null;

export function startPoolDeadlineMatchScheduler(): void {
  if (singleton) return;
  singleton = createPoolDeadlineMatchScheduler();
  singleton.start();
}
