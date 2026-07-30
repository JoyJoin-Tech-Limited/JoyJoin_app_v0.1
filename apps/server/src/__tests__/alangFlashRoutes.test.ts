import express from "express";
import session from "express-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWithServer } from "../test-utils/withServer";

const mocks = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  assertReady: vi.fn(),
  getHome: vi.fn(),
  locate: vi.fn(),
  getEncounter: vi.fn(),
  answer: vi.fn(),
  reroll: vi.fn(),
  respond: vi.fn(),
  deliver: vi.fn(),
  getAssignment: vi.fn(),
  arrive: vi.fn(),
  feedback: vi.fn(),
  abandon: vi.fn(),
  retryTask: vi.fn(),
  getPreferences: vi.fn(),
  patchPreferences: vi.fn(),
  removeTag: vi.fn(),
  reverseGeocode: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({ getFeatureFlag: mocks.getFeatureFlag }));
vi.mock("../lib/logger", () => ({
  logger: { warn: mocks.loggerWarn, error: vi.fn(), info: vi.fn() },
}));
vi.mock("../services/flashScheduleService", () => ({ startFlashBackgroundJobs: vi.fn() }));
vi.mock("../routes/domains/geo", () => ({ reverseGeocodeCoordinate: mocks.reverseGeocode }));
vi.mock("../services/flashService", () => {
  class FlashServiceError extends Error {
    constructor(public code: string, public status: number, message: string) {
      super(message);
    }
  }
  return {
    FlashServiceError,
    assertFlashRuntimeReady: mocks.assertReady,
    getFlashHome: mocks.getHome,
    locateFlashAppearance: mocks.locate,
    getFlashEncounter: mocks.getEncounter,
    answerFlashEncounter: mocks.answer,
    rerollFlashEncounterOffer: mocks.reroll,
    respondToFlashOffer: mocks.respond,
    deliverFlashTaskToNpc: mocks.deliver,
    getFlashAssignment: mocks.getAssignment,
    arriveAtFlashAssignment: mocks.arrive,
    feedbackFlashAssignment: mocks.feedback,
    abandonFlashTask: mocks.abandon,
    retryFlashTask: mocks.retryTask,
    getFlashPreferenceSettings: mocks.getPreferences,
    patchFlashPreferenceSettings: mocks.patchPreferences,
    removeFlashPreferenceTag: mocks.removeTag,
  };
});

