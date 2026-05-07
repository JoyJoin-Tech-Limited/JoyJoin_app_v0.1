import { describe, it, expect } from "vitest";
import {
  getArchetypeWaitingCopy,
  GENERIC_ARCHETYPE_WAITING_COPY,
} from "../archetypeWaitingCopy";

describe("getArchetypeWaitingCopy", () => {
  it("returns generic copy for null archetype", () => {
    expect(getArchetypeWaitingCopy(null)).toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns generic copy for undefined archetype", () => {
    expect(getArchetypeWaitingCopy(undefined)).toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns generic copy for unknown archetype", () => {
    expect(getArchetypeWaitingCopy("未知角色")).toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns high_energy copy for corgi", () => {
    const copy = getArchetypeWaitingCopy("corgi");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("能量");
  });

  it("returns high_energy copy for rooster", () => {
    const copy = getArchetypeWaitingCopy("rooster");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns high_energy copy for hamster_praise", () => {
    const copy = getArchetypeWaitingCopy("hamster_praise");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
  });

  it("returns connector copy for fox", () => {
    const copy = getArchetypeWaitingCopy("fox");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("魅力");
  });

  it("returns warmth copy for koala", () => {
    const copy = getArchetypeWaitingCopy("koala");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("温暖");
  });

  it("returns steady copy for owl", () => {
    const copy = getArchetypeWaitingCopy("owl");
    expect(copy).not.toBe(GENERIC_ARCHETYPE_WAITING_COPY);
    expect(copy.headline).toContain("就位");
  });

  it("all known archetypes return non-generic copy", () => {
    const knownArchetypes = [
      "corgi", "rooster", "hamster_praise",
      "fox", "dolphin_calm", "spider",
      "koala", "octopus",
      "owl", "elephant", "turtle", "cat",
    ];
    for (const archetype of knownArchetypes) {
      expect(getArchetypeWaitingCopy(archetype)).not.toBe(
        GENERIC_ARCHETYPE_WAITING_COPY,
      );
    }
  });

  it("each cluster returns a copy object with required fields", () => {
    const samples = ["corgi", "fox", "koala", "turtle"];
    for (const archetype of samples) {
      const copy = getArchetypeWaitingCopy(archetype);
      expect(typeof copy.headline).toBe("string");
      expect(typeof copy.subtext).toBe("string");
      expect(typeof copy.badgeGradient).toBe("string");
    }
  });
});
