import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * W4 — Reconnect the feedback fuel line.
 *
 * This suite is the regression lock for the whole pipeline:
 *   shipping client call → POST /api/event-pools/:poolId/group-outcome
 *     → event_group_outcomes → match_history → archetype-pair calibration
 *     → predictive auto-disable guard.
 *
 * Before W4 every writer in this chain existed but nothing in production called
 * the route: the client posted only to the legacy `/api/events/:eventId/feedback`
 * (`event_feedback`) table, and `updateWeightsAfterFeedback` had no caller. The
 * AC-W4.1 assertions below assert the shipping caller/writer inventory and are
 * the red→green repro (they fail on the pre-W4 tree, which had no caller).
 */

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const {
  sources,
  matchHistoryStore,
  syncMatchHistoryPairsForGroupMock,
  aggregateArchetypePairFeedbackRowsMock,
  upsertArchetypePairFeedbackStatsMock,
  listArchetypePairFeedbackStatsMock,
  storedStats,
  loggerInfo,
  loggerWarn,
  loggerError,
} = vi.hoisted(() => ({
  sources: new Map<string, any>(),
  // In-memory match_history stand-in: `${eventId}|${userA}|${userB}` -> row.
  matchHistoryStore: new Map<string, any>(),
  syncMatchHistoryPairsForGroupMock: vi.fn(),
  aggregateArchetypePairFeedbackRowsMock: vi.fn(),
  upsertArchetypePairFeedbackStatsMock: vi.fn(),
  listArchetypePairFeedbackStatsMock: vi.fn(),
  storedStats: { rows: [] as any[] },
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../repositories/matchHistoryRepo", () => ({
  getGroupDerivationSource: vi.fn(async (groupId: string) => sources.get(groupId) ?? null),
  syncMatchHistoryPairsForGroup: syncMatchHistoryPairsForGroupMock,
}));

vi.mock("../repositories/archetypePairFeedbackStatsRepo", () => ({
  aggregateArchetypePairFeedbackRows: aggregateArchetypePairFeedbackRowsMock,
  upsertArchetypePairFeedbackStats: upsertArchetypePairFeedbackStatsMock,
  listArchetypePairFeedbackStats: listArchetypePairFeedbackStatsMock,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
    debug: vi.fn(),
  },
}));

const {
  buildPairRowsForGroup,
  derivePairRowsForGroup,
  deriveMatchHistoryAndRefreshCalibration,
} = await import("../services/matchHistoryDerivation");
const { getArchetypePairCalibrationMap } = await import("../archetypeChemistryCalibration");
const { getPredictiveRerankAutoDisableReason } = await import("../predictiveRerankingService");

/** Synthetic archetypes so the real calibration map can key the derived pairs. */
const USER_ARCHETYPES: Record<string, string> = {
  u1: "koala",
  u2: "koala",
  u3: "dolphin_calm",
  u4: "dolphin_calm",
};

function pairKey(eventId: string, userA: string, userB: string): string {
  return `${eventId}|${[userA, userB].sort().join("|")}`;
}

/** Mirror the repo's idempotent merge so the flow is exercised, not mocked away. */
function installInMemorySync() {
  syncMatchHistoryPairsForGroupMock.mockImplementation(
    async (input: { eventId: string; rows: any[] }) => {
      let insertedCount = 0;
      let updatedCount = 0;
      for (const row of input.rows) {
        const key = pairKey(input.eventId, row.user1Id, row.user2Id);
        const existing = matchHistoryStore.get(key);
        if (existing) {
          matchHistoryStore.set(key, {
            ...existing,
            connectionQuality: row.connectionQuality,
            wouldMeetAgain: row.wouldMeetAgain,
          });
          updatedCount += 1;
        } else {
          matchHistoryStore.set(key, { ...row });
          insertedCount += 1;
        }
      }
      return { insertedCount, updatedCount };
    },
  );
}