const { registerAlangFlashRoutes } = await import("../routes/domains/alangFlash");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "flash-route-test", resave: false, saveUninitialized: false }));
  app.post("/__test__/login/:userId", (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  registerAlangFlashRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);
const validCoordinate = { latitude: 22.5431, longitude: 114.0579, coordinateSystem: "gcj02" };
const appearanceId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";

async function login(baseUrl: string, user = "acting-user") {
  const response = await fetch(`${baseUrl}/__test__/login/${user}`, { method: "POST" });
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("formal Flash routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reverseGeocode.mockImplementation(async ({ latitude, longitude }) => {
      if (latitude === validCoordinate.latitude && longitude === validCoordinate.longitude) {
        return { success: true, city: "深圳", district: "南山区", source: "tencent" };
      }
      return { success: true, city: latitude < 22.6 ? "香港" : latitude > 22.78 ? "惠州" : "东莞", district: "", source: "tencent" };
    });
    mocks.getFeatureFlag.mockResolvedValue(true);
    mocks.assertReady.mockResolvedValue(undefined);
    mocks.getHome.mockResolvedValue({ canonicalScreen: "home", onlineNpcs: [], myTasks: [] });
    mocks.locate.mockResolvedValue({ canonicalScreen: "radar", arrived: false });
    mocks.arrive.mockResolvedValue({ canonicalScreen: "task", arrived: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires an authenticated session before any Flash data access", async () => {
    await withServer(async (_baseUrl, request) => {
      const response = await request("/api/alang/flash/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(response.status).toBe(401);
    });
    expect(mocks.getHome).not.toHaveBeenCalled();
  });

  it("accepts home coordinates only in POST body and trusts the session user", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const queryResponse = await fetch(
        `${baseUrl}/api/alang/flash/home?latitude=22.5431&longitude=114.0579`,
        { headers: { Cookie: cookie } },
      );
      expect(queryResponse.status).toBe(404);

      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ ...validCoordinate, userId: "victim-user" }),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.getHome).toHaveBeenCalledWith({ userId: "acting-user" });
    expect(mocks.reverseGeocode).toHaveBeenCalledWith(validCoordinate, { cache: false });
  });

  it("fails closed without mislabelling the user when Tencent verification is unavailable", async () => {
    mocks.reverseGeocode.mockResolvedValue({ success: false, city: "深圳", district: "南山区", source: "bounds", code: "MAP_TIMEOUT" });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_LOCATION_UNAVAILABLE" });
    });
    expect(mocks.getHome).not.toHaveBeenCalled();
  });

  it("rejects an out-of-Shenzhen coordinate before service access", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 31.2304, longitude: 121.4737 }),
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_OUTSIDE_SHENZHEN" });
    });
    expect(mocks.getHome).not.toHaveBeenCalled();
  });

  it("allows Shenzhen-external GPS when the admin restriction is off in staging", async () => {
    vi.stubEnv("APP_MODE", "staging");
    mocks.getFeatureFlag.mockImplementation(async (key: string) =>
      key === "alangEnabled" ? true : key !== "flashShenzhenLocationGateEnabled"
    );
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" }),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.getHome).toHaveBeenCalled();
    expect(mocks.reverseGeocode).not.toHaveBeenCalled();
  });

  it("keeps the Shenzhen restriction locked in production even when the admin flag is off", async () => {
    vi.stubEnv("APP_MODE", "production");
    mocks.getFeatureFlag.mockImplementation(async (key: string) => key === "alangEnabled");
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" }),
      });
      expect(response.status).toBe(403);
    });
    expect(mocks.getHome).not.toHaveBeenCalled();
  });

  it("rejects Hong Kong New Territories points that fall inside the old rectangle", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 22.495, longitude: 114.139, coordinateSystem: "gcj02" }),
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_OUTSIDE_SHENZHEN" });
    });
    expect(mocks.getHome).not.toHaveBeenCalled();
  });

  it.each([
    ["Dongguan Fenggang", 22.7448, 114.141],
    ["Dongguan Humen", 22.75, 113.73],
    ["Huizhou Huiyang", 22.80, 114.46],
  ])("rejects neighbouring-city point %s before service access", async (_label, latitude, longitude) => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, coordinateSystem: "gcj02" }),
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_OUTSIDE_SHENZHEN" });
    });
    expect(mocks.getHome).not.toHaveBeenCalled();
  });

  it("does not put raw GPS into safe failure logs", async () => {
    mocks.locate.mockRejectedValue(new Error("upstream failed"));
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/appearances/${appearanceId}/locate`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(response.status).toBe(500);
    });
    expect(JSON.stringify(mocks.loggerWarn.mock.calls)).not.toContain(String(validCoordinate.latitude));
    expect(JSON.stringify(mocks.loggerWarn.mock.calls)).not.toContain(String(validCoordinate.longitude));
    expect(mocks.locate).toHaveBeenCalledWith(expect.objectContaining({ contextDistrict: "南山区" }));
  });

  it("returns a stable code when the local hidden-location guard is exhausted", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "rate-budget-user");
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`${baseUrl}/api/alang/flash/appearances/${appearanceId}/locate`, {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify(validCoordinate),
        });
        expect(response.status).toBe(200);
      }
      const blocked = await fetch(`${baseUrl}/api/alang/flash/appearances/${appearanceId}/locate`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(blocked.status).toBe(429);
      await expect(blocked.json()).resolves.toMatchObject({ code: "FLASH_LOCATE_RATE_LIMITED" });
    });
  });

  it("scopes task arrival to the session user and ignores client identity", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/assignments/${assignmentId}/arrive`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ ...validCoordinate, userId: "victim-user" }),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.arrive).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId,
      userId: "acting-user",
    }));
  });

  it("allows restarting the same task in non-production only when the admin flag is on", async () => {
    vi.stubEnv("APP_MODE", "staging");
    mocks.retryTask.mockResolvedValue({ canonicalScreen: "task", task: { id: assignmentId } });
    mocks.getFeatureFlag.mockImplementation(async (key: string) =>
      key === "flashTaskRetryTestEnabled" || key === "alangEnabled"
    );
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/assignments/${assignmentId}/retry`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.retryTask).toHaveBeenCalledWith({ assignmentId, userId: "acting-user" });
  });

  it("rejects task restart when the admin retry flag is off", async () => {
    vi.stubEnv("APP_MODE", "staging");
    mocks.getFeatureFlag.mockImplementation(async (key: string) => key === "alangEnabled");
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/assignments/${assignmentId}/retry`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_TASK_RETRY_DISABLED" });
    });
    expect(mocks.retryTask).not.toHaveBeenCalled();
  });

  it("keeps task restart disabled in production even if the flag is on", async () => {
    vi.stubEnv("APP_MODE", "production");
    mocks.getFeatureFlag.mockResolvedValue(true);
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/assignments/${assignmentId}/retry`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(response.status).toBe(403);
    });
    expect(mocks.retryTask).not.toHaveBeenCalled();
  });
});
