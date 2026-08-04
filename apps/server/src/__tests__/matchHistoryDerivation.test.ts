import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sources,
  matchHistoryStore,
  syncMatchHistoryPairsForGroupMock,
  refreshArchetypePairCalibrationMapMock,
  loggerInfo,
  loggerWarn,
  loggerError,
} = vi.hoisted(() => ({
  // groupId -> GroupDerivationSource fixture
  sources: new Map<string, any>(),
  // In-memory match_history stand-in: `${eventId}|${userA}|${userB}` (sorted) -> row.
  matchHistoryStore: new Map<string, any>(),
  syncMatchHistoryPairsForGroupMock: vi.fn(),
  refreshArchetypePairCalibrationMapMock: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../repositories/matchHistoryRepo", () => ({
  getGroupDerivationSource: vi.fn(async (groupId: string) => sources.get(groupId) ?? null),
  syncMatchHistoryPairsForGroup: syncMatchHistoryPairsForGroupMock,
}));

vi.mock("../archetypeChemistryCalibration", () => ({
  refreshArchetypePairCalibrationMap: refreshArchetypePairCalibrationMapMock,
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
  planPairRowsForGroup,
  derivePairRowsForGroup,
  deriveMatchHistoryAndRefreshCalibration,
} = await import("../services/matchHistoryDerivation");

/** Mirrors the repo's merge semantics so idempotency is exercised, not mocked away. */
function installInMemorySync() {
  syncMatchHistoryPairsForGroupMock.mockImplementation(
    async (input: { eventId: string; rows: any[] }) => {
      let insertedCount = 0;
      let updatedCount = 0;
      for (const row of input.rows) {
        const key = `${input.eventId}|${[row.user1Id, row.user2Id].sort().join("|")}`;
        const existing = matchHistoryStore.get(key);
        if (existing) {
          // Update path preserves the original matchedAt (no drift on re-run).
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

function storeRow(eventId: string, userA: string, userB: string) {
  return matchHistoryStore.get(`${eventId}|${[userA, userB].sort().join("|")}`);
}

beforeEach(() => {
  sources.clear();
  matchHistoryStore.clear();
  syncMatchHistoryPairsForGroupMock.mockReset();
  installInMemorySync();
  refreshArchetypePairCalibrationMapMock.mockReset();
  refreshArchetypePairCalibrationMapMock.mockResolvedValue(new Map());
  loggerInfo.mockClear();
  loggerWarn.mockClear();
  loggerError.mockClear();
});

describe("buildPairRowsForGroup (pure pair semantics)", () => {
  it("marks wouldMeetAgain true only when BOTH members submitted true", () => {
    const [pair] = buildPairRowsForGroup(
      ["u1", "u2"],
      [
        { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 3 },
      ],
    );

    expect(pair.wouldMeetAgain).toBe(true);
    expect(pair.connectionQuality).toBe(4); // mean of 5 and 3
  });

  it("marks wouldMeetAgain false when EITHER member submitted false", () => {
    const [pair] = buildPairRowsForGroup(
      ["u1", "u2"],
      [
        { submittedBy: "u1", wouldMeetAgain: false, atmosphereScore: 2 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 5 },
      ],
    );

    expect(pair.wouldMeetAgain).toBe(false);
  });

  it("marks wouldMeetAgain false even when the other member has not submitted", () => {
    const [pair] = buildPairRowsForGroup(
      ["u1", "u2"],
      [{ submittedBy: "u1", wouldMeetAgain: false, atmosphereScore: 2 }],
    );

    expect(pair.wouldMeetAgain).toBe(false);
    expect(pair.connectionQuality).toBe(2);
  });

  it("marks wouldMeetAgain null when submissions are incomplete (one true, one missing)", () => {
    const [pair] = buildPairRowsForGroup(
      ["u1", "u2"],
      [{ submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 4 }],
    );

    expect(pair.wouldMeetAgain).toBeNull();
    expect(pair.connectionQuality).toBe(4);
  });

  it("still records the pair when neither member submitted (anti-repetition data)", () => {
    const [pair] = buildPairRowsForGroup(["u1", "u2"], []);

    expect(pair).toEqual({
      user1Id: "u1",
      user2Id: "u2",
      wouldMeetAgain: null,
      connectionQuality: null,
    });
  });

  it("sorts member pairs consistently regardless of input order", () => {
    const pairs = buildPairRowsForGroup(["u3", "u1", "u2"], []);

    expect(pairs.map((pair) => `${pair.user1Id}|${pair.user2Id}`)).toEqual([
      "u1|u2",
      "u1|u3",
      "u2|u3",
    ]);
  });

  it("deduplicates member ids and ignores outcomes from non-members", () => {
    const pairs = buildPairRowsForGroup(
      ["u1", "u2", "u2"],
      [{ submittedBy: "stranger", wouldMeetAgain: false, atmosphereScore: 1 }],
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0].wouldMeetAgain).toBeNull();
    expect(pairs[0].connectionQuality).toBeNull();
  });

  it("rounds the mean atmosphere score to the integer connectionQuality scale", () => {
    const [pair] = buildPairRowsForGroup(
      ["u1", "u2"],
      [
        { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 4 },
      ],
    );

    // JS Math.round halves up: (5 + 4) / 2 = 4.5 -> 5
    expect(pair.connectionQuality).toBe(5);
  });
});

describe("derivePairRowsForGroup", () => {
  it("writes one row per unordered member pair with event linkage", async () => {
    sources.set("group-1", makeSource({
      outcomes: [
        { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 4 },
        { submittedBy: "u3", wouldMeetAgain: false, atmosphereScore: 2 },
      ],
    }));

    const result = await derivePairRowsForGroup("group-1");

    expect(result).toMatchObject({
      groupId: "group-1",
      status: "derived",
      pairCount: 3,
      insertedCount: 3,
      updatedCount: 0,
    });
    expect(storeRow("event-1", "u1", "u2")).toMatchObject({
      eventId: "event-1",
      wouldMeetAgain: true,
      connectionQuality: 5,
      matchedAt: new Date("2026-07-01T10:00:00.000Z"),
    });
    expect(storeRow("event-1", "u1", "u3").wouldMeetAgain).toBe(false);
    expect(storeRow("event-1", "u2", "u3").wouldMeetAgain).toBe(false);
  });

  it("is idempotent: a second run updates in place without duplicates or drift", async () => {
    sources.set("group-1", makeSource({
      outcomes: [
        { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 4 },
      ],
    }));

    await derivePairRowsForGroup("group-1");
    const snapshot = new Map(matchHistoryStore);

    const second = await derivePairRowsForGroup("group-1");

    expect(second).toMatchObject({ status: "derived", insertedCount: 0, updatedCount: 3 });
    expect(matchHistoryStore.size).toBe(3);
    for (const [key, row] of snapshot) {
      expect(matchHistoryStore.get(key)).toEqual(row);
    }
  });

  it("converges when a member resubmits a changed outcome", async () => {
    const outcomes = [
      { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
      { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 4 },
    ];
    sources.set("group-1", makeSource({ outcomes }));
    await derivePairRowsForGroup("group-1");
    expect(storeRow("event-1", "u1", "u2").wouldMeetAgain).toBe(true);

    // u2 changes their mind (duplicate submission strategy = replace)
    sources.set("group-1", makeSource({
      outcomes: [outcomes[0], { submittedBy: "u2", wouldMeetAgain: false, atmosphereScore: 3 }],
    }));
    await derivePairRowsForGroup("group-1");

    expect(storeRow("event-1", "u1", "u2")).toMatchObject({
      wouldMeetAgain: false,
      connectionQuality: 4, // mean of 5 and 3
    });
  });

  it("keeps groups isolated: re-deriving one group never touches another group's rows", async () => {
    sources.set("group-1", makeSource({
      memberUserIds: ["u1", "u2"],
      outcomes: [
        { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 5 },
      ],
    }));
    sources.set("group-2", makeSource({
      group: { id: "group-2", poolId: "pool-1", eventId: "event-2", createdAt: new Date("2026-07-02T10:00:00.000Z") },
      memberUserIds: ["u1", "u2"],
      outcomes: [
        { submittedBy: "u1", wouldMeetAgain: false, atmosphereScore: 1 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 2 },
      ],
    }));

    await derivePairRowsForGroup("group-1");
    await derivePairRowsForGroup("group-2");

    expect(storeRow("event-1", "u1", "u2").wouldMeetAgain).toBe(true);
    expect(storeRow("event-2", "u1", "u2").wouldMeetAgain).toBe(false);

    // Re-deriving group-1 must not disturb group-2's row (different event linkage).
    await derivePairRowsForGroup("group-1");
    expect(storeRow("event-2", "u1", "u2")).toMatchObject({
      wouldMeetAgain: false,
      connectionQuality: 2,
    });
  });

  it("skips groups that do not exist", async () => {
    const result = await derivePairRowsForGroup("missing-group");

    expect(result).toMatchObject({ status: "skipped", reason: "group_not_found" });
    expect(syncMatchHistoryPairsForGroupMock).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalled();
  });

  it("skips groups without a linked event (match_history.eventId is NOT NULL)", async () => {
    sources.set("group-1", makeSource({
      group: { id: "group-1", poolId: "pool-1", eventId: null, createdAt: new Date() },
      outcomes: [{ submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 }],
    }));

    const result = await derivePairRowsForGroup("group-1");

    expect(result).toMatchObject({ status: "skipped", reason: "missing_event_id" });
    expect(syncMatchHistoryPairsForGroupMock).not.toHaveBeenCalled();
  });

  it("skips groups with no submitted outcomes", async () => {
    sources.set("group-1", makeSource());

    const result = await derivePairRowsForGroup("group-1");

    expect(result).toMatchObject({ status: "skipped", reason: "no_outcomes" });
    expect(syncMatchHistoryPairsForGroupMock).not.toHaveBeenCalled();
  });

  it("skips groups with fewer than two members", async () => {
    sources.set("group-1", makeSource({
      memberUserIds: ["u1"],
      outcomes: [{ submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 }],
    }));

    const result = await derivePairRowsForGroup("group-1");

    expect(result).toMatchObject({ status: "skipped", reason: "insufficient_members" });
    expect(syncMatchHistoryPairsForGroupMock).not.toHaveBeenCalled();
  });

  it("plans without writing (backfill --dry-run shape)", async () => {
    sources.set("group-1", makeSource({
      outcomes: [{ submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 }],
    }));

    const plan = await planPairRowsForGroup("group-1");

    expect(plan.status).toBe("ready");
    expect(plan.pairs).toHaveLength(3);
    expect(syncMatchHistoryPairsForGroupMock).not.toHaveBeenCalled();
    expect(matchHistoryStore.size).toBe(0);
  });
});

describe("deriveMatchHistoryAndRefreshCalibration (W3 stats accumulation)", () => {
  it("invokes the archetype-pair feedback aggregation after a successful derivation", async () => {
    sources.set("group-1", makeSource({
      outcomes: [
        { submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 },
        { submittedBy: "u2", wouldMeetAgain: true, atmosphereScore: 4 },
      ],
    }));

    const result = await deriveMatchHistoryAndRefreshCalibration("group-1");

    expect(result.status).toBe("derived");
    expect(refreshArchetypePairCalibrationMapMock).toHaveBeenCalledTimes(1);
  });

  it("does not aggregate when derivation was skipped", async () => {
    const result = await deriveMatchHistoryAndRefreshCalibration("missing-group");

    expect(result.status).toBe("skipped");
    expect(refreshArchetypePairCalibrationMapMock).not.toHaveBeenCalled();
  });

  it("isolates aggregation failures: logs and still resolves the derivation result", async () => {
    sources.set("group-1", makeSource({
      outcomes: [{ submittedBy: "u1", wouldMeetAgain: true, atmosphereScore: 5 }],
    }));
    refreshArchetypePairCalibrationMapMock.mockRejectedValue(new Error("aggregate blew up"));

    const result = await deriveMatchHistoryAndRefreshCalibration("group-1");

    expect(result.status).toBe("derived");
    expect(loggerError).toHaveBeenCalledWith(
      "[MatchHistory] Archetype-pair feedback stats refresh failed",
      expect.objectContaining({ groupId: "group-1", error: "aggregate blew up" }),
    );
    // The pair rows themselves were still written.
    expect(matchHistoryStore.size).toBe(3);
  });
});
