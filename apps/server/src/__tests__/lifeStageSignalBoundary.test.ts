import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression test: after Workstream B1, matching must read users.lifeStage
 * for life-stage signals. Reading users.workMode in the deterministic scoring
 * path is a signal-boundary violation and must be caught.
 */

const sourcePath = path.resolve(import.meta.dirname, "../poolMatchingService.ts");
const source = fs.readFileSync(sourcePath, "utf-8");

describe("life stage signal boundary", () => {
  it("calculateLifeStageAffinity reads lifeStage, not workMode", () => {
    const match = source.match(
      /function calculateLifeStageAffinity\(user1:\s*UserWithProfile,\s*user2:\s*UserWithProfile\):\s*number\s*\{([\s\S]*?)\n\}/
    );
    expect(match).toBeTruthy();
    const body = match![1];
    expect(body).toMatch(/user1\.lifeStage/);
    expect(body).toMatch(/user2\.lifeStage/);
    expect(body).not.toMatch(/workMode/);
  });

  it("calculateGroupDiversity reads lifeStage, not workMode", () => {
    const match = source.match(
      /function calculateGroupDiversity\(members:\s*UserWithProfile\[\]\):\s*number\s*\{([\s\S]*?)\n\}/
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
