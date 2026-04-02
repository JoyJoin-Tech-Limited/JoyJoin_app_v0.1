import { describe, expect, it } from "vitest";
import {
  deriveChemistryFromArchetypes,
  deriveChemistryFromScore,
  deriveConnectionCues,
  getFitHintFromArchetypes,
} from "../poolVibeUtils";

describe("poolVibeUtils", () => {
  describe("deriveChemistryFromScore", () => {
    it("treats zero-or-missing score as no chemistry data yet", () => {
      expect(deriveChemistryFromScore(0)).toBeNull();
      expect(deriveChemistryFromScore(null)).toBeNull();
      expect(deriveChemistryFromScore(undefined)).toBeNull();
    });

    it("maps threshold boundaries to the expected chemistry band", () => {
      expect(deriveChemistryFromScore(54)).toBe("cold");
      expect(deriveChemistryFromScore(55)).toBe("mild");
      expect(deriveChemistryFromScore(69)).toBe("mild");
      expect(deriveChemistryFromScore(70)).toBe("warm");
      expect(deriveChemistryFromScore(84)).toBe("warm");
      expect(deriveChemistryFromScore(85)).toBe("fire");
    });
  });

  describe("deriveChemistryFromArchetypes", () => {
    it("falls back to warm when no archetypes are present", () => {
      expect(deriveChemistryFromArchetypes([])).toBe("warm");
    });

    it("treats unknown archetypes as neutral energy", () => {
      expect(deriveChemistryFromArchetypes(["不存在的原型"])).toBe("warm");
    });
  });

  describe("getFitHintFromArchetypes", () => {
    it("returns null gracefully when there is no archetype data", () => {
      expect(getFitHintFromArchetypes([], "饭局")).toBeNull();
      expect(getFitHintFromArchetypes([], "饭局", true)).toBeNull();
    });

    it("still supports girls-night flavor when archetype data exists", () => {
      expect(getFitHintFromArchetypes(["暖心熊"], "饭局", true)).toEqual({
        icon: "💫",
        text: "Girl Gang 专属",
      });
    });
  });

  describe("deriveConnectionCues", () => {
    it("guarantees at least two cues when pool signals exist", () => {
      const cues = deriveConnectionCues({ 暖心熊: 1 }, 0, 1);

      expect(cues).toHaveLength(2);
      expect(cues).toEqual([
        { icon: "🌱", text: "亲密小圈" },
        { icon: "🪄", text: "风格渐成形" },
      ]);
    });

    it("preserves richer cues when chemistry and diversity signals are present", () => {
      const cues = deriveConnectionCues(
        { 开心柯基: 2, 暖心熊: 1, 定心大象: 1, 织网蛛: 1 },
        82,
        5,
      );

      expect(cues).toEqual([
        { icon: "🎯", text: "适配度高" },
        { icon: "✨", text: "性格互补" },
        { icon: "🌍", text: "能量互补" },
        { icon: "💫", text: "聊感活跃" },
      ]);
    });
  });
});
