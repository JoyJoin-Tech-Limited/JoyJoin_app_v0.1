/**
 * Tests for POST /api/analytics/interaction
 *
 * Regression coverage for the M0 interaction-latency endpoint:
 * - Any arbitrary `interaction_*` eventType (open-ended suffix) is accepted
 *   and persisted with metadata (including durationMs).
 * - Non-`interaction_*` event types are silently rejected (200 with success:false).
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

describe("POST /api/analytics/interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockTransaction.mockImplementation(async (cb: any) => {
      await cb({ insert: mockInsert });
    });
  });

  it("rejects a non-interaction event type but returns 200 silent fail", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "auth_revalidation_started",
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

  it("accepts an interaction_* event and persists metadata with durationMs", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "interaction_tap_to_feedback",
          metadata: { durationMs: 312, source: "matching-status" },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "interaction_tap_to_feedback",
          poolId: null,
          metadata: expect.objectContaining({ durationMs: 312, source: "matching-status" }),
        }),
      );
    });
  });

  it("accepts arbitrary interaction_* suffixes (open-ended event names)", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "interaction_feedback_sheet_dismiss_latency_2026",
          metadata: { durationMs: 48 },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "interaction_feedback_sheet_dismiss_latency_2026",
          poolId: null,
        }),
      );
    });
  });

  it("rejects an interaction_* eventType longer than 60 chars (varchar(80) insert guard, N-1)", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: `interaction_${"x".repeat(60)}`, // 12 + 60 = 72 chars > 60 cap
          metadata: {},
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ success: false, error: "invalid eventType" });
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  it("accepts an interaction_* eventType at the exact 60-char cap (boundary)", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: `interaction_${"x".repeat(48)}`, // 12 + 48 = 60 chars, exactly at cap
          metadata: {},
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: `interaction_${"x".repeat(48)}` }),
      );
    });
  });
});
