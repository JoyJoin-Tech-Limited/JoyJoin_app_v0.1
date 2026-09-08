/**
 * Route tests for the admin invite/referral read endpoints:
 *   GET /api/admin/referrals/stats
 *   GET /api/admin/duo-invites
 *
 * Pattern follows adminOnboardingFunnelRoutes.test.ts: the repository is
 * mocked, admin middleware is stubbed through, and a real express app is
 * exercised over HTTP via withServer.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetReferralStats = vi.fn();
const mockListDuoInvites = vi.fn();

vi.mock("../repositories/adminReferralsRepo", () => ({
  getReferralStats: mockGetReferralStats,
  listDuoInvites: mockListDuoInvites,
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

const { registerAdminReferralRoutes } = await import("../routes/domains/adminReferrals");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerAdminReferralRoutes(app);
  return app;
}

const stubStats = {
  invitations: { totalSent: 10, totalClicks: 40, totalUses: 6, matchedTogether: 2, duoInvites: 3 },
  referrals: { totalCodes: 8, totalClicks: 20, totalConversions: 5, inviterRewardsIssued: 1, inviteeRewardsIssued: 1 },
  funnel: { invitationClickToUse: 0.15, referralClickToConversion: 0.25 },
  abuse: { selfInvitationUses: 0, selfReferralConversions: 1, totalSelfReferralFlags: 1 },
  topInviters: [{ userId: "u1", displayName: "Alice", count: 4 }],
  topReferrers: [{ userId: "u2", displayName: "Bob", count: 3 }],
};

describe("GET /api/admin/referrals/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReferralStats.mockResolvedValue(stubStats);
  });

  it("returns the aggregate stats payload", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/referrals/stats`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.invitations.totalSent).toBe(10);
      expect(body.referrals.totalConversions).toBe(5);
      expect(body.abuse.totalSelfReferralFlags).toBe(1);
      expect(body.topInviters).toHaveLength(1);
      expect(mockGetReferralStats).toHaveBeenCalledTimes(1);
    });
  });

  it("returns 500 when the repo throws", async () => {
    mockGetReferralStats.mockRejectedValueOnce(new Error("db down"));
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/referrals/stats`);
      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.message).toBeDefined();
    });
  });
});

describe("GET /api/admin/duo-invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDuoInvites.mockResolvedValue({ items: [], total: 0 });
  });

  it("applies default pagination (page 1, pageSize 20)", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/duo-invites`);
      expect(res.status).toBe(200);
      expect(mockListDuoInvites).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
      const body = (await res.json()) as any;
      expect(body).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    });
  });

  it("threads poolId + status filters through to the repo", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/duo-invites?poolId=pool-1&status=bound&page=2&pageSize=50`);
      expect(res.status).toBe(200);
      expect(mockListDuoInvites).toHaveBeenCalledWith({
        poolId: "pool-1",
        status: "bound",
        page: 2,
        pageSize: 50,
      });
    });
  });

  it("rejects an invalid status with 400", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/duo-invites?status=bogus`);
      expect(res.status).toBe(400);
      expect(mockListDuoInvites).not.toHaveBeenCalled();
    });
  });

  it("rejects pageSize above 100 with 400", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/duo-invites?pageSize=101`);
      expect(res.status).toBe(400);
      expect(mockListDuoInvites).not.toHaveBeenCalled();
    });
  });

  it("returns 500 when the repo throws", async () => {
    mockListDuoInvites.mockRejectedValueOnce(new Error("db down"));
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/duo-invites`);
      expect(res.status).toBe(500);
    });
  });
});
