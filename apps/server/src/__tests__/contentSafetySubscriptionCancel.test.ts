import express from "express";
import { createWithServer } from "../test-utils/withServer";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * S7 — POST /api/subscription/cancel content-moderation gate on `reason`:
 * validate BEFORE persist (cancelSubscription); severe → 400 +
 * recordViolation exactly once; benign → 200 + cancelled with reason.
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

const subCtx = vi.hoisted(() => ({
  getUserSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getUserSubscription: subCtx.getUserSubscription,
  },
}));

vi.mock("../subscriptionService", () => ({
  subscriptionService: {
    cancelSubscription: subCtx.cancelSubscription,
  },
}));

const { registerPaymentRoutes } = await import("../routes/domains/payments");

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
  registerPaymentRoutes(app);
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

describe("subscription cancel reason content moderation (S7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logRows.length = 0;
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetFeatureFlagSync.mockReturnValue(true);
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    subCtx.getUserSubscription.mockReset();
    subCtx.cancelSubscription.mockReset();
    subCtx.getUserSubscription.mockResolvedValue({ id: "sub-1", status: "active" });
    subCtx.cancelSubscription.mockResolvedValue({ id: "sub-1", status: "cancelled" });
  });

  it("severe reason → 400 CONTENT_VIOLATION + recordViolation exactly once, subscription NOT cancelled", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ reason: "因为看到有人宣扬毒品相关内容" }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(body.violation.source).toBe("tier0");
      expect(mockRecordViolation).toHaveBeenCalledTimes(1);
      expect(logRows).toHaveLength(1);
      expect(subCtx.cancelSubscription).not.toHaveBeenCalled();
    });
  });

  it("benign reason → 200 + subscription cancelled with the reason", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ reason: "近期活动较少" }),
      });

      expect(response.status).toBe(200);
      expect(subCtx.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(subCtx.cancelSubscription).toHaveBeenCalledWith("sub-1", "近期活动较少");
      expect(mockRecordViolation).not.toHaveBeenCalled();
      expect(logRows).toHaveLength(0);
    });
  });
});
