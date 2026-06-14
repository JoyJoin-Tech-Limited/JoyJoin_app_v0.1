import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = {
  id: "user-123",
  email: "joy@example.com",
  displayName: "Joy User",
  firstName: "Joy",
  lastName: "User",
  currentCity: "Hong Kong",
  gender: "female",
  hasCompletedRegistration: true,
  hasCompletedPersonalityTest: true,
  hasCompletedInterestsCarousel: true,
  hasSeenProfileReview: true,
  password: "hashed-password",
  wechatOpenId: "mock_openid_wechat_test_route_hardening",
  wechatSessionKey: "super-secret-session-key",
  secretKey: "should-not-leak",
};

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

vi.mock("../storage", () => ({
  storage: {
    getUserByPhone: vi.fn(),
    createUserWithPhone: vi.fn(),
    getUserById: vi.fn(),
    getUser: vi.fn(),
    getAssessmentSessionByUser: vi.fn(),
    getAdminAccountById: vi.fn(),
    getAdminAccountByUsername: vi.fn(),
    updateUser: vi.fn(),
    savePreSignupData: vi.fn(),
    getPreSignupData: vi.fn(),
    clearPreSignupData: vi.fn(),
  },
}));

vi.mock("../repositories/usersRepo", () => ({
  usersRepo: {
    getUserByWechatOpenId: vi.fn(),
    createUserWithWechat: vi.fn(),
    updateUser: vi.fn(),
    getUserById: vi.fn(),
    getUser: vi.fn(),
  },
}));

const { storage } = await import("../storage");
const { usersRepo } = await import("../repositories/usersRepo");
const { registerAuthRoutes } = await import("../routes/domains/auth");

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

  app.post("/__test__/anonymous-session", (req, res) => {
    (req.session as any).anonymousMarker = "anon";
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  app.get("/__test__/session-state", (req, res) => {
    res.json({
      sessionId: req.sessionID,
      userId: req.session.userId ?? null,
      anonymousMarker: (req.session as any).anonymousMarker ?? null,
    });
  });

  registerAuthRoutes(app);
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

function stringifyConsoleCalls(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls
    .flat()
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join("\n");
}

function expectNoSensitiveAuthFields(payload: Record<string, unknown>) {
  expect(payload).not.toHaveProperty("password");
  expect(payload).not.toHaveProperty("wechatSessionKey");
  expect(payload).not.toHaveProperty("wechatOpenId");
  expect(payload).not.toHaveProperty("secretKey");
}

describe("wechat auth route hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.NODE_ENV = "test";
    process.env.APP_MODE = "production";
    process.env.PAYMENTS_ENABLED = "false";

    vi.mocked(usersRepo.getUserByWechatOpenId).mockResolvedValue(undefined as any);
    vi.mocked(usersRepo.createUserWithWechat).mockResolvedValue(mockUser as any);
    vi.mocked(usersRepo.getUserById).mockResolvedValue(mockUser as any);
    vi.mocked(storage.getUserById).mockResolvedValue(mockUser as any);
    vi.mocked(storage.getUser).mockResolvedValue(mockUser as any);
    vi.mocked(storage.getAssessmentSessionByUser).mockResolvedValue(undefined as any);
  });

  it("regenerates the session and strips sensitive fields on /api/auth/wechat/login", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await withServer(async (baseUrl) => {
        const anonymousResponse = await fetch(`${baseUrl}/__test__/anonymous-session`, {
          method: "POST",
        });
        const anonymousBody = await anonymousResponse.json() as { sessionId: string };
        const anonymousCookie = cookieHeader(anonymousResponse);

        const loginResponse = await fetch(`${baseUrl}/api/auth/wechat/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: anonymousCookie,
          },
          body: JSON.stringify({ code: "wechat_test_probe123" }),
        });
        const loginBody = await loginResponse.json() as any;

        expect(loginResponse.status).toBe(200);
        expect(loginBody).toMatchObject({ success: true, isNewUser: true });
        expectNoSensitiveAuthFields(loginBody.user);

        const authenticatedCookie = cookieHeader(loginResponse);
        expect(authenticatedCookie).toContain("connect.sid=");
        expect(authenticatedCookie).not.toBe(anonymousCookie);

        const sessionStateResponse = await fetch(`${baseUrl}/__test__/session-state`, {
          headers: { cookie: authenticatedCookie },
        });
        const sessionState = await sessionStateResponse.json() as any;

        expect(sessionState.userId).toBe(mockUser.id);
        expect(sessionState.anonymousMarker).toBeNull();
        expect(sessionState.sessionId).not.toBe(anonymousBody.sessionId);

        const consoleOutput = stringifyConsoleCalls(logSpy);
        expect(consoleOutput).not.toContain(anonymousBody.sessionId);
        expect(consoleOutput).not.toContain(sessionState.sessionId);
        expect(consoleOutput).not.toContain("connect.sid=");
      });
    } finally {
      logSpy.mockRestore();
    }
  });

  it("strips sensitive fields on /api/auth/wechat/login-with-test", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/wechat/login-with-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "wechat_test_probe123" }),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ success: true, isNewUser: true });
      expectNoSensitiveAuthFields(body.user);
    });
  });

  it("strips sensitive fields from /api/auth/user after WeChat login", async () => {
    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/api/auth/wechat/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "wechat_test_route_hardening_auth_user" }),
      });
      const authenticatedCookie = cookieHeader(loginResponse);

      const authUserResponse = await fetch(`${baseUrl}/api/auth/user`, {
        headers: { cookie: authenticatedCookie },
      });
      const authUserBody = await authUserResponse.json() as any;

      expect(authUserResponse.status).toBe(200);
      expect(authUserBody).toMatchObject({
        id: mockUser.id,
        nextStep: "discover",
        profileEssentialComplete: true,
        paymentsEnabled: false,
      });
      expectNoSensitiveAuthFields(authUserBody);
    });
  });
});