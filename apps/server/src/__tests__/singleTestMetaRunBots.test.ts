import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSingleTestMetaForSessionStart } from "../services/singleTestService";
import { isSingleTestMode } from "../lib/isSingleTestMode";
import { isSocialIcebreakerTestMode } from "../lib/isSocialIcebreakerTestMode";

vi.mock("../lib/isSingleTestMode");
vi.mock("../lib/isSocialIcebreakerTestMode");

const { mockState, eventPoolGroupsTable, eventPoolsTable, eventPoolRegistrationsTable, usersTable } = vi.hoisted(() => ({
  mockState: {
    groupRow: { poolId: "pool-test" } as any,
    poolRow: { title: "单人调试局" } as any,
    registrationRows: [{ userId: "bot-user-1", registeredAt: new Date() }] as any[],
    botRows: [{ id: "bot-user-1", displayName: "Bot 1", archetype: "社牛柯基", primaryArchetype: "corgi" }] as any[],
  },
  eventPoolGroupsTable: Symbol("eventPoolGroups"),
  eventPoolsTable: Symbol("eventPools"),
  eventPoolRegistrationsTable: Symbol("eventPoolRegistrations"),
  usersTable: Symbol("users"),
}));

vi.mock("@shared/schema", () => ({
  eventPoolGroups: eventPoolGroupsTable,
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  users: usersTable,
}));

vi.mock("drizzle-orm", () => ({
  eq: (_field: unknown, value: unknown) => ({ type: "eq", value }),
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: "inArray", values }),
  like: (_field: unknown, value: unknown) => ({ type: "like", value }),
}));

function makeAwaitable(value: unknown) {
  return {
    limit: () => Promise.resolve(value),
    then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        if (table === eventPoolGroupsTable || table === eventPoolsTable) {
          return {
            where: () => makeAwaitable(
              table === eventPoolGroupsTable
                ? (mockState.groupRow ? [mockState.groupRow] : [])
                : (mockState.poolRow ? [mockState.poolRow] : [])
            ),
          };
        }
        if (table === eventPoolRegistrationsTable) {
          return {
            where: () => ({
              orderBy: () => Promise.resolve(mockState.registrationRows),
            }),
          };
        }
        if (table === usersTable) {
          return {
            where: () => makeAwaitable(mockState.botRows),
          };
        }
        return makeAwaitable([]);
      },
    }),
  },
}));

describe("getSingleTestMetaForSessionStart runBots", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets runBots=true when social icebreaker test mode is enabled", async () => {
    vi.mocked(isSingleTestMode).mockReturnValue(true);
    vi.mocked(isSocialIcebreakerTestMode).mockReturnValue(true);

    const result = await getSingleTestMetaForSessionStart("group-test");
    expect(result).not.toBeNull();
    expect(result!.runBots).toBe(true);
    expect(result!.isTestModeSkip).toBe(true);
    expect(result!.bots).toHaveLength(1);
  });

  it("sets runBots=false when social icebreaker test mode is disabled", async () => {
    vi.mocked(isSingleTestMode).mockReturnValue(true);
    vi.mocked(isSocialIcebreakerTestMode).mockReturnValue(false);

    const result = await getSingleTestMetaForSessionStart("group-test");
    expect(result).not.toBeNull();
    expect(result!.runBots).toBe(false);
  });

  it("returns null when not in single-test mode", async () => {
    vi.mocked(isSingleTestMode).mockReturnValue(false);
    vi.mocked(isSocialIcebreakerTestMode).mockReturnValue(true);

    const result = await getSingleTestMetaForSessionStart("group-test");
    expect(result).toBeNull();
  });
});
