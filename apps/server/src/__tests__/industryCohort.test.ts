/**
 * GET /api/inference/industry-cohort-count — route contract + predicate
 * regression suite (sprint contract
 * `.git/.orchestration/sprints/sprint-contract.industry-cohort-count.md`).
 *
 * CI runs the server suite without a live Postgres, so the data layer is the
 * mock seam — mirroring the repo's existing route-test pattern:
 *  - `../repositories/industryCohortRepo` — session identity + cohort count
 *  - `../lib/featureFlags` — kill switch (real registration maps kept for AC-6)
 * The real `requireAuth` middleware is used: with NODE_ENV=test the ban lookup
 * short-circuits (middleware/auth.ts:21), so 401 behaviour is exercised
 * end-to-end without a DB.
 * The SQL predicate itself is locked by a source-level structural test
 * (AC-7b, mirroring repositoryIndependence.test.ts).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWithServer, type RequestHelper } from "../test-utils/withServer";

const mocks = vi.hoisted(() => ({
  getIndustryCohortIdentity: vi.fn(),
  countIndustryCohortUsers: vi.fn(),
  getFeatureFlag: vi.fn(),
}));

vi.mock("../repositories/industryCohortRepo", () => ({
  getIndustryCohortIdentity: mocks.getIndustryCohortIdentity,
  countIndustryCohortUsers: mocks.countIndustryCohortUsers,
}));

vi.mock("../lib/featureFlags", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/featureFlags")>();
  return { ...original, getFeatureFlag: mocks.getFeatureFlag };
});

const { registerIndustryCohortRoutes, INDUSTRY_COHORT_MIN_COUNT } = await import(
  "../routes/domains/industryCohort"
);
const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import("../lib/featureFlags");

// ── App factory + helpers ────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));

  app.post("/__test__/login", (req, res) => {
    const { userId } = req.body ?? {};
    req.session.regenerate((err: unknown) => {
      if (err) return res.status(500).json({ message: "Session error" });
      req.session.userId = String(userId ?? "");
      req.session.save(() => res.json({ ok: true }));
    });
  });

  registerIndustryCohortRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);

async function loginAs(request: RequestHelper, userId: string): Promise<string> {
  const response = await request("/__test__/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect(cookie).not.toBe("");
  return cookie;
}

async function fetchCohortCount(request: RequestHelper, cookie?: string, query = "") {
  const response = await request(`/api/inference/industry-cohort-count${query}`, {
    headers: cookie ? { cookie } : undefined,
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: kill switch on, complete 深圳/tech identity, tiny cohort.
  mocks.getFeatureFlag.mockResolvedValue(true);
  mocks.getIndustryCohortIdentity.mockResolvedValue({
    currentCity: "深圳",
    industryCategory: "tech",
  });
  mocks.countIndustryCohortUsers.mockResolvedValue(0);
});

// ── Response contract ────────────────────────────────────────────────────────

describe("GET /api/inference/industry-cohort-count — response contract", () => {
  it("returns the exact count at the min-count boundary (10)", async () => {
    mocks.countIndustryCohortUsers.mockResolvedValue(INDUSTRY_COHORT_MIN_COUNT);

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-at-boundary");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: 10 });
      expect(mocks.countIndustryCohortUsers).toHaveBeenCalledWith("深圳", "tech");
    });
  });

  it("returns the exact count above the min count (session user included in the cohort)", async () => {
    mocks.countIndustryCohortUsers.mockResolvedValue(14);

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-count-14");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: 14 });
    });
  });

  it.each([0, 1, 9])(
    "suppresses the raw small count %i as { count: null } — raw number never serialized",
    async (rawCount) => {
      mocks.countIndustryCohortUsers.mockResolvedValue(rawCount);

      await withServer(async (_baseUrl, request) => {
        const cookie = await loginAs(request, `user-raw-${rawCount}`);
        const { status, body } = await fetchCohortCount(request, cookie);

        expect(status).toBe(200);
        expect(body).toEqual({ count: null });
        expect(JSON.stringify(body)).not.toContain(String(rawCount));
      });
    },
  );

  it("returns null when the session user's city is missing", async () => {
    mocks.getIndustryCohortIdentity.mockResolvedValue({
      currentCity: null,
      industryCategory: "tech",
    });

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-no-city");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: null });
      expect(mocks.countIndustryCohortUsers).not.toHaveBeenCalled();
    });
  });

  it("returns null when the session user's industry category is missing", async () => {
    mocks.getIndustryCohortIdentity.mockResolvedValue({
      currentCity: "深圳",
      industryCategory: null,
    });

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-no-category");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: null });
      expect(mocks.countIndustryCohortUsers).not.toHaveBeenCalled();
    });
  });

  it("returns null for whitespace-only identity values (missing after trim)", async () => {
    mocks.getIndustryCohortIdentity.mockResolvedValue({
      currentCity: "   ",
      industryCategory: "tech",
    });

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-blank-city");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: null });
      expect(mocks.countIndustryCohortUsers).not.toHaveBeenCalled();
    });
  });

  it("fails closed to null when the session user row no longer exists (stale session)", async () => {
    mocks.getIndustryCohortIdentity.mockResolvedValue(null);

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-stale-session");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: null });
      expect(mocks.getIndustryCohortIdentity).toHaveBeenCalledWith("user-stale-session");
      expect(mocks.countIndustryCohortUsers).not.toHaveBeenCalled();
    });
  });

  it("rejects unauthenticated requests with 401 before any read", async () => {
    await withServer(async (_baseUrl, request) => {
      const { status, body } = await fetchCohortCount(request);

      expect(status).toBe(401);
      expect(body).toEqual({ message: "Unauthorized" });
      expect(mocks.getFeatureFlag).not.toHaveBeenCalled();
      expect(mocks.getIndustryCohortIdentity).not.toHaveBeenCalled();
      expect(mocks.countIndustryCohortUsers).not.toHaveBeenCalled();
    });
  });
});

// ── Kill switch ──────────────────────────────────────────────────────────────

describe("kill switch — industryCohortCountEnabled", () => {
  it("is registered with the locked env fallback and a TRUE default (product decision)", () => {
    expect(FLAG_ENV_MAP.industryCohortCountEnabled).toBe("INDUSTRY_COHORT_COUNT_ENABLED");
    expect(DEFAULT_FLAG_VALUES.industryCohortCountEnabled).toBe(true);
  });

  it("serves { count: null } when off — no identity lookup, no cohort query", async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);
    mocks.countIndustryCohortUsers.mockResolvedValue(50);

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-flag-off");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(200);
      expect(body).toEqual({ count: null });
      expect(mocks.getFeatureFlag).toHaveBeenCalledWith("industryCohortCountEnabled", true);
      expect(mocks.getIndustryCohortIdentity).not.toHaveBeenCalled();
      expect(mocks.countIndustryCohortUsers).not.toHaveBeenCalled();
    });
  });
});

// ── Isolation + session scoping ──────────────────────────────────────────────

describe("isolation + session scoping (no enumeration surface)", () => {
  it("ignores query parameters — identity comes from the session only", async () => {
    mocks.countIndustryCohortUsers.mockResolvedValue(14);

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-session-scope");
      const { body } = await fetchCohortCount(
        request,
        cookie,
        "?city=广州&industryCategory=finance&userId=someone-else",
      );

      expect(body).toEqual({ count: 14 });
      expect(mocks.getIndustryCohortIdentity).toHaveBeenCalledTimes(1);
      expect(mocks.getIndustryCohortIdentity).toHaveBeenCalledWith("user-session-scope");
      expect(mocks.countIndustryCohortUsers).toHaveBeenCalledTimes(1);
      expect(mocks.countIndustryCohortUsers).toHaveBeenCalledWith("深圳", "tech");
    });
  });

  it("surfaces only the session user's same-city + same-category cohort count", async () => {
    // In-memory cohort rows honoring the documented predicate. Different-city /
    // different-category / banned / bot rows exist in the fixture but must
    // never contribute to the count surfaced for the 深圳/tech session user.
    const cohortRows = [
      ...Array.from({ length: 11 }, () => ({ city: "深圳", category: "tech", banned: false, bot: false })),
      ...Array.from({ length: 6 }, () => ({ city: "广州", category: "tech", banned: false, bot: false })),
      ...Array.from({ length: 6 }, () => ({ city: "深圳", category: "finance", banned: false, bot: false })),
      { city: "深圳", category: "tech", banned: true, bot: false },
      { city: "深圳", category: "tech", banned: false, bot: true },
    ];
    mocks.countIndustryCohortUsers.mockImplementation(async (city: string, category: string) =>
      cohortRows.filter(
        (row) => row.city === city && row.category === category && !row.banned && !row.bot,
      ).length,
    );

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-isolation");
      const { body } = await fetchCohortCount(request, cookie);

      // 11 real 深圳/tech users (incl. the session user); 12 other rows excluded.
      expect(body).toEqual({ count: 11 });
      expect(mocks.countIndustryCohortUsers).toHaveBeenCalledWith("深圳", "tech");
    });
  });
});

// ── Failure handling ─────────────────────────────────────────────────────────

describe("failure handling", () => {
  it("returns a logged 500 when the cohort count query fails", async () => {
    mocks.countIndustryCohortUsers.mockRejectedValue(new Error("db unavailable"));

    await withServer(async (_baseUrl, request) => {
      const cookie = await loginAs(request, "user-db-error");
      const { status, body } = await fetchCohortCount(request, cookie);

      expect(status).toBe(500);
      expect(body).toEqual({ message: "Failed to fetch industry cohort count" });
    });
  });
});

// ── Composition root (AC-1) ──────────────────────────────────────────────────

describe("composition root mounting (AC-1)", () => {
  it("mounts the domain router from routes.ts", () => {
    const routesSource = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../routes.ts"),
      "utf8",
    );

    expect(routesSource).toContain('from "./routes/domains/industryCohort"');
    expect(routesSource).toContain("registerIndustryCohortRoutes(app)");
  });
});

// ── Predicate lock (AC-7b) ───────────────────────────────────────────────────

describe("industryCohortRepo predicate lock (AC-7b)", () => {
  const repoSource = readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../repositories/industryCohortRepo.ts",
    ),
    "utf8",
  );

  it("counts exact-equality city AND industry-category matches", () => {
    expect(repoSource).toContain("eq(users.currentCity, city)");
    expect(repoSource).toContain("eq(users.industryCategory, category)");
    expect(repoSource).toContain("count(*)::int");
  });

  it("excludes banned users and test bots via coalesce-false predicates", () => {
    expect(repoSource).toContain("sql`coalesce(${users.isBanned}, false) = false`");
    expect(repoSource).toContain("sql`coalesce(${users.isTestBot}, false) = false`");
  });

  it("narrows the identity read to exactly the two cohort columns", () => {
    expect(repoSource).toContain("currentCity: users.currentCity");
    expect(repoSource).toContain("industryCategory: users.industryCategory");
  });
});
