/**
 * Tests for GET /api/admin/analytics/onboarding-funnel (PR-2 query params).
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetOnboardingFunnelStats = vi.fn();

vi.mock("../repositories/onboardingFunnelRepo", () => ({
  getOnboardingFunnelStats: mockGetOnboardingFunnelStats,
}));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
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

const { registerAdminOnboardingFunnelRoutes } = await import("../routes/domains/adminOnboardingFunnel");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerAdminOnboardingFunnelRoutes(app);
  return app;
}

const stubResponse = {
  days: 30,
  since: "2026-07-25T00:00:00.000Z",
  until: null,
  steps: [],
  stitch: { anonymousSessions: 0, stitchedSessions: 0, stitchRate: 0 },
  experiments: [],
  emotion: {
    ceremonyAdvance: { auto: 0, tap: 0, autoRatio: 0 },
    slotSkip: { starts: 0, skips: 0, skipRate: 0 },
    resultStageDwell: [],
    commentaryRead: { readComplete: 0, cutShort: 0, readCompleteRatio: 0 },
  },
};

describe("GET /api/admin/analytics/onboarding-funnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOnboardingFunnelStats.mockResolvedValue(stubResponse);
  });

  it("defaults to a 30-day rolling window", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/analytics/onboarding-funnel`);
      expect(res.status).toBe(200);
      expect(mockGetOnboardingFunnelStats).toHaveBeenCalledWith(30, {});
    });
  });

  it("passes an explicit days param", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/analytics/onboarding-funnel?days=7`);
      expect(res.status).toBe(200);
      expect(mockGetOnboardingFunnelStats).toHaveBeenCalledWith(7, {});
    });
  });

  it("threads from/to ISO dates through to the repo", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(
        `${base}/api/admin/analytics/onboarding-funnel?from=2026-08-01&to=2026-08-18`,
      );
      expect(res.status).toBe(200);
      expect(mockGetOnboardingFunnelStats).toHaveBeenCalledWith(30, {
        from: new Date("2026-08-01"),
        to: new Date("2026-08-18"),
      });
    });
  });

  it("rejects an unparseable from date with 400", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(
        `${base}/api/admin/analytics/onboarding-funnel?from=not-a-date`,
      );
      expect(res.status).toBe(400);
      expect(mockGetOnboardingFunnelStats).not.toHaveBeenCalled();
    });
  });

  it("rejects from >= to with 400", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(
        `${base}/api/admin/analytics/onboarding-funnel?from=2026-08-18&to=2026-08-01`,
      );
      expect(res.status).toBe(400);
      expect(mockGetOnboardingFunnelStats).not.toHaveBeenCalled();
    });
  });

  it("rejects out-of-range days with 400", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/analytics/onboarding-funnel?days=999`);
      expect(res.status).toBe(400);
      expect(mockGetOnboardingFunnelStats).not.toHaveBeenCalled();
    });
  });

  it("returns 500 when the repo throws", async () => {
    mockGetOnboardingFunnelStats.mockRejectedValueOnce(new Error("db down"));
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/analytics/onboarding-funnel`);
      expect(res.status).toBe(500);
    });
  });
});
