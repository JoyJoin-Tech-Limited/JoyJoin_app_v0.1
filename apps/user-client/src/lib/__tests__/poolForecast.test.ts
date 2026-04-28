import { describe, expect, it } from "vitest";
import {
  getPoolPhase,
  getPoolForecast,
  avgArchetypeEnergy,
  type ForecastPhase,
} from "../poolForecast";

// ── Phase classification ──────────────────────────────────────────────────────

describe("getPoolPhase", () => {
  it("returns spark when pool is empty", () => {
    expect(getPoolPhase(0, 4)).toBe("spark");
  });

  it("returns spark for a single person in a pool of 4", () => {
    expect(getPoolPhase(1, 4)).toBe("spark");
  });

  it("returns building at 2 people", () => {
    expect(getPoolPhase(2, 4)).toBe("building");
  });

  it("returns building at 2 people for a threshold of 5", () => {
    expect(getPoolPhase(2, 5)).toBe("building");
  });

  it("returns momentum at 60 % threshold (ceil)", () => {
    // minGroupSize=4 → 60% = 2.4 → ceil = 3 → 3 is momentum
    expect(getPoolPhase(3, 4)).toBe("momentum");
  });

  it("returns ready exactly at the threshold", () => {
    expect(getPoolPhase(4, 4)).toBe("ready");
  });

  it("returns ready above the threshold", () => {
    expect(getPoolPhase(7, 4)).toBe("ready");
  });

  it("handles a larger minGroupSize of 6", () => {
    // 60% of 6 = 3.6 → ceil = 4 → 4 is momentum
    expect(getPoolPhase(0, 6)).toBe("spark");
    expect(getPoolPhase(2, 6)).toBe("building");
    expect(getPoolPhase(4, 6)).toBe("momentum");
    expect(getPoolPhase(6, 6)).toBe("ready");
  });
});

// ── Archetype energy helper ───────────────────────────────────────────────────

describe("avgArchetypeEnergy", () => {
  it("returns null for an empty array", () => {
    expect(avgArchetypeEnergy([])).toBeNull();
  });

  it("returns the energyLevel for a single known archetype", () => {
    // corgi has energyLevel 95 per archetypes.ts
    const result = avgArchetypeEnergy(["corgi"]);
    expect(result).toBe(95);
  });

  it("falls back to 65 for unknown archetypes", () => {
    expect(avgArchetypeEnergy(["未知原型"])).toBe(65);
  });

  it("averages two archetypes correctly", () => {
    // corgi=95, cat=30 → avg = 62.5
    const result = avgArchetypeEnergy(["corgi", "cat"]);
    expect(result).toBeCloseTo(62.5);
  });
});

// ── getPoolForecast — result shape ────────────────────────────────────────────

describe("getPoolForecast — result shape", () => {
  it("always returns at least one non-empty line", () => {
    const result = getPoolForecast({ registrationCount: 0, sampleArchetypes: [] });
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
    expect(result.lines[0].length).toBeGreaterThan(0);
  });

  it("returns no more than 3 lines", () => {
    const result = getPoolForecast({
      registrationCount: 3,
      sampleArchetypes: ["corgi", "koala", "fox", "elephant"],
      eventType: "酒局",
    });
    expect(result.lines.length).toBeLessThanOrEqual(3);
  });

  it("returns the correct phase alongside the lines", () => {
    expect(getPoolForecast({ registrationCount: 0, sampleArchetypes: [] }).phase).toBe<ForecastPhase>("spark");
    expect(getPoolForecast({ registrationCount: 2, sampleArchetypes: [] }).phase).toBe<ForecastPhase>("building");
    expect(getPoolForecast({ registrationCount: 3, sampleArchetypes: [] }).phase).toBe<ForecastPhase>("momentum");
    expect(getPoolForecast({ registrationCount: 4, sampleArchetypes: [] }).phase).toBe<ForecastPhase>("ready");
  });
});

// ── getPoolForecast — momentum bridge line ────────────────────────────────────

describe("getPoolForecast — momentum bridge line", () => {
  it("keeps the momentum vibe line as primary copy", () => {
    const result = getPoolForecast({ registrationCount: 3, sampleArchetypes: [], minGroupSize: 4 });
    expect(result.phase).toBe("momentum");
    expect(result.lines[0]).toContain("这池");
  });

  it("adds seatsNeeded as a secondary bridge line for momentum phase", () => {
    // count=3, minGroupSize=4 → seatsNeeded=1
    const result = getPoolForecast({ registrationCount: 3, sampleArchetypes: [], minGroupSize: 4 });
    expect(result.phase).toBe("momentum");
    expect(result.lines[1]).toContain("1 位");
    expect(result.lines[1]).toContain("成桌匹配");
  });

  it("adjusts seatsNeeded for larger minGroupSize", () => {
    // count=4, minGroupSize=6 → seatsNeeded=2
    const result = getPoolForecast({ registrationCount: 4, sampleArchetypes: [], minGroupSize: 6 });
    expect(result.phase).toBe("momentum");
    expect(result.lines[1]).toContain("2 位");
  });
});

