/**
 * Unit tests for lib/poolGroupAdmin.ts — manual seat assignment into an
 * existing matched pool group (POST /api/admin/event-pools/:id/groups/:groupId/add-member).
 *
 * The db module is stubbed with chainable query-builder fakes (select queue +
 * transaction tx stub) — same mocking philosophy as
 * poolRegistrationCancelFlow.test.ts, trimmed to the shapes this lib uses.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    /** Results consumed one-per db.select(...) call (registration, pool, group). */
    selectResults: [] as any[][],
    /** Results consumed one-per tx update ... .returning() call. */
    txUpdateReturnings: [] as any[][],
    /** Results consumed one-per tx select call (attendance existence check). */
    txSelectResults: [] as any[][],
    /** Captured tx update .set(...) payloads, in call order. */
    setValues: [] as any[],
    /** Captured tx insert .values(...) payloads. */
    insertValues: [] as any[],
    /** Number of times db.transaction executed its callback. */
    transactionRuns: 0,
  };

  const tx = {
    update: () => ({
      set: (v: any) => {
        state.setValues.push(v);
        return {
          where: () => ({
            returning: () => Promise.resolve(state.txUpdateReturnings.shift() ?? []),
            // Plain thenable so updates without .returning() can be awaited.
            then: (resolve: (v: any[]) => void) => resolve([]),
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(state.txSelectResults.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: any) => {
        state.insertValues.push(v);
        return Promise.resolve();
      },
    }),
  };

  return { state, tx };
});

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(h.state.selectResults.shift() ?? []),
        }),
      }),
    }),
    transaction: async (cb: (tx: unknown) => Promise<void>) => {
      h.state.transactionRuns += 1;
      return cb(h.tx);
    },
  },
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { addMemberToPoolGroup } = await import("../lib/poolGroupAdmin");

const REGISTRATION = {
  id: "reg-1",
  poolId: "pool-1",
  userId: "user-1",
  matchStatus: "pending",
  assignedGroupId: null,
};
const POOL = { id: "pool-1", maxGroupSize: 6 };
const GROUP = {
  id: "group-1",
  poolId: "pool-1",
  memberCount: 5,
  eventId: "event-1",
  operatorReviewStatus: "approved",
};

function queuePreChecks(opts: {
  registration?: any;
  pool?: any;
  group?: any;
}) {
  h.state.selectResults.push(
    opts.registration === undefined ? [] : [opts.registration],
    opts.pool === undefined ? [] : [opts.pool],
    opts.group === undefined ? [] : [opts.group],
  );
}

