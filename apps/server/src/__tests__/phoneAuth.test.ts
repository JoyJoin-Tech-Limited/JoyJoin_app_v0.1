import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  storage: {
    getUserByPhone: vi.fn(),
    createUserWithPhone: vi.fn(),
    getUserById: vi.fn(),
  },
}));

const { setupPhoneAuth } = await import("../phoneAuth");

const originalEnv = { ...process.env };

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
  setupPhoneAuth(app);
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

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("phone auth debug route registration", () => {
  it("does not register debug routes by default", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_DEV_AUTH_TOOLS;

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/debug/echo-cookie`);
      expect(response.status).toBe(404);
    });
  });

  it("registers debug routes only with explicit opt-in", async () => {
    process.env.NODE_ENV = "development";
    process.env.ENABLE_DEV_AUTH_TOOLS = "1";

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/debug/echo-cookie`);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ sessionUserId: null, sessionIsAdmin: null });
    });
  });
});