// ── getPoolForecast — archetype diversity supplement ──────────────────────────

describe("getPoolForecast — archetype supplement", () => {
  it("adds a diversity line for 3 unique archetypes", () => {
    const result = getPoolForecast({
      registrationCount: 2,
      sampleArchetypes: ["corgi", "koala", "fox"],
    });
    // Second line should reference diversity
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.lines[1]).toContain("路数");
  });

  it("adds a high-diversity line for 4+ unique archetypes", () => {
    const result = getPoolForecast({
      registrationCount: 2,
      sampleArchetypes: ["corgi", "koala", "fox", "elephant"],
    });
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.lines[1]).toContain("性格");
  });

  it("adds an energy supplement when archetypes exist but diversity is low", () => {
    // Two of the same high-energy archetype: avg energy 95 → high energy line
    const result = getPoolForecast({
      registrationCount: 1,
      sampleArchetypes: ["corgi", "corgi"],
    });
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    // High energy → should mention energy
    expect(result.lines[1]).toContain("能量");
  });

  it("does not add an energy supplement when no archetypes given", () => {
    const result = getPoolForecast({ registrationCount: 1, sampleArchetypes: [] });
    // With no archetypes and non-酒局 type, only 1 line expected
    expect(result.lines).toHaveLength(1);
  });
});

// ── getPoolForecast — eventType 酒局 flavour ──────────────────────────────────

describe("getPoolForecast — 酒局 flavour", () => {
  it("adds a 酒局 flavour line when eventType is 酒局 and phase is not ready", () => {
    const result = getPoolForecast({
      registrationCount: 1,
      sampleArchetypes: [],
      eventType: "酒局",
    });
    const allText = result.lines.join(" ");
    expect(allText).toContain("酒局");
  });

  it("does not add 酒局 flavour when phase is ready", () => {
    const result = getPoolForecast({
      registrationCount: 4,
      sampleArchetypes: [],
      eventType: "酒局",
      minGroupSize: 4,
    });
    expect(result.phase).toBe("ready");
    // ready phase never gets the 酒局 flavour line
    const allText = result.lines.join(" ");
    expect(allText).not.toContain("酒局场子");
  });

  it("does not add 酒局 flavour for 饭局 type", () => {
    const result = getPoolForecast({
      registrationCount: 1,
      sampleArchetypes: [],
      eventType: "饭局",
    });
    const allText = result.lines.join(" ");
    expect(allText).not.toContain("酒局");
  });
});

// ── getPoolForecast — determinism ─────────────────────────────────────────────

describe("getPoolForecast — determinism", () => {
  it("returns identical results for identical inputs", () => {
    const inputA = { registrationCount: 3, sampleArchetypes: ["corgi"], minGroupSize: 4 };
    const inputB = { registrationCount: 3, sampleArchetypes: ["corgi"], minGroupSize: 4 };
    expect(getPoolForecast(inputA)).toEqual(getPoolForecast(inputB));
  });

  it("uses different primary lines for different registrationCount values in the same phase", () => {
    // building phase: count=2 and count=3 (before momentum) both land in building with minGroupSize=6
    const r2 = getPoolForecast({ registrationCount: 2, sampleArchetypes: [], minGroupSize: 6 });
    const r3 = getPoolForecast({ registrationCount: 3, sampleArchetypes: [], minGroupSize: 6 });
    // Both are in the building phase
    expect(r2.phase).toBe("building");
    expect(r3.phase).toBe("building");
    // They should select different lines from the bucket (bucket size is 3, 2%3=2, 3%3=0 → different)
    expect(r2.lines[0]).not.toBe(r3.lines[0]);
  });
});

// ── Pool vs 成桌 language guard ───────────────────────────────────────────────

describe("getPoolForecast — pool language safety", () => {
  const scenarios: Array<{ registrationCount: number; sampleArchetypes: string[]; eventType?: "饭局" | "酒局"; minGroupSize?: number }> = [
    { registrationCount: 0, sampleArchetypes: [] },
    { registrationCount: 1, sampleArchetypes: ["corgi"], eventType: "饭局" },
    { registrationCount: 2, sampleArchetypes: ["koala", "fox"] },
    { registrationCount: 3, sampleArchetypes: [], minGroupSize: 4 },
    { registrationCount: 5, sampleArchetypes: ["rooster", "dolphin_calm", "spider", "octopus"], eventType: "酒局" },
  ];

  it.each(scenarios)(
    "no output line implies formed table or promises exact match — count=$registrationCount",
    (scenario) => {
      const { lines } = getPoolForecast(scenario);
      for (const line of lines) {
        // Must not imply a confirmed table member roster
        expect(line).not.toMatch(/桌友已入座/);
        expect(line).not.toMatch(/这一桌已满/);
        expect(line).not.toMatch(/成桌成功/);
      }
    },
  );
});
