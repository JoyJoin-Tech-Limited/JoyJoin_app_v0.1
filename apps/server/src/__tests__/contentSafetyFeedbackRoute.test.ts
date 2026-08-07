import express from "express";
import { createWithServer } from "../test-utils/withServer";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * S1 — POST /api/events/:eventId/feedback content-moderation gate.
 *
 * Multi-field surface: per-field SYNC tier-0 checks (zero network), then ONE
 * validateContentSafeAsync on the concatenated text — single 250ms budget,
 * single WeChat call. recordViolation fires EXACTLY ONCE per blocked request.
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
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          // Resolve the canonical-event-id probe first: the feedback route now
          // resolves /api/events/:eventId/feedback through resolveCanonicalEventId,
          // whose direct events.id probe must hit so the original test semantics
          // (eventId straight through) are preserved.
          const rows = table === events ? [{ id: "event-1" }] : [{ wechatOpenId: "openid-test" }];
          const pending = Promise.resolve(rows) as Promise<typeof rows> & { limit: unknown };
          pending.limit = vi.fn(() => Promise.resolve(rows));
          return pending;
        }),
      })),
    })),
    // Only content-filter-log inserts are counted; the feedback route has
    // real fire-and-forget side-effect inserts (shadow-feedback calibration)
    // that must not pollute the log-row assertion.
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === contentFilterLogs) {
          logRows.push(values);
        }
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

import { contentFilterLogs, events } from "@shared/schema";

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
    attendeeTraits: {
      "member-2": { displayName: "Bob", tags: ["funny"], needsImprovement: true, improvementNote: "聊得不错" },
    },
    ...overrides,
  };
}

describe("POST /api/events/:eventId/feedback content moderation (S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logRows.length = 0;
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    storageCtx.createEventFeedback.mockReset();
    storageCtx.getMutualConnections.mockReset();
    storageCtx.createEventFeedback.mockImplementation(async (_userId: string, data: any) => ({
      id: "fb-1",
      connections: data.connections ?? [],
    }));
    storageCtx.getMutualConnections.mockResolvedValue([]);
  });

  it("severe keyword in one field → 400 CONTENT_VIOLATION + one tier0 log + recordViolation exactly once, nothing persisted", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ feedback: "这活动不错", conversationNotes: "聊到了杀人话题" })),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(body.violation.source).toBe("tier0");
      expect(logRows).toHaveLength(1);
      expect(logRows[0].severity).toBe("severe");
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(mockRecordViolation).toHaveBeenCalledWith("tester-1", "violent", "severe");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
      expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
    });
  });

  it("benign feedback → 2xx and persisted", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ feedback: "氛围很好，聊得很开心" })),
      });

      expect(response.status).toBe(200);
      expect(storageCtx.createEventFeedback).toHaveBeenCalledTimes(1);
      expect(mockRecordViolation).not.toHaveBeenCalled();
      expect(logRows).toHaveLength(0);
    });
  });

  it("concatenation proof: 7 dirty fields in ONE submission → exactly ONE tier-1 log row and exactly ONE WeChat call", async () => {
    // All seven fields are Tier-0 clean (per-field sync checks pass), but the
    // concatenated text is flagged risky by the mocked WeChat client. If the
    // route issued one WeChat call per field, call count would be 7.
    mockCheckTextWithMsgSecCheck.mockResolvedValue({
      risky: true,
      label: 20004,
      violationType: "harassment",
      severity: "warning",
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const payload = buildFeedbackPayload({
        feedback: "大家聊得挺好",
        atmosphereNote: "气氛很放松",
        improvementOther: "希望多些互动游戏",
        conversationNotes: "话题很丰富",
        futurePreferencesOther: "下次想试试户外活动",
        additionalMatchPoints: "都喜欢旅行和摄影",
        attendeeTraits: {
          "member-2": { improvementNote: "可以多分享一些见闻" },
        },
      });
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(body.violation.source).toBe("tier1");
      // Single WeChat call — the concatenation, not one per field.
      expect(mockCheckTextWithMsgSecCheck).toHaveBeenCalledTimes(1);
      // The concatenated text is what the client saw (all 7 fields joined).
      const calledText = mockCheckTextWithMsgSecCheck.mock.calls[0][0] as string;
      expect(calledText).toContain("大家聊得挺好");
      expect(calledText).toContain("可以多分享一些见闻");
      // Exactly ONE tier-1 log row.
      if (logRows.length !== 1) {
        throw new Error(`Expected exactly 1 log row, got ${logRows.length}: ${JSON.stringify(logRows)}`);
      }
      expect(logRows[0].source).toBe("tier1:eventFeedback");
      // recordViolation exactly once (no double-count).
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(mockRecordViolation).toHaveBeenCalledWith("tester-1", "harassment", "warning");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });
});
