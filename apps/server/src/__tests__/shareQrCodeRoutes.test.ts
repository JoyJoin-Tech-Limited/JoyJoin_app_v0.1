/**
 * Route tests for POST /api/personality/share-qrcode.
 *
 * Pattern follows connectionsShell.test.ts: real express app + express-session,
 * mocked middleware/lib boundaries, exercised over HTTP via withServer.
 */

import express from "express";
import session from "express-session";
import { createWithServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetShareQrCodeImage = vi.fn();
const mockGetOrCreateUserReferralCode = vi.fn();
const mockGetFeatureFlag = vi.fn();

vi.mock("../lib/wechatShareQrCode", async () => {
  const actual = await vi.importActual<typeof import("../lib/wechatShareQrCode")>("../lib/wechatShareQrCode");
  return {
    ...actual,
    getShareQrCodeImage: mockGetShareQrCodeImage,
  };
});

vi.mock("../lib/referralCode", () => ({
  getOrCreateUserReferralCode: mockGetOrCreateUserReferralCode,
}));

vi.mock("../lib/featureFlags", async () => {
  const actual = await vi.importActual<typeof import("../lib/featureFlags")>("../lib/featureFlags");
  return {
    ...actual,
    getFeatureFlag: mockGetFeatureFlag,
  };
});

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.session?.userId) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  },
}));

vi.mock("../rateLimiter", () => ({
  shareQrCodeLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

const { registerShareQrCodeRoutes } = await import("../routes/domains/shareQrCode");
const { buildShareQrScene } = await import("../lib/wechatShareQrCode");

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
    req.session.userId = "user-qr-1";
    req.session.save(() => {
      res.json({ ok: true });
    });
  });

  registerShareQrCodeRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function loginCookie(base: string): Promise<string> {
  const res = await fetch(`${base}/__test__/login`, { method: "POST" });
  return cookieHeader(res);
}

describe("POST /api/personality/share-qrcode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlag.mockResolvedValue(true);
    mockGetOrCreateUserReferralCode.mockResolvedValue("abc123");
    mockGetShareQrCodeImage.mockResolvedValue({ bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), cacheHit: false });
  });

  it("returns 401 when unauthenticated", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/personality/share-qrcode`, { method: "POST" });
      expect(res.status).toBe(401);
      expect(mockGetShareQrCodeImage).not.toHaveBeenCalled();
    });
  });

  it("returns 503 when the kill switch is off", async () => {
    mockGetFeatureFlag.mockResolvedValue(false);
    await withServer(async (base) => {
      const cookie = await loginCookie(base);
      const res = await fetch(`${base}/api/personality/share-qrcode`, {
        method: "POST",
        headers: { cookie },
      });
      expect(res.status).toBe(503);
      expect(mockGetShareQrCodeImage).not.toHaveBeenCalled();
    });
  });

  it("returns png bytes with the referral-code scene on success", async () => {
    await withServer(async (base) => {
      const cookie = await loginCookie(base);
      const res = await fetch(`${base}/api/personality/share-qrcode`, {
        method: "POST",
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/png");
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.length).toBe(4);
      expect(mockGetOrCreateUserReferralCode).toHaveBeenCalledWith("user-qr-1");
      expect(mockGetShareQrCodeImage).toHaveBeenCalledWith("abc123");
    });
  });

  it("maps a WeChat-side failure (null) to 503", async () => {
    mockGetShareQrCodeImage.mockResolvedValue(null);
    await withServer(async (base) => {
      const cookie = await loginCookie(base);
      const res = await fetch(`${base}/api/personality/share-qrcode`, {
        method: "POST",
        headers: { cookie },
      });
      expect(res.status).toBe(503);
    });
  });

  it("fails closed to 503 when referral-code provisioning throws", async () => {
    mockGetOrCreateUserReferralCode.mockRejectedValue(new Error("db down"));
    await withServer(async (base) => {
      const cookie = await loginCookie(base);
      const res = await fetch(`${base}/api/personality/share-qrcode`, {
        method: "POST",
        headers: { cookie },
      });
      expect(res.status).toBe(503);
    });
  });
});

describe("buildShareQrScene", () => {
  it("builds ic=<code> scenes", () => {
    expect(buildShareQrScene("abc123")).toBe("ic=abc123");
  });

  it("normalizes case", () => {
    expect(buildShareQrScene("ABC123")).toBe("ic=abc123");
  });

  it("rejects codes outside the WeChat scene charset", () => {
    expect(buildShareQrScene("有Repost")).toBeNull();
    expect(buildShareQrScene("ab c")).toBeNull();
    expect(buildShareQrScene("")).toBeNull();
  });

  it("rejects scenes that would exceed 32 chars", () => {
    expect(buildShareQrScene("a".repeat(40))).toBeNull();
  });
});
