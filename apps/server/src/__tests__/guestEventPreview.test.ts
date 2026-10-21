/**
 * P1c 游客预告卡 (对标平台 contract AC-08) — buildGuestEventPreview unit tests.
 *
 * Covers the server-side triple gate and the zero-PII projection without a
 * live DB: flag OFF → [], qualified supply < 3 → [], full pools (spotsLeft = 0,
 * CONCERN C2) cut before the teaser with the same fail-closed < 3 semantics →
 * [], dual gate satisfied → ≤3 items, test-pool / cancelled / expired /
 * wrong-city exclusion, live seats math (detail-page口径), and fail-closed
 * degradation on DB errors.
 *
 * Contract: .git/.orchestration/sprints/sprint-contract.benchmark-full-implementation.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock: drizzle select chain ──────────────────────────────────────────
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGroupBy = vi.fn();
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("../db", () => ({ db: { select: mockSelect } }));

const mockGetFeatureFlag = vi.fn();
vi.mock("../lib/featureFlags", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/featureFlags")>();
  return {
    ...original,
    getFeatureFlag: mockGetFeatureFlag,
  };
});

const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
vi.mock("../lib/logger", () => ({ logger: mockLogger }));

const {
  buildGuestEventPreview,
  isQualifiedGuestPreviewPool,
  resolvePreviewPoolCapacity,
  GUEST_PREVIEW_DEFAULT_CITY,
  GUEST_PREVIEW_MIN_SUPPLY,
} = await import("../lib/guestEventPreview");

// ── fixtures ────────────────────────────────────────────────────────────────

interface PoolRow {
  id: string;
  title: string;
  dateTime: Date;
  district: string | null;
  eventType: string;
  status: string | null;
  isTestPool: boolean | null;
  registrationDeadline: Date | null;
  city: string | null;
  minGroupSize: number | null;
  maxGroupSize: number | null;
  targetGroups: number | null;
}

let poolSeq = 0;
function makePool(overrides: Partial<PoolRow> = {}): PoolRow {
  poolSeq += 1;
  return {
    id: `pool-${poolSeq}`,
    title: `周五夜聊酒局 ${poolSeq}`,
    dateTime: new Date("2026-11-07T12:00:00.000Z"),
    district: "南山区",
    eventType: "饭局",
    status: "active",
    isTestPool: false,
    registrationDeadline: new Date("2026-11-05T12:00:00.000Z"),
    city: "深圳",
    minGroupSize: 4,
    maxGroupSize: 6,
    targetGroups: 1,
    ...overrides,
  };
}

function configureDb(poolRows: PoolRow[], countRows: Array<{ poolId: string; count: number }>) {
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy, groupBy: mockGroupBy, limit: mockLimit });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue(poolRows);
  mockGroupBy.mockResolvedValue(countRows);
}

const PII_FIELDS = [
  "userId",
  "displayName",
  "avatarUrl",
  "wechatOpenId",
  "phone",
  "email",
  "realName",
  "nickname",
  "gender",
  "age",
  "archetype",
];

const EXPECTED_ITEM_KEYS = ["id", "title", "dateTime", "district", "eventType", "spotsLeft"].sort();

beforeEach(() => {
  vi.clearAllMocks();
  poolSeq = 0;
  mockGetFeatureFlag.mockResolvedValue(true);
  configureDb([], []);
});

// ── gate 1: flag OFF ────────────────────────────────────────────────────────

describe("buildGuestEventPreview — flag gate", () => {
  it("returns [] without touching the DB when guestEventPreviewEnabled is OFF", async () => {
    mockGetFeatureFlag.mockResolvedValue(false);

    const result = await buildGuestEventPreview();

    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockGetFeatureFlag).toHaveBeenCalledWith("guestEventPreviewEnabled");
  });
});

// ── gate 2: qualified supply < 3 ────────────────────────────────────────────

describe("buildGuestEventPreview — supply gate", () => {
  it("returns [] when qualified supply is below the frozen ≥3 threshold", async () => {
    configureDb([makePool(), makePool()], []);

    const result = await buildGuestEventPreview();

    expect(result).toEqual([]);
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it("returns [] when non-qualified rows fill the fetch but qualified stay < 3", async () => {
    const goodPool = makePool();
    configureDb(
      [
        makePool({ status: "cancelled" }),
        makePool({ isTestPool: true }),
        makePool({ city: "香港" }),
        goodPool,
      ],
      [],
    );

    const result = await buildGuestEventPreview();

    expect(result).toEqual([]);
  });
});

// ── dual gate satisfied: ≤3 items, zero PII, live seats ────────────────────

describe("buildGuestEventPreview — triple gate satisfied", () => {
  it("returns at most 3 items with the exact minimal projection (zero PII)", async () => {
    const p1 = makePool({ id: "pool-a" });
    const p2 = makePool({ id: "pool-b", maxGroupSize: 6, targetGroups: 2 });
    const p3 = makePool({ id: "pool-c", district: null });
    const p4 = makePool({ id: "pool-d" });
    configureDb(
      [p1, p2, p3, p4],
      [
        { poolId: "pool-a", count: 4 }, // capacity 6 → spotsLeft 2
        { poolId: "pool-b", count: 0 }, // capacity 12 → spotsLeft 12
        { poolId: "pool-c", count: 8 }, // capacity 6 → spotsLeft 0 → cut (Gate 3)
        { poolId: "pool-d", count: 2 }, // capacity 6 → spotsLeft 4, promoted into the teaser
      ],
    );

    const result = await buildGuestEventPreview();

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual(["pool-a", "pool-b", "pool-d"]);
    expect(result[0].spotsLeft).toBe(2);
    expect(result[1].spotsLeft).toBe(12);
    expect(result[2].spotsLeft).toBe(4);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(EXPECTED_ITEM_KEYS);
      for (const piiField of PII_FIELDS) {
        expect(Object.keys(item)).not.toContain(piiField);
      }
    }
  });

  it("serializes dateTime as an ISO string", async () => {
    const pool = makePool({ id: "pool-iso", dateTime: new Date("2026-11-07T12:00:00.000Z") });
    configureDb([pool, makePool(), makePool()], []);

    const result = await buildGuestEventPreview();

    expect(result[0].dateTime).toBe("2026-11-07T12:00:00.000Z");
  });
});

// ── exclusion semantics ─────────────────────────────────────────────────────

describe("buildGuestEventPreview — exclusions", () => {
  it("excludes test pools even when they are among the fetched candidates", async () => {
    configureDb(
      [makePool({ id: "tp", isTestPool: true }), makePool(), makePool(), makePool()],
      [],
    );

    const result = await buildGuestEventPreview();

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).not.toContain("tp");
  });

  it("defaults to Shenzhen and excludes other-city pools", async () => {
    const hk = makePool({ id: "hk", city: "香港" });
    configureDb([hk, makePool(), makePool(), makePool()], []);

    const result = await buildGuestEventPreview();

    expect(result.map((item) => item.id)).not.toContain("hk");
  });

  it("honours an explicit city query", async () => {
    const hk = makePool({ id: "hk-1", city: "香港" });
    const sz = makePool({ id: "sz-1", city: "深圳" });
    configureDb([sz, hk, makePool({ id: "hk-2", city: "香港" }), makePool({ id: "hk-3", city: "香港" })], []);

    const result = await buildGuestEventPreview("香港");

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual(["hk-1", "hk-2", "hk-3"]);
  });
});

// ── gate 3: full pools cut (CONCERN C2) ─────────────────────────────────────

describe("buildGuestEventPreview — full-pool eligibility cut (C2)", () => {
  it("excludes a full pool (spotsLeft = 0) even when supply would otherwise be ≥3", async () => {
    const full = makePool({ id: "pool-full" });
    const p2 = makePool({ id: "pool-2" });
    const p3 = makePool({ id: "pool-3" });
    const p4 = makePool({ id: "pool-4" });
    configureDb(
      [full, p2, p3, p4],
      [
        { poolId: "pool-full", count: 6 }, // capacity 6 → spotsLeft 0 → cut
        { poolId: "pool-2", count: 1 }, // capacity 6 → spotsLeft 5
      ],
    );

    const result = await buildGuestEventPreview();

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual(["pool-2", "pool-3", "pool-4"]);
    expect(result.every((item) => item.spotsLeft > 0)).toBe(true);
  });

  it("returns [] when the eligibility cut drops supply below the ≥3 threshold", async () => {
    const full = makePool({ id: "pool-full" });
    configureDb(
      [full, makePool(), makePool()],
      [{ poolId: "pool-full", count: 6 }], // 3 qualified → 2 eligible → fail-closed []
    );

    const result = await buildGuestEventPreview();

    expect(result).toEqual([]);
  });

  it("keeps a pool at the boundary spotsLeft = 1", async () => {
    const nearlyFull = makePool({ id: "pool-1left" });
    configureDb(
      [nearlyFull, makePool({ id: "pool-x" }), makePool({ id: "pool-y" })],
      [{ poolId: "pool-1left", count: 5 }], // capacity 6 → spotsLeft 1 → kept
    );

    const result = await buildGuestEventPreview();

    expect(result.map((item) => item.id)).toContain("pool-1left");
    expect(result.find((item) => item.id === "pool-1left")?.spotsLeft).toBe(1);
  });

  it("counts seats for every qualified candidate, not just the first 3", async () => {
    // A full pool sitting in the top-3 slice must not consume a teaser slot:
    // the 4th qualified pool is promoted only if its seats are counted too.
    const full = makePool({ id: "pool-full" });
    const p2 = makePool({ id: "pool-2" });
    const p3 = makePool({ id: "pool-3" });
    const p4 = makePool({ id: "pool-4" });
    configureDb(
      [full, p2, p3, p4],
      [
        { poolId: "pool-full", count: 6 }, // cut
        { poolId: "pool-4", count: 3 }, // capacity 6 → spotsLeft 3 → promoted
      ],
    );

    const result = await buildGuestEventPreview();

    expect(result.map((item) => item.id)).toContain("pool-4");
  });
});

// ── fail-closed degradation ─────────────────────────────────────────────────

describe("buildGuestEventPreview — fail-closed", () => {
  it("returns [] and logs when the DB read throws (never an error page)", async () => {
    mockLimit.mockRejectedValue(new Error("connection lost"));

    const result = await buildGuestEventPreview();

    expect(result).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to build guest event preview",
      expect.objectContaining({ city: GUEST_PREVIEW_DEFAULT_CITY }),
    );
  });

  it("returns [] and logs when the seats-count query throws", async () => {
    configureDb([makePool(), makePool(), makePool()], []);
    mockGroupBy.mockRejectedValue(new Error("count query failed"));

    const result = await buildGuestEventPreview();

    expect(result).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

// ── pure helpers ────────────────────────────────────────────────────────────

describe("isQualifiedGuestPreviewPool", () => {
  const now = new Date("2026-11-01T00:00:00.000Z");

  it("accepts an active, future-deadline, non-test, matching-city pool", () => {
    expect(isQualifiedGuestPreviewPool(makePool({ isTestPool: null }), { now, city: "深圳" })).toBe(true);
  });

  it("rejects test pools, non-active pools, expired deadlines, and city mismatches", () => {
    expect(isQualifiedGuestPreviewPool(makePool({ isTestPool: true }), { now, city: "深圳" })).toBe(false);
    expect(isQualifiedGuestPreviewPool(makePool({ status: "cancelled" }), { now, city: "深圳" })).toBe(false);
    expect(
      isQualifiedGuestPreviewPool(
        makePool({ registrationDeadline: new Date("2026-10-31T23:59:59.000Z") }),
        { now, city: "深圳" },
      ),
    ).toBe(false);
    expect(isQualifiedGuestPreviewPool(makePool({ city: "香港" }), { now, city: "深圳" })).toBe(false);
    expect(
      isQualifiedGuestPreviewPool(makePool({ registrationDeadline: null }), { now, city: "深圳" }),
    ).toBe(false);
  });
});

describe("resolvePreviewPoolCapacity", () => {
  it("uses maxGroupSize × targetGroups with the same fallbacks as the detail page", () => {
    expect(resolvePreviewPoolCapacity({ minGroupSize: 4, maxGroupSize: 6, targetGroups: 1 })).toBe(6);
    expect(resolvePreviewPoolCapacity({ minGroupSize: null, maxGroupSize: 6, targetGroups: 2 })).toBe(12);
    // maxGroupSize falls back to minGroupSize (4) when null — same as the detail page.
    expect(resolvePreviewPoolCapacity({ minGroupSize: null, maxGroupSize: null, targetGroups: null })).toBe(4);
    expect(resolvePreviewPoolCapacity({ minGroupSize: 8, maxGroupSize: 8, targetGroups: 3 })).toBe(24);
  });
});

describe("constants", () => {
  it("freezes the D3 decisions: default city, ≥3 supply threshold, ≤3 items", () => {
    expect(GUEST_PREVIEW_DEFAULT_CITY).toBe("深圳");
    expect(GUEST_PREVIEW_MIN_SUPPLY).toBe(3);
  });
});
