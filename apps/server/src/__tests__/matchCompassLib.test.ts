import { describe, expect, it } from "vitest";
import {
  buildDefaultPreferencesFromArchetype,
  coerceStrictness,
  resolveTemperatureBand,
} from "../lib/matchCompass";

describe("buildDefaultPreferencesFromArchetype", () => {
  it("returns neutral defaults for unknown archetype", () => {
    const dna = buildDefaultPreferencesFromArchetype("unknown");
    expect(dna.strictness).toBe(50);
    expect(dna.acceptPairs).toBe(true);
    expect(dna.genderComposition).toBeNull();
  });

  it("returns expected defaults for all 12 archetypes", () => {
    const archetypes = [
      "corgi",
      "rooster",
      "hamster_praise",
      "fox",
      "dolphin_calm",
      "spider",
      "koala",
      "octopus",
      "owl",
      "elephant",
      "turtle",
      "cat",
    ] as const;

    for (const archetype of archetypes) {
      const dna = buildDefaultPreferencesFromArchetype(archetype);
      expect(dna.strictness).toBeGreaterThanOrEqual(0);
      expect(dna.strictness).toBeLessThanOrEqual(100);
      expect(typeof dna.acceptPairs).toBe("boolean");
    }
  });

  it("owl has stricter defaults", () => {
    const dna = buildDefaultPreferencesFromArchetype("owl");
    expect(dna.strictness).toBe(65);
    expect(dna.acceptPairs).toBe(false);
  });

  it("spider has more relaxed defaults", () => {
    const dna = buildDefaultPreferencesFromArchetype("spider");
    expect(dna.strictness).toBe(35);
    expect(dna.acceptPairs).toBe(true);
  });
});

describe("coerceStrictness", () => {
  it("returns 50 for null", () => {
    expect(coerceStrictness(null)).toBe(50);
  });
  it("returns 50 for undefined", () => {
    expect(coerceStrictness(undefined)).toBe(50);
  });
  it("returns the value for valid numbers", () => {
    expect(coerceStrictness(0)).toBe(0);
    expect(coerceStrictness(100)).toBe(100);
    expect(coerceStrictness(75)).toBe(75);
  });
});

describe("resolveTemperatureBand", () => {
  it("cold below 55", () => {
    expect(resolveTemperatureBand(30).level).toBe("cold");
  });
  it("mild at 55-69", () => {
    expect(resolveTemperatureBand(60).level).toBe("mild");
  });
  it("warm at 70-84", () => {
    expect(resolveTemperatureBand(75).level).toBe("warm");
  });
  it("fire at 85+", () => {
    expect(resolveTemperatureBand(90).level).toBe("fire");
  });
});
