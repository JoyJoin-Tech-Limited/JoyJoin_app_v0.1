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
      personalityWeight: "0.23",
      interestsWeight: "0.24",
      intentWeight: "0.13",
      backgroundWeight: "0.15",
      cultureWeight: "0.10",
      conversationSignatureWeight: "0.15",
    });

    const recommendedWeights = getRecommendedWeights({
      personalityAlpha: 9,
      personalityBeta: 3,
      interestsAlpha: 7,
      interestsBeta: 5,
      intentAlpha: 4,
      intentBeta: 6,
      backgroundAlpha: 6,
      backgroundBeta: 4,
      cultureAlpha: 3,
      cultureBeta: 7,
      conversationSignatureAlpha: 8,
      conversationSignatureBeta: 2,
    });

    expect(currentWeights.personalityWeight).toBe(23);
    expect(currentWeights.interestsWeight).toBe(24);
    expect(Object.values(recommendedWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 0);
    expect(recommendedWeights.personalityWeight).toBeGreaterThan(recommendedWeights.cultureWeight);
    expect(recommendedWeights.conversationSignatureWeight).toBeGreaterThan(recommendedWeights.intentWeight);
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
        personalityWeight: "0.20",
        interestsWeight: "0.24",
        intentWeight: "0.14",
        backgroundWeight: "0.16",
        cultureWeight: "0.11",
        conversationSignatureWeight: "0.15",
        matchesSinceLastUpdate: 50,
      },
      {
        recordedAt: "2026-03-10T00:00:00.000Z",
        personalityWeight: "0.22",
        interestsWeight: "0.25",
        intentWeight: "0.12",
        backgroundWeight: "0.15",
        cultureWeight: "0.10",
        conversationSignatureWeight: "0.16",
        matchesSinceLastUpdate: 50,
      },
    ]);

    expect(historySeries).toHaveLength(2);
    expect(historySeries[0].recordedAt).toBe("2026-03-02T00:00:00.000Z");
    expect(historySeries[1].personalityWeight).toBe(22);
    expect(historySeries[1].matchesSinceLastUpdate).toBe(50);
    expect(getSuccessfulMatchRate({ totalMatches: 40, successfulMatches: 30 })).toBe(75);
    expect(
      getRecommendationConfidence({
        totalMatches: 160,
        personalityAlpha: 30,
        personalityBeta: 10,
        interestsAlpha: 25,
        interestsBeta: 15,
        intentAlpha: 20,
        intentBeta: 20,
        backgroundAlpha: 18,
        backgroundBeta: 22,
        cultureAlpha: 16,
        cultureBeta: 24,
        conversationSignatureAlpha: 28,
        conversationSignatureBeta: 12,
      }),
    ).toBeGreaterThan(70);
  });
});
