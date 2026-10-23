/**
 * 双人成行 S3 (waiting copy direction) — route-level coverage for the two
 * server surfaces the client copy matrix consumes:
 *
 *   GET /api/pools/:id/duo-status  — passes `viewerRole` / `pendingSide`
 *     through from the real `resolveDuoStatus` (lib/duoInvites is NOT mocked;
 *     the pure matrix lives in duoInvites.test.ts).
 *   GET /api/duo-invites/:code     — new additive `inviterRegistered` boolean
 *     (AC-0): the ONLY data source a pre-registration invitee has for the
 *     「就等你」 guest copy. One (poolId, inviterId) unique-index point query;
 *     boolean only, the inviter's userId never leaves the server.
 *
 * Pattern follows matchCompass.test.ts: @shared/schema is mocked with Symbol
 * tables, drizzle-orm operators return plain introspectable objects, and a
 * semantic in-memory db answers the route's select/update chains. HTTP is
 * exercised for real via withServerForApp.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory fixtures ──────────────────────────────────────────────────────

const mockState = {
  registrations: [] as any[],
  invitations: [] as any[],
  uses: [] as any[],
  users: [] as any[],
};

let currentUserId: string | null = null;

const eventPoolsTable = Symbol("eventPools");
const eventPoolRegistrationsTable = Symbol("eventPoolRegistrations");
const invitationsTable = Symbol("invitations");
const invitationUsesTable = Symbol("invitationUses");
const referralCodesTable = Symbol("referralCodes");
const usersTable = Symbol("users");

vi.mock("@shared/schema", () => ({
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  invitations: invitationsTable,
  invitationUses: invitationUsesTable,
  referralCodes: referralCodesTable,
  users: usersTable,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  asc: (field: unknown) => ({ type: "asc", field }),
  eq: (_field: unknown, value: unknown) => ({ type: "eq", value }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: "inArray", values }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  }),
}));

// ── Semantic db mock ────────────────────────────────────────────────────────

function makeAwaitable(value: unknown) {
  const self: any = {
    limit: () => Promise.resolve(value),
    orderBy: () => self,
    then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return self;
}

function findRows(table: unknown, condition: any): any[] {
  if (table === eventPoolRegistrationsTable) {
    if (condition?.type === "and") {
      const [first, second] = condition.conditions ?? [];
      if (first?.type === "inArray") {
        // Inviter-side probe: inArray(id, useRowRegistrationIds) + eq(poolId).
        return mockState.registrations.filter(
          (r) => first.values.includes(r.id) && r.poolId === second?.value,
        );
      }
      // eq(poolId) + eq(userId) — the viewer's own registration, the inviter's
      // registration for duo-status, and the lookup-route inviterRegistered
      // probe all share this (poolId, userId) unique-index point-query shape.
      return mockState.registrations.filter(
        (r) => r.poolId === first?.value && r.userId === second?.value,
      );
    }
    return mockState.registrations;
  }
  if (table === invitationsTable) {
    if (condition?.type === "eq") {
      // Public lookup by share code.
      return mockState.invitations.filter((i) => i.code === condition.value);
    }
    if (condition?.type === "and") {
      // Own duo invite: eq(inviterId) + eq(poolId) + eq(invitationType).
      const [a, b, c] = condition.conditions ?? [];
      return mockState.invitations.filter(
        (i) => i.inviterId === a?.value && i.poolId === b?.value && i.invitationType === c?.value,
      );
    }
    return mockState.invitations;
  }
  if (table === invitationUsesTable) {
    if (condition?.type === "eq") {
      // Use rows for one invitation (inviter side).
      return mockState.uses.filter((u) => u.invitationId === condition.value);
    }
    return mockState.uses;
  }
  if (table === usersTable) {
    if (condition?.type === "eq") {
      return mockState.users.filter((u) => u.id === condition.value);
    }
    return mockState.users;
  }
  return [];
}

/** invitationUses ⋈ invitations — the invitee-side consumed-code probe. */
function findConsumedRows(condition: any): any[] {
  const [inviteeEq, typeEq, poolEq] = condition?.conditions ?? [];
  return mockState.uses
    .filter((u) => u.inviteeId === inviteeEq?.value)
    .map((u) => {
      const invitation = mockState.invitations.find(
        (i) =>
          i.id === u.invitationId &&
          i.invitationType === typeEq?.value &&
          i.poolId === poolEq?.value,
      );
      return invitation
        ? {
            inviterId: invitation.inviterId,
            invitedAt: invitation.createdAt,
            usePoolRegistrationId: u.poolRegistrationId,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: any) => makeAwaitable(findRows(table, condition)),
        innerJoin: () => ({
          where: (condition: any) => makeAwaitable(findConsumedRows(condition)),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  },
}));

// ── Cross-cutting stubs ─────────────────────────────────────────────────────

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!currentUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.user = { id: currentUserId };
    next();
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: vi.fn().mockResolvedValue(true),
}));

vi.mock("../rateLimiter", () => ({
  duoInviteLookupLimiter: (_req: any, _res: any, next: any) => next(),
}));

// lib/duoInvites is intentionally NOT mocked — these tests prove the route
// serializes the real resolver's direction fields.

const { registerDuoRoutes } = await import("../routes/domains/duo");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerDuoRoutes(app);
  return app;
}

