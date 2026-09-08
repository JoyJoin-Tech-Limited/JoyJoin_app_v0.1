/**
 * Route tests for POST /api/admin/blind-box-events/:eventId/chase-attendees
 * (devTools.ts) — real fan-out of in-app attendance reminders to the event's
 * not-yet-confirmed attendees + admin audit.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  /** Results consumed one-per db.select(...) call (event, then statuses). */
  selectResults: [] as any[][],
  mockNotify: null as any,
  mockAudit: null as any,
}));

vi.mock("../db", () => ({
  db: {
    select: () => {
      const result = h.selectResults.shift() ?? [];
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(result),
        // Terminal await without .limit() (the status query ends at .where()).
        then: (resolve: (v: any) => void) => resolve(result),
      };
      return chain;
    },
  },
}));

vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: {
    createNotification: (...args: unknown[]) => h.mockNotify(...args),
  },
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: (...args: unknown[]) => h.mockAudit(...args),
}));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireOperatorOrAbove: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../auth/policy", () => ({
  isDevAuthToolsEnabled: () => false,
}));

vi.mock("../storage", () => ({ storage: {} }));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

const { registerDevToolRoutes } = await import("../routes/domains/devTools");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerDevToolRoutes(app);
  return app;
}

const EVENT = {
  id: "bbe-1",
  title: "海底捞南山店",
  matchedAttendees: [
    { userId: "u-1", displayName: "小A" },
    { userId: "u-2", displayName: "小B" },
    { userId: "u-3", displayName: "小C" },
  ],
};

describe("POST /api/admin/blind-box-events/:eventId/chase-attendees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectResults.length = 0;
    h.mockNotify = vi.fn().mockResolvedValue(undefined);
    h.mockAudit = vi.fn();
  });

  it("404s when the blind-box event does not exist", async () => {
    h.selectResults.push([]); // no event row
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/blind-box-events/bbe-missing/chase-attendees`, {
        method: "POST",
      });
      expect(res.status).toBe(404);
      expect(h.mockNotify).not.toHaveBeenCalled();
      expect(h.mockAudit).not.toHaveBeenCalled();
    });
  });

  it("fans out reminders to not-yet-confirmed attendees and audits the count", async () => {
    h.selectResults.push(
      [EVENT], // event lookup
      [{ userId: "u-1", status: "confirmed" }], // only u-1 confirmed
    );
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/blind-box-events/bbe-1/chase-attendees`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ ok: true, notified: 2 });

      // u-2 and u-3 notified; u-1 skipped (already confirmed).
      expect(h.mockNotify).toHaveBeenCalledTimes(2);
      const notifiedUserIds = h.mockNotify.mock.calls.map((c: any[]) => c[0].userId);
      expect(notifiedUserIds).toEqual(["u-2", "u-3"]);
      const firstNotification = h.mockNotify.mock.calls[0][0];
      expect(firstNotification.title).toContain("确认出席");
      expect(firstNotification.title).not.toMatch(/匹配|社交/);
      expect(firstNotification.relatedResourceId).toBe("bbe-1");

      expect(h.mockAudit).toHaveBeenCalledTimes(1);
      const audit = h.mockAudit.mock.calls[0][0];
      expect(audit.action).toBe("BLIND_BOX_CHASE_ATTENDEES");
      expect(audit.targetEntityType).toBe("blind_box_event");
      expect(audit.targetEntityId).toBe("bbe-1");
      expect(audit.context.notified).toBe(2);
      expect(audit.context.pendingCount).toBe(2);
      expect(audit.context.attendeeCount).toBe(3);
    });
  });

  it("sends nothing when every attendee already confirmed", async () => {
    h.selectResults.push(
      [EVENT],
      [
        { userId: "u-1", status: "confirmed" },
        { userId: "u-2", status: "confirmed" },
        { userId: "u-3", status: "confirmed" },
      ],
    );
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/blind-box-events/bbe-1/chase-attendees`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      expect((await res.json()) as any).toEqual({ ok: true, notified: 0 });
      expect(h.mockNotify).not.toHaveBeenCalled();
      expect(h.mockAudit).toHaveBeenCalledTimes(1);
    });
  });
});
