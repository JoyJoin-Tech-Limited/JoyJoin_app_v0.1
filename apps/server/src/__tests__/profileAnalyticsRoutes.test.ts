/**
 * Tests for POST /api/analytics/profile
 */

import express from "express";
import type { AddressInfo } from "net";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../db", () => ({
  db: {
    transaction: mockTransaction,
  },
}));

vi.mock("@shared/schema", () => ({
  discoverAnalyticsEvents: "discover_analytics_events",
}));

async function buildTestApp() {
  const { registerAnalyticsRoutes } = await import("../routes/domains/analytics");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).requestId = "test-request-id";
    next();
  });
  registerAnalyticsRoutes(app);
  return app;
}

async function withServer(
  app: express.Express,
  fn: (baseUrl: string) => Promise<void>,
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

describe("POST /api/analytics/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockTransaction.mockImplementation(async (cb: any) => {
      await cb({ insert: mockInsert });
    });
  });

  it("accepts a valid profile event", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "profile_stat_tap",
          metadata: { stat: "events", value: 3 },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  it("rejects an invalid event type but returns 200 silent fail", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "unknown_event",
          metadata: {},
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(false);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  it("accepts all 5 whitelisted profile event types", async () => {
    const app = await buildTestApp();
    const types = [
      "profile_stat_tap",
      "profile_archetype_cta_tap",
      "profile_menu_tap",
      "profile_logout_tap",
      "profile_shell_retry",
    ];
    await withServer(app, async (base) => {
      for (const eventType of types) {
        const res = await fetch(`${base}/api/analytics/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType, metadata: {}, timestamp: Date.now() }),
        });
        const body: any = await res.json();
        expect(body.success).toBe(true);
      }
    });
  });
});