// ── Shared fixtures ─────────────────────────────────────────────────────────

const POOL_ID = "3f6b2a3e-9a1b-4f0e-9e2a-7b0f0a123456";
const INVITER_ID = "user-inviter";
const INVITEE_ID = "user-invitee";
const INVITED_AT = new Date("2026-08-07T06:00:00Z");
const VALID_CODE = "a1b2c3d4e5f6";

function makeDuoInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    code: VALID_CODE,
    inviterId: INVITER_ID,
    poolId: POOL_ID,
    invitationType: "duo",
    createdAt: INVITED_AT,
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockState.registrations = [];
  mockState.invitations = [];
  mockState.uses = [];
  mockState.users = [];
  currentUserId = null;
});

// ── duo-status direction pass-through ───────────────────────────────────────

describe("GET /api/pools/:id/duo-status — viewerRole/pendingSide pass-through (S3)", () => {
  it("inviter waiting (friend has not registered) → inviter × invitee", async () => {
    currentUserId = INVITER_ID;
    mockState.registrations = [{ id: "reg-1", poolId: POOL_ID, userId: INVITER_ID }];
    mockState.invitations = [makeDuoInvitation()];

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/pools/${POOL_ID}/duo-status`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.state).toBe("waiting");
      expect(body.viewerRole).toBe("inviter");
      expect(body.pendingSide).toBe("invitee");
      expect(body.invitedAt).toBe(INVITED_AT.toISOString());
    });
  });

  it("inviter waiting (friend registered, viewer has not) → inviter × inviter (就等你)", async () => {
    currentUserId = INVITER_ID;
    // The viewer (inviter) holds NO registration; the invitee does, linked by
    // a use row on the viewer's invitation.
    mockState.invitations = [makeDuoInvitation()];
    mockState.registrations = [{ id: "reg-2", poolId: POOL_ID, userId: INVITEE_ID }];
    mockState.uses = [
      { id: "use-1", invitationId: "inv-1", inviteeId: INVITEE_ID, poolRegistrationId: "reg-2" },
    ];
    mockState.users = [{ id: INVITEE_ID, displayName: "小鹿", firstName: null }];

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/pools/${POOL_ID}/duo-status`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.state).toBe("waiting");
      expect(body.viewerRole).toBe("inviter");
      expect(body.pendingSide).toBe("inviter");
      expect(body.friendDisplayName).toBe("小鹿");
    });
  });

  it("invitee waiting (inviter has not registered) → invitee × inviter", async () => {
    currentUserId = INVITEE_ID;
    mockState.registrations = [{ id: "reg-2", poolId: POOL_ID, userId: INVITEE_ID }];
    mockState.invitations = [makeDuoInvitation()];
    mockState.uses = [
      { id: "use-1", invitationId: "inv-1", inviteeId: INVITEE_ID, poolRegistrationId: "reg-2" },
    ];
    mockState.users = [{ id: INVITER_ID, displayName: "阿杰", firstName: null }];

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/pools/${POOL_ID}/duo-status`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.state).toBe("waiting");
      expect(body.viewerRole).toBe("invitee");
      expect(body.pendingSide).toBe("inviter");
      expect(body.friendDisplayName).toBe("阿杰");
    });
  });

  it("none → direction keys are absent from the payload", async () => {
    currentUserId = "user-solo";

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/pools/${POOL_ID}/duo-status`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toEqual({ state: "none" });
      expect("viewerRole" in body).toBe(false);
      expect("pendingSide" in body).toBe(false);
    });
  });

  it("401 without an authenticated session", async () => {
    currentUserId = null;
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/pools/${POOL_ID}/duo-status`);
      expect(res.status).toBe(401);
    });
  });
});

// ── public lookup inviterRegistered ─────────────────────────────────────────

describe("GET /api/duo-invites/:code — inviterRegistered (S3, AC-0)", () => {
  beforeEach(() => {
    mockState.invitations = [makeDuoInvitation()];
    mockState.users = [{ id: INVITER_ID, displayName: "阿杰", firstName: null }];
  });

  it("true when the inviter holds a registration in the pool — and never leaks the userId", async () => {
    mockState.registrations = [{ id: "reg-1", poolId: POOL_ID, userId: INVITER_ID }];

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/duo-invites/${VALID_CODE}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("active");
      expect(body.inviterRegistered).toBe(true);
      expect(body.inviter).toEqual({ displayName: "阿杰" });
      expect(body.poolId).toBe(POOL_ID);
      // Security pillar: boolean only — the inviter's userId stays server-side.
      expect(JSON.stringify(body)).not.toContain(INVITER_ID);
    });
  });

  it("false when the inviter has not registered yet", async () => {
    mockState.registrations = [];

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/duo-invites/${VALID_CODE}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.inviterRegistered).toBe(false);
    });
  });

  it("false after the inviter cancels (row deleted) — even with other registrations in the pool", async () => {
    // Cancelling a registration deletes the event_pool_registrations row, so
    // row-existence IS the truth (no dangling state). A different user's row
    // in the same pool must not flip the boolean — the probe is scoped to
    // (poolId, inviterId).
    mockState.registrations = [{ id: "reg-9", poolId: POOL_ID, userId: "user-other" }];

    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/duo-invites/${VALID_CODE}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.inviterRegistered).toBe(false);
    });
  });
});
