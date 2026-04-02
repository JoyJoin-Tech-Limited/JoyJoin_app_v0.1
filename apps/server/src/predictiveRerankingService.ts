import type { MatchGroup } from "./poolMatchingService";
import { buildMatchingShadowExperiment } from "./matchingShadowService";
import type { OutcomeCalibrationSnapshot, PredictiveRerankOutcomeMetric } from "./repositories/matchingShadowExperimentsRepo";

export type PredictiveExperimentArm = "control" | "treatment";
export type PredictiveDecisionArm = PredictiveExperimentArm | null;

type PredictiveRerankConfig = {
  predictiveRerankEnabled?: boolean | null;
  predictiveRerankExposurePercent?: number | null;
  predictiveRerankMaxPositionShift?: number | null;
  predictiveRerankConfidenceThreshold?: number | null;
  predictiveRerankAutoDisableEnabled?: boolean | null;
  predictiveRerankMinShadowExperiments?: number | null;
  predictiveRerankAutoDisabledAt?: Date | string | null;
  predictiveRerankAutoDisabledReason?: string | null;
};

export type PredictiveRerankDecision = {
  arm: PredictiveDecisionArm;
  applied: boolean;
  modelVersion: string | null;
  reason: string;
  groups: MatchGroup[];
  summary: {
    exposurePercent: number;
    confidenceThreshold: number;
    maxPositionShift: number;
    shadowPoolCount: number;
    eligibleGroupCount: number;
    movedGroupCount: number;
    autoDisabled: boolean;
    autoDisabledReason: string | null;
    outcomeMetrics: PredictiveRerankOutcomeMetric[];
  };
  audits: Array<{
    deterministicRank: number;
    finalRank: number;
    predictedRank: number;
    predictedScore: number;
    predictedOutcomeRate: number;
    confidence: number;
  }>;
};

