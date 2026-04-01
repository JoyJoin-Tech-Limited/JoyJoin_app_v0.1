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

// ── Build a minimal test app with the health routes ─────────────────────────
async function buildTestApp() {
  const { db } = await import("../db");
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/readyz", async (_req, res) => {
    const checks: Record<string, "ok" | "error"> = {};
    let allOk = true;

    try {
      await db.execute("SELECT 1");
      checks.database = "ok";
    } catch {
      checks.database = "error";
      allOk = false;
    }

    const criticalEnvVars = ["DATABASE_URL", "SESSION_SECRET", "WECHAT_APPID", "WECHAT_SECRET"];
    const missingVars = criticalEnvVars.filter((v) => !process.env[v]);
    if (missingVars.length > 0) {
      checks.config = "error";
      allOk = false;
    } else {
      checks.config = "ok";
    }

    res.status(allOk ? 200 : 503).json({
      status: allOk ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    });
  });

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
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(typeof body.uptime).toBe("number");
      expect(body.timestamp).toMatch(/^\d{4}-/);
    });
  });
});

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/healthz`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
    });
  });
});

describe("GET /api/readyz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test";
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.WECHAT_APPID = "wx123";
    process.env.WECHAT_SECRET = "secret";
  });

  it("returns 200 with all checks ok when DB succeeds and config is set", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body = await res.json();
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
      const body = await res.json();
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
      const body = await res.json();
      expect(res.status).toBe(503);
      expect(body.status).toBe("not_ready");
      expect(body.checks.config).toBe("error");
    });
    process.env.WECHAT_APPID = savedAppId;
  });

  it("includes a timestamp in the response", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/readyz`);
      const body = await res.json();
      expect(body.timestamp).toMatch(/^\d{4}-/);
    });
  });
});
