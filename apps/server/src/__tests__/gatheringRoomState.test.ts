/**
 * Tests for GET /api/pool-groups/:groupId/room-state (gathering room 集结房间)
 *
 * Coverage:
 *   - 404 for unknown group / missing pool (parity with the group details route)
 *   - 403 for non-members
 *   - Member list with attendanceStatus mapping + confirmedCount/totalParticipants
 *   - Visibility flags (ageVisible/industryVisible) match the group details route;
 *     ageLabel/industryNicheLabel are populated only when visible
 *   - No linked blind box event → blindBoxEventId null, everyone 'pending'
 */

import express from "express";
import { createWithServer } from '../test-utils/withServer';
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock drizzle-orm operators ──────────────────────────────────────────────

const mockSql: any = vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
  op: 'sql',
  raw: strings.join('?'),
  values,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ op: 'eq', a, b })),
  and: vi.fn((...conditions: any[]) => ({ op: 'and', conditions })),
  or: vi.fn((...conditions: any[]) => ({ op: 'or', conditions })),
  desc: vi.fn((col: any) => ({ op: 'desc', col })),
  gt: vi.fn((a: any, b: any) => ({ op: 'gt', a, b })),
  isNull: vi.fn((col: any) => ({ op: 'isNull', col })),
  inArray: vi.fn((col: any, values: any[]) => ({ op: 'inArray', col, values })),
  sql: mockSql,
}));

// ── Shared schema tables (lightweight proxies) ─────────────────────────────

const makeTable = (name: string) => new Proxy({ name } as any, {
  get(target, prop) {
    if (prop === 'name') return target.name;
    return { name: `${name}.${String(prop)}` };
  },
});

vi.mock("@shared/schema", () => ({
  eventPools: makeTable('eventPools'),
  eventPoolRegistrations: makeTable('eventPoolRegistrations'),
  eventPoolGroups: makeTable('eventPoolGroups'),
  users: makeTable('users'),
  invitations: makeTable('invitations'),
  invitationUses: makeTable('invitationUses'),
  blindBoxEvents: makeTable('blindBoxEvents'),
  poolAICopy: makeTable('poolAICopy'),
  userInterests: makeTable('userInterests'),
  userInterestSignals: makeTable('userInterestSignals'),
  referralCodes: makeTable('referralCodes'),
  referralConversions: makeTable('referralConversions'),
}));

// ── DB mock ─────────────────────────────────────────────────────────────────

const mockFindGroup = vi.fn();
const mockFindPool = vi.fn();
const mockFindRegistration = vi.fn();
const mockSelect = vi.fn();

vi.mock("../db", () => ({
  db: {
    query: {
      eventPoolGroups: { findFirst: mockFindGroup },
      eventPools: { findFirst: mockFindPool },
      eventPoolRegistrations: { findFirst: mockFindRegistration },
    },
    select: mockSelect,
  },
}));

// ── Repository / service mocks ──────────────────────────────────────────────

const mockGetAttendanceStatuses = vi.fn();

vi.mock("../repositories/attendanceRepo", () => ({
  attendanceRepo: {
    getAttendanceStatuses: mockGetAttendanceStatuses,
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getAttendanceStatus: vi.fn(),
    updateAttendanceStatus: vi.fn(),
    getUser: vi.fn(),
  },
}));

vi.mock("../paymentService", () => ({ paymentService: {} }));
vi.mock("../routes/domains/payments", () => ({ resolveCouponValidation: vi.fn() }));
vi.mock("../adminAuth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireOperatorOrAbove: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../eventBroadcast", () => ({ broadcastAttendanceStatusUpdated: vi.fn() }));
vi.mock("../wsService", () => ({
  wsService: {
    broadcastToEvent: vi.fn(),
    broadcastToUser: vi.fn(),
    broadcastToUsers: vi.fn(),
    broadcastToAll: vi.fn(),
  },
}));
vi.mock("../lib/requestAuth", () => ({
  getAuthenticatedUserId: (req: any) => req.session?.userId ?? null,
}));

// ── Imports after mocks ─────────────────────────────────────────────────────

// The room-state endpoint is gated by the gatheringRoomEnabled feature flag;
// enable it for these tests so the route is reachable.
process.env.GATHERING_ROOM_ENABLED = 'true';

const { registerUserEventPoolRoutes } = await import("../routes/domains/userEventPools");

// ── Test helpers ────────────────────────────────────────────────────────────

let currentUserId: string | null = "user-1";
let selectQueue: any[][] = [];

function rowsWithLimit(rows: any[]) {
  const out: any = [...rows];
  out.limit = (n: number) => rows.slice(0, n);
  return out;
}

