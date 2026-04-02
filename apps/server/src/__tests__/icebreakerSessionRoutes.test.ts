import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMocks = vi.hoisted(() => ({
  getBlindBoxEventParticipantAccess: vi.fn(),
  getIcebreakerSessionParticipantAccess: vi.fn(),
}));

vi.mock("../db", () => ({ db: {} }));
vi.mock("../lib/icebreakerAccess", () => accessMocks);
vi.mock("../repositories/icebreakerRepo", () => ({
  icebreakerRepo: {
    getIcebreakerSessionByBlindBoxEventId: vi.fn(),
    createIcebreakerSession: vi.fn(),
  },
}));

const { registerIcebreakerSessionRoutes } = await import("../routes/domains/icebreakerSessions");

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
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });

  registerIcebreakerSessionRoutes(app);
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
      server.close((error) => (error ? reject(error) : resolve()));
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

describe("icebreaker session routes", () => {
  beforeEach(() => {
    accessMocks.getBlindBoxEventParticipantAccess.mockReset();
    accessMocks.getIcebreakerSessionParticipantAccess.mockReset();
  });

  it("denies blind-box event session retrieval and creation for non-participants", async () => {
    accessMocks.getBlindBoxEventParticipantAccess.mockResolvedValue({
      allowed: false,
      status: 403,
      body: { message: "Forbidden" },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "blocked-user");

      const getResponse = await fetch(`${baseUrl}/api/events/event-1/session`, {
        headers: { cookie },
      });
      expect(getResponse.status).toBe(403);

      const postResponse = await fetch(`${baseUrl}/api/events/event-1/session`, {
        method: "POST",
        headers: { cookie },
      });
      expect(postResponse.status).toBe(403);
    });
  });

  it("returns explicit expiry status for expired session-details access", async () => {
    accessMocks.getIcebreakerSessionParticipantAccess.mockResolvedValue({
      allowed: false,
      status: 410,
      body: { message: "Icebreaker session has expired" },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/icebreaker/session/session-1`, {
        headers: { cookie },
      });

      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({
        message: "Icebreaker session has expired",
      });
    });
  });
});
