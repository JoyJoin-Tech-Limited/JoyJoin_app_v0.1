import express from "express";
import { createWithServer } from "../test-utils/withServer";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * S2 — POST /api/event-pools/:poolId/group-outcome content-moderation gate on
 * `freeTextSignal`: validate BEFORE persist; severe → 400 + recordViolation
 * exactly once; benign → 200 + persisted.
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
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("../lib/aiTraceLogger", () => ({
  logAITrace: vi.fn(),
}));

vi.mock("../services/matchHistoryDerivation", () => ({
  deriveMatchHistoryAndRefreshCalibration: vi.fn(() => Promise.resolve()),
}));

const repoCtx = vi.hoisted(() => ({
  getGroupMembershipContext: vi.fn(),
  upsertEventGroupOutcome: vi.fn(),
}));

vi.mock("../repositories/eventGroupOutcomesRepo", () => ({
  eventGroupOutcomesRepo: {
    getGroupMembershipContext: repoCtx.getGroupMembershipContext,
    upsertEventGroupOutcome: repoCtx.upsertEventGroupOutcome,
  },
}));

const { registerEventGroupOutcomeRoutes } = await import("../routes/domains/eventGroupOutcomes");

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
  registerEventGroupOutcomeRoutes(app);
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

function buildPayload(freeTextSignal?: string) {
  return {
    groupId: "group-1",
    atmosphereScore: 4,
    wouldMeetAgain: true,
    connectionRadar: { "member-2": 5 },
    icebreakerRatings: { warmup_intro: "helpful" },
    ...(freeTextSignal !== undefined ? { freeTextSignal } : {}),
  };
}

describe("group outcome freeTextSignal content moderation (S2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logRows.length = 0;
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    repoCtx.getGroupMembershipContext.mockReset();
    repoCtx.upsertEventGroupOutcome.mockReset();
    repoCtx.getGroupMembershipContext.mockResolvedValue({
      isMember: true,
      memberUserIds: ["tester-1", "member-2"],
    });
    repoCtx.upsertEventGroupOutcome.mockResolvedValue({
      outcome: { id: "outcome-1", submittedAt: new Date().toISOString() },
    });
  });

  it("severe freeTextSignal → 400 CONTENT_VIOLATION + recordViolation exactly once, nothing persisted", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildPayload("大家都很友善，但有人提到了毒品交易")),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(body.violation.source).toBe("tier0");
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(repoCtx.upsertEventGroupOutcome).not.toHaveBeenCalled();
    });
  });

  it("benign freeTextSignal → 200 + persisted with normalized value", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildPayload("Great chemistry, would meet again")),
      });

      expect(response.status).toBe(200);
      expect(repoCtx.upsertEventGroupOutcome).toHaveBeenCalledTimes(1);
      expect(repoCtx.upsertEventGroupOutcome.mock.calls[0][0].freeTextSignal).toBe(
        "Great chemistry, would meet again",
      );
      expect(mockRecordViolation).not.toHaveBeenCalled();
      expect(logRows).toHaveLength(0);
    });
  });
});