function createSelectChain() {
  const rows = selectQueue.length > 0 ? selectQueue.shift()! : [];
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => rowsWithLimit(rows));
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = currentUserId ? { userId: currentUserId } : {};
    next();
  });
  registerUserEventPoolRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

const GROUP = { id: "group-1", poolId: "pool-1", blindBoxEventId: "bbe-1" };
const POOL = { id: "pool-1", title: "周五饭局" };
const MEMBER_ROWS = [
  {
    userId: "user-1",
    displayName: "小明",
    archetype: "corgi",
    topInterests: ["咖啡", "徒步"],
    birthdate: "1998-06-15",
    industryNicheLabel: "互联网产品",
    ageVisible: "show_exact_age",
    industryVisible: "hide_all",
  },
  {
    userId: "user-2",
    displayName: "阿花",
    archetype: "owl",
    topInterests: ["展览"],
    birthdate: "1995-03-20",
    industryNicheLabel: "纪录片摄影",
    ageVisible: "hide_all",
    industryVisible: "show",
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/pool-groups/:groupId/room-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = "user-1";
    selectQueue = [];
    mockSelect.mockImplementation(createSelectChain);
    mockFindGroup.mockResolvedValue(GROUP);
    mockFindPool.mockResolvedValue(POOL);
    mockFindRegistration.mockResolvedValue({ id: "reg-1", userId: "user-1", assignedGroupId: "group-1" });
    mockGetAttendanceStatuses.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    currentUserId = null;
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/group-1/room-state`);
      expect(res.status).toBe(401);
    });
  });

  it("returns 404 when the group does not exist", async () => {
    mockFindGroup.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/nope/room-state`);
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.message).toBe("Group not found");
    });
  });

  it("returns 404 when the pool does not exist", async () => {
    mockFindPool.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/group-1/room-state`);
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.message).toBe("Event pool not found");
    });
  });

  it("returns 403 when the user is not a group member", async () => {
    mockFindRegistration.mockResolvedValue(null);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/group-1/room-state`);
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.message).toBe("You are not a member of this group");
    });
  });

  it("returns member states with attendance mapping, visibility flags and confirmedCount", async () => {
    selectQueue = [MEMBER_ROWS];
    mockGetAttendanceStatuses.mockResolvedValue([
      { userId: "user-1", status: "confirmed" },
    ]);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/group-1/room-state`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.groupId).toBe("group-1");
      expect(body.blindBoxEventId).toBe("bbe-1");
      expect(body.totalParticipants).toBe(2);
      expect(body.confirmedCount).toBe(1);
      expect(body.members).toHaveLength(2);

      // Visible age → ageLabel populated; hidden industry → niche label null
      expect(body.members[0]).toMatchObject({
        userId: "user-1",
        displayName: "小明",
        archetype: "corgi",
        attendanceStatus: "confirmed",
        topInterests: ["咖啡", "徒步"],
        ageVisible: true,
        industryVisible: false,
        industryNicheLabel: null,
      });
      expect(body.members[0].ageLabel).toMatch(/^\d+岁$/);

      // Hidden age → ageLabel null; visible industry → niche label populated
      expect(body.members[1]).toMatchObject({
        userId: "user-2",
        attendanceStatus: "pending",
        ageVisible: false,
        ageLabel: null,
        industryVisible: true,
        industryNicheLabel: "纪录片摄影",
      });
      expect(mockGetAttendanceStatuses).toHaveBeenCalledWith("bbe-1", ["user-1", "user-2"]);
    });
  });

  it("returns null blindBoxEventId and all-pending statuses when no event exists yet", async () => {
    mockFindGroup.mockResolvedValue({ id: "group-1", poolId: "pool-1", blindBoxEventId: null });
    // First select = pool-level blindBoxEvents fallback (empty), second = members
    selectQueue = [[], MEMBER_ROWS];
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/group-1/room-state`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.blindBoxEventId).toBeNull();
      expect(body.totalParticipants).toBe(2);
      expect(body.confirmedCount).toBe(0);
      expect(body.members.every((m: any) => m.attendanceStatus === "pending")).toBe(true);
      expect(mockGetAttendanceStatuses).not.toHaveBeenCalled();
    });
  });

  it("falls back to the pool-level blind box event when the group has no direct link", async () => {
    mockFindGroup.mockResolvedValue({ id: "group-1", poolId: "pool-1", blindBoxEventId: null });
    selectQueue = [[{ id: "bbe-fallback" }], MEMBER_ROWS];
    mockGetAttendanceStatuses.mockResolvedValue([
      { userId: "user-1", status: "confirmed" },
      { userId: "user-2", status: "confirmed" },
    ]);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/pool-groups/group-1/room-state`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.blindBoxEventId).toBe("bbe-fallback");
      expect(body.confirmedCount).toBe(2);
    });
  });
});
