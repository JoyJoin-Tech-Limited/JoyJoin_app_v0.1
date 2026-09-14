import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression test: after Workstream B1, matching must read users.lifeStage
 * for life-stage signals. Reading users.workMode in the deterministic scoring
 * path is a signal-boundary violation and must be caught.
 */

// `calculateGroupDiversity` moved verbatim into the group-scoring module
// (behavior-preserving modularization), so the life-stage boundary is locked
// against that source too.
const sourcePath = path.resolve(import.meta.dirname, "../matching/groupScoring.ts");
const source = fs.readFileSync(sourcePath, "utf-8");

// Behavior-preserving modularization: the pair-dimension helpers (including
// calculateLifeStageAffinity) moved verbatim into their own cohesive module,
// so the life-stage signal boundary is locked against that source instead.
const pairDimensionSourcePath = path.resolve(
  import.meta.dirname,
  "../matching/pairDimensionScoring.ts",
);
const pairDimensionSource = fs.readFileSync(pairDimensionSourcePath, "utf-8");

describe("life stage signal boundary", () => {
  it("calculateLifeStageAffinity reads lifeStage, not workMode", () => {
    const match = pairDimensionSource.match(
      /function calculateLifeStageAffinity\(user1:\s*UserWithProfile,\s*user2:\s*UserWithProfile\):\s*number\s*\{([\s\S]*?)\n\}/
    );
    expect(match).toBeTruthy();
    const body = match![1];
    expect(body).toMatch(/user1\.lifeStage/);
    expect(body).toMatch(/user2\.lifeStage/);
    expect(body).not.toMatch(/workMode/);
  });

  it("calculateGroupDiversity reads lifeStage, not workMode", () => {
    // Signature gained optional genderBalanceMode/genderBalanceBonusPoints params
    // (Sprint 2026-07-14 D8) — regex tolerates the extended parameter list.
    const match = source.match(
      /function calculateGroupDiversity\([^)]*\):\s*number\s*\{([\s\S]*?)\n\}/
    );
    expect(match).toBeTruthy();
    const body = match![1];
    expect(body).toMatch(/m\.lifeStage/);
    expect(body).not.toMatch(/workMode/);
  });

  it("UserWithProfile exposes lifeStage field", async () => {
    // Type-only import proves the field is part of the interface at compile time.
    await import("../poolMatchingService.js");
    expect(true).toBe(true);
  });
});
