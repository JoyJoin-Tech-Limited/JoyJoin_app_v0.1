import express from "express";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from "../test-utils/withServer";

const state = vi.hoisted(() => ({
  progresses: new Map<string, any>(),
  archives: new Map<string, any>(),
  nextProgress: 2,
  nextArchive: 2,
}));
const mockGetFeatureFlag = vi.hoisted(() => vi.fn());
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mission = vi.hoisted(() => ({
  id: "mission-alang",
  slug: "alang-demo",
  title: "阿浪的故事",
  description: "内部复测任务",
  status: "active",
  isInternalOnly: true,
}));
const content = vi.hoisted(() => ({
  startNodeId: "result-card",
  nodes: [
    {
      id: "result-card",
      type: "result_card",
      content: {
        locationLabel: "测试地点",
        finalMood: "安心",
        summaryLine: "新一轮故事已经完成",
      },
    },
  ],
}));

function key(userId: string, missionId: string): string {
  return `${userId}:${missionId}`;
}

const repository = vi.hoisted(() => ({
  getActiveMissions: vi.fn(async () => [mission]),
  getActiveInternalMissionBySlug: vi.fn(async (slug: string) =>
    slug === mission.slug ? mission : null
  ),
  getMissionProgress: vi.fn(async (userId: string, missionId: string) =>
    state.progresses.get(key(userId, missionId)) ?? null
  ),
  getMissionProgresses: vi.fn(async () => []),
  createMissionProgress: vi.fn(async (data: any) => {
    const row = {
      ...data,
      id: `progress-${state.nextProgress++}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.progresses.set(key(data.userId, data.missionId), row);
    return row;
  }),
  updateMissionProgress: vi.fn(async (progressId: string, updates: any) => {
    for (const [progressKey, progress] of state.progresses) {
      if (progress.id === progressId) {
        const updated = { ...progress, ...updates, updatedAt: new Date() };
        state.progresses.set(progressKey, updated);
        return updated;
      }
    }
    return null;
  }),
  updateMissionProgressIfCurrent: vi.fn(),
  archiveStory: vi.fn(async (data: any) => {
    const existing = state.archives.get(data.progressId);
    if (existing) return { archive: existing, created: false };
    const archive = {
      ...data,
      id: `archive-${state.nextArchive++}`,
      createdAt: new Date(),
    };
    state.archives.set(data.progressId, archive);
    return { archive, created: true };
  }),
  getStoryArchivesByUser: vi.fn(async (userId: string) =>
    [...state.archives.values()].filter((archive) => archive.userId === userId)
  ),
  getStoryArchiveById: vi.fn(async (archiveId: string) =>
    [...state.archives.values()].find((archive) => archive.id === archiveId) ?? null
  ),
  getStoryArchiveByProgressId: vi.fn(async (progressId: string) =>
    state.archives.get(progressId) ?? null
  ),
  deleteMissionProgress: vi.fn(async (userId: string, missionId: string) => {
    const progress = state.progresses.get(key(userId, missionId));
    if (!progress) {
      return { deletedProgressCount: 0, deletedArchiveCount: 0 };
    }
    const archive = state.archives.get(progress.id);
    const ownsArchive = archive?.userId === userId && archive?.missionId === missionId;
    if (ownsArchive) state.archives.delete(progress.id);
    state.progresses.delete(key(userId, missionId));
    return {
      deletedProgressCount: 1,
      deletedArchiveCount: ownsArchive ? 1 : 0,
    };
  }),
  seedDemoMissionIfNeeded: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
}));
vi.mock("../lib/logger", () => ({
  logger: { ...mockLog, child: () => mockLog },
}));
vi.mock("../lib/requestAuth", () => ({
  requireAuthenticatedUserId: (req: any, res: any) => {
    const userId = req.headers["x-test-user"];
    if (typeof userId === "string" && userId.length > 0) return userId;
    res.status(401).json({ message: "Unauthorized" });
    return null;
  },
}));
vi.mock("../repositories/alangRepo", () => repository);
vi.mock("../services/alangContentService", () => ({
  loadMissionContent: vi.fn(async (slug: string) =>
    slug === mission.slug ? content : null
  ),
  getNodeById: (loadedContent: typeof content, nodeId: string) =>
    loadedContent.nodes.find((node) => node.id === nodeId) ?? null,
}));

const { registerAlangRoutes } = await import("../routes/domains/alang");

function createApp() {
  const app = express();
  app.use(express.json());
  registerAlangRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);
const originalAppMode = process.env.APP_MODE;
const originalSingleTestMode = process.env.ENABLE_SINGLE_TEST_MODE;
const configuredPoints = {
  targetLocation: { latitude: 23.1291, longitude: 113.2644 },
  companionEndLocation: { latitude: 23.1303, longitude: 113.2644 },
  coordinateSystem: "gcj02",
};

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function seedProgress(
  userId = "user-1",
  missionId = mission.id,
  status: "in_progress" | "completed" = "completed",
  withArchive = status === "completed"
) {
  const progress = {
    id: `progress-${userId}-${missionId}`,
    userId,
    missionId,
    currentNodeId: "result-card",
    nodeHistory: ["result-card"],
    choicesMade: [],
    gpsHistory: [{ latitude: 22.5, longitude: 114.0, ts: 1 }],
    status,
    stage: status === "completed" ? "completed" : "result",
    debugMarkers: ["test"],
    isDebugSession: true,
  };
  state.progresses.set(key(userId, missionId), progress);
  if (withArchive) {
    state.archives.set(progress.id, {
      id: `archive-${userId}-${missionId}`,
      userId,
      missionId,
      progressId: progress.id,
      completedAt: new Date(),
    });
  }
  return progress;
}

async function post(path: string, body: Record<string, unknown> = {}) {
  return withServer(async (_baseUrl, request) => request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-user": "user-1",
    },
    body: JSON.stringify(body),
  }));
}

describe("Alang internal retest route", () => {
  beforeEach(() => {
    process.env.APP_MODE = "staging";
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    state.progresses.clear();
    state.archives.clear();
    state.nextProgress = 2;
    state.nextArchive = 2;
    vi.clearAllMocks();
    mockGetFeatureFlag.mockImplementation(async (name: string) => name === "alangEnabled");
  });

  afterAll(() => {
    restoreEnv("APP_MODE", originalAppMode);
    restoreEnv("ENABLE_SINGLE_TEST_MODE", originalSingleTestMode);
  });

  it("deletes a completed progress and its archive and returns exact counts", async () => {
    seedProgress();

    const response = await post("/api/alang/debug/missions/alang-demo/reset", {
      userId: "other-user",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 1,
    });
    expect(state.progresses.has(key("user-1", mission.id))).toBe(false);
    expect(state.archives.size).toBe(0);
    expect(repository.deleteMissionProgress).toHaveBeenCalledWith("user-1", mission.id);
    expect(mockLog.info).toHaveBeenCalledWith(
      "[Alang] internal retest reset",
      expect.objectContaining({
        actingUserId: "user-1",
        missionSlug: "alang-demo",
        environment: "staging",
        deletedProgressCount: 1,
        deletedArchiveCount: 1,
      })
    );
  });

  it("deletes an in-progress run without requiring an archive", async () => {
    seedProgress("user-1", mission.id, "in_progress", false);

    const response = await post("/api/alang/debug/missions/alang-demo/reset");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 0,
    });
  });

  it("is idempotent when reset is repeated with no remaining data", async () => {
    const first = await post("/api/alang/debug/missions/alang-demo/reset");
    const second = await post("/api/alang/debug/missions/alang-demo/reset");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      reset: true,
      deletedProgressCount: 0,
      deletedArchiveCount: 0,
    });
  });

  it("returns 403 outside single-test mode without touching data", async () => {
    process.env.ENABLE_SINGLE_TEST_MODE = "false";
    seedProgress();

    const response = await post("/api/alang/debug/missions/alang-demo/reset");

    expect(response.status).toBe(403);
    expect(repository.deleteMissionProgress).not.toHaveBeenCalled();
  });

  it("returns 403 in production even when the single-test env flag is stale", async () => {
    process.env.APP_MODE = "production";
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    seedProgress();

    const response = await post("/api/alang/debug/missions/alang-demo/reset");

    expect(response.status).toBe(403);
    expect(repository.deleteMissionProgress).not.toHaveBeenCalled();
  });

  it("requires alangEnabled in addition to single-test mode", async () => {
    mockGetFeatureFlag.mockResolvedValue(false);
    seedProgress();

    const response = await post("/api/alang/debug/missions/alang-demo/reset");

    expect(response.status).toBe(503);
    expect(repository.deleteMissionProgress).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested internal mission does not exist", async () => {
    const response = await post("/api/alang/debug/missions/missing-mission/reset");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "MISSION_NOT_FOUND" });
    expect(repository.deleteMissionProgress).not.toHaveBeenCalled();
  });

  it("does not touch another user or another mission", async () => {
    seedProgress();
    const otherUser = seedProgress("user-2", mission.id);
    const otherMission = seedProgress("user-1", "mission-other");

    const response = await post("/api/alang/debug/missions/alang-demo/reset");

    expect(response.status).toBe(200);
    expect(state.progresses.get(key("user-2", mission.id))).toBe(otherUser);
    expect(state.progresses.get(key("user-1", "mission-other"))).toBe(otherMission);
    expect(state.archives.has(otherUser.id)).toBe(true);
    expect(state.archives.has(otherMission.id)).toBe(true);
  });

  it("can start a fresh progress after resetting a completed run", async () => {
    seedProgress();
    expect((await post("/api/alang/debug/missions/alang-demo/reset")).status).toBe(200);

    const startResponse = await post("/api/alang/missions/alang-demo/start", configuredPoints);
    const startBody = await startResponse.json() as any;

    expect(startResponse.status).toBe(200);
    expect(startBody).toMatchObject({ stage: "result", currentNodeId: "result-card" });
    expect(startBody.progressId).not.toBe("progress-user-1-mission-alang");
    expect(state.progresses.get(key("user-1", mission.id))).toMatchObject({
      status: "in_progress",
      choicesMade: [],
      gpsHistory: [],
    });
  });

  it("can complete again and create a new archive after reset", async () => {
    const oldProgress = seedProgress();
    expect((await post("/api/alang/debug/missions/alang-demo/reset")).status).toBe(200);
    const startResponse = await post("/api/alang/missions/alang-demo/start", configuredPoints);
    const { progressId } = await startResponse.json() as any;

    const completeResponse = await post("/api/alang/missions/alang-demo/complete");
    const completeBody = await completeResponse.json();

    expect(completeResponse.status).toBe(200);
    expect(completeBody).toMatchObject({ completed: true });
    expect(progressId).not.toBe(oldProgress.id);
    expect(state.archives.get(progressId)).toMatchObject({
      progressId,
      userId: "user-1",
      missionId: mission.id,
    });
    expect(state.archives.has(oldProgress.id)).toBe(false);
  });
});
