import express from "express";
import session from "express-session";
import { createWithServerAndCookie } from '../test-utils/withServer';
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/userLocationRepo", () => ({
  getAggregatedHeatmap: vi.fn(),
  rollupSnapshotsForDate: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getAdminAccountById: vi.fn(),
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { getAggregatedHeatmap, rollupSnapshotsForDate } = await import("../repositories/userLocationRepo");
const { storage } = await import("../storage");
const { registerAdminGeolocationRoutes } = await import("../routes/domains/adminGeolocation");
const { requireAdmin, requireSuperAdmin } = await import("../adminAuth");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );

  registerAdminGeolocationRoutes(app);

  // Helper to set up a super-admin session bypassing admin_accounts lookup
  app.post("/__test__/super-session", (req, res) => {
    req.session.adminAccountId = "admin-1";
    req.session.adminRole = "super_admin";
    req.session.save(() => res.json({ ok: true }));
  });

  return app;
}

const withServer = createWithServerAndCookie(createApp, '/__test__/super-session');

beforeEach(() => {
  vi.clearAllMocks();
  (storage.getAdminAccountById as any).mockResolvedValue({
    id: "admin-1",
    username: "super-admin",
    role: "super_admin",
    status: "active",
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("admin geolocation routes", () => {
  it("GET /api/admin/geolocation/heatmap returns aggregate rows", async () => {
    (getAggregatedHeatmap as any).mockResolvedValue([
      {
        date: "2026-06-23",
        province: "浙江",
        city: "杭州",
        eventType: "login",
        uniqueHashedIps: 3,
        totalSnapshots: 5,
        anonymousSnapshots: 1,
      },
    ]);

    await withServer(async (baseUrl, cookie) => {
      const response = await fetch(
        `${baseUrl}/api/admin/geolocation/heatmap?startDate=2026-06-23&eventType=login`,
        { headers: { cookie: cookie ?? "" } }
      );

      expect(response.status).toBe(200);
      const body = await response.json() as { data: unknown[] };
      expect(body.data).toHaveLength(1);
      expect(getAggregatedHeatmap).toHaveBeenCalledWith({
        startDate: "2026-06-23",
        eventType: "login",
      });
    });
  });

  it("GET /api/admin/geolocation/heatmap rejects invalid query params", async () => {
    await withServer(async (baseUrl, cookie) => {
      const response = await fetch(
        `${baseUrl}/api/admin/geolocation/heatmap?startDate=not-a-date`,
        { headers: { cookie: cookie ?? "" } }
      );

      expect(response.status).toBe(400);
      const body = await response.json() as { message: string };
      expect(body.message).toBe("Invalid query parameters");
    });
  });

  it("POST /api/admin/geolocation/rollup triggers snapshot rollup", async () => {
    await withServer(async (baseUrl, cookie) => {
      const response = await fetch(`${baseUrl}/api/admin/geolocation/rollup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookie ?? "",
        },
        body: JSON.stringify({ date: "2026-06-23" }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as { success: boolean };
      expect(body.success).toBe(true);
      expect(rollupSnapshotsForDate).toHaveBeenCalledWith("2026-06-23");
    });
  });
});
