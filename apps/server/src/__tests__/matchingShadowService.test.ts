import { describe, expect, it } from "vitest";
import { buildMatchingShadowExperiment } from "../matchingShadowService";
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
    archetype: "koala",
    secondaryArchetype: "koala",
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
    ageMatchPreference: null,
    tableVibePreference: null,
    vibeVector: null,
  };
}

function makeGroup(overrides: Partial<MatchGroup> = {}): MatchGroup {
  return {
    members: [makeUser("u1"), makeUser("u2"), makeUser("u3"), makeUser("u4")],
    avgPairScore: 80,
    avgChemistryScore: 84,
    diversityScore: 72,
    communicationBalance: 68,
    overallScore: 79,
    temperatureLevel: "warm",
    explanation: "test",
    ...overrides,
  };
}

describe("matchingShadowService", () => {
  it("builds deterministic and predicted rankings without mutating live matching data", () => {
    const experiment = buildMatchingShadowExperiment(
      [
        makeGroup({ overallScore: 82, avgChemistryScore: 88, diversityScore: 66, communicationBalance: 60 }),
        makeGroup({ overallScore: 78, avgChemistryScore: 79, diversityScore: 84, communicationBalance: 80 }),
      ],
      {
        sampleCount: 24,
        positiveRate: 0.625,
        avgAtmosphereScore: 4.2,
      },
    );

    expect(experiment.mode).toBe("batch");
    expect(experiment.summary.liveRankingProtected).toBe(true);
    expect(experiment.results).toHaveLength(2);
    expect(experiment.results[0].deterministicRank).toBe(1);
    expect(experiment.results[1].deterministicRank).toBe(2);
    expect(experiment.results.every((result) => result.predictedRank >= 1)).toBe(true);
    expect(experiment.results.every((result) => result.confidence >= 0.25)).toBe(true);
  });

  it("falls back to a conservative confidence band when no outcome data exists", () => {
    const experiment = buildMatchingShadowExperiment(
      [makeGroup({ overallScore: 75 })],
      {
        sampleCount: 0,
        positiveRate: 0,
        avgAtmosphereScore: null,
      },
    );

    expect(experiment.summary.outcomeValidation.sampleCount).toBe(0);
    expect(experiment.results[0].confidence).toBeGreaterThanOrEqual(0.25);
    expect(experiment.results[0].confidence).toBeLessThanOrEqual(0.95);
    expect(experiment.results[0].predictedScore).toBeGreaterThan(0);
  });
});