/** Mirror the SQL aggregation semantics over the in-memory match_history store. */
function aggregateStore() {
  const groups = new Map<string, { archetypeA: string; archetypeB: string; meet: number; atm: number; count: number }>();

  for (const row of matchHistoryStore.values()) {
    if (row.wouldMeetAgain === null || row.connectionQuality === null) continue;
    const archetypeA = USER_ARCHETYPES[row.user1Id];
    const archetypeB = USER_ARCHETYPES[row.user2Id];
    if (!archetypeA || !archetypeB) continue;

    const [first, second] = [archetypeA, archetypeB].sort();
    const key = `${first}|${second}`;
    const group = groups.get(key) ?? { archetypeA: first, archetypeB: second, meet: 0, atm: 0, count: 0 };
    group.count += 1;
    group.meet += row.wouldMeetAgain ? 1 : 0;
    group.atm += row.connectionQuality;
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    archetypeA: group.archetypeA,
    archetypeB: group.archetypeB,
    sampleCount: group.count,
    avgMeetAgain: group.meet / group.count,
    avgAtmosphere: group.atm / group.count,
  }));
}

function makeSource(overrides?: Record<string, any>) {
  return {
    group: {
      id: "group-1",
      poolId: "pool-1",
      eventId: "event-1",
      createdAt: new Date("2026-07-01T10:00:00.000Z"),
    },
    memberUserIds: ["u1", "u2", "u3"],
    outcomes: [] as any[],
    ...overrides,
  };
}

