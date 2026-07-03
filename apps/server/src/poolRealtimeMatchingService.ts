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

/**
 * 获取当前激活的匹配阈值配置
 */
async function getActiveThresholds() {
  const [config] = await db
    .select()
    .from(matchingThresholds)
    .where(eq(matchingThresholds.isActive, true))
    .limit(1);

  // 如果没有配置，返回默认值
  if (!config) {
    return {
      highCompatibilityThreshold: 82,
      mediumCompatibilityThreshold: 67,
      lowCompatibilityThreshold: 52,
      timeDecayEnabled: true,
      timeDecayRate: 5,
      minThresholdAfterDecay: 50,
      minGroupSizeForMatch: 4,
      optimalGroupSize: 6,
      predictiveRerankEnabled: false,
      predictiveRerankExposurePercent: 50,
      predictiveRerankMaxPositionShift: 2,
      predictiveRerankConfidenceThreshold: 70,
      predictiveRerankAutoDisableEnabled: true,
      predictiveRerankMinShadowExperiments: 10,
      predictiveRerankAutoDisabledAt: null,
      predictiveRerankAutoDisabledReason: null,
    };
  }

  return config;
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

/**
 * 计算时间衰减后的实际阈值
 * 
 * 逻辑：
 * - 距离活动开始越近，阈值越低（更容易匹配）
 * - 每24小时降低 timeDecayRate 分
 * - 最低不低于 minThresholdAfterDecay
 */
function calculateDecayedThreshold(
  baseThreshold: number,
  hoursUntilEvent: number,
  config: Awaited<ReturnType<typeof getActiveThresholds>>
): number {
  if (!config.timeDecayEnabled) {
    return baseThreshold;
  }

  const daysUntilEvent = hoursUntilEvent / 24;
  const decay = Math.floor(daysUntilEvent + 1 / 86400) * (config.timeDecayRate || 5);
  const decayedThreshold = Math.max(
    baseThreshold - decay,
    config.minThresholdAfterDecay || 50
  );

  return decayedThreshold;
}

/**
 * 评估一组匹配结果是否达到阈值标准
 */
function evaluateMatchQuality(
  groups: MatchGroup[],
  currentThreshold: number,
  config: Awaited<ReturnType<typeof getActiveThresholds>>
): { shouldMatch: boolean; reason: string } {
  if (groups.length === 0) {
    return { shouldMatch: false, reason: "无法形成任何小组" };
  }

  // 计算所有组的平均分数
  const avgScore = Math.round(
    groups.reduce((sum, g) => sum + g.overallScore, 0) / groups.length
  );

  // 高兼容性：立即匹配
  if (avgScore >= (config.highCompatibilityThreshold || 85)) {
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
 * 扫描单个活动池并决策是否匹配
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
  let config = await getActiveThresholds();

  // 4. 计算距离活动开始的小时数
  const now = new Date();
  const eventTime = new Date(pool.dateTime);
  const hoursUntilEvent = Math.max(
    0,
    (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  );

  // 5. 计算当前阈值（考虑时间衰减）
  const currentThreshold = calculateDecayedThreshold(
    config.mediumCompatibilityThreshold || 70,
    hoursUntilEvent,
    config
  );

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

  // 7. 运行匹配算法（不保存，仅评估）
  let groups: MatchGroup[] = [];
  let predictiveDecisionSummary: SaveMatchResultsOptions["predictiveRerankSummary"] | undefined;
  let predictiveDecisionArm: SaveMatchResultsOptions["predictiveExperimentArm"] | undefined;
  let predictiveRerankApplied = false;
  try {
    groups = await matchEventPool(poolId);
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
          config = await getActiveThresholds();
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
    await db.insert(poolMatchingLogs).values({
      poolId,
      scanType,
      pendingUsersCount,
      currentThreshold,
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
    // 立即匹配！保存结果
    if (predictiveDecisionSummary) {
      await saveMatchResults(poolId, groups, {
        predictiveExperimentArm: predictiveDecisionArm ?? null,
        predictiveRerankApplied,
        predictiveRerankSummary: predictiveDecisionSummary,
      });
    } else {
      await saveMatchResults(poolId, groups);
    }

    const usersMatched = groups.reduce((sum, g) => sum + g.members.length, 0);

    // 记录日志
    await db.insert(poolMatchingLogs).values({
      poolId,
      scanType,
      pendingUsersCount,
      currentThreshold,
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
