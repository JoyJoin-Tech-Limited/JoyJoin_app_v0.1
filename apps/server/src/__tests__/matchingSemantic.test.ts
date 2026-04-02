import { describe, expect, it } from "vitest";

import {
  buildSemanticProfileCache,
  calculateSemanticSimilarityScore,
  calculateWeightedPairScore,
} from "../matchingSemantic";

describe("matchingSemantic", () => {
  const similarUsers = [
    {
      userId: "u1",
      archetype: "暖心熊",
      secondaryArchetype: "机智狐",
      workMode: "founder",
      educationLevel: "本科",
      industryNiche: "consumer-tech",
      hometown: "上海",
      preferredLanguages: ["zh-CN", "en"],
      eventIntent: ["networking"],
      userIntent: null,
      barThemes: null,
      alcoholComfort: null,
      eventType: "饭局",
    },
    {
      userId: "u2",
      archetype: "暖心熊",
      secondaryArchetype: "机智狐",
      workMode: "founder",
      educationLevel: "本科",
      industryNiche: "consumer-tech",
      hometown: "上海",
      preferredLanguages: ["zh-CN", "en"],
      eventIntent: ["networking"],
      userIntent: null,
      barThemes: null,
      alcoholComfort: null,
      eventType: "饭局",
    },
  ] as const;

  it("preserves the legacy 6D score when semantic scoring is disabled", () => {
    const score = calculateWeightedPairScore(
      {
        chemistry: 80,
        interest: 72,
        socialAffinity: 64,
        backgroundDiversity: 58,
        preference: 70,
        language: 100,
        semanticSimilarity: 99,
      },
      false,
    );

    expect(score).toBe(Math.round(80 * 0.28 + 72 * 0.28 + 64 * 0.2 + 58 * 0.15 + 70 * 0.05 + 100 * 0.04));
  });

  it("builds bounded semantic scores from cached semantic profiles", () => {
    const interests = new Map([
      ["u1", { topics: ["city-walks", "coffee"], heatMap: { "city-walks": 25, coffee: 10 } }],
      ["u2", { topics: ["city-walks", "coffee"], heatMap: { "city-walks": 25, coffee: 10 } }],
    ]);
    const cache = buildSemanticProfileCache([...similarUsers], interests);

    const score = calculateSemanticSimilarityScore(similarUsers[0], similarUsers[1], cache);

    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("falls back to neutral scores when semantic profiles are unavailable", () => {
    const score = calculateSemanticSimilarityScore(similarUsers[0], similarUsers[1]);
    expect(score).toBe(50);
  });
});
