import { describe, expect, it } from "vitest";

import { compatibilityMatrix, ALL_ARCHETYPES } from "../archetypeCompatibility";
import { getAllArchetypeIds, archetypeRegistry } from "../archetypeRegistry";
import {
  deriveChemistry,
  deriveChemistryRaw,
  calibrateDerivedChemistry,
  getDerivedArchetypeChemistry,
  traitSimilarity,
  traitComplementarity,
  DERIVED_CHEMISTRY_MATRIX,
  DERIVED_CHEMISTRY_CALIBRATION,
  DERIVED_COMPLEMENTARITY_TARGET_GAP,
  DERIVED_COMPLEMENTARITY_HALF_WIDTH,
} from "../derivedChemistry";
import type { TraitKey } from "../types";

const CANONICAL_ORDER: Array<string> = [
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
];

function vector(overrides: Partial<Record<TraitKey, number>> = {}): Record<TraitKey, number> {
  return { A: 50, C: 50, E: 50, O: 50, X: 50, P: 50, ...overrides };
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
function rank(x: number[]): number[] {
  const order = x.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(x.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}
const spearman = (x: number[], y: number[]) => pearson(rank(x), rank(y));

describe("derivedChemistry", () => {
  describe("formula components", () => {
    it("traitSimilarity is 1 for identical and 0 for opposite poles", () => {
      expect(traitSimilarity(vector({ A: 70 }), vector({ A: 70 }), "A")).toBe(1);
      expect(traitSimilarity(vector({ A: 0 }), vector({ A: 100 }), "A")).toBe(0);
    });

    it("traitComplementarity peaks at the target gap and is zero far from it", () => {
      const base = vector({ X: 50 });
      expect(traitComplementarity(base, vector({ X: 50 + DERIVED_COMPLEMENTARITY_TARGET_GAP }), "X")).toBe(1);
      expect(traitComplementarity(base, vector({ X: 50 }), "X")).toBeCloseTo(
        1 - DERIVED_COMPLEMENTARITY_TARGET_GAP / DERIVED_COMPLEMENTARITY_HALF_WIDTH,
        10,
      );
      expect(
        traitComplementarity(base, vector({ X: 50 + DERIVED_COMPLEMENTARITY_TARGET_GAP + DERIVED_COMPLEMENTARITY_HALF_WIDTH }), "X"),
      ).toBe(0);
    });

    it("deriveChemistryRaw blends 0.5 similarity + 0.5 complementarity", () => {
      // Identical vectors: similarity = 1, complementarity = bell(0) = 0.5.
      expect(deriveChemistryRaw(vector({ A: 80, E: 80, C: 80, X: 80, P: 80 }), vector({ A: 80, E: 80, C: 80, X: 80, P: 80 }))).toBeCloseTo(0.75, 10);
    });
  });

  describe("purity and determinism", () => {
    it("is deterministic and does not mutate its inputs", () => {
      const a = vector({ A: 60, C: 50, E: 60, O: 65, X: 95, P: 85 });
      const b = vector({ A: 90, C: 65, E: 80, O: 60, X: 48, P: 70 });
      const snapshotA = { ...a };
      const snapshotB = { ...b };
      const first = deriveChemistry(a, b);
      const second = deriveChemistry(a, b);
      expect(first).toBe(second);
      expect(a).toEqual(snapshotA);
      expect(b).toEqual(snapshotB);
    });

    it("is symmetric", () => {
      for (const x of ALL_ARCHETYPES) {
        for (const y of ALL_ARCHETYPES) {
          expect(getDerivedArchetypeChemistry(x, y)).toBe(getDerivedArchetypeChemistry(y, x));
        }
      }
    });
  });

  describe("matrix shape and scale", () => {
    it("covers all 144 ordered pairs with integer scores in [0,100]", () => {
      expect(Object.keys(DERIVED_CHEMISTRY_MATRIX)).toHaveLength(12);
      for (const x of ALL_ARCHETYPES) {
        expect(Object.keys(DERIVED_CHEMISTRY_MATRIX[x])).toHaveLength(12);
        for (const y of ALL_ARCHETYPES) {
          const score = DERIVED_CHEMISTRY_MATRIX[x][y];
          expect(Number.isInteger(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    });

    it("falls back to 50 for unknown archetype ids", () => {
      expect(getDerivedArchetypeChemistry("not_an_archetype", "corgi")).toBe(50);
    });

    it("calibrates the derived distribution to the authored first two moments", () => {
      // mean/sd derived at module load should be close to the authored target.
      const values = ALL_ARCHETYPES.flatMap((x) => ALL_ARCHETYPES.map((y) => DERIVED_CHEMISTRY_MATRIX[x][y]));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
      expect(DERIVED_CHEMISTRY_CALIBRATION.scale).toBeGreaterThan(0);
      expect(mean).toBeGreaterThan(78);
      expect(mean).toBeLessThan(82);
      expect(sd).toBeGreaterThan(5);
      expect(sd).toBeLessThan(9);
    });

    it("calibrateDerivedChemistry clamps into [0,100]", () => {
      expect(calibrateDerivedChemistry(-1)).toBe(0);
      expect(calibrateDerivedChemistry(2)).toBe(100);
    });
  });

  describe("roster-order invariant (AC-10.4)", () => {
    it("getAllArchetypeIds() is unchanged by importing the derived layer", () => {
      expect(getAllArchetypeIds()).toEqual(CANONICAL_ORDER);
      expect(ALL_ARCHETYPES).toEqual(CANONICAL_ORDER);
      expect(Object.keys(archetypeRegistry)).toEqual(CANONICAL_ORDER);
    });
  });

  describe("validation gate (AC-10.2)", () => {
    it("locks the measured Spearman rho and the < 0.7 gate outcome", () => {
      const pairs: Array<{ authored: number; derived: number }> = [];
      for (let i = 0; i < ALL_ARCHETYPES.length; i++) {
        for (let j = i; j < ALL_ARCHETYPES.length; j++) {
          pairs.push({
            authored: compatibilityMatrix[ALL_ARCHETYPES[i]][ALL_ARCHETYPES[j]],
            derived: getDerivedArchetypeChemistry(ALL_ARCHETYPES[i], ALL_ARCHETYPES[j]),
          });
        }
      }
      expect(pairs).toHaveLength(78);
      const rho = spearman(
        pairs.map((p) => p.authored),
        pairs.map((p) => p.derived),
      );

      // Documented in docs/reports/2026-09-10-derived-chemistry-validation.md.
      // The gate FAILED, so the flag ships dark; this test locks the finding so
      // an accidental formula change cannot silently rewrite the disposition
      // report. Re-validate (and update the report + contract) before changing.
      expect(rho).toBeCloseTo(0.57, 1);
      expect(rho).toBeLessThan(0.7);
    });
  });
});
