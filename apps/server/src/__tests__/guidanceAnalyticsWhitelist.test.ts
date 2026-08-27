/**
 * Tests for the D7 onboarding-guidance funnel whitelist on
 * POST /api/analytics/discover (2026-08-27, ships WITH W1).
 *
 * The 8 event types are UNCONDITIONAL (not flag-gated) so the 2-week baseline
 * clock starts at W1 deploy. Same minimal-metadata fail-open pattern as
 * flash_search_started: unknown events are silently ignored (200 +
 * success:false) and never inserted.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
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

const D7_GUIDANCE_EVENT_TYPES = [
  "onboarding_intro_viewed",
  "personality_test_started",
  "personality_test_completed",
  "discover_first_arrival",
  "registration_started",
  "registration_paid",
  "guidance_shown",
  "guidance_dismissed",
] as const;

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

describe("POST /api/analytics/discover — D7 guidance funnel whitelist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockTransaction.mockImplementation(async (cb: any) => {
      await cb({ insert: mockInsert });
    });
  });

  it.each(D7_GUIDANCE_EVENT_TYPES.map((eventType) => [eventType]))(
    "accepts %s and persists it",
    async (eventType) => {
      const app = await buildTestApp();
      await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/analytics/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            metadata:
              eventType === "guidance_dismissed"
                ? { tipId: "discover_arrival", reason: "button" }
                : eventType === "guidance_shown"
                  ? { tipId: "discover_arrival" }
                  : {},
            timestamp: Date.now(),
          }),
        });
        const body: any = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ eventType }),
        );
      });
    },
  );

  it("rejects a non-whitelisted event (200 silent fail, no insert)", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "guidance_secret_tracking",
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
});
