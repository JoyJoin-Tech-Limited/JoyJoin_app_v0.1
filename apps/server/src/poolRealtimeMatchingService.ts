/**
 * Pool Real-time Matching Service (池内实时匹配调度服务)
 * 
 * 核心功能：
 * 1. 实时扫描：每次有用户报名时触发扫描
 * 2. 动态阈值：根据配置和时间衰减调整匹配标准
 * 3. 智能决策：高兼容立即匹配，中等兼容等待，低兼容继续等
 * 4. 完整日志：记录每次扫描的决策过程
 */

import { db } from "./db";
import { 
  eventPools,
  eventPoolRegistrations,
  matchingThresholds,
  poolMatchingLogs,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { matchEventPool, saveMatchResults } from "./poolMatchingService";
import type { MatchGroup, SaveMatchResultsOptions } from "./poolMatchingService";
import { logger } from "./lib/logger";
import {
  getMatchingThresholdConfig,
  type MatchingThresholdsConfig,
} from "./lib/matchingThresholds";
import { resolvePairFloorForPool } from "./lib/pairFloorRollout";
import { calculateDecayedThreshold } from "./matching/matchingCurve";
import { notifyLowRegistration } from "./lib/wecomNotifications";
import {
  countMatchingShadowExperimentPools,
  getOutcomeCalibrationSnapshot,
  getPredictiveRerankOutcomeMetrics,
  type PredictiveRerankOutcomeMetrics,
} from "./repositories/matchingShadowExperimentsRepo";
import {
  getPredictiveRerankAutoDisableReason,
  planPredictiveRerank,
} from "./predictiveRerankingService";
import { fillBotsForTesting } from "./services/botFillService";

interface ScanResult {
  decision: "matched" | "waiting" | "insufficient";
  reason: string;
  groupsFormed: number;
  usersMatched: number;
  avgGroupScore: number;
  currentThreshold: number;
}

async function persistPredictiveRerankAutoDisable(reason: string) {
  await db
    .update(matchingThresholds)
    .set({
      predictiveRerankEnabled: false,
      predictiveRerankAutoDisabledAt: new Date(),
      predictiveRerankAutoDisabledReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(matchingThresholds.isActive, true));
}

/** 报名池达到容量的这个比例，视为报名画像足够完整，可以提前排桌。 */
export const EARLY_MATCH_FILL_RATIO = 0.8;

/** 距报名截止多少小时内进入排桌窗口，不再要求池满。 */
export const EARLY_MATCH_WINDOW_HOURS = 48;

/** 时间衰减阈值实现已移至 ./matching/matchingCurve（D3 单一尺子）。 */

export interface EarlyMatchGateInput {
  triggeredBy: string;
  isTestPool: boolean;
  pendingUsersCount: number;
  targetGroups: number | null;
  maxGroupSize: number | null;
  registrationDeadline: Date | null;
  now: Date;
}

export interface EarlyMatchGateDecision {
  allowed: boolean;
  reason: string;
  hoursUntilRegistrationDeadline: number | null;
  capacity: number;
  requiredRegistrations: number;
  fillRatio: number;
}

/**
 * 排桌时机闸门：自动触发的扫描只有在“报名画像足够完整”或“进入截止窗口”时才排桌。
 *
 * 这是防止 day 2 用 6 个人把桌排掉、把 day 3 更合拍的 10 个人挡在 POOL_CLOSED 外的
 * 核心保护。管理员手动排桌与测试池不受限制。
 */
export function evaluateEarlyMatchGate(
  input: EarlyMatchGateInput
): EarlyMatchGateDecision {
  const capacity = Math.max(
    1,
    (input.targetGroups ?? 1) * (input.maxGroupSize ?? 6)
  );
  const requiredRegistrations = Math.max(
    1,
    Math.ceil(capacity * EARLY_MATCH_FILL_RATIO)
  );
  const fillRatio = input.pendingUsersCount / capacity;
  const hoursUntilRegistrationDeadline = input.registrationDeadline
    ? (new Date(input.registrationDeadline).getTime() - input.now.getTime()) /
      (1000 * 60 * 60)
    : null;

  const base = {
    hoursUntilRegistrationDeadline,
    capacity,
    requiredRegistrations,
    fillRatio,
  };

  if (input.triggeredBy === "admin_manual") {
    return { ...base, allowed: true, reason: "管理员手动排桌，跳过时机闸门" };
  }

  if (input.isTestPool) {
    return { ...base, allowed: true, reason: "测试池，跳过时机闸门" };
  }

  if (hoursUntilRegistrationDeadline === null) {
    return { ...base, allowed: true, reason: "未设置报名截止时间，跳过时机闸门" };
  }

  if (hoursUntilRegistrationDeadline <= EARLY_MATCH_WINDOW_HOURS) {
    return {
      ...base,
      allowed: true,
      reason: `距报名截止 ${Math.max(0, Math.round(hoursUntilRegistrationDeadline))} 小时，已进入排桌窗口`,
    };
  }

  if (input.pendingUsersCount >= requiredRegistrations) {
    return {
      ...base,
      allowed: true,
      reason: `已报名 ${input.pendingUsersCount}/${capacity} 人，报名画像足够完整`,
    };
  }

  return {
    ...base,
    allowed: false,
    reason: `已报名 ${input.pendingUsersCount}/${capacity} 人（未达 ${requiredRegistrations} 人），距报名截止还有 ${Math.round(
      hoursUntilRegistrationDeadline
    )} 小时，等待更多报名后再排桌`,
  };
}

/**
 * 评估一组匹配结果是否达到阈值标准
 */
function evaluateMatchQuality(
  groups: MatchGroup[],
  currentThreshold: number,
  config: MatchingThresholdsConfig
): { shouldMatch: boolean; reason: string } {
  if (groups.length === 0) {
    return { shouldMatch: false, reason: "无法形成任何小组" };
  }

  // 计算所有组的平均分数
  const avgScore = Math.round(
    groups.reduce((sum, g) => sum + g.overallScore, 0) / groups.length
  );

  // 高兼容性：立即匹配
  if (avgScore >= config.highCompatibilityThreshold) {
    return {
      shouldMatch: true,
      reason: `高兼容性匹配（平均分${avgScore}≥${config.highCompatibilityThreshold}），立即成局`,
    };
  }

  // 中等兼容性：根据衰减阈值决定
  if (avgScore >= currentThreshold) {
    return {
      shouldMatch: true,
      reason: `达到当前阈值（平均分${avgScore}≥${currentThreshold}），可以成局`,
    };
  }

  // 低兼容性：继续等待
  return {
    shouldMatch: false,
    reason: `兼容性未达标（平均分${avgScore}<${currentThreshold}），等待更多用户或时间衰减`,
  };
}

/**
 * W8 (AC-W8.3): per-pool in-flight guard.
 *
 * Every registration previously fired an independent `scanPoolAndMatch`
 * fire-and-forget, so a burst of N concurrent registrations ran N full O(n²)
 * matching scans on the same pool. This map ensures only ONE scan runs per pool
 * at a time; concurrent callers join the in-flight promise and receive its
 * result instead of duplicating the work. Crash-safety: the entry is released in
 * `finally`, so a thrown scan never wedges the guard; if the process dies
 * mid-scan the pool is left `matching` and the W8 stuck-matching watchdog
 * recovers it.
 *
 * Process-local by design (matches the existing scheduled-scan model); the
 * `saveMatchResults` active→matching CAS remains the cross-instance guard.
 */
const inFlightScans = new Map<string, Promise<ScanResult>>();

/**
 * 扫描单个活动池并决策是否匹配 (wrapped by the per-pool in-flight guard above)
 *
 * @param poolId 活动池ID
 * @param scanType 扫描类型：realtime | scheduled | manual
 * @param triggeredBy 触发者：user_registration | cron_job | admin_manual
 */

export async function scanPoolAndMatch(
  poolId: string,
  scanType: "realtime" | "scheduled" | "manual",
  triggeredBy: string
): Promise<ScanResult> {
  const existing = inFlightScans.get(poolId);
  if (existing) {
    logger.info("[Realtime Matching] joining in-flight scan", { poolId, scanType, triggeredBy });
    return existing;
  }

  const run = runScanPoolAndMatch(poolId, scanType, triggeredBy).finally(() => {
    if (inFlightScans.get(poolId) === run) {
      inFlightScans.delete(poolId);
    }
  });
  inFlightScans.set(poolId, run);
  return run;
}

async function runScanPoolAndMatch(
  poolId: string,
  scanType: "realtime" | "scheduled" | "manual",
  triggeredBy: string
): Promise<ScanResult> {
  // 1. 获取活动池信息
  const pool = await db.query.eventPools.findFirst({
    where: eq(eventPools.id, poolId),
  });

  if (!pool || pool.status !== "active") {
    return {
      decision: "insufficient",
      reason: "活动池不存在或状态不是active",
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore: 0,
      currentThreshold: 0,
    };
  }

  // 2. 统计待匹配用户数
  let pendingRegistrations = await db
    .select()
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending")
      )
    );

  let pendingUsersCount = pendingRegistrations.length;

  // 3. 获取当前匹配配置
  let config = await getMatchingThresholdConfig();

  // 4. 计算距离活动开始的小时数
  //    `pool_matching_logs.time_until_event` is an integer column, and the scan
  //    persists this value on every decision. An unrounded float made the log
  //    insert fail with `22P02 invalid input syntax for type integer`, which
  //    aborted the whole scan (matching never completed, nothing was logged).
  const now = new Date();
  const eventTime = new Date(pool.dateTime);
  const hoursUntilEvent = Math.max(
    0,
    Math.round((eventTime.getTime() - now.getTime()) / (1000 * 60 * 60))
  );

  // 5. 计算当前阈值（考虑时间衰减）
  const currentThreshold = calculateDecayedThreshold(
    config.mediumCompatibilityThreshold,
    hoursUntilEvent,
    config
  );

  // D3: resolve the per-person floor once per scan; the formation core never
  // receives a clock or config it could use to recompute it.
  const pairFloorResolution = await resolvePairFloorForPool(pool, {
    config,
    hoursUntilEvent,
  });

  // 6. 检查是否有足够的人数
  const minGroupSize = config.minGroupSizeForMatch || pool.minGroupSize || 4;
  if (pendingUsersCount < minGroupSize) {
    try {
      const botFillResult = await fillBotsForTesting({ pool, pendingRegistrations, minGroupSize });
      if (botFillResult.filledCount > 0) {
        pendingRegistrations = await db
          .select()
          .from(eventPoolRegistrations)
          .where(
            and(
              eq(eventPoolRegistrations.poolId, poolId),
              eq(eventPoolRegistrations.matchStatus, "pending")
            )
          );
        pendingUsersCount = pendingRegistrations.length;
      }
    } catch (error) {
      logger.error("[BotFill] failed; continuing with insufficient-user result", {
        data: { poolId, pendingUsersCount, minGroupSize },
        error: String(error),
      });
    }

    if (pendingUsersCount >= minGroupSize) {
      logger.info("[BotFill] pool reached minimum group size; continuing normal matching flow", {
        data: { poolId, pendingUsersCount, minGroupSize },
      });
    } else {
      // 记录日志
      await db.insert(poolMatchingLogs).values({
        poolId,
        scanType,
        pendingUsersCount,
        currentThreshold,
        pairFloor: pairFloorResolution.pairFloor,
        timeUntilEvent: hoursUntilEvent,
        groupsFormed: 0,
        usersMatched: 0,
        avgGroupScore: 0,
        decision: "insufficient",
        reason: `人数不足（${pendingUsersCount}/${minGroupSize}）`,
        triggeredBy,
      });

      return {
        decision: "insufficient",
        reason: `人数不足（${pendingUsersCount}/${minGroupSize}）`,
        groupsFormed: 0,
        usersMatched: 0,
        avgGroupScore: 0,
        currentThreshold,
      };
    }
  }

  // Low registration alert for scheduled scans with approaching deadline
  if (triggeredBy === "cron_job") {
    const targetRegistrations = (pool.targetGroups || 1) * minGroupSize;
    const percentFilled = (pendingUsersCount / targetRegistrations) * 100;
    const daysUntilDeadline = pool.registrationDeadline
      ? Math.max(0, Math.round((new Date(pool.registrationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 7;

    if (percentFilled < 50 && daysUntilDeadline <= 3) {
      void notifyLowRegistration({
        poolTitle: pool.title,
        poolDate: pool.dateTime ? new Date(pool.dateTime).toLocaleString("zh-CN") : "待定",
        poolCity: pool.city,
        poolDistrict: pool.district || undefined,
        poolId: pool.id,
        currentRegistrations: pendingUsersCount,
        targetRegistrations,
        percentFilled,
        daysUntilDeadline,
      }).catch((err) => {
        logger.warn("[PoolRealtimeMatching] Low registration notification failed", { error: String(err) });
      });
    }
  }

  // 6.5 排桌时机闸门（2026-11-10）：自动触发的扫描不再“人数够就排”。
  // 报名池未满且距截止还远时提前排桌，会把后面更合拍的报名者挡在 POOL_CLOSED 之外，
  // 池子的最终画像也就停在触发那一刻。手动排桌与测试池不受限制。
  const earlyMatchGate = evaluateEarlyMatchGate({
    triggeredBy,
    isTestPool: pool.isTestPool === true,
    pendingUsersCount,
    targetGroups: pool.targetGroups,
    maxGroupSize: pool.maxGroupSize,
    registrationDeadline: pool.registrationDeadline
      ? new Date(pool.registrationDeadline)
      : null,
    now,
  });

  if (!earlyMatchGate.allowed) {
    await db.insert(poolMatchingLogs).values({
      poolId,
      scanType,
      pendingUsersCount,
      currentThreshold,
      pairFloor: pairFloorResolution.pairFloor,
      timeUntilEvent: hoursUntilEvent,
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore: 0,
      decision: "waiting",
      reason: earlyMatchGate.reason,
      triggeredBy,
    });

    console.log(`[Realtime Matching] ⏳ 池 ${pool.title} 暂不排桌: ${earlyMatchGate.reason}`);

    return {
      decision: "waiting",
      reason: earlyMatchGate.reason,
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore: 0,
      currentThreshold,
    };
  }

  // 7. 运行匹配算法（不保存，仅评估）
  let groups: MatchGroup[] = [];
  let predictiveDecisionSummary: SaveMatchResultsOptions["predictiveRerankSummary"] | undefined;
  let predictiveDecisionArm: SaveMatchResultsOptions["predictiveExperimentArm"] | undefined;
  let predictiveRerankApplied = false;
  try {
    groups = await matchEventPool(poolId, pairFloorResolution.pairFloor);
    const overrideForceEnabled = pool.predictiveRerankEnabledOverride === true;
    const predictiveRerankEligibleForEvaluation =
      pool.predictiveRerankEnabledOverride !== false &&
      (overrideForceEnabled || config.predictiveRerankEnabled);

    if (predictiveRerankEligibleForEvaluation) {
      const calibration = await getOutcomeCalibrationSnapshot();
      let shadowPoolCount = 0;
      let outcomeMetrics: PredictiveRerankOutcomeMetrics = [];

      if (!overrideForceEnabled) {
        [shadowPoolCount, outcomeMetrics] = await Promise.all([
          countMatchingShadowExperimentPools(),
          getPredictiveRerankOutcomeMetrics(),
        ]);

        const runtimeAutoDisableReason = getPredictiveRerankAutoDisableReason(outcomeMetrics);
        if (
          config.predictiveRerankEnabled &&
          !config.predictiveRerankAutoDisabledAt &&
          config.predictiveRerankAutoDisableEnabled &&
          runtimeAutoDisableReason
        ) {
          await persistPredictiveRerankAutoDisable(runtimeAutoDisableReason);
          config = await getMatchingThresholdConfig();
        }
      }

      const predictiveDecision = planPredictiveRerank({
        poolId,
        groups,
        calibration,
        config,
        shadowPoolCount,
        outcomeMetrics,
        poolOverrideEnabled: pool.predictiveRerankEnabledOverride,
      });

      groups = predictiveDecision.groups;
      predictiveDecisionArm = predictiveDecision.arm;
      predictiveRerankApplied = predictiveDecision.applied;
      predictiveDecisionSummary = {
        reason: predictiveDecision.reason,
        modelVersion: predictiveDecision.modelVersion,
        ...predictiveDecision.summary,
        audits: predictiveDecision.audits,
      };
    }
  } catch (error: any) {
    logger.error("[Realtime Matching] match algorithm failed during scan", {
      poolId,
      scanType,
      triggeredBy,
      pendingUsersCount,
      error: error instanceof Error ? error.message : String(error),
    });

    await db.insert(poolMatchingLogs).values({
      poolId,
      scanType,
      pendingUsersCount,
      currentThreshold,
      pairFloor: pairFloorResolution.pairFloor,
      timeUntilEvent: hoursUntilEvent,
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore: 0,
      decision: "insufficient",
      reason: `匹配算法失败: ${error.message}`,
      predictiveExperimentArm: predictiveDecisionArm,
      predictiveRerankApplied,
      predictiveRerankSummary: predictiveDecisionSummary,
      triggeredBy,
    });

    return {
      decision: "insufficient",
      reason: `匹配算法失败: ${error.message}`,
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore: 0,
      currentThreshold,
    };
  }

  // 8. 评估匹配质量
  const evaluation = evaluateMatchQuality(groups, currentThreshold, config);

  const avgGroupScore = groups.length > 0
    ? Math.round(groups.reduce((sum, g) => sum + g.overallScore, 0) / groups.length)
    : 0;

  // 9. 决策：是否立即匹配
  if (evaluation.shouldMatch) {
    const usersMatched = groups.reduce((sum, g) => sum + g.members.length, 0);

    // 立即匹配！保存结果 + 决策日志在同一显式事务边界内提交。
    // `saveMatchResults` owns the atomic write of the match rows (its own
    // internal transaction); this boundary groups the scan's decision-log write
    // with that persistence so the two related writes are not issued as
    // independent, unattested statements.
    await db.transaction(async (tx: any) => {
      if (predictiveDecisionSummary) {
        await saveMatchResults(poolId, groups, {
          predictiveExperimentArm: predictiveDecisionArm ?? null,
          predictiveRerankApplied,
          predictiveRerankSummary: predictiveDecisionSummary,
        });
      } else {
        await saveMatchResults(poolId, groups);
      }

      // 记录日志
      await tx.insert(poolMatchingLogs).values({
        poolId,
        scanType,
        pendingUsersCount,
        currentThreshold,
        pairFloor: pairFloorResolution.pairFloor,
        timeUntilEvent: hoursUntilEvent,
        groupsFormed: groups.length,
        usersMatched,
        avgGroupScore,
        decision: "matched",
        reason: evaluation.reason,
        predictiveExperimentArm: predictiveDecisionArm,
        predictiveRerankApplied,
        predictiveRerankSummary: predictiveDecisionSummary,
        triggeredBy,
      });
    });

    console.log(`[Realtime Matching] ✓ 池 ${pool.title} 完成匹配: ${groups.length}组, ${usersMatched}人`);

    return {
      decision: "matched",
      reason: evaluation.reason,
      groupsFormed: groups.length,
      usersMatched,
      avgGroupScore,
      currentThreshold,
    };
  } else {
    // 继续等待
    await db.insert(poolMatchingLogs).values({
      poolId,
      scanType,
      pendingUsersCount,
      currentThreshold,
      pairFloor: pairFloorResolution.pairFloor,
      timeUntilEvent: hoursUntilEvent,
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore,
      decision: "waiting",
      reason: evaluation.reason,
      predictiveExperimentArm: predictiveDecisionArm,
      predictiveRerankApplied,
      predictiveRerankSummary: predictiveDecisionSummary,
      triggeredBy,
    });

    console.log(`[Realtime Matching] ⏳ 池 ${pool.title} 继续等待: ${evaluation.reason}`);

    return {
      decision: "waiting",
      reason: evaluation.reason,
      groupsFormed: 0,
      usersMatched: 0,
      avgGroupScore,
      currentThreshold,
    };
  }
}

/**
 * 扫描所有 active 状态的活动池（定时任务调用）
 */
export async function scanAllActivePools(): Promise<void> {
  const activePools = await db
    .select()
    .from(eventPools)
    .where(eq(eventPools.status, "active"));

  console.log(`[Scheduled Scan] 开始扫描 ${activePools.length} 个活动池`);

  for (const pool of activePools) {
    try {
      await scanPoolAndMatch(pool.id, "scheduled", "cron_job");
    } catch (error: any) {
      console.error(`[Scheduled Scan] 池 ${pool.id} 扫描失败:`, error.message);
    }
  }

  console.log(`[Scheduled Scan] 扫描完成`);
}
