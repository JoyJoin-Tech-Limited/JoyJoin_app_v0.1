import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/isSingleTestMode", () => ({
  isSingleTestMode: vi.fn().mockReturnValue(true),
}));

vi.mock("../services/singleTestService", () => ({
  startSingleTestSession: vi.fn().mockResolvedValue({
    socialSessionId: "social_test_group_123",
    groupId: "test_group_123",
    botUsers: [
      { userId: "bot_user_1", displayName: "Bot One", archetype: "社牛柯基" },
      { userId: "bot_user_2", displayName: "Bot Two", archetype: "小太阳鸡" },
    ],
  }),
  cleanupSingleTestData: vi.fn().mockResolvedValue(undefined),
}));

const { registerSingleTestRoutes } = await import("../routes/domains/singleTest");
const { startSingleTestSession } = await import("../services/singleTestService");

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

  app.post("/__test__/login/:userId", (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });

  registerSingleTestRoutes(app);
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

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: "POST" });
  return cookieHeader(response);
}

describe("POST /api/test/single-test/start", () => {
  beforeEach(() => {
    vi.mocked(startSingleTestSession).mockClear();
  });

  it("returns the expected bot roster", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "tester-1");

      const response = await fetch(`${baseUrl}/api/test/single-test/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.socialSessionId).toBe("social_test_group_123");
      expect(body.groupId).toBe("test_group_123");
      expect(body.botUsers).toHaveLength(2);
      expect(body.botUsers[0]).toEqual({
        userId: "bot_user_1",
        displayName: "Bot One",
        archetype: "社牛柯基",
      });
      expect(startSingleTestSession).toHaveBeenCalledWith("tester-1");
    });
  });
});
