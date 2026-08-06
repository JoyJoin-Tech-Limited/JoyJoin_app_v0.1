import express from "express";
import { createWithServer } from "../test-utils/withServer";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * S3 — POST /api/blind-box-events/:eventId/attendance-status content-moderation
 * gate on `absentReason`: validate BEFORE persist (updateAttendanceStatus) and
 * BEFORE the WebSocket broadcast — ordering is a reliability requirement.
 * Severe → 400 + recordViolation exactly once, neither persisted nor
 * broadcast; benign → 200 + persisted + broadcast.
 */

const logRows: Array<Record<string, unknown>> = [];
const mockRecordViolation = vi.fn();
const mockCheckTextWithMsgSecCheck = vi.fn();
const mockGetFeatureFlag = vi.fn();
const mockGetFeatureFlagSync = vi.fn();
const mockBroadcastAttendanceStatusUpdated = vi.fn();

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
          limit: vi.fn(() => Promise.resolve([{ wechatOpenId: "openid-test" }])),
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
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("../eventBroadcast", () => ({
  broadcastAttendanceStatusUpdated: mockBroadcastAttendanceStatusUpdated,
  broadcastPoolRegistrationAdded: vi.fn(),
}));

const storageCtx = vi.hoisted(() => ({
  getBlindBoxEventAdmin: vi.fn(),
  getUser: vi.fn(),
  updateAttendanceStatus: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getBlindBoxEventAdmin: storageCtx.getBlindBoxEventAdmin,
    getUser: storageCtx.getUser,
    updateAttendanceStatus: storageCtx.updateAttendanceStatus,
  },
}));

const { registerBlindBoxEventRoutes } = await import("../routes/domains/blindBoxEvents");

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
  registerBlindBoxEventRoutes(app);
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

describe("attendance-status absentReason content moderation (S3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logRows.length = 0;
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    storageCtx.getBlindBoxEventAdmin.mockReset();
    storageCtx.getUser.mockReset();
    storageCtx.updateAttendanceStatus.mockReset();
    storageCtx.getBlindBoxEventAdmin.mockResolvedValue({
      id: "event-1",
      userId: "owner-1",
      date_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // future → absent allowed
      matchedAttendees: [{ userId: "tester-1" }],
    });
    storageCtx.getUser.mockResolvedValue({ displayName: "Tester" });
    storageCtx.updateAttendanceStatus.mockResolvedValue({ success: true });
    mockBroadcastAttendanceStatusUpdated.mockReset();
  });

  it("severe absentReason → 400 CONTENT_VIOLATION + recordViolation exactly once, NOT persisted and NOT broadcast", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/blind-box-events/event-1/attendance-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ status: "absent", absentReason: "临时要处理一起爆炸相关的事件" }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(body.violation.source).toBe("tier0");
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(storageCtx.updateAttendanceStatus).not.toHaveBeenCalled();
      expect(mockBroadcastAttendanceStatusUpdated).not.toHaveBeenCalled();
    });
  });

  it("benign absentReason → 200 + persisted then broadcast (ordering preserved)", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/blind-box-events/event-1/attendance-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ status: "absent", absentReason: "临时出差，很遗憾" }),
      });

      expect(response.status).toBe(200);
      expect(storageCtx.updateAttendanceStatus).toHaveBeenCalledTimes(1);
      expect(storageCtx.updateAttendanceStatus).toHaveBeenCalledWith(
        "event-1",
        "tester-1",
        "absent",
        null,
        "临时出差，很遗憾",
      );
      expect(mockBroadcastAttendanceStatusUpdated).toHaveBeenCalledTimes(1);
      expect(mockRecordViolation).not.toHaveBeenCalled();
      expect(logRows).toHaveLength(0);
    });
  });
});
