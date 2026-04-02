import { describe, expect, it } from "vitest";
import { planPredictiveRerank } from "../predictiveRerankingService";
import type { MatchGroup, UserWithProfile } from "../poolMatchingService";

function makeUser(userId: string): UserWithProfile {
  return {
    userId,
    registrationId: `${userId}-registration`,
    gender: null,
    birthdate: null,
    industryNiche: null,
    industryNicheLabel: null,
    industryCategoryLabel: null,
    educationLevel: null,
    archetype: "暖心熊",
    secondaryArchetype: "暖心熊",
    workMode: null,
    hometown: null,
    hometownAffinityOptin: false,
    budgetRange: null,
    barBudgetRange: null,
    preferredLanguages: null,
    eventIntent: null,
    userIntent: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    tasteIntensity: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: "饭局",
  };
}

function makeGroup(
  userIds: string[],
  overrides: Partial<MatchGroup> = {},
): MatchGroup {
  return {
    members: userIds.map((userId) => makeUser(userId)),
    avgPairScore: 80,
    avgChemistryScore: 80,
    diversityScore: 70,
    communicationBalance: 70,
    overallScore: 80,
    temperatureLevel: "warm",
    explanation: "test",
    ...overrides,
  };
}

describe("predictiveRerankingService", () => {
  it("caps movement while allowing confident treatment groups to move upward", () => {
    const decision = planPredictiveRerank({
      poolId: "pool-treatment",
      groups: [
        makeGroup(["u1", "u2", "u3", "u4"], { overallScore: 82, avgChemistryScore: 82, diversityScore: 60, communicationBalance: 60 }),
        makeGroup(["u5", "u6", "u7", "u8"], { overallScore: 78, avgChemistryScore: 95, diversityScore: 92, communicationBalance: 88 }),
        makeGroup(["u9", "u10", "u11", "u12"], { overallScore: 76, avgChemistryScore: 70, diversityScore: 68, communicationBalance: 72 }),
      ],
      calibration: { sampleCount: 180, positiveRate: 0.72, avgAtmosphereScore: 4.3 },
      config: {
        predictiveRerankEnabled: true,
        predictiveRerankExposurePercent: 100,
        predictiveRerankMaxPositionShift: 1,
        predictiveRerankConfidenceThreshold: 70,
        predictiveRerankAutoDisableEnabled: true,
        predictiveRerankMinShadowExperiments: 1,
      },
      shadowPoolCount: 12,
      outcomeMetrics: [],
      poolOverrideEnabled: null,
    });

    expect(decision.arm).toBe("treatment");
    expect(decision.applied).toBe(true);
    expect(decision.audits[1].finalRank).toBe(1);
    expect(decision.audits[1].deterministicRank - decision.audits[1].finalRank).toBeLessThanOrEqual(1);
  });

  it("falls back to control when the regression guard would auto-disable treatment", () => {
    const decision = planPredictiveRerank({
      poolId: "pool-control",
      groups: [
        makeGroup(["u1", "u2", "u3", "u4"], { overallScore: 82 }),
        makeGroup(["u5", "u6", "u7", "u8"], { overallScore: 79 }),
      ],
      calibration: { sampleCount: 150, positiveRate: 0.7, avgAtmosphereScore: 4.1 },
      config: {
        predictiveRerankEnabled: true,
        predictiveRerankExposurePercent: 100,
        predictiveRerankMaxPositionShift: 2,
        predictiveRerankConfidenceThreshold: 70,
        predictiveRerankAutoDisableEnabled: true,
        predictiveRerankMinShadowExperiments: 1,
      },
      shadowPoolCount: 12,
      outcomeMetrics: [
        { arm: "control", sampleCount: 20, positiveRate: 0.68, avgAtmosphereScore: 4.0 },
        { arm: "treatment", sampleCount: 22, positiveRate: 0.57, avgAtmosphereScore: 3.7 },
      ],
      poolOverrideEnabled: null,
    });

    expect(decision.arm).toBe("control");
    expect(decision.applied).toBe(false);
    expect(decision.summary.autoDisabled).toBe(true);
    expect(decision.summary.autoDisabledReason).toMatch(/Auto-disabled/);
  });

  it("honors an explicit pool-level disable override", () => {
    const decision = planPredictiveRerank({
      poolId: "pool-override",
      groups: [
        makeGroup(["u1", "u2", "u3", "u4"], { overallScore: 82 }),
        makeGroup(["u5", "u6", "u7", "u8"], { overallScore: 80, avgChemistryScore: 95, diversityScore: 90 }),
      ],
      calibration: { sampleCount: 150, positiveRate: 0.7, avgAtmosphereScore: 4.1 },
      config: {
        predictiveRerankEnabled: true,
        predictiveRerankExposurePercent: 100,
        predictiveRerankMaxPositionShift: 2,
        predictiveRerankConfidenceThreshold: 70,
        predictiveRerankAutoDisableEnabled: false,
        predictiveRerankMinShadowExperiments: 1,
      },
      shadowPoolCount: 12,
      outcomeMetrics: [],
      poolOverrideEnabled: false,
    });

    expect(decision.arm).toBe("control");
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("pool_override_disabled");
  });
});
