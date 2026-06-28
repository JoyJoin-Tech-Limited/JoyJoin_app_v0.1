/**
 * Tests for GET /api/shell/events — Events Predictive Shell composite endpoint
 *
 * Coverage:
 *   - AC-01: endpoint exists and returns composite payload
 *   - AC-02: payload shape (user, joinedEvents, notifications, meta)
 *   - REL-01: 401 auth failure shape
 *   - REL-02: 500 returns consistent error shape
 *   - OBS-01: shell.events metric logged
 *   - OBS-03: X-Response-Time header present
 */

import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mockGetEventsShellData = vi.fn();

vi.mock("../repositories/shellRepository", () => ({
  getEventsShellData: mockGetEventsShellData,
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (req.session?.userId) {
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  },
}));

const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

// ── Imports after mocks ────────────────────────────────────────────────────

const { registerShellRoutes, _clearShellCacheForTest } = await import("../routes/domains/shell");

// ── Test helpers ───────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );

  app.post("/__test__/login", (req, res) => {
    req.session.userId = "user-123";
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  registerShellRoutes(app);
  return app;
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

function makeEventsShellResponse() {
  return {
    user: { nextStep: "discover", primaryArchetype: "柯基" },
    joinedEvents: [
      {
        id: "event-1",
        title: "周五夜聊",
        dateTime: "2026-05-20T19:00:00.000Z",
        location: "深圳",
        city: "深圳",
        district: "福田区",
        status: "upcoming",
        eventType: "饭局",
        venueName: "测试餐厅",
        venueAddress: "福田区 test 路 1 号",
        registrationDeadline: "2026-05-19T12:00:00.000Z",
        price: 188,
        matchedAt: "2026-05-19T14:00:00.000Z",
        groupId: "group-1",
        finalDateTime: "2026-05-20T19:00:00.000Z",
      },
    ],
    notifications: {
      discover: 0,
      activities: 2,
      chat: 1,
      total: 3,
    },
    meta: {
      cacheKey: "shell-events-user-123",
      serverTime: new Date().toISOString(),
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/shell/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearShellCacheForTest();
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/shell/events`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ message: "Unauthorized" });
    });
  });

  it("returns composite payload for authenticated user", async () => {
    mockGetEventsShellData.mockResolvedValue(makeEventsShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/events`, {
        headers: { cookie },
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.user.nextStep).toBe("discover");
      expect(body.user.primaryArchetype).toBe("柯基");
      expect(body.joinedEvents).toHaveLength(1);
      expect(body.joinedEvents[0].title).toBe("周五夜聊");
      expect(body.joinedEvents[0].eventType).toBe("饭局");
      expect(body.joinedEvents[0].city).toBe("深圳");
      expect(body.joinedEvents[0].district).toBe("福田区");
      expect(body.joinedEvents[0].venueName).toBe("测试餐厅");
      expect(body.joinedEvents[0].venueAddress).toBe("福田区 test 路 1 号");
      expect(body.joinedEvents[0].registrationDeadline).toBe("2026-05-19T12:00:00.000Z");
      expect(body.joinedEvents[0].price).toBe(188);
      expect(body.joinedEvents[0].matchedAt).toBe("2026-05-19T14:00:00.000Z");
      expect(body.joinedEvents[0].groupId).toBe("group-1");
      expect(body.joinedEvents[0].finalDateTime).toBe("2026-05-20T19:00:00.000Z");
      expect(body.notifications.activities).toBe(2);
      expect(body.meta.cacheKey).toBe("shell-events-user-123");

      expect(mockGetEventsShellData).toHaveBeenCalledWith({ userId: "user-123" });

      const logCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "shell.events"
      );
      expect(logCall).toBeDefined();
      expect(logCall![1].userId).toBe("user-123");
      expect(logCall![1].cache_hit).toBe(false);
      expect(logCall![1].event_count).toBe(1);

      expect(res.headers.get("X-Response-Time")).toBeTruthy();
      expect(res.headers.get("Cache-Control")).toContain("private");
    });
  });

  it("uses cache on second request", async () => {
    mockGetEventsShellData.mockResolvedValue(makeEventsShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      await fetch(`${baseUrl}/api/shell/events`, { headers: { cookie } });
      const missCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "shell.events" && call[1].cache_hit === false
      );
      expect(missCall).toBeDefined();

      await fetch(`${baseUrl}/api/shell/events`, { headers: { cookie } });
      const hitCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "shell.events" && call[1].cache_hit === true
      );
      expect(hitCall).toBeDefined();

      expect(mockGetEventsShellData).toHaveBeenCalledTimes(1);
    });
  });

  it("returns 500 with consistent error shape on DB failure", async () => {
    mockGetEventsShellData.mockRejectedValue(new Error("DB connection lost"));

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/events`, {
        headers: { cookie },
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ message: "Failed to load Events shell" });

      const errorLog = mockLoggerError.mock.calls.find(
        (call) => call[0] === "shell.events failed"
      );
      expect(errorLog).toBeDefined();
      expect(errorLog![1].error).toBe("DB connection lost");
    });
  });
});
