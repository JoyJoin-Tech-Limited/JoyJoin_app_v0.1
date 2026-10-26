import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, queryResults, selections, whereConditions, limitCalls, offsetCalls } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
  queryResults: [] as unknown[][],
  selections: [] as Array<Record<string, unknown>>,
  whereConditions: [] as unknown[],
  limitCalls: [] as Array<{ queryIndex: number; value: number }>,
  offsetCalls: [] as Array<{ queryIndex: number; value: number }>,
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
  limitCalls.length = 0;
  offsetCalls.length = 0;
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
      limit: (value: number) => {
        limitCalls.push({ queryIndex, value });
        return chain;
      },
      offset: (value: number) => {
        offsetCalls.push({ queryIndex, value });
        return chain;
      },
      then: (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(queryResults[queryIndex] ?? []).then(onFulfilled, onRejected),
    };
    return chain;
  });
}

function makeListRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    useId: `use-${id}`,
    code: `DUO-${id}`,
    invitationType: "duo",
    inviterId: `inviter-${id}`,
    inviterDisplayName: "Inviter",
    inviteeId: `invitee-${id}`,
    inviteeDisplayName: "Invitee",
    boundAt: new Date("2026-10-01T00:00:00Z"),
    matchedTogether: false,
    rewardIssued: false,
    poolId: "pool-1",
    poolTitle: "Pool",
    poolCity: "深圳",
    poolDateTime: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    expiresAt: null,
    ...overrides,
  };
}

describe("admin duo invite repository read models", () => {
  beforeEach(() => {
    mockDb.select.mockReset();
  });

  it("aggregates every summary count and recomputes conflict from pool-scoped bindings", async () => {
    queueQueryResults(
      [{ total: 8, pending: 2, accepted: 4, expired: 2 }],
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
      accepted: 4,
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
      accepted: 0,
      expired: 0,
      conflict: 0,
      seated: 0,
      rewarded: 0,
    });
  });

  it("selects and returns matchedTogether/rewardIssued, including empty-use values", async () => {
    queueQueryResults(
      [],
      [{ id: "inv-a" }],
      [{ count: 1 }],
      [makeListRow("inv-a", {
        useId: null,
        inviteeId: null,
        inviteeDisplayName: null,
        boundAt: null,
        matchedTogether: null,
        createdAt: null,
      })],
    );

    const result = await listDuoInvites({ page: 1, pageSize: 20, conflict: false });
    expect(selections[3]).toHaveProperty("matchedTogether");
    expect(selections[3]).toHaveProperty("rewardIssued");
    expect(result.items[0]).toMatchObject({
      id: "inv-a",
      useId: null,
      matchedTogether: null,
      rewardIssued: false,
      hasConflict: false,
      status: "pending",
    });
    expect(result.total).toBe(1);
  });

  it("keeps accepted history independent of inviter registration and seated outcome", async () => {
    const invitationIds = ["inviter-unregistered", "both-registered", "inviter-cancelled"];
    queueQueryResults(
      [],
      invitationIds.map((id) => ({ id })),
      [{ count: 3 }],
      [
        makeListRow("inviter-unregistered", { matchedTogether: false }),
        makeListRow("both-registered", { matchedTogether: true }),
        makeListRow("inviter-cancelled", { matchedTogether: false }),
      ],
    );

    const result = await listDuoInvites({ page: 1, pageSize: 20 });

    expect(result.items.map((item) => item.status)).toEqual(["bound", "bound", "bound"]);
    expect(result.items.map((item) => item.useId)).toEqual(
      invitationIds.map((id) => `use-${id}`),
    );
    expect(result.items.map((item) => item.matchedTogether)).toEqual([false, true, false]);
    expect(result.total).toBe(3);
  });

  it("pages invitation ids before joining every historical use row", async () => {
    const allInvitationIds = Array.from({ length: 22 }, (_, index) => `inv-${index + 1}`);
    const firstPageIds = allInvitationIds.slice(0, 20);
    const joinedRows = firstPageIds.flatMap((id, index) => index === 0
      ? [
          makeListRow(id, { useId: "use-1-a", inviteeId: "invitee-1-a" }),
          makeListRow(id, { useId: "use-1-b", inviteeId: "invitee-1-b" }),
        ]
      : [makeListRow(id)]);
    queueQueryResults(
      [],
      firstPageIds.map((id) => ({ id })),
      [{ count: allInvitationIds.length }],
      joinedRows,
    );

    const result = await listDuoInvites({
      poolId: "pool-1",
      status: "bound",
      conflict: false,
      page: 1,
      pageSize: 20,
    });

    expect(new Set(result.items.map((item) => item.id))).toEqual(new Set(firstPageIds));
    expect(result.items).toHaveLength(21);
    expect(result.items.filter((item) => item.id === "inv-1").map((item) => item.useId))
      .toEqual(["use-1-a", "use-1-b"]);
    expect(result.total).toBe(22);
    expect(Math.ceil(result.total / 20)).toBe(2);
    expect(selections).toHaveLength(4);
    expect(limitCalls).toEqual([{ queryIndex: 1, value: 20 }]);
    expect(offsetCalls).toEqual([{ queryIndex: 1, value: 0 }]);
    expect(whereConditions[1]).toBeDefined();
    expect(whereConditions[3]).toBeDefined();
  });

  it("keeps conflict=true empty-set short-circuit behavior", async () => {
    queueQueryResults([]);

    await expect(
      listDuoInvites({ page: 1, pageSize: 20, conflict: true }),
    ).resolves.toEqual({ items: [], total: 0 });
    expect(selections).toHaveLength(1);
  });
});
