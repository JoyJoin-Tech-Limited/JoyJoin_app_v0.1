import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  insert: vi.fn(),
  progress: vi.fn(),
  generate: vi.fn(),
  getFeatureFlag: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../repositories/personalStoryRepo", () => ({
  claimNextPersonalStoryUpdateJob: mocks.claim,
  completePersonalStoryUpdateJob: mocks.complete,
  failPersonalStoryUpdateJob: mocks.fail,
  insertPersonalStoryChapterIfAbsent: mocks.insert,
  recordPersonalStoryJobProgress: mocks.progress,
}));

vi.mock("../services/personalStoryGenerationService", () => ({
  generatePersonalStoryChapter: mocks.generate,
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mocks.getFeatureFlag,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: mocks.info,
    error: mocks.error,
  },
}));

const { processPersonalStoryJobOnce } = await import("../jobs/personalStoryWorker");

const sources = [
  {
    sourceType: "alang" as const,
    sourceId: "archive-1",
    occurredAt: "2026-07-14T10:00:00.000Z",
    keywords: {
      occurredOn: "2026-07-14",
      activityType: "闪现",
      location: "深圳湾公园",
      npc: "阿浪",
    },
  },
  {
    sourceType: "blind_box" as const,
    sourceId: "registration-1",
    occurredAt: "2026-07-15T10:00:00.000Z",
    keywords: {
      occurredOn: "2026-07-15",
      activityType: "盲盒饭局",
      location: "南山区",
      partnerAnimals: ["猫头鹰伙伴"],
    },
  },
];

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    novelId: "novel-1",
    userId: "user-1",
    status: "running",
    activeKey: "active",
    sourceSnapshot: sources,
    nextSourceIndex: 0,
    generatedCount: 0,
    attemptCount: 1,
    lockedAt: new Date(),
    leaseExpiresAt: new Date(Date.now() + 60_000),
    leaseToken: "lease-1",
    errorCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

