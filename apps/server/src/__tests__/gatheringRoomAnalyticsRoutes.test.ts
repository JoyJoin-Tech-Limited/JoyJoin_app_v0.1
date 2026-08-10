/**
 * Tests for POST /api/analytics/gathering-room
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

describe("POST /api/analytics/gathering-room", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockTransaction.mockImplementation(async (cb: any) => {
      await cb({ insert: mockInsert });
    });
  });

  it("accepts a valid gathering-room analytics event", async () => {
    const app = await buildTestApp();
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/analytics/gathering-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "room_entered",
          poolId: "pool-123",
          metadata: { groupId: "group-1" },
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
      const res = await fetch(`${base}/api/analytics/gathering-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "room_deleted",
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

  it("accepts all 4 whitelisted gathering-room event types", async () => {
    const app = await buildTestApp();
    const types = [
      "room_entered",
      "room_poke",
      "room_confirm_attendance",
      "room_all_present",
    ];
    await withServer(app, async (base) => {
      for (const eventType of types) {
        const res = await fetch(`${base}/api/analytics/gathering-room`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType, metadata: {}, timestamp: Date.now() }),
        });
        const body: any = await res.json();
        expect(body.success).toBe(true);
      }
    });
  });

  it("stays in sync with the shared canonical event list", async () => {
    const { GATHERING_ROOM_ANALYTICS_EVENT_TYPES } = await import("@shared/api");
    expect([...GATHERING_ROOM_ANALYTICS_EVENT_TYPES].sort()).toEqual(
      ["room_all_present", "room_confirm_attendance", "room_entered", "room_poke"].sort(),
    );
  });
});