const ALL_POSITIVE_OUTCOMES = [
  { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
  { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 4 },
  { submittedBy: "u3", wouldMeetAgain: true, atmosphereScore: 4 },
];

beforeEach(() => {
  sources.clear();
  matchHistoryStore.clear();
  storedStats.rows = [];
  syncMatchHistoryPairsForGroupMock.mockReset();
  installInMemorySync();
  aggregateArchetypePairFeedbackRowsMock.mockReset();
  aggregateArchetypePairFeedbackRowsMock.mockImplementation(async () => aggregateStore());
  upsertArchetypePairFeedbackStatsMock.mockReset();
  upsertArchetypePairFeedbackStatsMock.mockImplementation(async (rows: any[]) => {
    storedStats.rows = rows.map((row, index) => ({ id: `stat-${index}`, ...row }));
    return storedStats.rows;
  });
  listArchetypePairFeedbackStatsMock.mockReset();
  listArchetypePairFeedbackStatsMock.mockImplementation(async () => storedStats.rows);
  loggerInfo.mockClear();
  loggerWarn.mockClear();
  loggerError.mockClear();
});

describe("AC-W4.1 shipping caller + writer inventory", () => {
  it("the canonical outcome route is registered, writes match_history, and has a shipping caller", () => {
    const routesSource = readRepoFile("apps/server/src/routes.ts");
    const routeSource = readRepoFile("apps/server/src/routes/domains/eventGroupOutcomes.ts");
    const derivationSource = readRepoFile("apps/server/src/services/matchHistoryDerivation.ts");
    const clientSource = readRepoFile("apps/mini-program/src/pages/event-feedback/index.tsx");
    const clientBuilderSource = readRepoFile(
      "apps/mini-program/src/pages/event-feedback/groupOutcomePayload.ts",
    );

    // ── Writers (pre-existing) ────────────────────────────────────────────
    expect(routesSource).toContain("registerEventGroupOutcomeRoutes");
    expect(routeSource).toContain("deriveMatchHistoryAndRefreshCalibration(groupId)");
    expect(derivationSource).toContain("syncMatchHistoryPairsForGroup");

    // ── Shipping caller (W4 addition) ─────────────────────────────────────
    // Red repro: on the pre-W4 tree this block does not exist, so the
    // `submitGroupOutcome()` call assertion failed (zero shipping callers).
    expect(clientSource).toContain("buildGroupOutcomePayload");
    expect(clientSource).toContain("/api/event-pools/${encodeURIComponent(matchedRegistration.poolId)}/group-outcome");
    expect(clientSource).toContain("submitGroupOutcome()");
    expect(clientBuilderSource).toContain("groupId");
  });

  it("keeps the legacy /api/events/:eventId/feedback route distinct from the canonical pipeline", () => {
    const clientSource = readRepoFile("apps/mini-program/src/pages/event-feedback/index.tsx");

    // The user-facing balanced feedback still goes to its own endpoint/table.
    expect(clientSource).toContain("/api/events/${encodeURIComponent(eventId)}/feedback");
    // …and the canonical outcome is a separate POST, not a rename of it.
    expect(clientSource).toContain("/group-outcome");
  });
});

describe("AC-W4.2 synthetic end-to-end event produces match_history rows", () => {
  it("derives one non-empty match_history row per pair from a synthetic outcome submission", async () => {
    sources.set("group-1", makeSource({ outcomes: ALL_POSITIVE_OUTCOMES }));

    const result = await deriveMatchHistoryAndRefreshCalibration("group-1");

    expect(result).toMatchObject({ groupId: "group-1", status: "derived", pairCount: 3 });
    expect(matchHistoryStore.size).toBe(3);

    const derived = matchHistoryStore.get(pairKey("event-1", "u1", "u2"));
    expect(derived).toMatchObject({
      wouldMeetAgain: true,
      connectionQuality: 5, // mean of 5 and 4 rounds to 5
      eventId: "event-1",
    });
    // Every derived row carries a real signal (not an empty/neutral placeholder).
    for (const row of matchHistoryStore.values()) {
      expect(row.wouldMeetAgain).not.toBeNull();
      expect(row.connectionQuality).not.toBeNull();
    }
  });
});

describe("AC-W4.4 seeded synthetic outcomes feed calibration and the auto-disable guard", () => {
  it("accumulates calibration sampleCount > 0 from the derived match_history rows", async () => {
    sources.set("group-1", makeSource({ outcomes: ALL_POSITIVE_OUTCOMES }));

    await deriveMatchHistoryAndRefreshCalibration("group-1");

    const calibration = await getArchetypePairCalibrationMap(false);
    const koalaPair = calibration.get("dolphin_calm|koala");

    expect(koalaPair).toBeDefined();
    expect(koalaPair?.sampleCount).toBeGreaterThan(0);
    expect(koalaPair?.sampleCount).toBe(2); // u1/u3 and u2/u3
    expect(koalaPair?.avgMeetAgain).toBe(1);
  });

  it("does not fire the predictive auto-disable guard below 10 samples/arm but does at 10", () => {
    const belowThreshold = [
      { arm: "control" as const, sampleCount: 9, positiveRate: 0.7, avgAtmosphereScore: 4.0 },
      { arm: "treatment" as const, sampleCount: 9, positiveRate: 0.5, avgAtmosphereScore: 3.5 },
    ];
    expect(getPredictiveRerankAutoDisableReason(belowThreshold)).toBeNull();

    const atThreshold = [
      { arm: "control" as const, sampleCount: 10, positiveRate: 0.7, avgAtmosphereScore: 4.0 },
      { arm: "treatment" as const, sampleCount: 10, positiveRate: 0.5, avgAtmosphereScore: 3.5 },
    ];
    expect(getPredictiveRerankAutoDisableReason(atThreshold)).toMatch(/Auto-disabled/);
  });
});

describe("AC-W4.6 derivation reads are deterministic", () => {
  it("orders the group member + outcome reads at the repository layer", () => {
    const outcomeRepoSource = readRepoFile("apps/server/src/repositories/eventGroupOutcomesRepo.ts");
    const matchHistoryRepoSource = readRepoFile("apps/server/src/repositories/matchHistoryRepo.ts");

    expect(outcomeRepoSource).toContain(".orderBy(eventPoolRegistrations.userId)");
    expect(matchHistoryRepoSource).toContain(".orderBy(eventPoolRegistrations.userId)");
    expect(matchHistoryRepoSource).toContain(".orderBy(eventGroupOutcomes.submittedBy)");
    expect(matchHistoryRepoSource).toContain(".orderBy(eventGroupOutcomes.groupId)");
  });

  it("produces identical pair rows regardless of member/outcome read order", async () => {
    sources.set(
      "group-1",
      makeSource({ memberUserIds: ["u3", "u1", "u2"], outcomes: ALL_POSITIVE_OUTCOMES }),
    );
    await derivePairRowsForGroup("group-1");
    const firstRows = syncMatchHistoryPairsForGroupMock.mock.calls.at(-1)?.[0].rows;

    matchHistoryStore.clear();
    sources.set(
      "group-1",
      makeSource({
        memberUserIds: ["u2", "u3", "u1"],
        outcomes: [...ALL_POSITIVE_OUTCOMES].reverse(),
      }),
    );
    await derivePairRowsForGroup("group-1");
    const secondRows = syncMatchHistoryPairsForGroupMock.mock.calls.at(-1)?.[0].rows;

    expect(secondRows).toEqual(firstRows);
    // And the pure builder is itself order-independent.
    expect(
      buildPairRowsForGroup(["u3", "u1", "u2"], [...ALL_POSITIVE_OUTCOMES].reverse()),
    ).toEqual(buildPairRowsForGroup(["u1", "u2", "u3"], ALL_POSITIVE_OUTCOMES));
  });
});
