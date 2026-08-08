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
  loggerWarn: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({ getFeatureFlag: mocks.getFeatureFlag }));
vi.mock("../lib/logger", () => ({
  logger: { warn: mocks.loggerWarn, error: vi.fn(), info: vi.fn() },
}));
vi.mock("../services/flashScheduleService", () => ({ startFlashBackgroundJobs: vi.fn() }));
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
    vi.stubEnv(
      "FLASH_SHENZHEN_BOUNDARY_APPROVED_SHA256",
      "b691faa581d9330e6dc738dcd11421958ca2d4ddea271b656a56237f9fa6fb0b",
    );
    mocks.getFeatureFlag.mockResolvedValue(true);
    mocks.assertReady.mockResolvedValue(undefined);
    mocks.getHome.mockResolvedValue({ canonicalScreen: "home", onlineNpcs: [], myTasks: [] });
    mocks.locate.mockResolvedValue({
      appearanceId,
      destination: { latitude: 22.5432, longitude: 114.0578, coordinateSystem: "gcj02" },
      distanceMeters: 83,
      targetBearingDegrees: 91,
      proximityBand: "near",
      signal: "searching",
      canonicalScreen: "map",
      arrived: false,
      encounterId: null,
    });
    mocks.arrive.mockResolvedValue({ canonicalScreen: "task", arrived: false });
    mocks.getEncounter.mockResolvedValue({ canonicalScreen: "dialogue" });
    mocks.deliver.mockResolvedValue({ canonicalScreen: "completed" });
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

  it("allows authenticated preference updates before the Flash catalog is ready", async () => {
    mocks.assertReady.mockRejectedValue(new Error("catalog not ready"));
    mocks.patchPreferences.mockResolvedValue({ personalizationEnabled: false, tags: [] });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/preferences`, {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizationEnabled: false }),
      });

      expect(response.status).toBe(200);
    });

    expect(mocks.patchPreferences).toHaveBeenCalledWith(expect.objectContaining({
      userId: "acting-user",
      update: expect.objectContaining({ personalizationEnabled: false }),
    }));
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
    expect(mocks.getHome).toHaveBeenCalledWith(expect.objectContaining({
      userId: "acting-user",
      latitude: validCoordinate.latitude,
      longitude: validCoordinate.longitude,
    }));
  });

  it("does not gate the formal Street Blind Box routes on legacy alangEnabled", async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.assertReady).toHaveBeenCalled();
    expect(mocks.getHome).toHaveBeenCalled();
  });

  it("allows a remote coordinate and leaves encounter eligibility to approved-location distance", async () => {
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
  });

  it("allows an out-of-Shenzhen coordinate when the admin gate is off in staging", async () => {
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
  });

  it("accepts a valid coordinate in production and relies on approved encounter distance", async () => {
    vi.stubEnv("APP_MODE", "production");
    mocks.getFeatureFlag.mockImplementation(async (key: string) => key === "alangEnabled");
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
  });

  it("keeps story arrival testing available while retired task endpoints stay closed", async () => {
    vi.stubEnv("APP_MODE", "staging");
    mocks.getFeatureFlag.mockImplementation(async (key: string) =>
      key === "alangEnabled" || key === "flashAnyLocationArrivalTestEnabled"
    );
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const headers = { Cookie: cookie, "Content-Type": "application/json" };
      const remoteCoordinate = { latitude: 31.2304, longitude: 121.4737, coordinateSystem: "gcj02" };
      expect((await fetch(`${baseUrl}/api/alang/flash/appearances/${appearanceId}/locate`, {
        method: "POST", headers, body: JSON.stringify(remoteCoordinate),
      })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/alang/flash/assignments/${assignmentId}/arrive`, {
        method: "POST", headers, body: JSON.stringify(remoteCoordinate),
      })).status).toBe(410);
      expect((await fetch(`${baseUrl}/api/alang/flash/encounters/${appearanceId}`, {
        headers,
      })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/alang/flash/encounters/${appearanceId}/deliver`, {
        method: "POST",
        headers,
        body: JSON.stringify({ assignmentId }),
      })).status).toBe(410);
    });
    expect(mocks.locate).toHaveBeenCalledWith(expect.objectContaining({ forceArrivalForTesting: true }));
    expect(mocks.arrive).not.toHaveBeenCalled();
    expect(mocks.getEncounter).toHaveBeenCalledWith(expect.objectContaining({ allowSameEncounterDeliveryForTesting: true }));
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("never enables the any-location arrival override in production", async () => {
    vi.stubEnv("APP_MODE", "production");
    mocks.getFeatureFlag.mockResolvedValue(true);
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/appearances/${appearanceId}/locate`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.locate).toHaveBeenCalledWith(expect.objectContaining({ forceArrivalForTesting: false }));
  });

  it("does not use the old city polygon as an entry gate", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 22.495, longitude: 114.139, coordinateSystem: "gcj02" }),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.getHome).toHaveBeenCalled();
  });

  it.each([
    ["Dongguan Fenggang", 22.7448, 114.141],
    ["Dongguan Humen", 22.75, 113.73],
    ["Huizhou Huiyang", 22.80, 114.46],
  ])("accepts neighbouring-city point %s while approved-location distance remains authoritative", async (_label, latitude, longitude) => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/home`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, coordinateSystem: "gcj02" }),
      });
      expect(response.status).toBe(200);
    });
    expect(mocks.getHome).toHaveBeenCalled();
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
  });

  it("returns the fixed approved destination while the selected appearance is live", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "map-navigation-user");
      const response = await fetch(`${baseUrl}/api/alang/flash/appearances/${appearanceId}/locate`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(validCoordinate),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        appearanceId,
        destination: { latitude: 22.5432, longitude: 114.0578, coordinateSystem: "gcj02" },
        distanceMeters: 83,
        canonicalScreen: "map",
      });
    });
  });

  it("supports the live-map cadence and returns a stable code when its guard is exhausted", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "rate-budget-user");
      for (let attempt = 0; attempt < 360; attempt += 1) {
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

  it("returns 410 for retired task arrival", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/alang/flash/assignments/${assignmentId}/arrive`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ ...validCoordinate, userId: "victim-user" }),
      });
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_TASK_FLOW_RETIRED" });
    });
    expect(mocks.arrive).not.toHaveBeenCalled();
  });

  it("keeps retired task restart closed even when the old test flag is on", async () => {
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
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_TASK_FLOW_RETIRED" });
    });
    expect(mocks.retryTask).not.toHaveBeenCalled();
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
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({ code: "FLASH_TASK_FLOW_RETIRED" });
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
      expect(response.status).toBe(410);
    });
    expect(mocks.retryTask).not.toHaveBeenCalled();
  });
});
