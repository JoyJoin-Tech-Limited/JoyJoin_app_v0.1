import { describe, it, expect } from "vitest";
import {
  buildAdminInterestView,
  getInterestCategoryLabel,
  getInterestLevelLabel,
  INTEREST_HEAT_LEGEND,
} from "../adminInterestDisplay";
import type { UserInterests } from "../types";

/**
 * Fixture mirrors the production row that exposed the defect: 9 selections,
 * totalHeat 203, but only 8 of them are level 3 (so `topPriorities` held 8).
 */
function screenshotInterests(): UserInterests {
  return {
    totalSelections: 9,
    totalHeat: 203,
    categoryHeat: {
      food: 50,
      play: 53,
      sports: 25,
      culture: 25,
      life: 25,
      growth: 25,
    },
    selections: [
      { topicId: "food-explore", label: "探店", category: "美食小酌", categoryId: "food", level: 3, heat: 25 },
      { topicId: "food-private-kitchen", label: "私厨", category: "美食小酌", categoryId: "food", level: 3, heat: 25 },
      { topicId: "play-ktv", label: "KTV", category: "聚会玩乐", categoryId: "play", level: 3, heat: 25 },
      { topicId: "play-bar", label: "小酒馆", category: "聚会玩乐", categoryId: "play", level: 3, heat: 25 },
      { topicId: "play-boardgame", label: "桌游", category: "聚会玩乐", categoryId: "play", level: 1, heat: 3 },
      { topicId: "sports-climbing", label: "攀岩", category: "运动户外", categoryId: "sports", level: 3, heat: 25 },
      { topicId: "culture-movie", label: "电影", category: "文艺现场", categoryId: "culture", level: 3, heat: 25 },
      { topicId: "life-travel", label: "旅行", category: "生活美学", categoryId: "life", level: 3, heat: 25 },
      { topicId: "growth-podcast", label: "播客", category: "思想成长", categoryId: "growth", level: 3, heat: 25 },
    ],
    topPriorities: [
      { topicId: "food-explore", label: "探店", heat: 25 },
      { topicId: "food-private-kitchen", label: "私厨", heat: 25 },
      { topicId: "play-ktv", label: "KTV", heat: 25 },
      { topicId: "play-bar", label: "小酒馆", heat: 25 },
      { topicId: "sports-climbing", label: "攀岩", heat: 25 },
      { topicId: "culture-movie", label: "电影", heat: 25 },
      { topicId: "life-travel", label: "旅行", heat: 25 },
      { topicId: "growth-podcast", label: "播客", heat: 25 },
    ],
  };
}

describe("admin interest view", () => {
  it("renders every selection, not the level-3 topPriorities slice (9 vs 8 regression)", () => {
    const view = buildAdminInterestView(screenshotInterests());

    expect(view.totalSelections).toBe(9);
    expect(view.rows).toHaveLength(9);
    expect(view.rows.map((row) => row.label)).toContain("桌游");
  });

  it("keeps per-row heat summing to the stored totalHeat", () => {
    const view = buildAdminInterestView(screenshotInterests());

    expect(view.totalHeat).toBe(203);
    expect(view.rows.reduce((sum, row) => sum + row.heat, 0)).toBe(203);
  });

  it("labels each tier with the onboarding vocabulary", () => {
    const view = buildAdminInterestView(screenshotInterests());

    expect(view.rows.find((row) => row.topicId === "play-boardgame")).toMatchObject({
      level: 1,
      levelLabel: "感兴趣",
      heat: 3,
    });
    expect(view.rows.find((row) => row.topicId === "play-ktv")).toMatchObject({
      level: 3,
      levelLabel: "必聊项",
      heat: 25,
    });
    expect(getInterestLevelLabel(2)).toBe("很热衷");
    expect(getInterestLevelLabel(undefined)).toBe("感兴趣");
  });

  it("sorts rows by level, then canonical category order, then label", () => {
    const view = buildAdminInterestView(screenshotInterests());

    expect(view.rows.map((row) => row.label)).toEqual([
      "私厨",
      "探店",
      "小酒馆",
      "KTV",
      "攀岩",
      "电影",
      "旅行",
      "播客",
      "桌游",
    ]);
  });

  it("renders category heat with Chinese labels, counts, and heat-desc order", () => {
    const view = buildAdminInterestView(screenshotInterests());

    expect(view.categoryCount).toBe(6);
    expect(view.categories[0]).toMatchObject({
      categoryId: "play",
      label: "聚会玩乐",
      selectionCount: 3,
      heat: 53,
      strengthPercent: 100,
    });
    expect(view.categories[1]).toMatchObject({ categoryId: "food", label: "美食小酌", heat: 50 });
    expect(view.categories.map((category) => category.label)).toEqual([
      "聚会玩乐",
      "美食小酌",
      "运动户外",
      "文艺现场",
      "生活美学",
      "思想成长",
    ]);
  });

  it("normalises bars to the strongest category, never to the total", () => {
    const view = buildAdminInterestView(screenshotInterests());

    expect(view.categories.find((c) => c.categoryId === "food")?.strengthPercent).toBe(94);
    expect(view.categories.find((c) => c.categoryId === "sports")?.strengthPercent).toBe(47);
  });

  it("drops zero-heat categories instead of rendering empty rows", () => {
    const view = buildAdminInterestView({
      categoryHeat: { food: 25, play: 0 },
      selections: [
        { topicId: "food-explore", label: "探店", category: "美食小酌", categoryId: "food", level: 3, heat: 25 },
      ],
    });

    expect(view.categories.map((c) => c.categoryId)).toEqual(["food"]);
  });

  it("recovers the macro category for legacy rows that only stored the Chinese label", () => {
    const view = buildAdminInterestView({
      selections: [
        { topicId: "play-ktv", label: "KTV", category: "聚会玩乐", level: 2, heat: 10 },
      ],
    });

    expect(view.rows[0]).toMatchObject({ categoryId: "play", categoryLabel: "聚会玩乐" });
    expect(view.categories[0]).toMatchObject({ categoryId: "play", heat: 10 });
  });

  it("falls back to derived heat when a stored heat is missing", () => {
    const view = buildAdminInterestView({
      selections: [
        { topicId: "play-ktv", label: "KTV", category: "聚会玩乐", categoryId: "play", level: 2, heat: Number.NaN },
      ],
    });

    expect(view.rows[0].heat).toBe(10);
    expect(view.totalHeat).toBe(10);
  });

  it("renders unknown category ids verbatim rather than crashing", () => {
    const view = buildAdminInterestView({
      selections: [
        { topicId: "legacy-x", label: "旧兴趣", category: "旧分类", categoryId: "legacy", level: 1, heat: 3 },
      ],
    });

    expect(view.rows[0].categoryLabel).toBe("旧分类");
    expect(getInterestCategoryLabel("legacy")).toBe("legacy");
  });

  it("handles a missing row", () => {
    const view = buildAdminInterestView(null);

    expect(view).toMatchObject({ totalSelections: 0, totalHeat: 0, categoryCount: 0 });
    expect(view.rows).toEqual([]);
    expect(view.categories).toEqual([]);
  });

  it("states the 3 / 10 / 25 scale in the legend", () => {
    expect(INTEREST_HEAT_LEGEND).toContain("3 / 10 / 25");
    expect(INTEREST_HEAT_LEGEND).toContain("感兴趣 / 很热衷 / 必聊项");
    expect(INTEREST_HEAT_LEGEND).toContain("必聊项优先排同好");
  });
});