describe("addMemberToPoolGroup", () => {
  beforeEach(() => {
    h.state.selectResults.length = 0;
    h.state.txUpdateReturnings.length = 0;
    h.state.txSelectResults.length = 0;
    h.state.setValues.length = 0;
    h.state.insertValues.length = 0;
    h.state.transactionRuns = 0;
  });

  it("404s when the user holds no registration in the pool", async () => {
    queuePreChecks({ registration: undefined, pool: POOL, group: GROUP });
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(h.state.transactionRuns).toBe(0);
  });

  it("404s when the registration belongs to a different pool", async () => {
    queuePreChecks({
      registration: { ...REGISTRATION, poolId: "pool-2" },
      pool: POOL,
      group: GROUP,
    });
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(h.state.transactionRuns).toBe(0);
  });

  it("404s when the group does not belong to the pool", async () => {
    queuePreChecks({
      registration: REGISTRATION,
      pool: POOL,
      group: { ...GROUP, poolId: "pool-2" },
    });
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", registrationId: "reg-1" });
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(h.state.transactionRuns).toBe(0);
  });

  it("is idempotent when the user is already in THIS group", async () => {
    queuePreChecks({
      registration: { ...REGISTRATION, assignedGroupId: "group-1" },
      pool: POOL,
      group: GROUP,
    });
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });
    expect(result).toMatchObject({ ok: true, memberAdded: false, memberCount: 5 });
    expect(h.state.transactionRuns).toBe(0);
  });

  it("409s when the user is already in ANOTHER group of the pool", async () => {
    queuePreChecks({
      registration: { ...REGISTRATION, assignedGroupId: "group-9" },
      pool: POOL,
      group: GROUP,
    });
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(h.state.transactionRuns).toBe(0);
  });

  it("409s when the group is already at capacity", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    // Guarded headcount bump finds no row (memberCount < maxSize failed).
    h.state.txUpdateReturnings.push([]);
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect((result as any).message).toMatch(/full/i);
  });

  it("409s when the registration is claimed concurrently mid-transaction", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], []); // bump ok, claim loses race
    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect((result as any).message).toMatch(/concurrent/i);
  });

  it("adds the member: headcount bump, matched claim, attendance insert", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([]); // no existing attendance row

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", registrationId: "reg-1" });

    expect(result).toMatchObject({
      ok: true,
      memberAdded: true,
      poolId: "pool-1",
      groupId: "group-1",
      registrationId: "reg-1",
      userId: "user-1",
      memberCount: 6,
    });

    // Registration claim set assignedGroupId + matchStatus='matched' (approved group).
    const claimSet = h.state.setValues.find((v) => v.assignedGroupId === "group-1");
    expect(claimSet).toBeDefined();
    expect(claimSet.matchStatus).toBe("matched");

    // Attendance row created for the group's linked event.
    expect(h.state.insertValues).toContainEqual({
      eventId: "event-1",
      userId: "user-1",
      status: "confirmed",
    });
  });

  it("mirrors pending matchStatus for groups still under operator review", async () => {
    queuePreChecks({
      registration: REGISTRATION,
      pool: POOL,
      group: { ...GROUP, operatorReviewStatus: "pending" },
    });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([]);

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, memberAdded: true });
    const claimSet = h.state.setValues.find((v) => v.assignedGroupId === "group-1");
    expect(claimSet.matchStatus).toBe("pending");
  });

  it("reactivates a cancelled attendance row instead of inserting a duplicate", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([{ id: "att-1", status: "cancelled" }]);

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, memberAdded: true });
    expect(h.state.insertValues).toHaveLength(0);
    expect(h.state.setValues).toContainEqual({ status: "confirmed" });
  });

  // ── Operator-facing warnings (non-blocking, post-add) ──────────────────
  // Warnings helper select order after the pre-checks:
  //   inviter-side own duo invite → (uses → partner registration)
  //   OR invitee-side use → (invitation → partner registration)
  //   then completed-payment presence.

  it("warns when the duo partner is bound but seated in another group", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([]); // no existing attendance row
    h.state.selectResults.push(
      [{ id: "inv-1" }], // own duo invite (inviter side)
      [{ poolRegistrationId: "reg-partner" }], // invitee's use row
      [{ assignedGroupId: "group-9" }], // partner seated elsewhere
      [{ id: "pay-1" }], // completed payment present
    );

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, memberAdded: true });
    const warnings = (result as any).warnings as string[];
    expect(warnings).toContain("该用户已绑定双人成行，搭档未同组");
    expect(warnings).not.toContain("未找到该用户在本池的已完成支付记录");
  });

  it("does not warn about the duo when the partner is seated in the same group", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([]);
    h.state.selectResults.push(
      [{ id: "inv-1" }],
      [{ poolRegistrationId: "reg-partner" }],
      [{ assignedGroupId: "group-1" }], // partner in THIS group
      [{ id: "pay-1" }],
    );

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });

    expect((result as any).warnings).toEqual([]);
  });

  it("detects the duo bind from the invitee side (consumed invite)", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([]);
    h.state.selectResults.push(
      [], // no own invite (not the inviter)
      [{ invitationId: "inv-9" }], // this registration consumed a duo invite
      [{ inviterId: "user-2" }], // the duo invitation
      [{ assignedGroupId: null }], // inviter registered but not seated
      [{ id: "pay-1" }],
    );

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });

    expect((result as any).warnings).toContain("该用户已绑定双人成行，搭档未同组");
  });

  it("warns when no completed payment exists for the user in this pool", async () => {
    queuePreChecks({ registration: REGISTRATION, pool: POOL, group: GROUP });
    h.state.txUpdateReturnings.push([{ memberCount: 6 }], [{ id: "reg-1" }]);
    h.state.txSelectResults.push([]);
    h.state.selectResults.push(
      [], // no own duo invite
      [], // no consumed duo invite
      [], // no completed payment
    );

    const result = await addMemberToPoolGroup({ poolId: "pool-1", groupId: "group-1", userId: "user-1" });

    expect(result).toMatchObject({ ok: true, memberAdded: true });
    expect((result as any).warnings).toEqual(["未找到该用户在本池的已完成支付记录"]);
  });
});
