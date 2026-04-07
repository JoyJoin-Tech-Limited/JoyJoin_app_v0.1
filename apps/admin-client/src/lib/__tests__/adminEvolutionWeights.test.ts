import { describe, expect, it } from "vitest";
import {
  getCurrentWeights,
  getRecommendationConfidence,
  getRecommendedWeights,
  getRecommendationReadiness,
  getSuccessfulMatchRate,
  getWeightHistorySeries,
} from "../adminEvolutionWeights";

describe("adminEvolutionWeights", () => {
  it("normalizes current and recommended weights into percentages", () => {
    const currentWeights = getCurrentWeights({
      chemistryWeight: "0.23",
      interestWeight: "0.24",
      socialAffinityWeight: "0.13",
      backgroundDiversityWeight: "0.15",
      preferenceWeight: "0.10",
      languageWeight: "0.15",
    });

    const recommendedWeights = getRecommendedWeights({
      chemistryAlpha: 9,
      chemistryBeta: 3,
      interestAlpha: 7,
      interestBeta: 5,
      socialAffinityAlpha: 4,
      socialAffinityBeta: 6,
      backgroundDiversityAlpha: 6,
      backgroundDiversityBeta: 4,
      preferenceAlpha: 3,
      preferenceBeta: 7,
      languageAlpha: 8,
      languageBeta: 2,
    });

    expect(currentWeights.chemistryWeight).toBe(23);
    expect(currentWeights.interestWeight).toBe(24);
    expect(Object.values(recommendedWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 0);
    expect(recommendedWeights.chemistryWeight).toBeGreaterThan(recommendedWeights.preferenceWeight);
    expect(recommendedWeights.languageWeight).toBeGreaterThan(recommendedWeights.socialAffinityWeight);
  });

  it("flags insufficient and ready sample states clearly", () => {
    expect(getRecommendationReadiness({ totalMatches: 18 })).toEqual({
      label: "样本不足",
      tone: "critical",
      description: "还需 32 个反馈样本才能进入首个稳定更新窗口。",
    });

    expect(getRecommendationReadiness({ totalMatches: 80 })).toEqual({
      label: "观察中",
      tone: "warning",
      description: "已有初步学习信号，建议结合更多反馈再决定是否采纳推荐权重。",
    });

    expect(getRecommendationReadiness({ totalMatches: 180 })).toEqual({
      label: "可采纳",
      tone: "positive",
      description: "反馈样本已具备参考价值，推荐权重可作为下一轮实验候选。",
    });
  });

  it("builds chronological history series and contextual metrics", () => {
    const historySeries = getWeightHistorySeries([
      {
        recordedAt: "2026-03-02T00:00:00.000Z",
        chemistryWeight: "0.20",
        interestWeight: "0.24",
        socialAffinityWeight: "0.14",
        backgroundDiversityWeight: "0.16",
        preferenceWeight: "0.11",
        languageWeight: "0.15",
        matchesSinceLastUpdate: 50,
      },
      {
        recordedAt: "2026-03-10T00:00:00.000Z",
        chemistryWeight: "0.22",
        interestWeight: "0.25",
        socialAffinityWeight: "0.12",
        backgroundDiversityWeight: "0.15",
        preferenceWeight: "0.10",
        languageWeight: "0.16",
        matchesSinceLastUpdate: 50,
      },
    ]);

    expect(historySeries).toHaveLength(2);
    expect(historySeries[0].recordedAt).toBe("2026-03-02T00:00:00.000Z");
    expect(historySeries[1].chemistryWeight).toBe(22);
    expect(historySeries[1].matchesSinceLastUpdate).toBe(50);
    expect(getSuccessfulMatchRate({ totalMatches: 40, successfulMatches: 30 })).toBe(75);
    expect(
      getRecommendationConfidence({
        totalMatches: 160,
        chemistryAlpha: 30,
        chemistryBeta: 10,
        interestAlpha: 25,
        interestBeta: 15,
        socialAffinityAlpha: 20,
        socialAffinityBeta: 20,
        backgroundDiversityAlpha: 18,
        backgroundDiversityBeta: 22,
        preferenceAlpha: 16,
        preferenceBeta: 24,
        languageAlpha: 28,
        languageBeta: 12,
      }),
    ).toBeGreaterThan(70);
  });
});
