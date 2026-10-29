import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dequeue: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  store: vi.fn(),
  isJobRunning: vi.fn(),
  deleteResult: vi.fn(),
  recoverStale: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../lib/socialIcebreakerStore", () => ({
  dequeuePendingJob: mocks.dequeue,
  completePreGenerationJob: mocks.complete,
  failPreGenerationJob: mocks.fail,
  storePreGenerationResult: mocks.store,
  isPreGenerationJobRunning: mocks.isJobRunning,
  deletePreGenerationResultById: mocks.deleteResult,
  recoverStalePreGenerationJobs: mocks.recoverStale,
}));

vi.mock("../socialIcebreakerAIService", () => ({
  generateWarmupTopics: vi.fn(),
  generateMicroChallenges: vi.fn(),
  generateLieDetectiveStatements: vi.fn(),
  generatePersonalityDiceChallenges: vi.fn(),
  generatePersonalityDiceChallengeGroups: vi.fn(),
  generateAuctionLots: vi.fn(),
  generateQuipBattlePrompts: vi.fn(),
  generateUndercoverWordPair: vi.fn(),
  generateGroupMirrorQuestions: vi.fn(),
}));

vi.mock("../ai/aiQualityGate", () => ({
  generateWithQualityGate: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
  },
}));

const {
  startPreGenerationWorker,
  stopPreGenerationWorker,
  isPreGenerationWorkerRunning,
} = await import("../jobs/preGenerationWorker");

const originalKillSwitch = process.env.PRE_GENERATION_WORKER_ENABLED;

describe("pre-generation worker startup and lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PRE_GENERATION_WORKER_ENABLED;
    mocks.dequeue.mockResolvedValue(null);
    mocks.recoverStale.mockResolvedValue(0);
  });

  afterEach(() => {
    stopPreGenerationWorker();
    vi.useRealTimers();
    if (originalKillSwitch === undefined) {
      delete process.env.PRE_GENERATION_WORKER_ENABLED;
    } else {
      process.env.PRE_GENERATION_WORKER_ENABLED = originalKillSwitch;
    }
  });

  it("wires exactly one fail-open worker start into server startup", () => {
    const startupSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

    expect(startupSource).toContain('from "./jobs/preGenerationWorker"');
    expect(startupSource.match(/startPreGenerationWorker\(\);/g)).toHaveLength(1);
    expect(startupSource).toMatch(
      /try\s*{\s*startPreGenerationWorker\(\);\s*}\s*catch\s*\(error\)\s*{\s*logger\.warn\(/,
    );
  });

  it("starts only one immediate tick and one interval across duplicate start calls", async () => {
    vi.useFakeTimers();

    startPreGenerationWorker();
    startPreGenerationWorker();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.dequeue).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(isPreGenerationWorkerRunning()).toBe(true);
  });

  it("recovers stale jobs on startup and every 12th active tick", async () => {
    vi.useFakeTimers();
    mocks.recoverStale.mockResolvedValue(2);

    startPreGenerationWorker();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.recoverStale).toHaveBeenCalledTimes(1);
    const staleBefore = mocks.recoverStale.mock.calls[0][0] as Date;
    expect(staleBefore).toBeInstanceOf(Date);
    expect(Date.now() - staleBefore.getTime()).toBe(10 * 60 * 1000);
    expect(mocks.warn).toHaveBeenCalledWith(
      "Pre-generation worker recovered stale running jobs",
      expect.objectContaining({ recoveredCount: 2 }),
    );

    await vi.advanceTimersByTimeAsync(55_000);
    expect(mocks.recoverStale).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.recoverStale).toHaveBeenCalledTimes(2);
  });

  it("contains recovery errors and continues processing later polls", async () => {
    vi.useFakeTimers();
    mocks.recoverStale.mockRejectedValue(new Error("recovery unavailable"));

    expect(() => startPreGenerationWorker()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.dequeue).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(
      "Pre-generation stale-job recovery failed; continuing polling",
      expect.objectContaining({ error: "recovery unavailable" }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.dequeue).toHaveBeenCalledTimes(2);
    expect(isPreGenerationWorkerRunning()).toBe(true);
  });

  it("does not tick or create a timer when PRE_GENERATION_WORKER_ENABLED=false", async () => {
    vi.useFakeTimers();
    process.env.PRE_GENERATION_WORKER_ENABLED = "false";

    startPreGenerationWorker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mocks.dequeue).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(isPreGenerationWorkerRunning()).toBe(false);
  });

  it("contains a rejected tick without throwing or emitting an unhandled rejection", async () => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);
    mocks.dequeue.mockRejectedValue(new Error("dequeue unavailable"));

    try {
      expect(() => startPreGenerationWorker()).not.toThrow();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(mocks.error).toHaveBeenCalledWith(
        "Pre-generation worker poll failed; will retry next interval",
        expect.objectContaining({ error: "dequeue unavailable" }),
      );
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(isPreGenerationWorkerRunning()).toBe(true);
    } finally {
      process.off("unhandledRejection", unhandledRejection);
    }
  });

  it("does not overlap ticks while the previous dequeue is still pending", async () => {
    vi.useFakeTimers();
    let finishFirstDequeue!: (value: null) => void;
    mocks.dequeue.mockImplementationOnce(() => new Promise<null>((resolve) => {
      finishFirstDequeue = resolve;
    }));

    startPreGenerationWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.dequeue).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.dequeue).toHaveBeenCalledTimes(1);

    finishFirstDequeue(null);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.dequeue).toHaveBeenCalledTimes(2);
  });

  it("stop clears the interval and prevents later ticks", async () => {
    vi.useFakeTimers();

    startPreGenerationWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);

    stopPreGenerationWorker();
    expect(vi.getTimerCount()).toBe(0);
    expect(isPreGenerationWorkerRunning()).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.dequeue).toHaveBeenCalledTimes(1);
  });
});
