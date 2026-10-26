/**
 * 双人成行 S1 (one-partner-per-pool) — `repositories/duoBindingRepo` tests.
 *
 * Two layers are locked here WITHOUT a live DB:
 *   1. Result mapping: rows-found → boolean guard facts (all combinations).
 *   2. Query topology: the AC-8 load-bearing inviter-registration join MUST
 *      exist in the invitee-side probe (cancellation deletes use rows by the
 *      cancelled user's own poolRegistrationId only — a residual invitee row
 *      without a live inviter registration must NOT count as a binding).
 *
 * drizzle-orm eq/and are instrumented to plain objects so join conditions can
 * be asserted structurally; schema tables + pg-core alias stay real.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((a: any, b: any) => ({ op: "eq", a, b })),
    and: vi.fn((...conds: any[]) => ({ op: "and", conds })),
  };
});

import {
  eventPoolRegistrations,
  invitations,
  invitationUses,
} from "@shared/schema";
import { resolveDuoBindingAvailability } from "../repositories/duoBindingRepo";

interface RecordedQuery {
  fromTable: any;
  joins: Array<{ table: any; on: any }>;
  where: any;
  limitValue?: number;
}

function createRecordingExecutor(queue: any[][]) {
  const queries: RecordedQuery[] = [];
  const executor = {
    select: vi.fn(() => {
      const record: RecordedQuery = { fromTable: undefined, joins: [], where: undefined };
      const chain: any = {};
      chain.from = vi.fn((table: any) => {
        record.fromTable = table;
        return chain;
      });
      chain.innerJoin = vi.fn((table: any, on: any) => {
        record.joins.push({ table, on });
        return chain;
      });
      chain.where = vi.fn((cond: any) => {
        record.where = cond;
        return chain;
      });
      chain.limit = vi.fn(async (n: number) => {
        record.limitValue = n;
        queries.push(record);
        return queue.length > 0 ? queue.shift()! : [];
      });
      return chain;
    }),
  };
  return { executor: executor as any, queries };
}

const PARAMS = { poolId: "pool-1", userId: "user-1", invitationId: "inv-1" };

describe("resolveDuoBindingAvailability — result mapping", () => {
  it("maps all-empty probes to both flags false", async () => {
    const { executor } = createRecordingExecutor([[], [], []]);
    const result = await resolveDuoBindingAvailability(executor, PARAMS);
    expect(result).toEqual({
      invitationAlreadyBound: false,
      userAlreadyBoundInPool: false,
    });
  });

  it("maps a live invitation consumer to invitationAlreadyBound only", async () => {
    const { executor } = createRecordingExecutor([[{ id: "use-1" }], [], []]);
    const result = await resolveDuoBindingAvailability(executor, PARAMS);
    expect(result).toEqual({
      invitationAlreadyBound: true,
      userAlreadyBoundInPool: false,
    });
  });

  it("maps an invitee-side binding to userAlreadyBoundInPool", async () => {
    const { executor } = createRecordingExecutor([[], [{ id: "use-2" }], []]);
    const result = await resolveDuoBindingAvailability(executor, PARAMS);
    expect(result.userAlreadyBoundInPool).toBe(true);
    expect(result.invitationAlreadyBound).toBe(false);
  });

  it("maps an inviter-side binding (own code already consumed) to userAlreadyBoundInPool", async () => {
    const { executor } = createRecordingExecutor([[], [], [{ id: "inv-own" }]]);
    const result = await resolveDuoBindingAvailability(executor, PARAMS);
    expect(result.userAlreadyBoundInPool).toBe(true);
  });
});

describe("resolveDuoBindingAvailability — query topology (AC-8 joins)", () => {
  it("partner_taken probe joins the invitee registration in-pool only (code claim)", async () => {
    const { executor, queries } = createRecordingExecutor([[], [], []]);
    await resolveDuoBindingAvailability(executor, PARAMS);

    const partnerTaken = queries[0];
    expect(partnerTaken.fromTable).toBe(invitationUses);
    expect(partnerTaken.joins).toHaveLength(1);
    expect(partnerTaken.joins[0].table).toBe(eventPoolRegistrations);
    // invitee registration must be in THIS pool
    expect(partnerTaken.joins[0].on.conds).toHaveLength(2);
    expect(partnerTaken.limitValue).toBe(1);
  });

  it("invitee-side probe carries the load-bearing inviter-registration join", async () => {
    const { executor, queries } = createRecordingExecutor([[], [], []]);
    await resolveDuoBindingAvailability(executor, PARAMS);

    const inviteeSide = queries[1];
    expect(inviteeSide.fromTable).toBe(invitationUses);
    // invitations (duo + pool scope) + invitee registration + inviter registration
    expect(inviteeSide.joins).toHaveLength(3);
    expect(inviteeSide.joins[0].table).toBe(invitations);
    expect(inviteeSide.joins[1].table).toBe(eventPoolRegistrations);

    // The third join MUST be the inviter-registration alias — a DISTINCT table
    // object from the invitee registration table (AC-8: residual use rows left
    // by an inviter cancel are not bindings).
    const inviterJoin = inviteeSide.joins[2];
    expect(inviterJoin.table).not.toBe(eventPoolRegistrations);
    const joinConds: any[] = inviterJoin.on.conds;
    const correlatesInviter = joinConds.some(
      (cond) => cond?.op === "eq" && cond.b === invitations.inviterId,
    );
    expect(correlatesInviter).toBe(true);
    const aliasUserColumn = joinConds.find(
      (cond) => cond?.op === "eq" && cond.b === invitations.inviterId,
    )?.a;
    // The alias column is not the base table's userId column object.
    expect(aliasUserColumn).not.toBe(eventPoolRegistrations.userId);
  });

  it("inviter-side probe checks the user's OWN duo invitation for a live consumer", async () => {
    const { executor, queries } = createRecordingExecutor([[], [], []]);
    await resolveDuoBindingAvailability(executor, PARAMS);

    const inviterSide = queries[2];
    expect(inviterSide.fromTable).toBe(invitations);
    expect(inviterSide.joins).toHaveLength(2);
    expect(inviterSide.joins[0].table).toBe(invitationUses);
    expect(inviterSide.joins[1].table).toBe(eventPoolRegistrations);
    // where: inviterId = userId (plus duo type + pool scope)
    expect(inviterSide.where.conds).toHaveLength(3);
    expect(inviterSide.limitValue).toBe(1);
  });
});
