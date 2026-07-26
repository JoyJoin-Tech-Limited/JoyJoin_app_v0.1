/**
 * Tests for POST /api/analytics/landing
 */

import express from "express";
import { withServerForApp as withServer } from '../test-utils/withServer';
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
  participationExperimentEvents: "participation_experiment_events",
  paymentRitualEvents: "payment_ritual_events",
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

describe("POST /api/analytics/landing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockTransaction.mockImplementation(async (cb: any) => {
      await cb({ insert: mockInsert });
    });
  });

  it("rejects an invalid event type but returns 200 silent fail", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/landing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "unknown_landing_event",
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

  it("accepts landing_cta_tap and persists key fields", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/landing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "landing_cta_tap",
          metadata: {
            cta_type: "new",
            user_next_step: "personality-test",
            has_incomplete_session: false,
            blocked_by_legal: false,
            dwell_ms: 4200,
            hero_ready: true,
            appSurface: "mini-program",
            runtime: "taro",
          },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "landing_cta_tap",
          poolId: null,
          metadata: expect.objectContaining({
            cta_type: "new",
            user_next_step: "personality-test",
            blocked_by_legal: false,
            dwell_ms: 4200,
            hero_ready: true,
          }),
        }),
      );
    });
  });

  it("accepts landing_hero_asset and persists key fields", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/landing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "landing_hero_asset",
          metadata: {
            asset: "landing-hero.webp",
            result: "fallback",
            src_type: "local",
            duration_ms: 850,
            network_type: "wifi",
          },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "landing_hero_asset",
          poolId: null,
          metadata: expect.objectContaining({
            asset: "landing-hero.webp",
            result: "fallback",
            src_type: "local",
            duration_ms: 850,
            network_type: "wifi",
          }),
        }),
      );
    });
  });

  it("accepts landing_dwell and persists key fields", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/landing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "landing_dwell",
          metadata: {
            dwell_ms: 9500,
            dwell_bucket: "8-15s",
            exit_action: "app_hide",
            cta_type_shown: "continue",
          },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "landing_dwell",
          poolId: null,
          metadata: expect.objectContaining({
            dwell_ms: 9500,
            dwell_bucket: "8-15s",
            exit_action: "app_hide",
            cta_type_shown: "continue",
          }),
        }),
      );
    });
  });
});
