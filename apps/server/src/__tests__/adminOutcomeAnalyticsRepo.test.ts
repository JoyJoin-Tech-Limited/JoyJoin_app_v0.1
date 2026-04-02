import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  db: {},
}));

import {
  buildOutcomeAnalyticsDashboard,
  summarizeDialogueFeedbackRows,
} from "../repositories/adminOutcomeAnalyticsRepo";

describe("adminOutcomeAnalyticsRepo", () => {
  it("builds dashboard totals, readiness, and cohort warnings", () => {
    const dashboard = buildOutcomeAnalyticsDashboard({
      registrations: [
        {
          poolId: "pool-1",
          poolTitle: "深圳饭局",
          city: "深圳",
          eventType: "饭局",
          userId: "user-1",
          currentCity: "深圳",
          archetype: "开心柯基",
          budgetRange: ["150-200"],
          preferredLanguages: ["中文（国语）"],
          eventIntent: ["交朋友"],
          cuisinePreferences: ["粤菜"],
          dietaryRestrictions: [],
          tasteIntensity: [],
          registeredAt: new Date("2026-04-01T10:00:00Z"),
        },
        {
          poolId: "pool-1",
          poolTitle: "深圳饭局",
          city: "深圳",
          eventType: "饭局",
          userId: "user-2",
          currentCity: null,
          archetype: null,
          budgetRange: null,
          preferredLanguages: ["英语"],
          eventIntent: [],
          cuisinePreferences: null,
          dietaryRestrictions: null,
          tasteIntensity: null,
          registeredAt: new Date("2026-04-01T10:05:00Z"),
        },
        {
          poolId: "pool-2",
          poolTitle: "香港酒局",
          city: "香港",
          eventType: "酒局",
          userId: "user-3",
          currentCity: "香港",
          archetype: "机智狐",
          budgetRange: ["200-300"],
          preferredLanguages: ["中文（粤语）"],
          eventIntent: ["放松心情"],
          cuisinePreferences: ["西餐"],
          dietaryRestrictions: [],
          tasteIntensity: ["不辣/清淡为主"],
          registeredAt: new Date("2026-04-02T10:00:00Z"),
        },
      ],
      feedbackRows: [
        {
          userId: "user-1",
          atmosphereScore: 5,
          connectionStatus: "已交换联系方式",
          hasDeepFeedback: true,
          triggerEffectivenessScore: "0.8",
        },
        {
          userId: "user-3",
          atmosphereScore: 4,
          connectionStatus: null,
          hasDeepFeedback: false,
          triggerEffectivenessScore: null,
        },
      ],
      dialogueFeedbackRows: [
        {
          userId: "user-1",
          overallRating: 5,
        },
      ],
      model: {
        activeConfigName: "default",
        totalMatches: 12,
        successfulMatches: 7,
        averageSatisfaction: 0.63,
        configUpdatedAt: new Date("2026-04-02T00:00:00Z"),
        latestWeightsRecordedAt: new Date("2026-04-01T00:00:00Z"),
        triggerCount: 4,
        avgTriggerEffectiveness: 0.42,
        dialogueFeedbackCount: 1,
        avgDialogueRating: 5,
        outcomeSummaryCount: 1,
      },
    });

    expect(dashboard.overview.submissionCount).toBe(3);
    expect(dashboard.overview.completeSubmissions).toBe(2);
    expect(dashboard.overview.uniqueUsers).toBe(3);
    expect(dashboard.overview.poolCount).toBe(2);
    expect(dashboard.overview.cityCount).toBe(2);
    expect(dashboard.coverage.archetypes).toEqual(["开心柯基", "未标注", "机智狐"]);

    const shenzhenCohort = dashboard.cohorts.find(
      (cohort) => cohort.key === "深圳__饭局__开心柯基",
    );
    expect(shenzhenCohort?.warningLevel).toBe("healthy");
    expect(shenzhenCohort?.feedbackCoverageRate).toBe(1);

    const missingProfileCohort = dashboard.cohorts.find(
      (cohort) => cohort.key === "深圳__饭局__未标注",
    );
    expect(missingProfileCohort?.warningLevel).toBe("critical");
    expect(missingProfileCohort?.warningReasons).toContain("前置资料完整度偏低");

    expect(dashboard.readinessMetrics.find((metric) => metric.id === "deep-feedback")?.status).toBe("needs_data");
    expect(dashboard.modelReadiness.status).toBe("needs_data");
    expect(dashboard.underInstrumentedCohorts[0]?.warningLevel).toBe("critical");
  });

  it("returns empty-safe dashboard output", () => {
    const dashboard = buildOutcomeAnalyticsDashboard({
      registrations: [],
      feedbackRows: [],
      dialogueFeedbackRows: [],
      model: {
        activeConfigName: null,
        totalMatches: 0,
        successfulMatches: 0,
        averageSatisfaction: 0,
        configUpdatedAt: null,
        latestWeightsRecordedAt: null,
        triggerCount: 0,
        avgTriggerEffectiveness: 0,
        dialogueFeedbackCount: 0,
        avgDialogueRating: 0,
        outcomeSummaryCount: 0,
      },
    });

    expect(dashboard.overview.submissionCount).toBe(0);
    expect(dashboard.cohorts).toEqual([]);
    expect(dashboard.underInstrumentedCohorts).toEqual([]);
    expect(dashboard.modelReadiness.status).toBe("needs_data");
  });

  it("counts dialogue readiness by unique rated users", () => {
    const dashboard = buildOutcomeAnalyticsDashboard({
      registrations: [
        {
          poolId: "pool-1",
          poolTitle: "深圳饭局",
          city: "深圳",
          eventType: "饭局",
          userId: "user-1",
          currentCity: "深圳",
          archetype: "开心柯基",
          budgetRange: ["150-200"],
          preferredLanguages: ["中文（国语）"],
          eventIntent: ["交朋友"],
          cuisinePreferences: ["粤菜"],
          dietaryRestrictions: [],
          tasteIntensity: [],
          registeredAt: new Date("2026-04-01T10:00:00Z"),
        },
        {
          poolId: "pool-2",
          poolTitle: "香港酒局",
          city: "香港",
          eventType: "酒局",
          userId: "user-2",
          currentCity: "香港",
          archetype: "机智狐",
          budgetRange: ["200-300"],
          preferredLanguages: ["中文（粤语）"],
          eventIntent: ["放松心情"],
          cuisinePreferences: ["西餐"],
          dietaryRestrictions: [],
          tasteIntensity: ["不辣/清淡为主"],
          registeredAt: new Date("2026-04-02T10:00:00Z"),
        },
      ],
      feedbackRows: [],
      dialogueFeedbackRows: [
        { userId: "user-1", overallRating: 5 },
        { userId: "user-1", overallRating: 4 },
        { userId: "user-2", overallRating: null },
        { userId: "external-user", overallRating: 3 },
      ],
      model: {
        activeConfigName: "default",
        totalMatches: 30,
        successfulMatches: 18,
        averageSatisfaction: 0.7,
        configUpdatedAt: new Date("2026-04-02T00:00:00Z"),
        latestWeightsRecordedAt: new Date("2026-04-01T00:00:00Z"),
        triggerCount: 4,
        avgTriggerEffectiveness: 0.42,
        dialogueFeedbackCount: 1,
        avgDialogueRating: 4.5,
        outcomeSummaryCount: 2,
      },
    });

    const dialogueMetric = dashboard.readinessMetrics.find(
      (metric) => metric.id === "dialogue-feedback",
    );

    expect(dialogueMetric?.count).toBe(1);
    expect(dialogueMetric?.coverageRate).toBe(0.5);
    expect(dashboard.modelReadiness.dialogueFeedbackCount).toBe(1);
    expect(dashboard.modelReadiness.status).toBe("watch");
  });

  it("summarizes dialogue feedback using rated rows only", () => {
    const summary = summarizeDialogueFeedbackRows([
      { userId: "user-1", overallRating: 5 },
      { userId: "user-1", overallRating: 4 },
      { userId: "user-2", overallRating: null },
      { userId: "external-user", overallRating: 3 },
    ]);

    expect(summary.ratedUserCount).toBe(2);
    expect(summary.avgDialogueRating).toBe(4);
  });
});
