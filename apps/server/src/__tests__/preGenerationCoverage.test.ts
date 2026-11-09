import { describe, expect, it } from "vitest";

import {
  PRE_GENERATION_MIN_SAMPLE,
  computePreGenerationCoverage,
  type PreGenerationCoverageInput,
} from "../lib/preGenerationCoverage";

const T0 = new Date("2026-11-01T12:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

function baseInput(overrides: Partial<PreGenerationCoverageInput> = {}): PreGenerationCoverageInput {
  return {
    phaseUses: [],
    results: [],
    jobs: [],
    sessionCount: 1,
    windowDays: 30,
    ...overrides,
  };
}

describe("computePreGenerationCoverage", () => {
  it("returns INSUFFICIENT_DATA with null rates on an empty window", () => {
    const report = computePreGenerationCoverage(
      baseInput({ sessionCount: 0, phaseUses: [], results: [], jobs: [] }),
    );

    expect(report.status).toBe("INSUFFICIENT_DATA");
    expect(report.measuredPhaseUses).toBe(0);
    expect(report.strictOnTimeRate).toBeNull();
    expect(report.openReadyRate).toBeNull();
    expect(report.eventualCoverageRate).toBeNull();
    expect(report.jobCompletionRate).toBeNull();
    expect(report.liveContentShare).toBeNull();
    expect(report.phases).toEqual([]);
  });

  it("excludes each session's first phase from the strict denominator", () => {
    const report = computePreGenerationCoverage(
      baseInput({
        phaseUses: [
          { socialSessionId: "s1", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s1", phase: "lie_detective", startedAt: at(600_000) },
        ],
        results: [
          { socialSessionId: "s1", phase: "warmup", createdAt: at(8_000), fallbackUsed: false },
          { socialSessionId: "s1", phase: "lie_detective", createdAt: at(590_000), fallbackUsed: false },
        ],
        jobs: [],
      }),
      { minSample: 1 },
    );

    expect(report.excludedFirstPhaseUses).toBe(1);
    expect(report.measuredPhaseUses).toBe(1);
    expect(report.strictOnTimeRate).toBe(1);
  });

  it("excludes recap and never lets it enter a denominator", () => {
    const report = computePreGenerationCoverage(
      baseInput({
        phaseUses: [
          { socialSessionId: "s1", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s1", phase: "recap", startedAt: at(900_000) },
        ],
      }),
      { minSample: 1 },
    );

    expect(report.excludedNonGeneratableUses).toBe(1);
    expect(report.measuredPhaseUses).toBe(0);
    expect(report.status).toBe("INSUFFICIENT_DATA");
  });

  it("splits before-open, within-grace, late and missing", () => {
    const report = computePreGenerationCoverage(
      baseInput({
        sessionCount: 4,
        phaseUses: [
          { socialSessionId: "s1", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s1", phase: "quip_battle", startedAt: at(600_000) },
          { socialSessionId: "s2", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s2", phase: "quip_battle", startedAt: at(600_000) },
          { socialSessionId: "s3", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s3", phase: "quip_battle", startedAt: at(600_000) },
          { socialSessionId: "s4", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s4", phase: "quip_battle", startedAt: at(600_000) },
        ],
        results: [
          // s1: before open
          { socialSessionId: "s1", phase: "quip_battle", createdAt: at(120_000), fallbackUsed: false },
          // s2: inside grace
          { socialSessionId: "s2", phase: "quip_battle", createdAt: at(610_000), fallbackUsed: false },
          // s3: late
          { socialSessionId: "s3", phase: "quip_battle", createdAt: at(700_000), fallbackUsed: true },
          // s4: missing
        ],
        jobs: [],
      }),
      { minSample: 1 },
    );

    const row = report.phases.find((phase) => phase.phase === "quip_battle");
    expect(row).toMatchObject({
      used: 4,
      readyBeforeOpen: 1,
      readyWithinGrace: 1,
      late: 1,
      missing: 1,
      fallback: 1,
    });
    expect(report.strictOnTimeRate).toBe(0.25);
    expect(report.openReadyRate).toBe(0.5);
    expect(report.eventualCoverageRate).toBe(0.75);
    expect(report.sessionsWithFullCoverage).toBe(1);
    expect(report.sessionFullCoverageRate).toBe(0.25);
  });

  it("does not count a phase revisited later as the excluded first phase", () => {
    const report = computePreGenerationCoverage(
      baseInput({
        phaseUses: [
          { socialSessionId: "s1", phase: "warmup", startedAt: at(0) },
          { socialSessionId: "s1", phase: "micro_challenge", startedAt: at(300_000) },
          // Host returns to warmup later; this occurrence is measurable.
          { socialSessionId: "s1", phase: "warmup", startedAt: at(600_000) },
        ],
        results: [
          { socialSessionId: "s1", phase: "warmup", createdAt: at(10_000), fallbackUsed: false },
          { socialSessionId: "s1", phase: "micro_challenge", createdAt: at(290_000), fallbackUsed: false },
        ],
        jobs: [],
      }),
      { minSample: 1 },
    );

    expect(report.excludedFirstPhaseUses).toBe(1);
    expect(report.measuredPhaseUses).toBe(2);
    expect(report.strictOnTimeRate).toBe(1);
  });

  it("computes job completion, failure codes and live content share", () => {
    const report = computePreGenerationCoverage(
      baseInput({
        phaseUses: [],
        results: [
          { socialSessionId: "s1", phase: "warmup", createdAt: at(0), fallbackUsed: false },
          { socialSessionId: "s1", phase: "auction", createdAt: at(0), fallbackUsed: true },
        ],
        jobs: [
          { status: "completed", errorCode: null, phase: "warmup" },
          { status: "completed", errorCode: null, phase: "auction" },
          { status: "failed", errorCode: "quality_gate_discard", phase: "quip_battle" },
          { status: "failed", errorCode: "quality_gate_discard", phase: "group_mirror" },
          { status: "failed", errorCode: "timeout", phase: "lie_detective" },
          { status: "pending", errorCode: null, phase: "micro_challenge" },
        ],
      }),
    );

    expect(report.jobCounts).toEqual({ completed: 2, failed: 3, pending: 1 });
    expect(report.jobCompletionRate).toBe(0.4);
    expect(report.jobFailureCodes).toEqual([
      { code: "quality_gate_discard", count: 2 },
      { code: "timeout", count: 1 },
    ]);
    expect(report.liveContentShare).toBe(0.5);
    expect(report.storedResultCount).toBe(2);
  });

  it("refuses to publish a rate below the minimum sample", () => {
    const phaseUses = Array.from({ length: PRE_GENERATION_MIN_SAMPLE - 1 }, (_, index) => [
      { socialSessionId: `s${index}`, phase: "warmup", startedAt: at(0) },
      { socialSessionId: `s${index}`, phase: "auction", startedAt: at(60_000) },
    ]).flat();

    const report = computePreGenerationCoverage(baseInput({ phaseUses }));

    expect(report.measuredPhaseUses).toBe(PRE_GENERATION_MIN_SAMPLE - 1);
    expect(report.status).toBe("INSUFFICIENT_DATA");
  });

  it("publishes once the minimum sample is reached", () => {
    const phaseUses = Array.from({ length: PRE_GENERATION_MIN_SAMPLE }, (_, index) => [
      { socialSessionId: `s${index}`, phase: "warmup", startedAt: at(0) },
      { socialSessionId: `s${index}`, phase: "auction", startedAt: at(60_000) },
    ]).flat();

    const report = computePreGenerationCoverage(baseInput({ phaseUses }));

    expect(report.measuredPhaseUses).toBe(PRE_GENERATION_MIN_SAMPLE);
    expect(report.status).toBe("OK");
  });

  it("carries a definition string so the number cannot be quoted without scope", () => {
    const report = computePreGenerationCoverage(baseInput());

    expect(report.definition).toContain("first phase");
    expect(report.definition).toContain("recap");
    expect(report.definition).toContain("15s");
  });
});
