/**
 * Tests for the Reports domain router.
 *
 * Coverage:
 *   - POST /api/reports rejects unauthenticated requests
 *   - POST /api/reports validates the request body
 *   - POST /api/reports rejects descriptions that fail content safety
 *   - POST /api/reports creates a report for authenticated users
 *   - GET /api/admin/reports/ai-content is gated by admin auth
 *   - GET /api/admin/reports/ai-content lists AI-content reports with pagination
 */

import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn((a: any, b: any) => ({ a, b }));
const mockAnd = vi.fn((...conditions: any[]) => conditions);
const mockDesc = vi.fn((col: any) => ({ col, direction: 'desc' }));
const mockSql = vi.fn(() => ({
  as: vi.fn((alias: string) => ({ alias, kind: 'sql_count' })),
})) as any;

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
  desc: mockDesc,
  sql: mockSql,
}));

vi.mock("../db", () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
  },
}));

vi.mock("@shared/schema", () => ({
  reports: {
    id: { name: 'id' },
    reporterId: { name: 'reporter_id' },
    reportedUserId: { name: 'reported_user_id' },
    category: { name: 'category' },
    description: { name: 'description' },
    relatedEventId: { name: 'related_event_id' },
    status: { name: 'status' },
    reviewedBy: { name: 'reviewed_by' },
    reviewedAt: { name: 'reviewed_at' },
    resolution: { name: 'resolution' },
    createdAt: { name: 'created_at' },
  },
  users: {
    id: { name: 'id' },
    displayName: { name: 'display_name' },
    wechatNickname: { name: 'wechat_nickname' },
  },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (req.session?.userId) {
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  },
}));

vi.mock("../adminAuth", () => ({
  requireAdmin: (req: any, _res: any, next: any) => {
    if (req.session?.adminRole === 'operator' || req.session?.adminRole === 'super_admin') {
      return next();
    }
    return _res.status(403).json({ message: "Forbidden" });
  },
  requireOperatorOrAbove: (_req: any, _res: any, next: any) => next(),
}));

const mockValidateContentSafe = vi.fn();

vi.mock("../lib/contentSafety", () => ({
  validateContentSafe: mockValidateContentSafe,
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

vi.mock("../rateLimiter", () => ({
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

const { registerReportRoutes } = await import("../routes/domains/reports");

// ── Test helpers ─────────────────────────────────────────────────────────────

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

  app.post("/__test__/login-admin", (req, res) => {
    req.session.userId = "admin-123";
    req.session.adminRole = "operator";
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  registerReportRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateContentSafe.mockReturnValue({ safe: true });
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "ai_content", description: "test" }),
      });
      expect(res.status).toBe(401);
    });
  });

  it("returns 400 for invalid request body", async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ category: "ai_content" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe("Invalid report body");
    });
  });

  it("returns 400 when description fails content safety", async () => {
    mockValidateContentSafe.mockReturnValue({
      safe: false,
      violation: {
        type: "harassment",
        severity: "warning",
        field: "reportDescription",
        message: "内容包含不当用语",
        matchedKeywords: ["傻逼"],
      },
    });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ category: "ai_content", description: "你这个傻逼" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(mockValidateContentSafe).toHaveBeenCalledWith("你这个傻逼", "reportDescription");
    });
  });

  it("creates a report and returns 201 for valid requests", async () => {
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(() =>
          Promise.resolve([
            {
              id: "report-1",
              category: "ai_content",
              description: "这段 AI 内容有问题",
              status: "pending",
              reporterId: "user-123",
            },
          ])
        ),
      })),
    });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          category: "ai_content",
          description: "这段 AI 内容有问题",
          relatedEventId: "pool-1",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; category: string; status: string };
      expect(body.id).toBe("report-1");
      expect(body.category).toBe("ai_content");
      expect(body.status).toBe("pending");

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "[Reports] created",
        expect.objectContaining({ reportId: "report-1", category: "ai_content", userId: "user-123" })
      );
    });
  });
});

describe("GET /api/admin/reports/ai-content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin sessions", async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/admin/reports/ai-content?status=pending`, {
        headers: { cookie },
      });

      expect(res.status).toBe(403);
    });
  });

  it("returns paginated AI-content reports for operators", async () => {
    const listResult = [
      {
        report: {
          id: "report-1",
          category: "ai_content",
          description: "AI 内容有问题",
          status: "pending",
          createdAt: new Date().toISOString(),
        },
        reporterDisplayName: "User One",
        reporterWechatNickname: null,
      },
    ];

    const listChain: any = {};
    Object.assign(listChain, {
      from: vi.fn(() => listChain),
      leftJoin: vi.fn(() => listChain),
      where: vi.fn(() => listChain),
      orderBy: vi.fn(() => listChain),
      limit: vi.fn(() => listChain),
      offset: vi.fn(() => Promise.resolve(listResult)),
    });

    const countChain: any = {};
    Object.assign(countChain, {
      from: vi.fn(() => countChain),
      where: vi.fn(() => Promise.resolve([{ count: 1 }])),
    });

    mockSelect.mockImplementation((fields: any) => {
      // Count query selects a single `count` field; list query selects report + reporter fields.
      return fields?.count ? countChain : listChain;
    });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login-admin`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/admin/reports/ai-content?status=pending&page=1&pageSize=20`, {
        headers: { cookie },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { reports: Array<{ category: string }>; pagination: { page: number; totalPages: number } };
      expect(body.reports).toHaveLength(1);
      expect(body.reports[0].category).toBe("ai_content");
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.totalPages).toBe(1);
    });
  });
});
