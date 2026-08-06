import express from "express";
import { createWithServer } from "../test-utils/withServer";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * S4 — POST /api/chat-reports content-moderation gate on `description` +
 * chat-report submission rate limiter (5 req / 5 min, keyPrefix chatReports):
 * severe → 400 + recordViolation exactly once; benign → 200; 6th rapid
 * submission → 429.
 */

const logRows: Array<Record<string, unknown>> = [];
const mockRecordViolation = vi.fn();
const mockCheckTextWithMsgSecCheck = vi.fn();
const mockGetFeatureFlag = vi.fn();
const mockGetFeatureFlagSync = vi.fn();

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
  getFeatureFlagSync: mockGetFeatureFlagSync,
  refreshFeatureFlag: vi.fn(),
  listFeatureFlags: vi.fn(),
}));

vi.mock("../lib/wechatMsgSecCheck", () => ({
  checkTextWithMsgSecCheck: mockCheckTextWithMsgSecCheck,
  warmWechatAccessToken: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ wechatOpenId: "openid-test", displayName: "Target" }])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        logRows.push(values);
        return { execute: vi.fn(() => Promise.resolve()) };
      },
    })),
  },
}));

vi.mock("../abuseDetection", () => ({
  recordViolation: mockRecordViolation,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../lib/wecomNotifications", () => ({
  notifyAbuseReport: vi.fn(() => Promise.resolve()),
}));

const storageCtx = vi.hoisted(() => ({
  createChatReport: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    createChatReport: storageCtx.createChatReport,
  },
}));

const { registerMatchingAdminRoutes } = await import("../routes/domains/matchingAdmin");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.post("/__test__/login/:userId", (req, res) => {
    (req.session as any).userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  registerMatchingAdminRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response): string {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function login(baseUrl: string, userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: "POST" });
  return cookieHeader(response);
}

function buildPayload(description: string) {
  return {
    messageId: "msg-1",
    reportedBy: "tester-1",
    reportedUserId: "user-2",
    reportType: "harassment",
    description,
  };
}

describe("chat-reports content moderation + limiter (S4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logRows.length = 0;
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    storageCtx.createChatReport.mockReset();
    storageCtx.createChatReport.mockResolvedValue({
      id: "report-1",
      status: "pending",
      category: "harassment",
      reportType: "harassment",
    });
  });

  it("severe description → 400 CONTENT_VIOLATION + recordViolation exactly once, report not created", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/chat-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildPayload("对方在群里宣扬恐怖袭击内容")),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(body.violation.source).toBe("tier0");
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(storageCtx.createChatReport).not.toHaveBeenCalled();
    });
  });

  it("benign description → 201 + report created", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/chat-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildPayload("发了重复消息，有点打扰")),
      });

      expect(response.status).toBe(200);
      expect(storageCtx.createChatReport).toHaveBeenCalledTimes(1);
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  it("rate limiter: 429 after the 5-per-5-min threshold", async () => {
    await withServer(async (baseUrl) => {
      // Fresh user so the shared in-memory limiter window starts at zero.
      const cookie = await login(baseUrl, "limiter-user");

      for (let i = 0; i < 5; i += 1) {
        const okResponse = await fetch(`${baseUrl}/api/chat-reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify(buildPayload(`第 ${i} 次正常举报`)),
        });
        expect(okResponse.status).toBe(200);
      }

      const limitedResponse = await fetch(`${baseUrl}/api/chat-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildPayload("第 6 次应该被限流")),
      });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.headers.get("Retry-After")).toBeTruthy();
      // The limiter rejects BEFORE the handler: no new report, no escalation.
      expect(storageCtx.createChatReport).toHaveBeenCalledTimes(5);
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });
});
