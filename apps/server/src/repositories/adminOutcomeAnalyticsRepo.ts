import {
  dialogueFeedback,
  eventFeedback,
  eventPoolRegistrations,
  eventPools,
  eventSatisfactionSummary,
  matchingWeightsConfig,
  matchingWeightsHistory,
  triggerPerformance,
  users,
} from "@shared/schema";
import { count, desc, eq } from "drizzle-orm";

import { db } from "../db";

type RegistrationRow = {
  poolId: string;
  poolTitle: string;
  city: string;
  eventType: string;
  userId: string;
  currentCity: string | null;
  archetype: string | null;
  budgetRange: string[] | null;
  preferredLanguages: string[] | null;
  eventIntent: string[] | null;
  cuisinePreferences: string[] | null;
  dietaryRestrictions: string[] | null;
  tasteIntensity: string[] | null;
  registeredAt: Date | null;
};

type FeedbackRow = {
  userId: string | null;
  atmosphereScore: number | null;
  connectionStatus: string | null;
  hasDeepFeedback: boolean | null;
  triggerEffectivenessScore: string | number | null;
};

type DialogueFeedbackRow = {
  userId: string | null;
  overallRating: number | null;
};

export function summarizeDialogueFeedbackRows(rows: DialogueFeedbackRow[]): {
  ratedUserCount: number;
  avgDialogueRating: number;
} {
  const ratedDialogueFeedbackRows = rows.filter(
    (row: DialogueFeedbackRow) => row.overallRating !== null,
  );
  const ratedUserCount = new Set(
    ratedDialogueFeedbackRows
      .map((row: DialogueFeedbackRow) => row.userId)
      .filter((userId: string | null): userId is string => Boolean(userId)),
  ).size;
  const avgDialogueRating =
    ratedDialogueFeedbackRows.length > 0
      ? ratedDialogueFeedbackRows.reduce(
          (sum: number, row: DialogueFeedbackRow) =>
            sum + toNumber(row.overallRating),
          0,
        ) / ratedDialogueFeedbackRows.length
      : 0;

  return {
    ratedUserCount,
    avgDialogueRating,
  };
}

type ModelInput = {
  activeConfigName: string | null;
  totalMatches: number;
  successfulMatches: number;
  averageSatisfaction: number;
  configUpdatedAt: Date | null;
  latestWeightsRecordedAt: Date | null;
  triggerCount: number;
  avgTriggerEffectiveness: number;
  dialogueFeedbackCount: number;
  avgDialogueRating: number;
  outcomeSummaryCount: number;
};

export type OutcomeAnalyticsCohort = {
  key: string;
  city: string;
  eventType: string;
  archetype: string;
  submissionCount: number;
  uniqueUsers: number;
  completeSubmissions: number;
  completionRate: number;
  atmosphereLabelUsers: number;
  connectionLabelUsers: number;
  deepFeedbackUsers: number;
  triggerLabelUsers: number;
  dialogueFeedbackUsers: number;
  feedbackCoverageRate: number;
  deepFeedbackCoverageRate: number;
  warningLevel: "healthy" | "watch" | "critical";
  warningReasons: string[];
};

export type OutcomeAnalyticsMetric = {
  id: string;
  label: string;
  count: number;
  target: number;
  coverageRate: number;
  status: "ready" | "watch" | "needs_data";
};

export type OutcomeAnalyticsDashboard = {
  generatedAt: string;
  overview: {
    submissionCount: number;
    completeSubmissions: number;
    completionRate: number;
    labeledUsers: number;
    uniqueUsers: number;
    poolCount: number;
    cityCount: number;
    archetypeCount: number;
    outcomeSummaryCount: number;
  };
  coverage: {
    cities: string[];
    eventTypes: string[];
    archetypes: string[];
  };
  readinessMetrics: OutcomeAnalyticsMetric[];
  cohorts: OutcomeAnalyticsCohort[];
  underInstrumentedCohorts: OutcomeAnalyticsCohort[];
  modelReadiness: {
    activeConfigName: string | null;
    totalMatches: number;
    successfulMatches: number;
    averageSatisfaction: number;
    configUpdatedAt: string | null;
    latestWeightsRecordedAt: string | null;
    triggerCount: number;
    avgTriggerEffectiveness: number;
    dialogueFeedbackCount: number;
    avgDialogueRating: number;
    outcomeSummaryCount: number;
    status: "ready" | "watch" | "needs_data";
  };
};