describe("personal story durable worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFeatureFlag.mockResolvedValue(true);
    mocks.progress.mockResolvedValue(true);
    mocks.complete.mockResolvedValue(true);
    mocks.fail.mockResolvedValue(true);
    mocks.generate.mockImplementation(async (source: (typeof sources)[number]) => ({
      title: `${source.keywords.occurredOn} · ${source.keywords.activityType}`,
      body: `${source.keywords.activityType}事实章节`,
      keywordHash: `hash-${source.sourceId}`,
      provider: "minimax",
      model: "minimax-m2.7",
      promptVersion: "personal-story-grounded-novel-v4",
      fallbackUsed: false,
    }));
    mocks.insert.mockResolvedValue({ created: true, chapter: { id: "chapter" } });
  });

  it("returns without writes when no durable job is pending", async () => {
    mocks.claim.mockResolvedValue(null);

    await expect(processPersonalStoryJobOnce()).resolves.toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("does not claim a queued job while the independent feature flag is off", async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);

    await expect(processPersonalStoryJobOnce()).resolves.toBe(false);

    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("appends one chapter per experience and advances the cursor after each commit", async () => {
    mocks.claim.mockResolvedValue(job());

    await expect(processPersonalStoryJobOnce()).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls.map(([input]) => input.leaseToken)).toEqual([
      "lease-1",
      "lease-1",
    ]);
    expect(mocks.insert.mock.calls.map(([input]) => input.jobId)).toEqual([
      "job-1",
      "job-1",
    ]);
    expect(mocks.insert.mock.calls.map(([input]) => input.source.sourceId)).toEqual([
      "archive-1",
      "registration-1",
    ]);
    expect(mocks.progress).toHaveBeenNthCalledWith(
      1,
      "job-1",
      "user-1",
      "lease-1",
      1,
      1,
    );
    expect(mocks.progress).toHaveBeenNthCalledWith(
      2,
      "job-1",
      "user-1",
      "lease-1",
      2,
      2,
    );
    expect(mocks.complete).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-1",
      2,
    );
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("records a partial failure without removing the already committed chapter", async () => {
    mocks.claim.mockResolvedValue(job());
    mocks.insert
      .mockResolvedValueOnce({ created: true, chapter: { id: "chapter-1" } })
      .mockRejectedValueOnce(new Error("database unavailable"));

    await expect(processPersonalStoryJobOnce()).resolves.toBe(true);

    expect(mocks.progress).toHaveBeenCalledTimes(1);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-1",
      1,
      "chapter_processing_failed",
    );
  });

  it("keeps the first chapter and fails before inserting when the next model output is rejected", async () => {
    mocks.claim.mockResolvedValue(job());
    mocks.generate
      .mockResolvedValueOnce({
        title: "2026-07-14 · 闪现",
        body: "闪现事实章节",
        keywordHash: "hash-archive-1",
        provider: "minimax",
        model: "minimax-m2.7",
        promptVersion: "personal-story-grounded-novel-v4",
        fallbackUsed: false,
      })
      .mockRejectedValueOnce(
        new Error("PERSONAL_STORY_NO_EMBELLISHMENT_REJECTED"),
      );

    await expect(processPersonalStoryJobOnce()).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.progress).toHaveBeenCalledTimes(1);
    expect(mocks.fail).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-1",
      1,
      "no_embellishment_rejection",
    );
  });

  it("does not insert a synthetic chapter when both approved providers fail", async () => {
    mocks.claim.mockResolvedValue(job({ sourceSnapshot: [sources[0]] }));
    mocks.generate.mockRejectedValue(
      new Error("PERSONAL_STORY_ALL_PROVIDERS_FAILED"),
    );

    await expect(processPersonalStoryJobOnce()).resolves.toBe(true);

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.progress).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-1",
      0,
      "all_providers_failed",
    );
  });

  it("resumes from the persisted cursor instead of regenerating earlier sources", async () => {
    mocks.claim.mockResolvedValue(
      job({ nextSourceIndex: 1, generatedCount: 1 }),
    );

    await processPersonalStoryJobOnce();

    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledWith(sources[1]);
    expect(mocks.progress).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-1",
      2,
      2,
    );
    expect(mocks.complete).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-1",
      2,
    );
  });

  it("refuses to process a claimed row that has no fencing token", async () => {
    mocks.claim.mockResolvedValue(job({ leaseToken: null }));

    await expect(processPersonalStoryJobOnce()).resolves.toBe(true);

    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.progress).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.fail).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "[PersonalStoryWorker] Claimed job missing fencing token",
      expect.objectContaining({
        jobId: "job-1",
        errorCode: "job_lease_token_missing",
      }),
    );
  });

  it("fences an expired worker after a second worker reclaims the same job", async () => {
    let currentLease = "lease-old";
    let releaseOldGeneration!: () => void;
    let signalOldGenerationStarted!: () => void;
    const oldGenerationBlocked = new Promise<void>((resolve) => {
      releaseOldGeneration = resolve;
    });
    const oldGenerationStarted = new Promise<void>((resolve) => {
      signalOldGenerationStarted = resolve;
    });

    mocks.claim
      .mockImplementationOnce(async () => {
        currentLease = "lease-old";
        return job({ leaseToken: currentLease, attemptCount: 1 });
      })
      .mockImplementationOnce(async () => {
        currentLease = "lease-new";
        return job({ leaseToken: currentLease, attemptCount: 2 });
      });

    let generationCall = 0;
    mocks.generate.mockImplementation(async (source: (typeof sources)[number]) => {
      generationCall += 1;
      if (generationCall === 1) {
        signalOldGenerationStarted();
        await oldGenerationBlocked;
      }
      return {
        title: `${source.keywords.occurredOn} 路 ${source.keywords.activityType}`,
        body: `${source.keywords.activityType}浜嬪疄绔犺妭`,
        keywordHash: `hash-${source.sourceId}`,
        provider: "minimax",
        model: "minimax-m2.7",
        promptVersion: "personal-story-grounded-novel-v4",
        fallbackUsed: false,
      };
    });
    mocks.insert.mockImplementation(async (input: { leaseToken: string }) => {
      if (input.leaseToken !== currentLease) {
        throw new Error("PERSONAL_STORY_JOB_LEASE_LOST");
      }
      return { created: true, chapter: { id: "chapter" } };
    });
    mocks.progress.mockImplementation(
      async (_jobId: string, _userId: string, leaseToken: string) =>
        leaseToken === currentLease,
    );
    mocks.complete.mockImplementation(
      async (_jobId: string, _userId: string, leaseToken: string) =>
        leaseToken === currentLease,
    );
    mocks.fail.mockImplementation(
      async (_jobId: string, _userId: string, leaseToken: string) =>
        leaseToken === currentLease,
    );

    const oldWorker = processPersonalStoryJobOnce();
    await oldGenerationStarted;

    const newWorker = processPersonalStoryJobOnce();
    await expect(newWorker).resolves.toBe(true);

    releaseOldGeneration();
    await expect(oldWorker).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", leaseToken: "lease-new" }),
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", leaseToken: "lease-old" }),
    );
    expect(mocks.complete).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-new",
      2,
    );
    expect(mocks.complete).not.toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-old",
      expect.any(Number),
    );
    expect(mocks.fail).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      "lease-old",
      0,
      "job_lease_lost",
    );
    expect(mocks.error).toHaveBeenCalledWith(
      "[PersonalStoryWorker] Update failed",
      expect.objectContaining({
        jobId: "job-1",
        errorCode: "job_lease_lost",
        failureRecorded: false,
      }),
    );
  });
});
