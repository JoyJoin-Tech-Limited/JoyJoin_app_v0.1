import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from "../test-utils/withServer";

const repo = vi.hoisted(() => ({
  ensureNovel: vi.fn(),
  listChapters: vi.fn(),
  activeJob: vi.fn(),
  latestJob: vi.fn(),
  missing: vi.fn(),
  createJob: vi.fn(),
  getFeatureFlag: vi.fn(),
  isProviderAvailable: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: repo.getFeatureFlag,
}));

vi.mock("../ai/creativeModelRouter", () => ({
  isProviderAvailable: repo.isProviderAvailable,
}));

vi.mock("../lib/requestAuth", () => ({
  requireAuthenticatedUserId: (req: any, res: any) => {
    const userId = req.headers["x-test-user"];
    if (typeof userId === "string" && userId.length > 0) return userId;
    res.status(401).json({ message: "Unauthorized" });
    return null;
  },
}));

vi.mock("../rateLimiter", () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    child: () => ({ error: vi.fn() }),
  },
}));

vi.mock("../repositories/personalStoryRepo", () => ({
  ensurePersonalStoryNovel: repo.ensureNovel,
  listPersonalStoryChapters: repo.listChapters,
  getActivePersonalStoryUpdateJob: repo.activeJob,
  getLatestPersonalStoryUpdateJob: repo.latestJob,
  listMissingPersonalStoryExperiences: repo.missing,
  createOrGetPersonalStoryUpdateJob: repo.createJob,
  toPersonalStoryChapterView: (chapter: any) => chapter,
  toPersonalStoryUpdateJobView: (job: any) => ({
    id: job.id,
    status: job.status === "pending" ? "queued" : job.status,
    updatedAt: job.createdAt.toISOString(),
  }),
}));

const { registerPersonalStoryRoutes } = await import(
  "../routes/domains/personalStory"
);

function createApp() {
  const app = express();
  app.use(express.json());
  registerPersonalStoryRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);

const source = {
  sourceType: "alang",
  sourceId: "archive-1",
  occurredAt: "2026-07-15T10:00:00.000Z",
  keywords: {
    occurredOn: "2026-07-15",
    activityType: "闪现",
  },
};

const job = {
  id: "job-1",
  status: "pending",
  sourceSnapshot: [source],
  generatedCount: 0,
  nextSourceIndex: 0,
  errorCode: null,
  createdAt: new Date("2026-07-15T11:00:00.000Z"),
};

describe("personal story routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.ensureNovel.mockResolvedValue({ id: "novel-1", userId: "user-1" });
    repo.listChapters.mockResolvedValue([]);
    repo.activeJob.mockResolvedValue(null);
    repo.latestJob.mockResolvedValue(null);
    repo.missing.mockResolvedValue([source]);
    repo.createJob.mockResolvedValue(job);
    repo.getFeatureFlag.mockResolvedValue(true);
    repo.isProviderAvailable.mockReturnValue(true);
  });

  it("requires authentication before loading or updating a story", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "victim" }),
      });

      expect(response.status).toBe(401);
      expect(repo.ensureNovel).not.toHaveBeenCalled();
    });
  });

  it("derives ownership only from authentication and ignores a client userId", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "user-1",
        },
        body: JSON.stringify({ userId: "victim" }),
      });

      expect(response.status).toBe(202);
      expect(repo.ensureNovel).toHaveBeenCalledWith("user-1");
      expect(repo.missing).toHaveBeenCalledWith("user-1", "novel-1");
      expect(repo.createJob).toHaveBeenCalledWith("user-1", "novel-1", [source]);
      expect(repo.ensureNovel).not.toHaveBeenCalledWith("victim");
    });
  });

  it("returns the active update job instead of enqueuing duplicate model work", async () => {
    repo.activeJob.mockResolvedValue(job);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story/update`, {
        method: "POST",
        headers: { "x-test-user": "user-1" },
      });

      expect(response.status).toBe(202);
      expect(repo.missing).not.toHaveBeenCalled();
      expect(repo.createJob).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        accepted: true,
        updateJob: { id: "job-1", status: "queued" },
      });
    });
  });

  it("returns a no-op response when there are no new verified experiences", async () => {
    repo.missing.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story/update`, {
        method: "POST",
        headers: { "x-test-user": "user-1" },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        accepted: false,
        noNewExperiences: true,
        updateJob: null,
      });
      expect(repo.createJob).not.toHaveBeenCalled();
    });
  });

  it("fails the story surface closed without touching rollout tables when the flag is off", async () => {
    repo.getFeatureFlag.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story`, {
        headers: { "x-test-user": "user-1" },
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "PERSONAL_STORY_DISABLED",
        message: "我的故事暂未开放",
      });
    });
    expect(repo.ensureNovel).not.toHaveBeenCalled();
    expect(repo.listChapters).not.toHaveBeenCalled();
  });

  it("rejects manual POST bypass with 403 when personalStoryEnabled is off", async () => {
    repo.getFeatureFlag.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "user-1",
        },
        body: JSON.stringify({ force: true, personalStoryEnabled: true }),
      });

      expect(response.status).toBe(403);
      expect(repo.activeJob).not.toHaveBeenCalled();
      expect(repo.createJob).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        accepted: false,
        story: null,
        updateJob: { status: "disabled" },
      });
      expect(repo.ensureNovel).not.toHaveBeenCalled();
    });
  });

  it("returns 503 and preserves old chapters when neither approved provider is available", async () => {
    repo.isProviderAvailable.mockReturnValue(false);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/personal-story/update`, {
        method: "POST",
        headers: { "x-test-user": "user-1" },
      });

      expect(response.status).toBe(503);
      expect(repo.activeJob).not.toHaveBeenCalled();
      expect(repo.createJob).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        accepted: false,
        story: { chapters: [] },
        updateJob: { status: "disabled" },
      });
    });
  });
});
