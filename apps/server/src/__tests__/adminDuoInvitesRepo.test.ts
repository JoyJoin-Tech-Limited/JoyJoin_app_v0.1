import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, queryResults, selections, whereConditions } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
  queryResults: [] as unknown[][],
  selections: [] as Array<Record<string, unknown>>,
  whereConditions: [] as unknown[],
}));

vi.mock("../db", () => ({ db: mockDb }));

import {
  getDuoInviteSummary,
  listDuoInvites,
} from "../repositories/adminReferralsRepo";

function queueQueryResults(...results: unknown[][]) {
  queryResults.splice(0, queryResults.length, ...results);
  selections.length = 0;
  whereConditions.length = 0;
  mockDb.select.mockImplementation((selection: Record<string, unknown>) => {
    const queryIndex = selections.length;
    selections.push(selection);
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (condition: unknown) => {
        whereConditions[queryIndex] = condition;
        return chain;
      },
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(queryResults[queryIndex] ?? []).then(onFulfilled, onRejected),
    };
    return chain;
  });
}

describe("admin duo invite repository read models", () => {
  beforeEach(() => {
    mockDb.select.mockReset();
  });

  it("aggregates every summary count and recomputes conflict from pool-scoped bindings", async () => {
    queueQueryResults(
      [{ total: 8, pending: 2, bound: 4, expired: 2 }],
      [{ seated: 3, rewarded: 2 }],
      [
        { invitationId: "inv-a", inviteeId: "user-1", poolId: "pool-1" },
        { invitationId: "inv-b", inviteeId: "user-1", poolId: "pool-1" },
        { invitationId: "inv-c", inviteeId: "user-2", poolId: "pool-1" },
      ],
    );

    await expect(getDuoInviteSummary({ poolId: "pool-1" })).resolves.toEqual({
      total: 8,
      pending: 2,
      bound: 4,
      expired: 2,
      conflict: 2,
      seated: 3,
      rewarded: 2,
    });
    expect(selections).toHaveLength(3);
    expect(whereConditions[0]).toBeDefined();
    expect(whereConditions[1]).toBeDefined();
    expect(whereConditions[2]).toBeDefined();
  });

  it("returns integer zeroes for an empty summary scope", async () => {
    queueQueryResults([], [], []);

    await expect(getDuoInviteSummary()).resolves.toEqual({
      total: 0,
      pending: 0,
      bound: 0,
      expired: 0,
      conflict: 0,
      seated: 0,
      rewarded: 0,
    });
  });

  it("selects and returns matchedTogether/rewardIssued, including empty-use values", async () => {
    queueQueryResults(
      [],
      [
        {
          id: "inv-a",
          code: "DUO-A",
          invitationType: "duo",
          inviterId: "inviter-1",
          inviterDisplayName: "Inviter",
          inviteeId: null,
          inviteeDisplayName: null,
          boundAt: null,
          matchedTogether: null,
          rewardIssued: false,
          poolId: "pool-1",
          poolTitle: "Pool",
          poolCity: "深圳",
          poolDateTime: null,
          createdAt: null,
          expiresAt: null,
        },
      ],
      [{ count: 1 }],
    );

    const result = await listDuoInvites({ page: 1, pageSize: 20, conflict: false });
    expect(selections[1]).toHaveProperty("matchedTogether");
    expect(selections[1]).toHaveProperty("rewardIssued");
    expect(result.items[0]).toMatchObject({
      id: "inv-a",
      matchedTogether: null,
      rewardIssued: false,
      hasConflict: false,
      status: "pending",
    });
    expect(result.total).toBe(1);
  });

  it("keeps conflict=true empty-set short-circuit behavior", async () => {
    queueQueryResults([]);

    await expect(
      listDuoInvites({ page: 1, pageSize: 20, conflict: true }),
    ).resolves.toEqual({ items: [], total: 0 });
    expect(selections).toHaveLength(1);
  });
});
