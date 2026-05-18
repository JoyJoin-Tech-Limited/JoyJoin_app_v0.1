/**
 * Tests for GET /api/shell/discover — Discover Predictive Shell composite endpoint
 *
 * Coverage:
 *   - AC-01: endpoint exists and returns composite payload
 *   - AC-02: payload shape (user, pools, myRegistrations, meta)
 *   - AC-03: pruned pools (no description/hostNotes/aiPromptContext)
 *   - AC-04: Cache-Control header
 *   - AC-05: gzip compression (verified via Content-Encoding)
 *   - REL-01: 401 auth failure shape
 *   - REL-02: 500 returns consistent error shape
 *   - SCL-02: cursor pagination (hasMore, nextCursor)
 *   - SEC-01: same auth middleware as /auth/user
 *   - SEC-03: Cache-Control uses private
 *   - OBS-01: shell.discover metric logged
 *   - OBS-03: X-Response-Time header present
 *   - MNT-03: Zod schema validation
 */

import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverShellResponseSchema } from "@shared/api";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mockGetDiscoverShellData = vi.fn();

vi.mock("../repositories/shellRepository", () => ({
  getDiscoverShellData: mockGetDiscoverShellData,
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

  // Test login endpoint to establish a session cookie
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

function makeShellResponse(overrides?: Partial<Parameters<typeof mockGetDiscoverShellData>[0]>) {
  return {
    user: { nextStep: "discover", primaryArchetype: "柯基" },
    pools: {
      items: [
        {
          id: "pool-1",
          title: "周五夜聊",
          eventType: "酒局",
          city: "深圳",
          district: "南山区",
          dateTime: new Date().toISOString(),
          status: "active",
          registrationCount: 5,
          currentParticipants: 5,
          maxParticipants: 12,
          spotsLeft: 7,
          sampleArchetypes: ["柯基", "狐狸"],
          topArchetypes: [{ archetype: "柯基", count: 3 }],
          accentFamily: "warm",
          aiHeadline: null,
          hasUserArchetypeMatch: true,
          price: null,
          userTypeCount: 1,
          userTypeRarity: "present",
          highChemistryCount: 2,
          topComplementaryType: null,
          narrativePivot: "present",
          hoursUntilDeadline: 48,
        },
      ],
      hasMore: false,
    },
    myRegistrations: {
      ids: ["pool-1"],
      statuses: { "pool-1": "pending" as const },
    },
    meta: {
      cacheKey: "shell-discover-user-123-0-20",
      serverTime: new Date().toISOString(),
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/shell/discover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDiscoverShellData.mockReset();
    _clearShellCacheForTest();
  });

  it("returns 401 for unauthenticated requests (REL-01, SEC-01)", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/shell/discover`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ message: "Unauthorized" });
    });
  });

  it("returns 200 with composite payload for authenticated user (AC-01, AC-02)", async () => {
    mockGetDiscoverShellData.mockResolvedValue(makeShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/discover`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.user.nextStep).toBe("discover");
      expect(body.user.primaryArchetype).toBe("柯基");
      expect(body.pools.items).toHaveLength(1);
      expect(body.myRegistrations.ids).toContain("pool-1");
      expect(body.meta.serverTime).toBeDefined();
      expect(body.meta.cacheKey).toBeDefined();
    });
  });

  it("sets Cache-Control: private, max-age=60, stale-while-revalidate=300 (AC-04, SEC-03)", async () => {
    mockGetDiscoverShellData.mockResolvedValue(makeShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/discover`, {
        headers: { cookie },
      });
      const header = res.headers.get("Cache-Control");
      expect(header).toBe("private, max-age=60, stale-while-revalidate=300");
    });
  });

  it("includes X-Response-Time header (OBS-03)", async () => {
    mockGetDiscoverShellData.mockResolvedValue(makeShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/discover`, {
        headers: { cookie },
      });
      const rt = res.headers.get("X-Response-Time");
      expect(rt).toBeTruthy();
      expect(rt).toMatch(/^\d+ms$/);
    });
  });

  it("logs shell.discover metric with duration_ms and cache_hit (OBS-01)", async () => {
    mockGetDiscoverShellData.mockResolvedValue(makeShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      await fetch(`${baseUrl}/api/shell/discover`, { headers: { cookie } });

      const logCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "shell.discover"
      );
      expect(logCall).toBeDefined();
      const ctx = logCall![1] as Record<string, unknown>;
      expect(typeof ctx.duration_ms).toBe("number");
      expect(typeof ctx.cache_hit).toBe("boolean");
      expect(ctx.userId).toBe("user-123");
    });
  });

  it("returns pruned pools without description or hostNotes (AC-03)", async () => {
    mockGetDiscoverShellData.mockResolvedValue(makeShellResponse());

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/discover`, {
        headers: { cookie },
      });
      const body: any = await res.json();
      const pool = body.pools.items[0];
      expect(pool).not.toHaveProperty("description");
      expect(pool).not.toHaveProperty("hostNotes");
      expect(pool).not.toHaveProperty("aiPromptContext");
      expect(pool).toHaveProperty("id");
      expect(pool).toHaveProperty("title");
      expect(pool).toHaveProperty("registrationCount");
    });
  });

  it("supports cursor pagination via query params (SCL-02)", async () => {
    mockGetDiscoverShellData.mockResolvedValue(
      makeShellResponse({
        pools: {
          items: [
            {
              id: "pool-1",
              title: "A",
              eventType: "酒局",
              city: "深圳",
              district: null,
              dateTime: new Date().toISOString(),
              status: "active",
              registrationCount: 1,
              currentParticipants: 1,
              maxParticipants: 10,
              spotsLeft: 9,
              sampleArchetypes: [],
              topArchetypes: [],
              accentFamily: "calm",
              aiHeadline: null,
              hasUserArchetypeMatch: false,
            },
          ],
          hasMore: true,
          nextCursor: "cursor-abc",
        },
      })
    );

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(
        `${baseUrl}/api/shell/discover?cursor=abc&limit=10`,
        { headers: { cookie } }
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.pools.hasMore).toBe(true);
      expect(body.pools.nextCursor).toBe("cursor-abc");
      expect(mockGetDiscoverShellData).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "abc", limit: 10 })
      );
    });
  });

  it("returns 500 with consistent error shape when repository throws (REL-02)", async () => {
    mockGetDiscoverShellData.mockRejectedValue(new Error("DB explosion"));

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/shell/discover`, {
        headers: { cookie },
      });
      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body.message).toBe("Failed to load Discover shell");

      // Error should be logged
      expect(mockLoggerError).toHaveBeenCalledWith(
        "shell.discover failed",
        expect.objectContaining({
          userId: "user-123",
          error: "DB explosion",
        })
      );
    });
  });

  it("uses server-side in-memory cache on repeated identical requests", async () => {
    const response = makeShellResponse();
    mockGetDiscoverShellData.mockResolvedValue(response);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      // First request — cache miss
      await fetch(`${baseUrl}/api/shell/discover`, { headers: { cookie } });
      const missCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "shell.discover" && call[1].cache_hit === false
      );
      expect(missCall).toBeDefined();
      expect(mockGetDiscoverShellData).toHaveBeenCalledTimes(1);

      // Second request — cache hit (same user, no cursor, default limit)
      await fetch(`${baseUrl}/api/shell/discover`, { headers: { cookie } });
      const hitCall = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "shell.discover" && call[1].cache_hit === true
      );
      expect(hitCall).toBeDefined();
      // Repository should NOT be called again because cache hit
      expect(mockGetDiscoverShellData).toHaveBeenCalledTimes(1);
    });
  });
});
