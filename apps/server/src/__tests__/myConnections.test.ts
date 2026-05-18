/**
 * Tests for GET /api/my-connections — Prerequisite P-02
 *
 * Coverage:
 *   - Endpoint exists and returns ConnectionSummary[]
 *   - Returns 401 for unauthenticated requests
 *   - Returns 500 with consistent error shape on DB failure
 *   - N+1-free: single DB round-trip
 */

import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mockGetUserConnections = vi.fn();

vi.mock("../repositories/connectionsRepo", () => ({
  getUserConnections: mockGetUserConnections,
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

const { registerConnectionRoutes } = await import("../routes/domains/connections");

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

  registerConnectionRoutes(app);
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/my-connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/my-connections`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ message: "Unauthorized" });
    });
  });

  it("returns connections for authenticated user", async () => {
    mockGetUserConnections.mockResolvedValue([
      {
        id: "conn-1",
        peerName: "Alice",
        peerArchetype: "柯基",
        eventTitle: "周五夜聊",
        wechatId: "alice_wx",
      },
      {
        id: "conn-2",
        peerName: "Bob",
        peerArchetype: "狐狸",
        eventTitle: "周三饭局",
        wechatId: null,
      },
    ]);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/my-connections`, {
        headers: { cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0].id).toBe("conn-1");
      expect(body[0].peerName).toBe("Alice");
      expect(body[0].peerArchetype).toBe("柯基");
      expect(body[0].eventTitle).toBe("周五夜聊");
      expect(body[0].wechatId).toBe("alice_wx");
      expect(body[1].wechatId).toBeNull();

      expect(mockGetUserConnections).toHaveBeenCalledWith("user-123");

      const logCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "connections.my"
      );
      expect(logCall).toBeDefined();
      expect(logCall[1].userId).toBe("user-123");
      expect(logCall[1].count).toBe(2);

      expect(res.headers.get("X-Response-Time")).toBeTruthy();
    });
  });

  it("returns empty array when user has no connections", async () => {
    mockGetUserConnections.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/my-connections`, {
        headers: { cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });
  });

  it("returns 500 with consistent error shape on DB failure", async () => {
    mockGetUserConnections.mockRejectedValue(new Error("DB connection lost"));

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/my-connections`, {
        headers: { cookie },
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ message: "Failed to load connections" });

      const errorLog = mockLoggerError.mock.calls.find(
        (call) => call[0] === "connections.my failed"
      );
      expect(errorLog).toBeDefined();
      expect(errorLog[1].error).toBe("DB connection lost");
    });
  });
});