type AutoDisableAssessment = {
  autoDisabled: boolean;
  reason: string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stableBucket(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

function assessAutoDisable(metrics: PredictiveRerankOutcomeMetric[]): AutoDisableAssessment {
  const control = metrics.find((metric) => metric.arm === "control");
  const treatment = metrics.find((metric) => metric.arm === "treatment");

  if (!control || !treatment || control.sampleCount < 10 || treatment.sampleCount < 10) {
    return { autoDisabled: false, reason: null };
  }

  if (treatment.positiveRate < control.positiveRate - 0.05) {
    return {
      autoDisabled: true,
      reason: `Auto-disabled after treatment positive rate ${(treatment.positiveRate * 100).toFixed(1)}% fell below control ${(control.positiveRate * 100).toFixed(1)}% by more than 5 percentage points`,
    };
  }

  return { autoDisabled: false, reason: null };
}

function applyBoundedRerank(
  predictedOrderKeys: string[],
  confidenceByKey: Map<string, number>,
  maxPositionShift: number,
  confidenceThreshold: number,
): string[] {
  const targetIndexByKey = new Map(predictedOrderKeys.map((key, index) => [key, index]));
  const currentOrder = [...predictedOrderKeys].sort((a, b) => {
    const [aRank] = a.split(":");
    const [bRank] = b.split(":");
    return Number.parseInt(aRank, 10) - Number.parseInt(bRank, 10);
  });
  const upwardMoves = new Map<string, number>();
  const downwardMoves = new Map<string, number>();

  for (const groupKey of predictedOrderKeys) {
    const groupConfidence = confidenceByKey.get(groupKey) ?? 0;
    if (groupConfidence < confidenceThreshold) {
      continue;
    }

    const targetIndex = targetIndexByKey.get(groupKey);
    if (targetIndex === undefined) {
      continue;
    }
    let currentIndex = currentOrder.indexOf(groupKey);

    while (currentIndex > targetIndex) {
      const previousIndex = currentIndex - 1;
      const displacedKey = currentOrder[previousIndex];
      const groupUpwardMoves = upwardMoves.get(groupKey) ?? 0;
      const displacedDownwardMoves = downwardMoves.get(displacedKey) ?? 0;

      if (groupUpwardMoves >= maxPositionShift || displacedDownwardMoves >= maxPositionShift) {
        break;
      }

      currentOrder[previousIndex] = groupKey;
      currentOrder[currentIndex] = displacedKey;
      upwardMoves.set(groupKey, groupUpwardMoves + 1);
      downwardMoves.set(displacedKey, displacedDownwardMoves + 1);
      currentIndex = previousIndex;
    }
  }

  return currentOrder;
}

export function planPredictiveRerank(params: {
  poolId: string;
  groups: MatchGroup[];
  calibration: OutcomeCalibrationSnapshot;
  config: PredictiveRerankConfig;
  shadowPoolCount: number;
  outcomeMetrics: PredictiveRerankOutcomeMetric[];
  poolOverrideEnabled: boolean | null | undefined;
}): PredictiveRerankDecision {
  const {
    poolId,
    groups,
    calibration,
    config,
    shadowPoolCount,
    outcomeMetrics,
    poolOverrideEnabled,
  } = params;

  const exposurePercent = clamp(config.predictiveRerankExposurePercent ?? 50, 0, 100);
  const maxPositionShift = clamp(config.predictiveRerankMaxPositionShift ?? 2, 0, 2);
  const confidenceThreshold = clamp(config.predictiveRerankConfidenceThreshold ?? 70, 0, 100) / 100;
  const minShadowExperiments = Math.max(0, config.predictiveRerankMinShadowExperiments ?? 10);
  const configuredDisabledReason = config.predictiveRerankAutoDisabledReason ?? null;
  const overrideForceEnabled = poolOverrideEnabled === true;
  const autoDisableAssessment = config.predictiveRerankAutoDisableEnabled
    ? assessAutoDisable(outcomeMetrics)
    : { autoDisabled: false, reason: null };

  let reason = "eligible";
  if (groups.length <= 1) {
    reason = "insufficient_groups";
  } else if (poolOverrideEnabled === false) {
    reason = "pool_override_disabled";
  } else if (!overrideForceEnabled && !config.predictiveRerankEnabled) {
    reason = "feature_flag_off";
  } else if (!overrideForceEnabled && config.predictiveRerankAutoDisabledAt) {
    reason = "previously_auto_disabled";
  } else if (!overrideForceEnabled && autoDisableAssessment.autoDisabled) {
    reason = "auto_disabled_by_regression_guard";
  } else if (!overrideForceEnabled && shadowPoolCount < minShadowExperiments) {
    reason = "shadow_gate_not_met";
  }

  const experiment = buildMatchingShadowExperiment(groups, calibration);
  const keyByDeterministicRank = new Map(
    experiment.results.map((result) => [result.deterministicRank, `${result.deterministicRank}:${result.groupKey}`]),
  );
  const predictedOrderKeys = [...experiment.results]
    .sort(
      (a, b) =>
        a.predictedRank - b.predictedRank ||
        b.confidence - a.confidence ||
        a.deterministicRank - b.deterministicRank,
    )
    .map((result) => keyByDeterministicRank.get(result.deterministicRank)!)
    .filter(Boolean);
  const confidenceByKey = new Map(
    experiment.results.map((result) => [
      keyByDeterministicRank.get(result.deterministicRank)!,
      result.confidence,
    ]),
  );

  const assignedArm: PredictiveExperimentArm = stableBucket(poolId) < exposurePercent ? "treatment" : "control";
  const shouldApply = reason === "eligible" && assignedArm === "treatment";
  const finalOrderKeys = shouldApply
    ? applyBoundedRerank(predictedOrderKeys, confidenceByKey, maxPositionShift, confidenceThreshold)
    : [...predictedOrderKeys].sort((a, b) => {
        const [aRank] = a.split(":");
        const [bRank] = b.split(":");
        return Number.parseInt(aRank, 10) - Number.parseInt(bRank, 10);
      });

  const finalRankByKey = new Map(finalOrderKeys.map((key, index) => [key, index + 1]));
  const reorderedGroups = finalOrderKeys.map((key) => {
    const [deterministicRankToken] = key.split(":");
    const deterministicRank = Number.parseInt(deterministicRankToken, 10);
    if (!Number.isFinite(deterministicRank) || deterministicRank < 1 || deterministicRank > groups.length) {
      throw new Error(
        `Invalid predictive rerank key: ${key}; parsed rank ${deterministicRankToken} is outside 1..${groups.length}`,
      );
    }
    return groups[deterministicRank - 1];
  });
  const audits = experiment.results.map((result) => {
    const key = keyByDeterministicRank.get(result.deterministicRank)!;
    return {
      deterministicRank: result.deterministicRank,
      finalRank: finalRankByKey.get(key) ?? result.deterministicRank,
      predictedRank: result.predictedRank,
      predictedScore: result.predictedScore,
      predictedOutcomeRate: result.predictedOutcomeRate,
      confidence: result.confidence,
    };
  });

  const movedGroupCount = audits.filter((audit) => audit.finalRank !== audit.deterministicRank).length;
  const applied = shouldApply && movedGroupCount > 0;
  const eligibleGroupCount = experiment.results.filter((result) => result.confidence >= confidenceThreshold).length;

  return {
    arm: reason === "eligible" ? assignedArm : null,
    applied,
    modelVersion: experiment.modelVersion,
    reason,
    groups: applied ? reorderedGroups : groups,
    audits,
    summary: {
      exposurePercent,
      confidenceThreshold,
      maxPositionShift,
      shadowPoolCount,
      eligibleGroupCount,
      movedGroupCount,
      autoDisabled: reason === "previously_auto_disabled" || autoDisableAssessment.autoDisabled,
      autoDisabledReason: configuredDisabledReason ?? autoDisableAssessment.reason,
      outcomeMetrics,
    },
  };
}

export function getPredictiveRerankAutoDisableReason(
  metrics: PredictiveRerankOutcomeMetric[],
): string | null {
  return assessAutoDisable(metrics).reason;
}
