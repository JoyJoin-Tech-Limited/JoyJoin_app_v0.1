import express from "express";
import { createWithServer } from "../test-utils/withServer";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Feedback-activation gates (2026-10-16, plan D4/D5).
 *
 * POST /api/events/:eventId/feedback maps resolveFeedbackState onto coded
 * rejections — ineligible → 403 FEEDBACK_NOT_ELIGIBLE, locked/closed → 403
 * FEEDBACK_NOT_OPEN, submitted → 409 FEEDBACK_ALREADY_SUBMITTED — AFTER
 * canonicalEventIdGuard and BEFORE the content-moderation layer (a rejected
 * submission must never burn the tier-1 WeChat budget, and a duplicate must
 * never re-award XP). GET /api/events/:eventId/feedback-state serves the
 * client state machine and fails closed on unknown ids (404) with a coded
 * 500 on transport errors.
 */

const mockResolveFeedbackState = vi.fn();
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
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          // The canonicalEventIdGuard probes events first — resolve it so the
          // gate is reached. Everything else behaves as "no rows".
          const rows = table === events ? [{ id: "event-1" }] : [];
          const pending = Promise.resolve(rows) as Promise<typeof rows> & { limit: unknown };
          pending.limit = vi.fn(() => Promise.resolve(rows));
          return pending;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ execute: vi.fn(() => Promise.resolve()) })),
    })),
  },
}));

vi.mock("../abuseDetection", () => ({
  recordViolation: mockRecordViolation,
}));

vi.mock("../lib/feedbackStateResolver", () => ({
  resolveFeedbackState: mockResolveFeedbackState,
  FEEDBACK_OPEN_OFFSET_MS: 3 * 60 * 60 * 1000,
  FEEDBACK_ELIGIBLE_MATCH_STATUSES: ["matched", "completed"],
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

import { events } from "@shared/schema";

const storageCtx = vi.hoisted(() => ({
  createEventFeedback: vi.fn(),
  getMutualConnections: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    createEventFeedback: storageCtx.createEventFeedback,
    getMutualConnections: storageCtx.getMutualConnections,
  },
}));

const { registerSocialRoutes } = await import("../routes/domains/social");

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
  registerSocialRoutes(app);
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

function buildFeedbackPayload(overrides: Record<string, unknown> = {}) {
  return {
    atmosphereScore: 4,
    hasNewConnections: false,
    feedback: "氛围很好",
    ...overrides,
  };
}

describe("POST /api/events/:eventId/feedback activation gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    storageCtx.createEventFeedback.mockImplementation(async (_userId: string, data: any) => ({
      id: "fb-1",
      connections: data.connections ?? [],
    }));
    storageCtx.getMutualConnections.mockResolvedValue([]);
  });

  it("locked → 403 FEEDBACK_NOT_OPEN, nothing persisted, moderation untouched", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "locked", canonicalEventId: "event-1" });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload()),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(403);
      expect(body.code).toBe("FEEDBACK_NOT_OPEN");
      expect(body.message).toBe("活动还没结束，结束后再来聊聊感受吧");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
      expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  it("closed (reserved state) maps to 403 FEEDBACK_NOT_OPEN", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "closed", canonicalEventId: "event-1" });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload()),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(403);
      expect(body.code).toBe("FEEDBACK_NOT_OPEN");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });

  it("ineligible → 403 FEEDBACK_NOT_ELIGIBLE, nothing persisted", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "ineligible", canonicalEventId: null });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload()),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(403);
      expect(body.code).toBe("FEEDBACK_NOT_ELIGIBLE");
      expect(body.message).toBe("这场活动未成行，无法评价");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });

  it("resolver null (event vanished after the guard) fails closed as ineligible", async () => {
    mockResolveFeedbackState.mockResolvedValue(null);
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload()),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(403);
      expect(body.code).toBe("FEEDBACK_NOT_ELIGIBLE");
    });
  });

  it("submitted → 409 FEEDBACK_ALREADY_SUBMITTED, no duplicate write (XP loophole closed)", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "submitted", canonicalEventId: "event-1" });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload()),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(409);
      expect(body.code).toBe("FEEDBACK_ALREADY_SUBMITTED");
      expect(body.message).toBe("你已经评价过这场活动啦");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });

  it("open → proceeds to the existing pipeline (200 + persisted)", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "open", canonicalEventId: "event-1" });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload()),
      });

      expect(response.status).toBe(200);
      expect(mockResolveFeedbackState).toHaveBeenCalledWith("event-1", "tester-1");
      expect(storageCtx.createEventFeedback).toHaveBeenCalledTimes(1);
    });
  });
});

describe("GET /api/events/:eventId/feedback-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the resolver state for an authenticated viewer", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "locked", canonicalEventId: "event-1" });
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback-state`, {
        headers: { cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body).toEqual({ state: "locked" });
      expect(mockResolveFeedbackState).toHaveBeenCalledWith("event-1", "tester-1");
    });
  });

  it("404s for an id unknown to all three families", async () => {
    mockResolveFeedbackState.mockResolvedValue(null);
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/nope/feedback-state`, {
        headers: { cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(404);
      expect(body.message).toBe("未找到对应的活动");
    });
  });

  it("500s with a code on unexpected errors (never fail-closed to ineligible)", async () => {
    mockResolveFeedbackState.mockRejectedValue(new Error("db down"));
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback-state`, {
        headers: { cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(500);
      expect(body.code).toBe("server");
    });
  });

  it("requires auth", async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "open", canonicalEventId: "event-1" });
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback-state`);
      expect(response.status).toBe(401);
      expect(mockResolveFeedbackState).not.toHaveBeenCalled();
    });
  });
});
