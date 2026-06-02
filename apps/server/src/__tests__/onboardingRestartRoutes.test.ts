import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserIncomplete = {
  id: "user-incomplete-123",
  email: "incomplete@example.com",
  displayName: "Joy User",
  firstName: "Joy",
  lastName: "User",
  currentCity: null,
  gender: null,
  hasCompletedRegistration: true,
  hasCompletedPersonalityTest: false,
  hasCompletedInterestsCarousel: false,
  hasSeenProfileReview: false,
  onboardingCheckpoint: null,
  onboardingRestartCount: 1,
  password: "hashed-password",
  wechatOpenId: "mock_openid_incomplete",
  wechatSessionKey: "super-secret-session-key",
};

const mockUserComplete = {
  id: "user-complete-123",
  email: "complete@example.com",
  displayName: "Joy Complete",
  firstName: "Joy",
  lastName: "Complete",
  currentCity: "Hong Kong",
  gender: "female",
  hasCompletedRegistration: true,
  hasCompletedPersonalityTest: true,
  hasCompletedInterestsCarousel: true,
  hasSeenProfileReview: true,
  onboardingCheckpoint: "profile-review",
  onboardingRestartCount: 2,
  password: "hashed-password",
  wechatOpenId: "mock_openid_complete",
  wechatSessionKey: "super-secret-session-key",
};

const mockUserFresh = {
  id: "user-fresh-123",
  email: "fresh@example.com",
  displayName: null,
  firstName: "Joy",
  lastName: "Fresh",
  currentCity: null,
  gender: null,
  hasCompletedRegistration: false,
  hasCompletedPersonalityTest: false,
  hasCompletedInterestsCarousel: false,
  hasSeenProfileReview: false,
  onboardingCheckpoint: null,
  onboardingRestartCount: 0,
  password: "hashed-password",
  wechatOpenId: "mock_openid_fresh",
  wechatSessionKey: "super-secret-session-key",
};

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

vi.mock("../storage", () => ({
  storage: {
    restartOnboarding: vi.fn(),
    getUser: vi.fn(),
    getAssessmentSessionByUser: vi.fn(),
  } as any,
}));

const { storage } = await import("../storage");
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

  app.post("/__test__/login", (req, res) => {
    const { userId } = req.body;
    req.session.regenerate((err: any) => {
      if (err) return res.status(500).json({ message: "Session error" });
      req.session.userId = userId;
      req.session.save(() => res.json({ ok: true }));
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

async function loginAndGetCookie(baseUrl: string, userId: string): Promise<string> {
  const loginResponse = await fetch(`${baseUrl}/__test__/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return cookieHeader(loginResponse);
}

// SKIPPED: Route POST /api/auth/onboarding/restart was removed/refactored.
// Tests need to be rewritten against the current restart implementation.
// See: apps/server/src/routes/domains/auth.ts (no restart route), onboardingRestartInvariant.test.ts
describe.skip("POST /api/auth/onboarding/restart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESTART_ONBOARDING_ENABLED = "true";
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/onboarding/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status).toBe(401);
    });
  });

  it("returns 400 when user is already fully onboarded", async () => {
    (storage as any).restartOnboarding.mockResolvedValue({
      user: mockUserComplete as any,
      action: "already_complete",
    });

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, mockUserComplete.id);
      const response = await fetch(`${baseUrl}/api/auth/onboarding/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("ONBOARDING_ALREADY_COMPLETE");
      expect(body.message).toBe("Onboarding already complete");
    });
  });

  it("returns 200 with updated user on successful restart", async () => {
    const restartedUser = {
      ...mockUserIncomplete,
      onboardingRestartCount: 2,
      displayName: null,
      hasCompletedPersonalityTest: false,
    };

    (storage as any).restartOnboarding.mockResolvedValue({
      user: restartedUser as any,
      action: "restarted",
    });

    vi.mocked(storage.getUser).mockResolvedValue(restartedUser as any);
    vi.mocked(storage.getAssessmentSessionByUser).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, mockUserIncomplete.id);
      const response = await fetch(`${baseUrl}/api/auth/onboarding/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.restartsRemaining).toBe(3); // max(0, 5 - 2)
      expect(body.features?.restartOnboarding).toBe(true);
      // hasCompletedRegistration stays true, so next step is personality-test
      expect(body.nextStep).toBe("personality-test");
      expect(body).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("wechatSessionKey");
      expect(body).not.toHaveProperty("wechatOpenId");
    });
  });

  it("returns 200 idempotently without burning a restart count", async () => {
    (storage as any).restartOnboarding.mockResolvedValue({
      user: mockUserFresh as any,
      action: "idempotent",
    });

    vi.mocked(storage.getUser).mockResolvedValue(mockUserFresh as any);
    vi.mocked(storage.getAssessmentSessionByUser).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, mockUserFresh.id);
      const response = await fetch(`${baseUrl}/api/auth/onboarding/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.restartsRemaining).toBe(5); // max(0, 5 - 0)
      expect(body.nextStep).toBe("onboarding");
    });
  });

  it("returns 404 when user is not found", async () => {
    (storage as any).restartOnboarding.mockRejectedValue(
      new Error("USER_NOT_FOUND")
    );

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, "ghost-user");
      const response = await fetch(`${baseUrl}/api/auth/onboarding/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(404);
      expect(body.message).toBe("User not found");
    });
  });

  it("computes restartsRemaining correctly at the cap boundary", async () => {
    const maxedUser = {
      ...mockUserIncomplete,
      onboardingRestartCount: 5,
    };

    (storage as any).restartOnboarding.mockResolvedValue({
      user: maxedUser as any,
      action: "restarted",
    });

    vi.mocked(storage.getUser).mockResolvedValue(maxedUser as any);
    vi.mocked(storage.getAssessmentSessionByUser).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, maxedUser.id);
      const response = await fetch(`${baseUrl}/api/auth/onboarding/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.restartsRemaining).toBe(0); // max(0, 5 - 5)
    });
  });

  it("hides the restart feature when env flag is disabled", async () => {
    process.env.RESTART_ONBOARDING_ENABLED = "false";

    vi.mocked(storage.getUser).mockResolvedValue(mockUserIncomplete as any);
    vi.mocked(storage.getAssessmentSessionByUser).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, mockUserIncomplete.id);
      const response = await fetch(`${baseUrl}/api/auth/user`, {
        headers: { cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.features?.restartOnboarding).toBe(false);
    });
  });
});
