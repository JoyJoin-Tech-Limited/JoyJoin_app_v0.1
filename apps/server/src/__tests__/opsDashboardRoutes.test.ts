/**
 * Route tests for GET /api/admin/ops-dashboard — each todayEvent now carries
 * `blindBoxEventId` (resolved via event_pool_groups.event_id →
 * blind_box_event_id) so ops can call the blind-box attendance endpoints
 * without a second lookup.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  /** Results consumed one-per db.execute(...) call, in handler order. */
  executeResults: [] as Array<{ rows: any[] }>,
}));

vi.mock("../db", () => ({
  db: {
    execute: () => Promise.resolve(h.executeResults.shift() ?? { rows: [] }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
        leftJoin: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }),
    }),
  },
}));

vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../matchingMetrics", () => ({ getMatchingMetricsSnapshot: vi.fn(() => ({})) }));
vi.mock("../lib/wecomNotifications", () => ({ notifyAdminAction: vi.fn() }));
vi.mock("../lib/fkCascadeDelete", () => ({ cascadeDeleteByIds: vi.fn() }));
vi.mock("../lib/adminAuditLogger", () => ({ logAdminAudit: vi.fn() }));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireOperatorOrAbove: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

const { registerAdminUserRoutes } = await import("../routes/domains/adminUsers");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerAdminUserRoutes(app);
  return app;
}

describe("GET /api/admin/ops-dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.executeResults.length = 0;
  });

  it("includes blindBoxEventId per today event (null when unlinked)", async () => {
    h.executeResults.push(
      {
        rows: [
          {
            id: "evt-1",
            blindBoxEventId: "bbe-1",
            title: "海底捞局",
            dateTime: new Date().toISOString(),
            location: "南山",
            status: "upcoming",
            maxAttendees: 6,
            registeredCount: "5",
            checkedInCount: "2",
          },
          {
            id: "evt-2",
            blindBoxEventId: null,
            title: "手工活动",
            dateTime: new Date().toISOString(),
            location: "福田",
            status: "upcoming",
            maxAttendees: 8,
            registeredCount: "3",
            checkedInCount: "3",
          },
        ],
      },
      { rows: [{ count: "1" }] }, // pendingReports
      { rows: [{ count: "2" }] }, // underfilledPoolsClosingSoon
      { rows: [{ count: "3" }] }, // refundsPending
      { rows: [{ count: "4" }] }, // usersStuckInOnboarding
    );

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/ops-dashboard`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.todayEvents).toHaveLength(2);
      expect(body.todayEvents[0].id).toBe("evt-1");
      expect(body.todayEvents[0].blindBoxEventId).toBe("bbe-1");
      expect(body.todayEvents[0].registeredCount).toBe(5);
      expect(body.todayEvents[0].noShowCount).toBe(3);
      expect(body.todayEvents[1].blindBoxEventId).toBeNull();

      expect(body.alerts).toEqual({
        pendingReports: 1,
        underfilledPoolsClosingSoon: 2,
        refundsPending: 3,
        usersStuckInOnboarding: 4,
      });
    });
  });
});
