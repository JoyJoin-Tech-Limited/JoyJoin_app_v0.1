/**
 * Tests for POST /api/analytics/squad-unboxing
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

describe("POST /api/analytics/squad-unboxing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockTransaction.mockImplementation(async (cb: any) => {
      await cb({ insert: mockInsert });
    });
  });

  it("accepts a valid squad-unboxing analytics event", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/squad-unboxing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "squad_unboxing_reveal",
          metadata: { poolId: "pool-123", method: "tap" },
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
      const res = await fetch(`${base}/api/analytics/squad-unboxing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "unknown_squad_event",
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

  it("accepts all previously whitelisted squad-unboxing event types", async () => {
    const app = await buildTestApp();
    const types = [
      "squad_unboxing_reveal",
      "squad_unboxing_reveal_drag",
      "squad_unboxing_reveal_tap",
      "squad_unboxing_card_focus",
      "squad_unboxing_confirm_attendance_tap",
      "squad_unboxing_confirm_attendance_success",
      "squad_unboxing_confirm_attendance_error",
      "squad_unboxing_share_poster_tap",
      "squad_unboxing_card_shared",
      "squad_unboxing_bubble_reveal_complete",
      "squad_unboxing_box_open_milestone",
      "match_reveal_prelude_started",
      "match_reveal_prelude_completed",
      "match_reveal_prelude_skipped",
      "match_reveal_prelude_cta_tapped",
    ];
    await withServer(app, async (base) => {
      for (const eventType of types) {
        const res = await fetch(`${base}/api/analytics/squad-unboxing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType, metadata: {}, timestamp: Date.now() }),
        });
        const body: any = await res.json();
        expect(body.success).toBe(true);
      }
    });
  });

  it("accepts the 3 new squad-unboxing event types (AC-14)", async () => {
    const app = await buildTestApp();
    const newTypes = [
      "squad_unboxing_card_flip",
      "squad_unboxing_reveal_all_tap",
      "squad_unboxing_all_revealed",
      "squad_unboxing_card_detail_dismiss",
    ];
    await withServer(app, async (base) => {
      for (const eventType of newTypes) {
        const res = await fetch(`${base}/api/analytics/squad-unboxing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType, metadata: {}, timestamp: Date.now() }),
        });
        const body: any = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      }
      expect(mockTransaction).toHaveBeenCalledTimes(newTypes.length);
    });
  });

  it("accepts the pocket-deck event types (deck_collapse / deck_reopen / auto_pocket)", async () => {
    const app = await buildTestApp();
    const pocketDeckTypes = [
      "squad_unboxing_deck_collapse",
      "squad_unboxing_deck_reopen",
      // 2026-08-19 auto-pocket handoff: fires once when the deck folds itself
      // after the live all-cards-up transition.
      "squad_unboxing_auto_pocket",
    ];
    await withServer(app, async (base) => {
      for (const eventType of pocketDeckTypes) {
        const res = await fetch(`${base}/api/analytics/squad-unboxing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            metadata:
              eventType === "squad_unboxing_deck_collapse"
                ? { groupId: "group-1", screen: "squad-unboxing", firstCollapse: true }
                : { groupId: "group-1", screen: "squad-unboxing", reopenCount: 2 },
            timestamp: Date.now(),
          }),
        });
        const body: any = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
      }
      expect(mockTransaction).toHaveBeenCalledTimes(pocketDeckTypes.length);
    });
  });

  it("accepts the ready-dwell anticipation metric (Batch A, 2026-07-24)", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/squad-unboxing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "squad_unboxing_ready_dwell",
          metadata: { groupId: "group-1", screen: "squad-unboxing", source: "box", dwellMs: 3200 },
          timestamp: Date.now(),
        }),
      });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
