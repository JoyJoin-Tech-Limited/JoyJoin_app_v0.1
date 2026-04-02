import type {
  MatchingShadowComparison,
  MatchingShadowSummary,
} from "@shared/schema";
import type { MatchGroup } from "./poolMatchingService";
import type { OutcomeCalibrationSnapshot } from "./repositories/matchingShadowExperimentsRepo";

const MODEL_VERSION = "predictive-shadow-v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function safeScore(value: number | undefined): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

function getBaselineOutcomeRate(calibration: OutcomeCalibrationSnapshot): number {
  if (calibration.sampleCount === 0) {
    return 0.55;
  }

  return calibration.positiveRate;
}

function calculatePredictedOutcomeRate(
  group: MatchGroup,
  calibration: OutcomeCalibrationSnapshot,
): number {
  const deterministicSignal = safeScore(group.overallScore) / 100;
  const chemistrySignal = safeScore(group.avgChemistryScore) / 100;
  const diversitySignal = safeScore(group.diversityScore) / 100;
  const balanceSignal = safeScore(group.communicationBalance) / 100;
  const atmosphereSignal = calibration.avgAtmosphereScore
    ? calibration.avgAtmosphereScore / 5
    : getBaselineOutcomeRate(calibration);

  return clamp(
    deterministicSignal * 0.45 +
      chemistrySignal * 0.2 +
      diversitySignal * 0.1 +
      balanceSignal * 0.05 +
      getBaselineOutcomeRate(calibration) * 0.15 +
      atmosphereSignal * 0.05,
    0,
    1,
  );
}

function calculateConfidence(
  group: MatchGroup,
  calibration: OutcomeCalibrationSnapshot,
  predictedOutcomeRate: number,
): number {
  const sampleSignal = Math.min(calibration.sampleCount, 250) / 250;
  const featureSpread =
    Math.abs(safeScore(group.avgChemistryScore) - safeScore(group.overallScore)) / 100 +
    Math.abs(safeScore(group.diversityScore) - safeScore(group.overallScore)) / 100 +
    Math.abs(safeScore(group.communicationBalance) - safeScore(group.overallScore)) / 100;

  return roundTo4(
    clamp(
      0.25 +
        sampleSignal * 0.35 +
        predictedOutcomeRate * 0.25 +
        Math.min(featureSpread, 0.3),
      0.25,
      0.95,
    ),
  );
}

export function buildMatchingShadowExperiment(groups: MatchGroup[], calibration: OutcomeCalibrationSnapshot): {
  mode: "batch";
  modelVersion: string;
  results: MatchingShadowComparison[];
  summary: MatchingShadowSummary;
} {
  const deterministicOrdered = [...groups].sort(
    (a, b) =>
      safeScore(b.overallScore) - safeScore(a.overallScore) ||
      safeScore(b.avgChemistryScore) - safeScore(a.avgChemistryScore),
  );

  const draftResults = deterministicOrdered.map((group, index) => {
    const predictedOutcomeRate = calculatePredictedOutcomeRate(group, calibration);
    const predictedScore = Math.round(predictedOutcomeRate * 100);
    const confidence = calculateConfidence(group, calibration, predictedOutcomeRate);

    return {
      groupKey: `group-${index + 1}`,
      memberUserIds: group.members.map((member) => member.userId),
      memberCount: group.members.length,
      deterministicScore: safeScore(group.overallScore),
      deterministicRank: index + 1,
      predictedScore,
      predictedRank: 0,
      scoreDelta: predictedScore - safeScore(group.overallScore),
      rankDelta: 0,
      confidence,
      predictedOutcomeRate: roundTo4(predictedOutcomeRate),
      avgChemistryScore: safeScore(group.avgChemistryScore),
      diversityScore: safeScore(group.diversityScore),
      communicationBalance: safeScore(group.communicationBalance),
      temperatureLevel: group.temperatureLevel,
    } satisfies MatchingShadowComparison;
  });

  const predictedOrder = [...draftResults].sort(
    (a, b) =>
      b.predictedScore - a.predictedScore ||
      b.confidence - a.confidence ||
      b.deterministicScore - a.deterministicScore,
  );

  const predictedRankByGroupKey = new Map(
    predictedOrder.map((result, index) => [result.groupKey, index + 1]),
  );

  const results = draftResults.map((result) => {
    const predictedRank = predictedRankByGroupKey.get(result.groupKey) ?? result.deterministicRank;
    return {
      ...result,
      predictedRank,
      rankDelta: predictedRank - result.deterministicRank,
    };
  });

  const deterministicAverageScore = results.length > 0
    ? Math.round(results.reduce((sum, result) => sum + result.deterministicScore, 0) / results.length)
    : 0;

  const averageConfidence = results.length > 0
    ? roundTo4(results.reduce((sum, result) => sum + result.confidence, 0) / results.length)
    : 0;

  const averageScoreDelta = results.length > 0
    ? Math.round(results.reduce((sum, result) => sum + result.scoreDelta, 0) / results.length)
    : 0;

  const rankAgreementRate = results.length > 0
    ? roundTo4(results.filter((result) => result.rankDelta === 0).length / results.length)
    : 0;

  return {
    mode: "batch",
    modelVersion: MODEL_VERSION,
    results,
    summary: {
      modelVersion: MODEL_VERSION,
      liveRankingProtected: true,
      deterministicGroupCount: results.length,
      deterministicAverageScore,
      averageConfidence,
      averageScoreDelta,
      rankAgreementRate,
      topRankChanged: results.some(
        (result) => result.deterministicRank === 1 && result.predictedRank !== 1,
      ),
      outcomeValidation: {
        sampleCount: calibration.sampleCount,
        positiveRate: roundTo4(calibration.positiveRate),
        avgAtmosphereScore: calibration.avgAtmosphereScore === null
          ? null
          : roundTo4(calibration.avgAtmosphereScore),
      },
    },
  };
}
