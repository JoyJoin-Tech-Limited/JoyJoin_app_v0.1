import express from "express";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from "../test-utils/withServer";

const state = vi.hoisted(() => ({
  progresses: new Map<string, any>(),
  nextProgress: 1,
}));
const mockGetFeatureFlag = vi.hoisted(() => vi.fn(async (key: string) => key === "alangEnabled"));
const mockLog = vi.hoisted(() => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

const mission = vi.hoisted(() => ({
  id: "mission-alang",
  slug: "alang-demo",
  title: "阿浪的故事",
  description: "内部复测任务",
  status: "active",
  isInternalOnly: true,
  targetLocation: { latitude: 22.518, longitude: 113.944, radiusMeters: 5 },
  companionEndLocation: { latitude: 22.519, longitude: 113.945, radiusMeters: 5 },
  contentJson: { nodes: [] },
}));
const content = vi.hoisted(() => ({
  version: "1.0",
  title: "阿浪的故事",
  description: "内部复测任务",
  startNodeId: "event-card",
  nodes: [
    { id: "event-card", type: "event_card", content: {}, nextNodeId: "event-detail" },
    { id: "event-detail", type: "event_detail", content: {}, nextNodeId: "search" },
    {
      id: "search",
      type: "search_gate",
      content: {},
      gpsTrigger: { latitude: 22.518, longitude: 113.944, radiusMeters: 5 },
      nextNodeId: "companion",
    },
    {
      id: "companion",
      type: "companion_move",
      content: { companionLines: [] },
      gpsTrigger: { latitude: 22.519, longitude: 113.945, radiusMeters: 5 },
      nextNodeId: "arrival",
    },
    { id: "arrival", type: "arrival_gate", content: {}, nextNodeId: "result" },
    { id: "result", type: "result_card", content: { summaryLine: "完成" } },
  ],
  meta: {
    defaultTargetLocation: { latitude: 22.518, longitude: 113.944, radiusMeters: 5 },
    defaultCompanionEndLocation: { latitude: 22.519, longitude: 113.945, radiusMeters: 5 },
  },
}));

function key(userId: string, missionId = mission.id): string {
  return `${userId}:${missionId}`;
}

const repository = vi.hoisted(() => ({
  getActiveMissions: vi.fn(async () => [mission]),
  getActiveInternalMissionBySlug: vi.fn(async (slug: string) => slug === mission.slug ? mission : null),
  getMissionProgress: vi.fn(async (userId: string, missionId: string) => state.progresses.get(key(userId, missionId)) ?? null),
  getMissionProgresses: vi.fn(async () => []),
  createMissionProgress: vi.fn(async (data: any) => {
    const row = { ...data, id: `progress-${state.nextProgress++}`, createdAt: new Date(), updatedAt: new Date() };
    state.progresses.set(key(data.userId, data.missionId), row);
    return row;
  }),
  updateMissionProgress: vi.fn(async (progressId: string, updates: any) => {
    for (const [progressKey, progress] of state.progresses) {
      if (progress.id !== progressId) continue;
      const updated = { ...progress, ...updates, updatedAt: new Date() };
      state.progresses.set(progressKey, updated);
      return updated;
    }
    return null;
  }),
  updateMissionProgressIfCurrent: vi.fn(),
  archiveStory: vi.fn(async (data: any) => ({
    archive: {
      id: `archive-${data.progressId}`,
      ...data,
    },
    created: true,
  })),
  getStoryArchivesByUser: vi.fn(async () => []),
  getStoryArchiveById: vi.fn(async () => null),
  getStoryArchiveByProgressId: vi.fn(async () => null),
  deleteMissionProgress: vi.fn(async (userId: string, missionId: string) => {
    const existed = state.progresses.delete(key(userId, missionId));
    return { deletedProgressCount: existed ? 1 : 0, deletedArchiveCount: 0 };
  }),
  seedDemoMissionIfNeeded: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({ getFeatureFlag: mockGetFeatureFlag }));
vi.mock("../lib/logger", () => ({ logger: { ...mockLog, child: () => mockLog } }));
vi.mock("../lib/requestAuth", () => ({
  requireAuthenticatedUserId: (req: any, res: any) => {
    const userId = req.headers["x-test-user"];
    if (typeof userId === "string" && userId) return userId;
    res.status(401).json({ error: "UNAUTHORIZED" });
    return null;
  },
}));
vi.mock("../repositories/alangRepo", () => repository);
vi.mock("../services/alangContentService", () => ({
  loadMissionContent: vi.fn(async (slug: string) => slug === mission.slug ? content : null),
  getNodeById: (loaded: typeof content, nodeId: string) => loaded.nodes.find((node) => node.id === nodeId) ?? null,
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

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

const configuredPoints = {
  targetLocation: { latitude: 23.1291, longitude: 113.2644 },
  companionEndLocation: { latitude: 23.1303, longitude: 113.2644 },
  coordinateSystem: "gcj02",
};

function seedProgress(userId = "user-1", overrides: Record<string, unknown> = {}) {
  const progress = {
    id: `progress-${userId}`,
    userId,
    missionId: mission.id,
    currentNodeId: "companion",
    nodeHistory: ["event-card", "event-detail", "search", "companion"],
    choicesMade: [],
    gpsHistory: [],
    status: "in_progress",
    stage: "companion",
    targetLocation: { ...configuredPoints.targetLocation, radiusMeters: 5, coordinateSystem: "gcj02" },
    companionEndLocation: { ...configuredPoints.companionEndLocation, radiusMeters: 5, coordinateSystem: "gcj02" },
    isDebugSession: true,
    debugMarkers: ["test-points-configured"],
    ...overrides,
  };
  state.progresses.set(key(userId), progress);
  return progress;
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  userId = "user-1",
) {
  return withServer(async (_baseUrl, send) => send(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-test-user": userId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

describe("Alang per-run test point flow", () => {
  beforeEach(() => {
    process.env.APP_MODE = "staging";
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    state.progresses.clear();
    state.nextProgress = 1;
    vi.clearAllMocks();
    mockGetFeatureFlag.mockImplementation(async (flag: string) => flag === "alangEnabled");
  });

  afterAll(() => {
    restoreEnv("APP_MODE", originalAppMode);
    restoreEnv("ENABLE_SINGLE_TEST_MODE", originalSingleTestMode);
  });

  it("stores this run's configured points instead of the demo mission defaults", async () => {
    const response = await request("POST", "/api/alang/missions/alang-demo/start", configuredPoints);
    expect(response.status).toBe(200);

    const progress = state.progresses.get(key("user-1"));
    expect(progress).toMatchObject({
      targetLocation: { ...configuredPoints.targetLocation, coordinateSystem: "gcj02" },
      companionEndLocation: { ...configuredPoints.companionEndLocation, coordinateSystem: "gcj02" },
      isDebugSession: true,
    });
    expect(progress.companionEndLocation).not.toMatchObject(mission.companionEndLocation);
  });

  it("recovers the current run's companion endpoint without exposing the demo endpoint", async () => {
    seedProgress();
    const response = await request("GET", "/api/alang/missions/alang-demo/recover");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stage: "companion",
      routeDestination: configuredPoints.companionEndLocation,
    });
  });

  it("does not recover a companion endpoint owned only by another user", async () => {
    seedProgress("user-2");

    const response = await request("GET", "/api/alang/missions/alang-demo/recover");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "NO_ACTIVE_PROGRESS" });
    expect(repository.getMissionProgress).toHaveBeenCalledWith("user-1", mission.id);
  });

  it("treats a legacy progress with no saved points as reconfiguration-required", async () => {
    seedProgress("user-1", { targetLocation: null, companionEndLocation: null });
    const response = await request("GET", "/api/alang/missions/alang-demo");
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.testConfigurationInvalid).toBe(true);
    expect(body.routeDestination).toBeUndefined();
  });

  it.each([undefined, "wgs84"])(
    "rejects a persisted run whose coordinate system is %s",
    async (coordinateSystem) => {
      seedProgress("user-1", {
        companionEndLocation: {
          ...configuredPoints.companionEndLocation,
          radiusMeters: 5,
          ...(coordinateSystem ? { coordinateSystem } : {}),
        },
      });
      const response = await request("GET", "/api/alang/missions/alang-demo");
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.testConfigurationInvalid).toBe(true);
      expect(body.routeDestination).toBeUndefined();
    },
  );

  it.each([
    {
      name: "legacy lat/lng keys",
      points: { ...configuredPoints, targetLocation: { lat: 23.1291, lng: 113.2644 } },
    },
    {
      name: "string coordinates",
      points: { ...configuredPoints, targetLocation: { latitude: "23.1291", longitude: "113.2644" } },
    },
    {
      name: "zero coordinate",
      points: { ...configuredPoints, targetLocation: { latitude: 0, longitude: 0 } },
    },
    {
      name: "swapped latitude and longitude",
      points: { ...configuredPoints, targetLocation: { latitude: 113.2644, longitude: 23.1291 } },
    },
  ])("rejects $name", async ({ points }) => {
    const response = await request("POST", "/api/alang/missions/alang-demo/start", points);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "ALANG_TEST_POINTS_INVALID" });
    expect(state.progresses.size).toBe(0);
  });

  it("rejects a cross-city point pair over 2000 metres", async () => {
    const response = await request("POST", "/api/alang/missions/alang-demo/start", {
      ...configuredPoints,
      companionEndLocation: { latitude: 23.2, longitude: 113.2644 },
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "ALANG_TEST_POINTS_INVALID",
      reason: "distance_too_long",
    });
  });

  it("returns configurationInvalid instead of persisting a GPS sample over 2000 metres away", async () => {
    const progress = seedProgress();
    const response = await request("POST", "/api/alang/missions/alang-demo/gps", {
      latitude: 22.5431,
      longitude: 114.0579,
      accuracy: 8,
      timestamp: Date.now(),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      arrived: false,
      configurationInvalid: true,
    });
    expect(state.progresses.get(key("user-1")).gpsHistory).toEqual(progress.gpsHistory);
  });

  it("simulates three stable points within 3 metres and advances only the acting user", async () => {
    const actingProgress = seedProgress("user-1");
    const otherProgress = seedProgress("user-2");

    const response = await request("POST", "/api/alang/debug/missions/alang-demo/mock-gps", {
      mode: "arrive",
    });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ arrived: true, stableCount: 3, debug: true });
    expect(body.distanceMeters).toBeLessThanOrEqual(3);
    expect(state.progresses.get(key("user-1"))).toMatchObject({
      id: actingProgress.id,
      currentNodeId: "arrival",
      stage: "arrived",
      isDebugSession: true,
      debugMarkers: expect.arrayContaining(["mock-gps:arrive"]),
    });
    expect(state.progresses.get(key("user-1")).gpsHistory).toHaveLength(3);
    expect(state.progresses.get(key("user-2"))).toEqual(otherProgress);
  });

  it("can advance to the result and archive the same run after mock arrival", async () => {
    const progress = seedProgress("user-1");

    const arrival = await request(
      "POST",
      "/api/alang/debug/missions/alang-demo/mock-gps",
      { mode: "arrive" },
    );
    expect(arrival.status).toBe(200);

    const result = await request(
      "POST",
      "/api/alang/missions/alang-demo/progress",
      { nodeId: "result" },
    );
    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({
      stage: "result",
      currentNodeId: "result",
    });

    const completion = await request(
      "POST",
      "/api/alang/missions/alang-demo/complete",
    );
    expect(completion.status).toBe(200);
    await expect(completion.json()).resolves.toEqual({
      archiveId: `archive-${progress.id}`,
      completed: true,
    });
    expect(repository.archiveStory).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      progressId: progress.id,
      isDebugSession: true,
    }));
    expect(state.progresses.get(key("user-1"))).toMatchObject({
      status: "completed",
      stage: "completed",
    });
  });

  it("reset deletes the progress-scoped points and requires a fresh configuration", async () => {
    seedProgress();
    const reset = await request("POST", "/api/alang/debug/missions/alang-demo/reset");
    expect(reset.status).toBe(200);
    expect(state.progresses.has(key("user-1"))).toBe(false);

    const restart = await request("POST", "/api/alang/missions/alang-demo/start");
    expect(restart.status).toBe(400);
    await expect(restart.json()).resolves.toEqual({ error: "ALANG_TEST_POINTS_REQUIRED" });
  });
});
