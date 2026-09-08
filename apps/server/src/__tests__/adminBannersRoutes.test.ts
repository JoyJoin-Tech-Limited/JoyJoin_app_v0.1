/**
 * Route tests for the admin promotion-banner CRUD endpoints:
 *   GET/POST /api/admin/banners, PATCH/DELETE /api/admin/banners/:id
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAllBanners = vi.fn();
const mockCreateBanner = vi.fn();
const mockUpdateBanner = vi.fn();
const mockDeleteBanner = vi.fn();
const mockAudit = vi.fn();

vi.mock("../repositories/pricingRepo", () => ({
  pricingRepo: {
    listAllBanners: mockListAllBanners,
    createBanner: mockCreateBanner,
    updateBanner: mockUpdateBanner,
    deleteBanner: mockDeleteBanner,
  },
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: (...args: unknown[]) => mockAudit(...args),
}));

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

const { registerAdminBannerRoutes } = await import("../routes/domains/adminBanners");

function buildTestApp(preRoute?: (req: any, _res: any, next: () => void) => void) {
  const app = express();
  app.use(express.json());
  if (preRoute) app.use(preRoute);
  registerAdminBannerRoutes(app);
  return app;
}

const stubBanner = {
  id: "b-1",
  imageUrl: "https://cdn.example.com/banner.webp",
  title: "新用户礼包",
  placement: "discover",
  isActive: true,
  sortOrder: 1,
};

describe("admin banners CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET lists all banners incl. inactive", async () => {
    mockListAllBanners.mockResolvedValue([stubBanner, { ...stubBanner, id: "b-2", isActive: false }]);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveLength(2);
    });
  });

  it("POST validates imageUrl is required", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "no image" }),
      });
      expect(res.status).toBe(400);
      expect(mockCreateBanner).not.toHaveBeenCalled();
    });
  });

  it("POST creates a banner and audit-logs BANNER_CREATED", async () => {
    mockCreateBanner.mockResolvedValue(stubBanner);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: stubBanner.imageUrl,
          title: stubBanner.title,
          placement: "discover",
          sortOrder: 1,
        }),
      });
      expect(res.status).toBe(201);
      expect(mockCreateBanner).toHaveBeenCalledTimes(1);
      expect(mockAudit).toHaveBeenCalledTimes(1);
      const audit = mockAudit.mock.calls[0][0];
      expect(audit.action).toBe("BANNER_CREATED");
      expect(audit.targetEntityType).toBe("promotion_banner");
      expect(audit.targetEntityId).toBe("b-1");
    });
  });

  it("POST persists the session userId as createdBy for legacy user-backed admins", async () => {
    mockCreateBanner.mockResolvedValue(stubBanner);
    const app = buildTestApp((req, _res, next) => {
      req.session = { userId: "user-123" };
      next();
    });
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/admin/banners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: stubBanner.imageUrl }),
      });
      expect(res.status).toBe(201);
      expect(mockCreateBanner.mock.calls[0][0].createdBy).toBe("user-123");
    });
  });

  it("POST persists createdBy=null for RBAC admin sessions (admin_accounts.id is not a users.id)", async () => {
    mockCreateBanner.mockResolvedValue(stubBanner);
    const app = buildTestApp((req, _res, next) => {
      req.adminAccount = { id: "admin-account-1", role: "operator" };
      req.adminRole = "operator";
      next();
    });
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/admin/banners`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: stubBanner.imageUrl }),
      });
      expect(res.status).toBe(201);
      // FK promotion_banners.created_by → users.id must not receive an
      // admin_accounts.id; the RBAC identity lives in the audit record only.
      expect(mockCreateBanner.mock.calls[0][0].createdBy).toBeNull();
      expect(mockAudit.mock.calls[0][0].adminId).toBe("admin-account-1");
    });
  });

  it("PATCH rejects an empty payload without bumping updatedAt or writing a no-op audit", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners/b-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(mockUpdateBanner).not.toHaveBeenCalled();
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  it("PATCH 404s when the banner does not exist", async () => {
    mockUpdateBanner.mockResolvedValue(undefined);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners/missing`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      expect(res.status).toBe(404);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  it("PATCH converts ISO date strings and audit-logs BANNER_UPDATED", async () => {
    mockUpdateBanner.mockResolvedValue({ ...stubBanner, isActive: false });
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners/b-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isActive: false,
          effectiveUntil: "2026-12-31T16:00:00.000Z",
        }),
      });
      expect(res.status).toBe(200);
      const updates = mockUpdateBanner.mock.calls[0][1];
      expect(updates.isActive).toBe(false);
      expect(updates.effectiveUntil).toBeInstanceOf(Date);
      expect(mockAudit.mock.calls[0][0].action).toBe("BANNER_UPDATED");
    });
  });

  it("DELETE removes the banner and audit-logs BANNER_DELETED", async () => {
    mockDeleteBanner.mockResolvedValue(stubBanner);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners/b-1`, { method: "DELETE" });
      expect(res.status).toBe(200);
      expect(mockDeleteBanner).toHaveBeenCalledWith("b-1");
      const audit = mockAudit.mock.calls[0][0];
      expect(audit.action).toBe("BANNER_DELETED");
      expect(audit.targetEntityId).toBe("b-1");
    });
  });

  it("DELETE 404s when the banner does not exist", async () => {
    mockDeleteBanner.mockResolvedValue(undefined);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/banners/missing`, { method: "DELETE" });
      expect(res.status).toBe(404);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });
});
