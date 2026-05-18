import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";

vi.mock("../benchmarks/socialAIBenchmark", () => ({
  runSocialAIBenchmark: vi.fn(),
  formatBenchmarkReport: vi.fn((report: any) => `Formatted: ${report.ranAt}`),
  getDefaultModelConfigs: vi.fn(() => [
    { label: "minimax-m2.7", provider: "minimax", model: "minimax-m2.7" },
    { label: "deepseek-v4-flash", provider: "deepseek", model: "deepseek-v4-flash" },
  ]),
}));

vi.mock("../lib/socialIcebreakerStore", () => ({
  getPhaseRatings: vi.fn(),
  getMomentCardStats: vi.fn(),
}));

vi.mock("../repositories/adminOutcomeAnalyticsRepo", () => ({
  adminOutcomeAnalyticsRepo: { getDashboard: vi.fn() },
}));

vi.mock("../repositories/socialIcebreakerAiFeedbackRepo", () => ({
  socialIcebreakerAiFeedbackRepo: { getSummary: vi.fn() },
}));

vi.mock("../repositories/adminAuditLogsRepo", () => ({
  queryAdminAuditLogs: vi.fn(),
}));

vi.mock("../archetypeChemistryCalibration", () => ({
  CHEMISTRY_CALIBRATION_MIN_SAMPLES: 10,
  CHEMISTRY_CALIBRATION_MAX_DELTA: 0.2,
  listArchetypePairCalibrationDetails: vi.fn(),
}));

vi.mock("../inference/runtimeLLMFallback", () => ({
  getRuntimeLLMFallbackConfig: vi.fn(),
  getRuntimeLLMFallbackStats: vi.fn(),
}));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (req: any, res: any, next: any) => {
      if (!req.session?.adminId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    },
  };
});

const { registerAdminRoutes } = await import("../routes/domains/admin");
const { runSocialAIBenchmark } = await import("../benchmarks/socialAIBenchmark");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.post("/__setAdmin", (req, res) => {
    (req.session as any).adminId = req.body.adminId || "admin-1";
    req.session.save(() => res.json({ ok: true }));
  });

  registerAdminRoutes(app);
  return app;
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("GET /api/admin/benchmarks/social-ai", () => {
  beforeEach(() => {
    vi.mocked(runSocialAIBenchmark).mockReset();
  });

  it("returns 403 for non-admin session", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/admin/benchmarks/social-ai`);
      expect(res.status).toBe(403);
    });
  });

  it("returns benchmark report for admin session", async () => {
    vi.mocked(runSocialAIBenchmark).mockResolvedValue({
      ranAt: "2026-05-13T10:00:00.000Z",
      iterationsPerFixture: 3,
      models: [{ label: "minimax-m2.7", provider: "minimax", model: "minimax-m2.7" }],
      results: [],
      summary: [
        {
          fixtureId: "xiaoyue-comment",
          modelLabel: "minimax-m2.7",
          provider: "minimax",
          model: "minimax-m2.7",
          iterations: 3,
          successCount: 3,
          validCount: 3,
          meanLatencyMs: 100,
          p50LatencyMs: 100,
          p95LatencyMs: 120,
          p99LatencyMs: 130,
          minLatencyMs: 80,
          maxLatencyMs: 140,
        },
      ],
    });

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: "admin-1" }),
      });
      const cookie = setRes.headers.get("set-cookie")?.split(";")[0] || "";

      const res = await fetch(`${baseUrl}/api/admin/benchmarks/social-ai`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.report.iterationsPerFixture).toBe(3);
      expect(body.report.summary).toHaveLength(1);
      expect(body.report.formatted).toContain("2026-05-13T10:00:00.000Z");
    });
  });

  it("caps iterations at 10", async () => {
    vi.mocked(runSocialAIBenchmark).mockResolvedValue({
      ranAt: new Date().toISOString(),
      iterationsPerFixture: 10,
      models: [],
      results: [],
      summary: [],
    });

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: "admin-1" }),
      });
      const cookie = setRes.headers.get("set-cookie")?.split(";")[0] || "";

      await fetch(`${baseUrl}/api/admin/benchmarks/social-ai?iterations=50`, {
        headers: { Cookie: cookie },
      });

      expect(runSocialAIBenchmark).toHaveBeenCalledWith(
        expect.objectContaining({ iterations: 10 }),
      );
    });
  });

  it("filters models by whitelist", async () => {
    vi.mocked(runSocialAIBenchmark).mockResolvedValue({
      ranAt: new Date().toISOString(),
      iterationsPerFixture: 5,
      models: [],
      results: [],
      summary: [],
    });

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: "admin-1" }),
      });
      const cookie = setRes.headers.get("set-cookie")?.split(";")[0] || "";

      const res = await fetch(`${baseUrl}/api/admin/benchmarks/social-ai?models=deepseek-v4-flash,unknown-model`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const callArg = vi.mocked(runSocialAIBenchmark).mock.calls[0][0];
      expect(callArg?.models).toHaveLength(1);
      expect(callArg?.models?.[0].label).toBe("deepseek-v4-flash");
    });
  });

  it("returns 400 when no valid models remain after filtering", async () => {
    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: "admin-1" }),
      });
      const cookie = setRes.headers.get("set-cookie")?.split(";")[0] || "";

      const res = await fetch(`${baseUrl}/api/admin/benchmarks/social-ai?models=totally-invalid`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.message).toContain("No valid models");
    });
  });
});
