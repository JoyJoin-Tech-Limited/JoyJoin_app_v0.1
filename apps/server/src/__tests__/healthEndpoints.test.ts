/**
 * Tests for /api/health and /api/readyz endpoints
 */

import express from "express";
import type { AddressInfo } from "net";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbExecute = vi.fn();

vi.mock("../db", () => ({
  db: {
    execute: mockDbExecute,
  },
}));

// ── Build a minimal test app with the shared health routes ──────────────────
async function buildTestApp() {
  const { registerHealthRoutes } = await import("../healthRoutes");
  const app = express();
  app.use(express.json());
  registerHealthRoutes(app);
  return app;
}

async function withServer(
  app: express.Express,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/health`);
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body).toEqual({ status: "ok" });
    });
  });
});

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/healthz`);
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
    });
  });
});

describe("GET /api/readyz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.WECHAT_PAY_APP_ID;
    delete process.env.WECHAT_PAY_MCH_ID;
    delete process.env.WECHAT_PAY_SERIAL_NO;
    delete process.env.WECHAT_PAY_PRIVATE_KEY;
    delete process.env.WECHAT_PAY_APIV3_KEY;
    delete process.env.WECHAT_PAY_PLATFORM_CERT;
    process.env.DATABASE_URL = "postgresql://test";
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.WECHAT_APPID = "wx1234567890abcdef";
    process.env.WECHAT_SECRET = "secret";
  });

  it("returns 200 with all checks ok when DB succeeds and config is set", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("ready");
      expect(body.checks.database).toBe("ok");
      expect(body.checks.config).toBe("ok");
    });
  });

  it("returns 503 with database=error when DB query fails", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("Connection refused"));
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body: any = await res.json();
      expect(res.status).toBe(503);
      expect(body.status).toBe("not_ready");
      expect(body.checks.database).toBe("error");
    });
  });

  it("returns 503 with config=error when a critical env var is missing", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    const savedAppId = process.env.WECHAT_APPID;
    delete process.env.WECHAT_APPID;
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body: any = await res.json();
      expect(res.status).toBe(503);
      expect(body.status).toBe("not_ready");
      expect(body.checks.config).toBe("error");
    });
    process.env.WECHAT_APPID = savedAppId;
  });

  it("returns 503 with config=error when payments are enabled without platform cert", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    process.env.PAYMENTS_ENABLED = "true";
    process.env.WECHAT_PAY_APP_ID = "wx-pay-app";
    process.env.WECHAT_PAY_MCH_ID = "mch_123";
    process.env.WECHAT_PAY_SERIAL_NO = "serial_123";
    process.env.WECHAT_PAY_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----fake";
    process.env.WECHAT_PAY_APIV3_KEY = "a".repeat(32);
    delete process.env.WECHAT_PAY_PLATFORM_CERT;

    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body: any = await res.json();
      expect(res.status).toBe(503);
      expect(body.checks.config).toBe("error");
    });
  });

  it("includes a timestamp in the response", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body: any = await res.json();
      expect(body.timestamp).toMatch(/^\d{4}-/);
    });
  });
});
