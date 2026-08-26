/**
 * Tests for repositories/onboardingFunnelRepo.ts (PR-2).
 *
 * db.execute is mocked with a queue of row sets matching the repo's five
 * queries in order: steps, stitch, experiments, emotion counts, stage dwell.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("../db", () => ({
  db: { execute: mockExecute },
}));

const { getOnboardingFunnelStats } = await import("../repositories/onboardingFunnelRepo");

function queueResults(...results: unknown[][]) {
  mockExecute.mockReset();
  for (const rows of results) {
    mockExecute.mockResolvedValueOnce({ rows });
  }
}

const emptyWindow = [
  [], // steps
  [{ anonymous_sessions: 0, stitched_sessions: 0 }], // stitch
  [], // experiments
  [{
    ceremony_auto: 0,
    ceremony_tap: 0,
    slot_starts: 0,
    slot_skips: 0,
    commentary_read_complete: 0,
    commentary_cut_short: 0,
  }], // emotion counts
  [], // stage dwell
];

describe("getOnboardingFunnelStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps p50/p90 step durations (numeric and string) and leaves nulls null", async () => {
    queueResults(
      [
        {
          step: "personality-test",
          step_index: 2,
          entered: 10,
          completed: 8,
          abandoned: 1,
          unique_sessions: 9,
          p50_step_duration: 1234.5,
          p90_step_duration: "5678.9",
        },
        {
          step: "login",
          step_index: 0,
          entered: 10,
          completed: 10,
          abandoned: 0,
          unique_sessions: 10,
          p50_step_duration: null,
          p90_step_duration: null,
        },
      ],
      ...emptyWindow.slice(1),
    );

    const stats = await getOnboardingFunnelStats(30);

    const test = stats.steps.find((s) => s.step === "personality-test");
    expect(test?.p50StepDurationMs).toBe(1234.5);
    expect(test?.p90StepDurationMs).toBe(5678.9);
    expect(test?.completionRate).toBeCloseTo(0.8);

    const login = stats.steps.find((s) => s.step === "login");
    expect(login?.p50StepDurationMs).toBeNull();
    expect(login?.p90StepDurationMs).toBeNull();
  });

  it("uses a rolling days window by default (until = null)", async () => {
    queueResults(...emptyWindow);

    const before = Date.now();
    const stats = await getOnboardingFunnelStats(7);
    const sinceMs = Date.parse(stats.since);

    expect(stats.until).toBeNull();
    expect(sinceMs).toBeGreaterThan(before - 8 * 24 * 60 * 60 * 1000);
    expect(sinceMs).toBeLessThanOrEqual(before - 6 * 24 * 60 * 60 * 1000);
  });

  it("honors an explicit [from, to) range and echoes it in the response", async () => {
    queueResults(...emptyWindow);

    const stats = await getOnboardingFunnelStats(30, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-18T00:00:00.000Z"),
    });

    expect(stats.since).toBe("2026-08-01T00:00:00.000Z");
    expect(stats.until).toBe("2026-08-18T00:00:00.000Z");
    expect(stats.days).toBe(30);
  });

  it("aggregates emotion metrics with ratios", async () => {
    queueResults(
      [],
      [{ anonymous_sessions: 0, stitched_sessions: 0 }],
      [],
      [{
        ceremony_auto: 3,
        ceremony_tap: 1,
        slot_starts: 10,
        slot_skips: 4,
        commentary_read_complete: 7,
        commentary_cut_short: 3,
      }],
      [
        { stage: "slot", median_dwell_ms: "4200.5", samples: 9 },
        { stage: "result", median_dwell_ms: 12000, samples: "11" },
      ],
    );

    const stats = await getOnboardingFunnelStats(30);

    expect(stats.emotion.ceremonyAdvance).toEqual({
      auto: 3,
      tap: 1,
      autoRatio: 0.75,
    });
    expect(stats.emotion.slotSkip).toEqual({
      starts: 10,
      skips: 4,
      skipRate: 0.4,
    });
    expect(stats.emotion.commentaryRead).toEqual({
      readComplete: 7,
      cutShort: 3,
      readCompleteRatio: 0.7,
    });
    expect(stats.emotion.resultStageDwell).toEqual([
      { stage: "slot", medianDwellMs: 4200.5, samples: 9 },
      { stage: "result", medianDwellMs: 12000, samples: 11 },
    ]);
  });

  it("returns zero ratios (never NaN) when there are no emotion rows", async () => {
    queueResults(...emptyWindow);

    const stats = await getOnboardingFunnelStats(30);

    expect(stats.emotion.ceremonyAdvance.autoRatio).toBe(0);
    expect(stats.emotion.slotSkip.skipRate).toBe(0);
    expect(stats.emotion.commentaryRead.readCompleteRatio).toBe(0);
    expect(stats.emotion.resultStageDwell).toEqual([]);
  });
});
