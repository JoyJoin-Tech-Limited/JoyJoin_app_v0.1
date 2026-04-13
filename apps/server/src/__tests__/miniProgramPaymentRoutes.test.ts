import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

vi.mock("../adminAuth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../rateLimiter", () => ({
  paymentEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  webhookEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

vi.mock("../paymentService", () => ({
  paymentService: {
    assertMiniProgramAppIdConsistency: vi.fn(),
    createMiniProgramPayment: vi.fn(),
  },
}));

vi.mock("../repositories/paymentsRepo", () => ({
  paymentsRepo: {},
}));

vi.mock("../repositories/usersRepo", () => ({
  usersRepo: {
    getUser: vi.fn(),
  },
}));

vi.mock("../subscriptionService", () => ({
  subscriptionService: {
    renewSubscription: vi.fn(),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getActivePricingSettings: vi.fn(),
  },
}));

vi.mock("../phoneAuth", () => ({
  isPhoneAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {},
}));

const { paymentService } = await import("../paymentService");
const { usersRepo } = await import("../repositories/usersRepo");
const { storage } = await import("../storage");
const { registerPaymentRoutes } = await import("../routes/domains/payments");

const mockSessionUser = {
  id: "user-123",
  wechatOpenId: "session-openid-123",
};

const mockPaymentIntent = {
  wechatOrderId: "wx-order-123",
  timeStamp: "1710000000",
  nonceStr: "nonce-123",
  package: "prepay_id=mock-123",
  signType: "RSA" as const,
  paySign: "signature-123",
};

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

  app.post("/__test__/login", (req, res) => {
    req.session.userId = mockSessionUser.id;
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  registerPaymentRoutes(app);
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

describe("mini-program payment route openid handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.PAYMENTS_ENABLED = "true";

    vi.mocked(usersRepo.getUser).mockResolvedValue(mockSessionUser as any);
    vi.mocked(storage.getActivePricingSettings).mockResolvedValue([] as any);
    vi.mocked(paymentService.assertMiniProgramAppIdConsistency).mockReturnValue(undefined);
    vi.mocked(paymentService.createMiniProgramPayment).mockResolvedValue(mockPaymentIntent as any);
  });

  // Guards against regression: omitted openid must fall back to the session-owned
  // WeChat identity instead of rejecting a valid mini-program payment request.
  it("uses the session wechatOpenId when openid is omitted", async () => {
    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/__test__/login`, {
        method: "POST",
      });
      const authenticatedCookie = cookieHeader(loginResponse);

      const response = await fetch(`${baseUrl}/api/payments/miniprogram/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authenticatedCookie,
        },
        body: JSON.stringify({
          type: "event",
          eventId: "event-123",
        }),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        outTradeNo: mockPaymentIntent.wechatOrderId,
        type: "event",
      });
      expect(paymentService.createMiniProgramPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockSessionUser.id,
          paymentType: "event",
          relatedId: "event-123",
          openid: mockSessionUser.wechatOpenId,
        }),
      );
    });
  });

  // Guards against regression: a caller-supplied openid must never override a
  // different authenticated WeChat identity from the server-owned session.
  it("rejects a provided openid when it mismatches the session wechatOpenId", async () => {
    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/__test__/login`, {
        method: "POST",
      });
      const authenticatedCookie = cookieHeader(loginResponse);

      const response = await fetch(`${baseUrl}/api/payments/miniprogram/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authenticatedCookie,
        },
        body: JSON.stringify({
          type: "event",
          eventId: "event-123",
          openid: "different-openid",
        }),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(400);
      expect(body).toMatchObject({ error: "OpenID mismatch" });
      expect(paymentService.assertMiniProgramAppIdConsistency).not.toHaveBeenCalled();
      expect(paymentService.createMiniProgramPayment).not.toHaveBeenCalled();
    });
  });
});