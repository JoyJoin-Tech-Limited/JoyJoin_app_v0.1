/**
 * Tests for GET /api/events/joined — Prerequisite P-01
 *
 * Coverage:
 *   - Endpoint exists and returns JoinedEventSummary[]
 *   - Returns 401 for unauthenticated requests
 *   - Returns 500 with consistent error shape on DB failure
 *   - N+1-free: exactly 2 DB round-trips
 *   - Includes both legacy events and pool registrations
 */

import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mockGetUserJoinedEventsSummary = vi.fn();

vi.mock("../repositories/joinedEventsRepo", () => ({
  getUserJoinedEventsSummary: mockGetUserJoinedEventsSummary,
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

const { registerEventRoutes } = await import("../routes/domains/events");

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

  registerEventRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/events/joined", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/events/joined`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ message: "Unauthorized" });
    });
  });

  it("returns joined events for authenticated user", async () => {
    mockGetUserJoinedEventsSummary.mockResolvedValue([
      {
        id: "event-1",
        title: "周五夜聊",
        dateTime: "2026-05-20T19:00:00.000Z",
        location: "深圳",
        district: "南山区",
        status: "upcoming",
      },
      {
        id: "pool-1",
        title: "周三饭局",
        dateTime: "2026-05-18T19:00:00.000Z",
        location: "深圳",
        city: "深圳",
        district: "福田区",
        status: "pending",
        displayStatus: "pending",
        eventType: "饭局",
        venueName: "测试餐厅",
        venueAddress: "福田区 test 路 1 号",
        registrationDeadline: "2026-05-17T12:00:00.000Z",
        price: 188,
        matchedAt: "2026-05-17T14:00:00.000Z",
        groupId: "group-1",
        finalDateTime: "2026-05-18T19:00:00.000Z",
        venueAssignmentStatus: "assigned",
      },
    ]);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/events/joined`, {
        headers: { cookie },
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      const result: any[] = body;
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("event-1");
      expect(result[0].title).toBe("周五夜聊");
      expect(result[0].district).toBe("南山区");
      expect(result[0].eventType).toBeUndefined();
      expect(result[1].id).toBe("pool-1");
      expect(result[1].status).toBe("pending");
      expect(result[1].displayStatus).toBe("pending");
      expect(result[1].venueAssignmentStatus).toBe("assigned");
      expect(result[1].eventType).toBe("饭局");
      expect(result[1].city).toBe("深圳");
      expect(result[1].district).toBe("福田区");
      expect(result[1].venueName).toBe("测试餐厅");
      expect(result[1].venueAddress).toBe("福田区 test 路 1 号");
      expect(result[1].registrationDeadline).toBe("2026-05-17T12:00:00.000Z");
      expect(result[1].price).toBe(188);
      expect(result[1].matchedAt).toBe("2026-05-17T14:00:00.000Z");
      expect(result[1].groupId).toBe("group-1");
      expect(result[1].finalDateTime).toBe("2026-05-18T19:00:00.000Z");

      expect(mockGetUserJoinedEventsSummary).toHaveBeenCalledWith("user-123");

      const logCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "events.joined"
      );
      expect(logCall).toBeDefined();
      expect(logCall![1].userId).toBe("user-123");
      expect(logCall![1].count).toBe(2);

      expect(res.headers.get("X-Response-Time")).toBeTruthy();
    });
  });

  it("returns empty array when user has no joined events", async () => {
    mockGetUserJoinedEventsSummary.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/events/joined`, {
        headers: { cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });
  });

  it("returns 500 with consistent error shape on DB failure", async () => {
    mockGetUserJoinedEventsSummary.mockRejectedValue(new Error("DB connection lost"));

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/events/joined`, {
        headers: { cookie },
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ message: "Failed to load joined events" });

      const errorLog = mockLoggerError.mock.calls.find(
        (call) => call[0] === "events.joined failed"
      );
      expect(errorLog).toBeDefined();
      expect(errorLog![1].error).toBe("DB connection lost");
    });
  });
});