const MIN_COMPLETENESS_FIELDS = 2;

function nonEmptyCount(values: Array<string[] | null | undefined>): number {
  return values.filter((value) => Array.isArray(value) && value.length > 0).length;
}

function isSubmissionComplete(row: RegistrationRow): boolean {
  const profileCoverage = Boolean(row.currentCity && row.archetype);
  const preferenceCoverage = nonEmptyCount([
    row.budgetRange,
    row.preferredLanguages,
    row.eventIntent,
    row.cuisinePreferences,
    row.dietaryRestrictions,
    row.tasteIntensity,
  ]);

  return profileCoverage && preferenceCoverage >= MIN_COMPLETENESS_FIELDS;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function clampRate(numerator: number, denominator: number): number {
  return Math.min(1, rate(numerator, denominator));
}

function getMetricStatus(
  count: number,
  target: number,
  coverageRate: number,
): "ready" | "watch" | "needs_data" {
  if (count >= target || coverageRate >= 0.75) {
    return "ready";
  }

  if (count >= Math.ceil(target * 0.5) || coverageRate >= 0.4) {
    return "watch";
  }

  return "needs_data";
}

function getWarningLevel(
  completionRate: number,
  feedbackCoverageRate: number,
  deepFeedbackCoverageRate: number,
): "healthy" | "watch" | "critical" {
  if (
    completionRate < 0.45 ||
    feedbackCoverageRate < 0.3 ||
    deepFeedbackCoverageRate < 0.1
  ) {
    return "critical";
  }

  if (
    completionRate < 0.7 ||
    feedbackCoverageRate < 0.5 ||
    deepFeedbackCoverageRate < 0.2
  ) {
    return "watch";
  }

  return "healthy";
}

export function buildOutcomeAnalyticsDashboard(input: {
  registrations: RegistrationRow[];
  feedbackRows: FeedbackRow[];
  dialogueFeedbackRows: DialogueFeedbackRow[];
  model: ModelInput;
}): OutcomeAnalyticsDashboard {
  const userSignals = new Map<
    string,
    {
      hasAtmosphereLabel: boolean;
      hasConnectionLabel: boolean;
      hasDeepFeedback: boolean;
      hasTriggerLabel: boolean;
      hasDialogueFeedback: boolean;
    }
  >();

  input.feedbackRows.forEach((row) => {
    if (!row.userId) {
      return;
    }

    const existing = userSignals.get(row.userId) ?? {
      hasAtmosphereLabel: false,
      hasConnectionLabel: false,
      hasDeepFeedback: false,
      hasTriggerLabel: false,
      hasDialogueFeedback: false,
    };

    existing.hasAtmosphereLabel ||= row.atmosphereScore !== null;
    existing.hasConnectionLabel ||= Boolean(row.connectionStatus);
    existing.hasDeepFeedback ||= Boolean(row.hasDeepFeedback);
    existing.hasTriggerLabel ||= row.triggerEffectivenessScore !== null;
    userSignals.set(row.userId, existing);
  });

  input.dialogueFeedbackRows.forEach((row) => {
    if (!row.userId) {
      return;
    }

    const existing = userSignals.get(row.userId) ?? {
      hasAtmosphereLabel: false,
      hasConnectionLabel: false,
      hasDeepFeedback: false,
      hasTriggerLabel: false,
      hasDialogueFeedback: false,
    };

    existing.hasDialogueFeedback ||= row.overallRating !== null;
    userSignals.set(row.userId, existing);
  });

  const cohortMap = new Map<
    string,
    {
      city: string;
      eventType: string;
      archetype: string;
      submissionCount: number;
      completeSubmissions: number;
      uniqueUsers: Set<string>;
      atmosphereUsers: Set<string>;
      connectionUsers: Set<string>;
      deepFeedbackUsers: Set<string>;
      triggerUsers: Set<string>;
      dialogueUsers: Set<string>;
    }
  >();

  const allUsers = new Set<string>();
  const allPools = new Set<string>();
  const allCities = new Set<string>();
  const allArchetypes = new Set<string>();
  let completeSubmissions = 0;

  input.registrations.forEach((row) => {
    const archetype = row.archetype ?? "未标注";
    const key = `${row.city}__${row.eventType}__${archetype}`;
    const cohort = cohortMap.get(key) ?? {
      city: row.city,
      eventType: row.eventType,
      archetype,
      submissionCount: 0,
      completeSubmissions: 0,
      uniqueUsers: new Set<string>(),
      atmosphereUsers: new Set<string>(),
      connectionUsers: new Set<string>(),
      deepFeedbackUsers: new Set<string>(),
      triggerUsers: new Set<string>(),
      dialogueUsers: new Set<string>(),
    };

    cohort.submissionCount += 1;
    cohort.uniqueUsers.add(row.userId);

    const complete = isSubmissionComplete(row);
    if (complete) {
      cohort.completeSubmissions += 1;
      completeSubmissions += 1;
    }

    const signals = userSignals.get(row.userId);
    if (signals?.hasAtmosphereLabel) {
      cohort.atmosphereUsers.add(row.userId);
    }
    if (signals?.hasConnectionLabel) {
      cohort.connectionUsers.add(row.userId);
    }
    if (signals?.hasDeepFeedback) {
      cohort.deepFeedbackUsers.add(row.userId);
    }
    if (signals?.hasTriggerLabel) {
      cohort.triggerUsers.add(row.userId);
    }
    if (signals?.hasDialogueFeedback) {
      cohort.dialogueUsers.add(row.userId);
    }

    cohortMap.set(key, cohort);
    allUsers.add(row.userId);
    allPools.add(row.poolId);
    allCities.add(row.city);
    allArchetypes.add(archetype);
  });

  const cohorts = Array.from(cohortMap.entries())
    .map(([key, cohort]): OutcomeAnalyticsCohort => {
      const completionRate = rate(
        cohort.completeSubmissions,
        cohort.submissionCount,
      );
      const feedbackCoverageRate = rate(
        cohort.atmosphereUsers.size,
        cohort.uniqueUsers.size,
      );
      const deepFeedbackCoverageRate = rate(
        cohort.deepFeedbackUsers.size,
        cohort.uniqueUsers.size,
      );
      const warningReasons: string[] = [];

      if (completionRate < 0.7) {
        warningReasons.push("前置资料完整度偏低");
      }
      if (feedbackCoverageRate < 0.5) {
        warningReasons.push("满意度标签覆盖不足");
      }
      if (deepFeedbackCoverageRate < 0.2) {
        warningReasons.push("深度反馈样本不足");
      }

      return {
        key,
        city: cohort.city,
        eventType: cohort.eventType,
        archetype: cohort.archetype,
        submissionCount: cohort.submissionCount,
        uniqueUsers: cohort.uniqueUsers.size,
        completeSubmissions: cohort.completeSubmissions,
        completionRate,
        atmosphereLabelUsers: cohort.atmosphereUsers.size,
        connectionLabelUsers: cohort.connectionUsers.size,
        deepFeedbackUsers: cohort.deepFeedbackUsers.size,
        triggerLabelUsers: cohort.triggerUsers.size,
        dialogueFeedbackUsers: cohort.dialogueUsers.size,
        feedbackCoverageRate,
        deepFeedbackCoverageRate,
        warningLevel: getWarningLevel(
          completionRate,
          feedbackCoverageRate,
          deepFeedbackCoverageRate,
        ),
        warningReasons,
      };
    })
    .sort((a, b) => b.submissionCount - a.submissionCount);

  const registeredUserSignalValues = Array.from(allUsers).map((userId) => {
    return userSignals.get(userId) ?? {
      hasAtmosphereLabel: false,
      hasConnectionLabel: false,
      hasDeepFeedback: false,
      hasTriggerLabel: false,
      hasDialogueFeedback: false,
    };
  });
  const atmosphereLabelCount = registeredUserSignalValues.filter(
    (signals) => signals.hasAtmosphereLabel,
  ).length;
  const connectionLabelCount = registeredUserSignalValues.filter(
    (signals) => signals.hasConnectionLabel,
  ).length;
  const deepFeedbackCount = registeredUserSignalValues.filter(
    (signals) => signals.hasDeepFeedback,
  ).length;
  const triggerLabelCount = registeredUserSignalValues.filter(
    (signals) => signals.hasTriggerLabel,
  ).length;
  const dialogueFeedbackUserCount = registeredUserSignalValues.filter(
    (signals) => signals.hasDialogueFeedback,
  ).length;
  const labeledUsers = registeredUserSignalValues.filter(
    (signals) => signals.hasAtmosphereLabel || signals.hasConnectionLabel,
  ).length;
  const atmosphereCoverageRate = clampRate(atmosphereLabelCount, allUsers.size);
  const connectionCoverageRate = clampRate(connectionLabelCount, allUsers.size);
  const deepFeedbackCoverage = clampRate(deepFeedbackCount, allUsers.size);
  const triggerCoverageRate = clampRate(triggerLabelCount, allUsers.size);
  const dialogueFeedbackCoverage = clampRate(
    dialogueFeedbackUserCount,
    allUsers.size,
  );

  const overview = {
    submissionCount: input.registrations.length,
    completeSubmissions,
    completionRate: rate(completeSubmissions, input.registrations.length),
    labeledUsers,
    uniqueUsers: allUsers.size,
    poolCount: allPools.size,
    cityCount: allCities.size,
    archetypeCount: allArchetypes.size,
    outcomeSummaryCount: input.model.outcomeSummaryCount,
  };

  const readinessMetrics: OutcomeAnalyticsMetric[] = [
    {
      id: "submission-completeness",
      label: "前置资料完整提交",
      count: completeSubmissions,
      target: Math.max(1, Math.ceil(input.registrations.length * 0.75)),
      coverageRate: overview.completionRate,
      status: getMetricStatus(
        completeSubmissions,
        Math.max(1, Math.ceil(input.registrations.length * 0.75)),
        overview.completionRate,
      ),
    },
    {
      id: "atmosphere-labels",
      label: "氛围评分标签",
      count: atmosphereLabelCount,
      target: 30,
      coverageRate: atmosphereCoverageRate,
      status: getMetricStatus(atmosphereLabelCount, 30, atmosphereCoverageRate),
    },
    {
      id: "connection-labels",
      label: "连接结果标签",
      count: connectionLabelCount,
      target: 30,
      coverageRate: connectionCoverageRate,
      status: getMetricStatus(connectionLabelCount, 30, connectionCoverageRate),
    },
    {
      id: "deep-feedback",
      label: "深度反馈标签",
      count: deepFeedbackCount,
      target: 15,
      coverageRate: deepFeedbackCoverage,
      status: getMetricStatus(deepFeedbackCount, 15, deepFeedbackCoverage),
    },
    {
      id: "trigger-effectiveness",
      label: "触发器效果标签",
      count: triggerLabelCount,
      target: 10,
      coverageRate: triggerCoverageRate,
      status: getMetricStatus(triggerLabelCount, 10, triggerCoverageRate),
    },
    {
      id: "dialogue-feedback",
      label: "对话反馈标签",
      count: dialogueFeedbackUserCount,
      target: 20,
      coverageRate: dialogueFeedbackCoverage,
      status: getMetricStatus(
        dialogueFeedbackUserCount,
        20,
        dialogueFeedbackCoverage,
      ),
    },
  ];

  const modelStatus =
    input.model.totalMatches >= 50 &&
    dialogueFeedbackUserCount >= 20 &&
    input.model.avgTriggerEffectiveness >= 0.4
      ? "ready"
      : input.model.totalMatches >= 20 || dialogueFeedbackUserCount >= 10
        ? "watch"
        : "needs_data";

  return {
    generatedAt: new Date().toISOString(),
    overview,
    coverage: {
      cities: Array.from(allCities).sort(),
      eventTypes: Array.from(
        new Set(input.registrations.map((row) => row.eventType)),
      ).sort(),
      archetypes: Array.from(allArchetypes).sort(),
    },
    readinessMetrics,
    cohorts,
    underInstrumentedCohorts: cohorts
      .filter((cohort) => cohort.warningLevel !== "healthy")
      .sort((a, b) => {
        const severity =
          (a.warningLevel === "critical" ? 2 : 1) -
          (b.warningLevel === "critical" ? 2 : 1);
        if (severity !== 0) {
          return -severity;
        }
        return b.submissionCount - a.submissionCount;
      })
      .slice(0, 8),
    modelReadiness: {
      activeConfigName: input.model.activeConfigName,
      totalMatches: input.model.totalMatches,
      successfulMatches: input.model.successfulMatches,
      averageSatisfaction: input.model.averageSatisfaction,
      configUpdatedAt: input.model.configUpdatedAt?.toISOString() ?? null,
      latestWeightsRecordedAt:
        input.model.latestWeightsRecordedAt?.toISOString() ?? null,
      triggerCount: input.model.triggerCount,
      avgTriggerEffectiveness: input.model.avgTriggerEffectiveness,
      dialogueFeedbackCount: dialogueFeedbackUserCount,
      avgDialogueRating: input.model.avgDialogueRating,
      outcomeSummaryCount: input.model.outcomeSummaryCount,
      status: modelStatus,
    },
  };
}

export const adminOutcomeAnalyticsRepo = {
  async getDashboard(): Promise<OutcomeAnalyticsDashboard> {
    const [
      registrations,
      feedbackRows,
      dialogueFeedbackRows,
      activeConfigs,
      latestHistoryRows,
      triggerRows,
      outcomeSummaryCountRows,
    ] = await Promise.all([
      db
        .select({
          poolId: eventPoolRegistrations.poolId,
          poolTitle: eventPools.title,
          city: eventPools.city,
          eventType: eventPools.eventType,
          userId: eventPoolRegistrations.userId,
          currentCity: users.currentCity,
          archetype: users.archetype,
          budgetRange: eventPoolRegistrations.budgetRange,
          preferredLanguages: eventPoolRegistrations.preferredLanguages,
          eventIntent: eventPoolRegistrations.eventIntent,
          cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
          dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
          tasteIntensity: eventPoolRegistrations.tasteIntensity,
          registeredAt: eventPoolRegistrations.registeredAt,
        })
        .from(eventPoolRegistrations)
        .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .orderBy(desc(eventPoolRegistrations.registeredAt)),
      db
        .select({
          userId: eventFeedback.userId,
          atmosphereScore: eventFeedback.atmosphereScore,
          connectionStatus: eventFeedback.connectionStatus,
          hasDeepFeedback: eventFeedback.hasDeepFeedback,
          triggerEffectivenessScore: eventFeedback.triggerEffectivenessScore,
        })
        .from(eventFeedback),
      db
        .select({
          userId: dialogueFeedback.userId,
          overallRating: dialogueFeedback.overallRating,
        })
        .from(dialogueFeedback),
      db
        .select({
          configName: matchingWeightsConfig.configName,
          totalMatches: matchingWeightsConfig.totalMatches,
          successfulMatches: matchingWeightsConfig.successfulMatches,
          averageSatisfaction: matchingWeightsConfig.averageSatisfaction,
          updatedAt: matchingWeightsConfig.updatedAt,
        })
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.isActive, true))
        .orderBy(desc(matchingWeightsConfig.updatedAt))
        .limit(1),
      db
        .select({
          recordedAt: matchingWeightsHistory.recordedAt,
        })
        .from(matchingWeightsHistory)
        .orderBy(desc(matchingWeightsHistory.recordedAt))
        .limit(1),
      db
        .select({
          effectivenessScore: triggerPerformance.effectivenessScore,
        })
        .from(triggerPerformance),
      db
        .select({
          count: count(),
        })
        .from(eventSatisfactionSummary),
    ]);

    const activeConfig = activeConfigs[0];
    const latestHistory = latestHistoryRows[0];
    const { ratedUserCount: dialogueFeedbackUserCount, avgDialogueRating } =
      summarizeDialogueFeedbackRows(dialogueFeedbackRows);
    const avgTriggerEffectiveness =
      triggerRows.length > 0
        ? triggerRows.reduce(
            (sum: number, row: { effectivenessScore: string | number | null }) =>
              sum + toNumber(row.effectivenessScore),
            0,
          ) / triggerRows.length
        : 0;

    return buildOutcomeAnalyticsDashboard({
      registrations,
      feedbackRows,
      dialogueFeedbackRows,
      model: {
        activeConfigName: activeConfig?.configName ?? null,
        totalMatches: activeConfig?.totalMatches ?? 0,
        successfulMatches: activeConfig?.successfulMatches ?? 0,
        averageSatisfaction: toNumber(activeConfig?.averageSatisfaction),
        configUpdatedAt: activeConfig?.updatedAt ?? null,
        latestWeightsRecordedAt: latestHistory?.recordedAt ?? null,
        triggerCount: triggerRows.length,
        avgTriggerEffectiveness,
        dialogueFeedbackCount: dialogueFeedbackUserCount,
        avgDialogueRating,
        outcomeSummaryCount: toNumber(outcomeSummaryCountRows[0]?.count ?? 0),
      },
    });
  },
};
