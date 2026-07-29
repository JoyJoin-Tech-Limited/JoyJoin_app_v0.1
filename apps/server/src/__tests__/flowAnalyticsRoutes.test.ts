/**
 * Tests for POST /api/analytics/flow
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

describe("POST /api/analytics/flow", () => {
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
      const res = await fetch(`${base}/api/analytics/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "unknown_flow_event",
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

  it("accepts flow_banner_tap with the street split and persists key fields", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "flow_banner_tap",
          metadata: {
            flow: "intro",
            banner: "street",
            alang_enabled: false,
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
          eventType: "flow_banner_tap",
          poolId: null,
          metadata: expect.objectContaining({
            flow: "intro",
            banner: "street",
            alang_enabled: false,
          }),
        }),
      );
    });
  });

  it("accepts flow_complete and persists key fields", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "flow_complete",
          metadata: {
            flow: "lifecycle",
            dwell_ms: 7100,
            tapped_ahead: true,
            nodes_activated: 6,
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
          eventType: "flow_complete",
          poolId: null,
          metadata: expect.objectContaining({
            flow: "lifecycle",
            dwell_ms: 7100,
            tapped_ahead: true,
          }),
        }),
      );
    });
  });

  it("accepts flow_street_gate_hit (D7 tripwire) and persists key fields", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "flow_street_gate_hit",
          metadata: {
            gate: "preparing",
            source: "street_banner_storage_flag",
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
          eventType: "flow_street_gate_hit",
          poolId: null,
          metadata: expect.objectContaining({
            gate: "preparing",
          }),
        }),
      );
    });
  });
});
