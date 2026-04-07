import { describe, expect, it } from "vitest";
import {
  findCommonInterests,
  buildArchetypeChemistryLabel,
  generateChemistryPayoff,
  pickHeadline,
} from "../chemistryPayoff";

describe("chemistryPayoff", () => {
  describe("pickHeadline", () => {
    it("returns a non-empty string for any group size", () => {
      for (let size = 1; size <= 8; size++) {
        expect(pickHeadline(size)).toBeTruthy();
      }
    });

    it("returns stable output for the same group size", () => {
      expect(pickHeadline(4)).toBe(pickHeadline(4));
    });

    it("cycles through different headlines for different sizes", () => {
      const headlines = new Set([1, 2, 3, 4, 5].map(pickHeadline));
      // At least 2 distinct headlines across sizes 1–5
      expect(headlines.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("findCommonInterests", () => {
    it("returns an empty array when no members have interests", () => {
      expect(findCommonInterests([{}, {}])).toEqual([]);
    });

    it("returns empty when only one member shares an interest", () => {
      const members = [
        { topInterests: ["travel_exploration"] },
        { topInterests: [] },
      ];
      expect(findCommonInterests(members)).toEqual([]);
    });

    it("returns localised label for a shared interest", () => {
      const members = [
        { topInterests: ["travel_exploration"] },
        { topInterests: ["travel_exploration"] },
      ];
      expect(findCommonInterests(members)).toContain("旅行");
    });

    it("includes the current user's interests in the count", () => {
      const members = [{ topInterests: ["music_concerts"] }];
      const currentUser = { interests: ["music_concerts"] };
      expect(findCommonInterests(members, currentUser)).toContain("音乐");
    });

    it("returns at most 3 results", () => {
      const interests = ["travel_exploration", "music_concerts", "food_dining", "gaming"];
      const members = [
        { topInterests: interests },
        { topInterests: interests },
        { topInterests: interests },
      ];
      expect(findCommonInterests(members).length).toBeLessThanOrEqual(3);
    });

    it("does not double-count the same interest within one member", () => {
      const members = [
        { topInterests: ["travel_exploration"], primaryInterests: ["travel_exploration"] },
        { topInterests: [] },
      ];
      expect(findCommonInterests(members)).toEqual([]);
    });

    it("breaks equal-count ties deterministically by key", () => {
      const members = [
        { topInterests: ["travel_exploration", "music_concerts"] },
        { topInterests: ["travel_exploration", "music_concerts"] },
      ];
      expect(findCommonInterests(members)).toEqual(["音乐", "旅行"]);
    });

    it("falls back gracefully for unknown interest keys", () => {
      const members = [
        { topInterests: ["unknown_interest_key"] },
        { topInterests: ["unknown_interest_key"] },
      ];
      const result = findCommonInterests(members);
      expect(result).toContain("unknown_interest_key");
    });
  });

  describe("buildArchetypeChemistryLabel", () => {
    it("returns null for an empty archetype list", () => {
      expect(buildArchetypeChemistryLabel([])).toBeNull();
    });

    it("returns null for unknown archetypes", () => {
      expect(buildArchetypeChemistryLabel(["不存在的原型"])).toBeNull();
    });

    it("builds a label for known archetypes", () => {
      const label = buildArchetypeChemistryLabel(["开心柯基", "沉思猫头鹰"]);
      expect(label).toBe("活力 × 深度");
    });

    it("deduplicates the same energy from multiple archetypes", () => {
      // Repeating the same archetype should not duplicate its energy label in the result.
      const label = buildArchetypeChemistryLabel(["开心柯基", "开心柯基", "暖心熊"]);
      expect(label).toBe("活力 × 温暖");
    });

    it("limits to 3 energies even with more archetypes", () => {
      const label = buildArchetypeChemistryLabel([
        "开心柯基",
        "机智狐",
        "暖心熊",
        "织网蛛",
        "夸夸豚",
      ]);
      // At most 3 segments separated by " × "
      const parts = label!.split(" × ");
      expect(parts.length).toBeLessThanOrEqual(3);
    });
  });

  describe("generateChemistryPayoff", () => {
    it("returns a valid payoff object with required fields", () => {
      const result = generateChemistryPayoff([
        { archetype: "开心柯基", topInterests: ["travel_exploration"] },
        { archetype: "暖心熊", topInterests: ["travel_exploration"] },
      ]);
      expect(result.headline).toBeTruthy();
      expect(result.chemistryLine).toBeTruthy();
      expect(Array.isArray(result.tags)).toBe(true);
    });

    it("prefers interest-based chemistry line when shared interests exist", () => {
      const result = generateChemistryPayoff([
        { topInterests: ["music_concerts"] },
        { topInterests: ["music_concerts"] },
      ]);
      expect(result.chemistryLine).toContain("音乐");
      expect(result.tags).toContain("音乐");
    });

    it("includes current user interests in interest matching", () => {
      const result = generateChemistryPayoff(
        [{ topInterests: ["food_dining"] }],
        { interests: ["food_dining"] },
      );
      expect(result.chemistryLine).toContain("美食");
    });

    it("falls back to archetype energy when no shared interests", () => {
      const result = generateChemistryPayoff([
        { archetype: "沉思猫头鹰", topInterests: [] },
        { archetype: "开心柯基", topInterests: [] },
      ]);
      expect(result.chemistryLine).toBeTruthy();
    });

    it("returns a fallback when neither interests nor archetypes are available", () => {
      const result = generateChemistryPayoff([{}, {}]);
      expect(result.headline).toBeTruthy();
      expect(result.chemistryLine).toBeTruthy();
      expect(result.tags).toEqual([]);
    });

    it("is deterministic for the same group composition", () => {
      const members = [
        { archetype: "机智狐", topInterests: ["travel_exploration"] },
        { archetype: "淡定海豚", topInterests: ["travel_exploration"] },
      ];
      const a = generateChemistryPayoff(members);
      const b = generateChemistryPayoff(members);
      expect(a).toEqual(b);
    });

    it("handles groups of different sizes (3–6 members)", () => {
      const base = { archetype: "开心柯基", topInterests: [] };
      for (let size = 3; size <= 6; size++) {
        const result = generateChemistryPayoff(Array(size).fill(base));
        expect(result.headline).toBeTruthy();
        expect(result.chemistryLine).toBeTruthy();
      }
    });
  });
});
