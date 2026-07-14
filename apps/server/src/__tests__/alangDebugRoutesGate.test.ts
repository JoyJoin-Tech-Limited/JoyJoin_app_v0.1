import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from "../test-utils/withServer";

const mockGetFeatureFlag = vi.fn();
const mockAlangRepositoryCall = vi.fn();

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
}));

vi.mock("../repositories/alangRepo", () => ({
  getActiveMissions: mockAlangRepositoryCall,
  getActiveInternalMissionBySlug: mockAlangRepositoryCall,
  getMissionProgress: mockAlangRepositoryCall,
  getMissionProgresses: mockAlangRepositoryCall,
  createMissionProgress: mockAlangRepositoryCall,
  updateMissionProgress: mockAlangRepositoryCall,
  updateMissionProgressIfCurrent: mockAlangRepositoryCall,
  archiveStory: mockAlangRepositoryCall,
  getStoryArchivesByUser: mockAlangRepositoryCall,
  getStoryArchiveById: mockAlangRepositoryCall,
  getStoryArchiveByProgressId: mockAlangRepositoryCall,
  deleteMissionProgress: mockAlangRepositoryCall,
  seedDemoMissionIfNeeded: mockAlangRepositoryCall,
}));

const { isAlangDebugMode, registerAlangRoutes } = await import(
  "../routes/domains/alang"
);

const originalAppMode = process.env.APP_MODE;
const originalEnableSingleTestMode = process.env.ENABLE_SINGLE_TEST_MODE;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function createApp() {
  const app = express();
  app.use(express.json());
  registerAlangRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);

describe("Alang debug route gate", () => {
  beforeEach(() => {
    process.env.APP_MODE = "staging";
    process.env.ENABLE_SINGLE_TEST_MODE = "false";
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv("APP_MODE", originalAppMode);
    restoreEnv("ENABLE_SINGLE_TEST_MODE", originalEnableSingleTestMode);
  });

  it("keeps Alang debug mode disabled in staging without single-test mode", () => {
    expect(isAlangDebugMode()).toBe(false);
  });

  it("fails closed when APP_MODE is unset even if single-test mode is enabled", () => {
    delete process.env.APP_MODE;
    process.env.ENABLE_SINGLE_TEST_MODE = "true";

    expect(isAlangDebugMode()).toBe(false);
  });

  it("fails every Alang debug mutation closed before feature or data access", async () => {
    const requests = [
      {
        path: "/api/alang/debug/missions/demo/force-node",
        body: { nodeId: "arrival" },
      },
      {
        path: "/api/alang/debug/missions/demo/reset",
        body: {},
      },
      {
        path: "/api/alang/debug/missions/demo/mock-gps",
        body: { latitude: 31.2304, longitude: 121.4737 },
      },
    ];

    await withServer(async (_baseUrl, request) => {
      for (const debugRequest of requests) {
        const response = await request(debugRequest.path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(debugRequest.body),
        });

        if (debugRequest.path.endsWith("/reset")) {
          expect(response.status).toBe(403);
          await expect(response.json()).resolves.toEqual({ error: "ALANG_RETEST_FORBIDDEN" });
        } else {
          expect(response.status).toBe(404);
          await expect(response.json()).resolves.toEqual({ error: "NOT_FOUND" });
        }
      }
    });

    expect(mockGetFeatureFlag).not.toHaveBeenCalled();
    expect(mockAlangRepositoryCall).not.toHaveBeenCalled();
  });
});
