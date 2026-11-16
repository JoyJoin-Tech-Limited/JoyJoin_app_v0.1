/**
 * S2 AC-04：GET /api/pool-groups/:groupId 的 venueDeal 装配与成员边界。
 * 复用 gatheringRoomState.test.ts 的 withServer + findFirst mock 模式。
 */
import express from "express";
import { createWithServer } from "../test-utils/withServer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSql: any = vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
  op: "sql",
  raw: strings.join("?"),
  values,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ op: "eq", a, b })),
  and: vi.fn((...conditions: any[]) => ({ op: "and", conditions })),
  or: vi.fn((...conditions: any[]) => ({ op: "or", conditions })),
  desc: vi.fn((col: any) => ({ op: "desc", col })),
  gt: vi.fn((a: any, b: any) => ({ op: "gt", a, b })),
  isNull: vi.fn((col: any) => ({ op: "isNull", col })),
  inArray: vi.fn((col: any, values: any[]) => ({ op: "inArray", col, values })),
  sql: mockSql,
}));

const makeTable = (name: string) =>
  new Proxy({ name } as any, {
    get(target, prop) {
      if (prop === "name") return target.name;
      return { name: `${name}.${String(prop)}` };
    },
  });

vi.mock("@shared/schema", () => ({
  eventPools: makeTable("eventPools"),
  eventPoolRegistrations: makeTable("eventPoolRegistrations"),
  eventPoolGroups: makeTable("eventPoolGroups"),
  users: makeTable("users"),
  invitations: makeTable("invitations"),
  invitationUses: makeTable("invitationUses"),
  blindBoxEvents: makeTable("blindBoxEvents"),
  poolAICopy: makeTable("poolAICopy"),
  userInterests: makeTable("userInterests"),
  userInterestSignals: makeTable("userInterestSignals"),
  referralCodes: makeTable("referralCodes"),
  referralConversions: makeTable("referralConversions"),
}));

const mockFindGroup = vi.fn();
const mockFindPool = vi.fn();
const mockFindRegistration = vi.fn();
const mockFindManyRegistrations = vi.fn();
const mockSelect = vi.fn();
const mockExecute = vi.fn();

vi.mock("../db", () => ({
  db: {
    query: {
      eventPoolGroups: { findFirst: mockFindGroup },
      eventPools: { findFirst: mockFindPool },
      eventPoolRegistrations: { findFirst: mockFindRegistration, findMany: mockFindManyRegistrations },
    },
    select: mockSelect,
    execute: mockExecute,
  },
}));

const mockGetGroupVenueDeal = vi.fn();
const mockComputeHasGuaranteedDeal = vi.fn();
vi.mock("../repositories/venueDealsRepo", () => ({
  getGroupVenueDeal: mockGetGroupVenueDeal,
  computeHasGuaranteedDeal: mockComputeHasGuaranteedDeal,
  getPoolGuarantee: vi.fn(),
  getVenueDealById: vi.fn(),
  listVenueDeals: vi.fn(),
}));

vi.mock("../repositories/attendanceRepo", () => ({
  attendanceRepo: { getAttendanceStatuses: vi.fn() },
}));
vi.mock("../storage", () => ({
  storage: {
    getAttendanceStatus: vi.fn(),
    updateAttendanceStatus: vi.fn(),
    getUser: vi.fn(),
  },
}));
vi.mock("../paymentService", () => ({
  paymentService: {},
  REFUND_CLAIM_ERROR_MESSAGE: "Can only refund completed payments",
}));
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
vi.mock("../lib/budgetOptionsResolver", () => ({
  resolveBudgetOptions: vi.fn(async () => []),
}));

const { registerUserEventPoolRoutes } = await import("../routes/domains/userEventPools");

let currentUserId: string | null = "user-1";
let selectQueue: any[][] = [];

function rowsWithLimit(rows: any[]) {
  const out: any = [...rows];
  out.limit = (n: number) => rows.slice(0, n);
  return out;
}

function createSelectChain() {
  const rows = selectQueue.length > 0 ? selectQueue.shift()! : [];
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: any) => resolve(rowsWithLimit(rows));
        if (prop === "limit") return async (n: number) => rows.slice(0, n);
        return () => chain;
      },
    },
  );
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

const GROUP = {
  id: "group-1",
  poolId: "pool-1",
  groupNumber: 1,
  memberCount: 6,
  overallScore: 88,
  avgChemistryScore: 86,
  diversityScore: 70,
  energyBalance: null,
  matchExplanation: null,
  theme: "周末松弛感饭局",
  subtitle: null,
  vibe: null,
  themeEmoji: null,
  themeHighlights: [],
  venueId: "venue-1",
  venueName: "山止川行·南山店",
  venueAddress: "深圳市南山区",
  venueAssignmentStatus: "assigned",
  venueAssignmentReason: null,
  finalDateTime: null,
  status: "formed",
};

const POOL = {
  id: "pool-1",
  title: "周五饭局",
  description: null,
  eventType: "dining",
  city: "深圳",
  district: "南山区",
  dateTime: new Date("2026-11-20T11:30:00Z"),
  guaranteedVenueId: null,
  guaranteedDealId: null,
};

const MEMBER_ROWS = [
  {
    userId: "user-1",
    displayName: "小明",
    archetype: "corgi",
    topInterests: ["咖啡"],
    birthdate: "1998-06-15",
    industryNicheLabel: "互联网产品",
    industryCategoryLabel: "互联网",
    ageVisible: "show_exact_age",
    industryVisible: "show",
    wechatAvatarUrl: null,
    profileImageUrl: null,
    isTestBot: false,
    gender: "male",
    educationLevel: null,
    hometownRegionCity: null,
    hometownAffinityOptin: null,
    educationVisible: "hide_all",
    relationshipStatus: null,
    intent: null,
  },
];

const SUMMARY = {
  id: "deal-1",
  kind: "discount",
  valueOffPercent: 20,
  title: "本场专属折扣",
  description: "无门槛全单通用",
  method: "code",
  code: "悦聚同桌",
  venueName: "山止川行·南山店",
};

describe("GET /api/pool-groups/:groupId · venueDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = "user-1";
    selectQueue = [];
    mockFindGroup.mockResolvedValue(GROUP);
    mockFindPool.mockResolvedValue(POOL);
    mockFindRegistration.mockResolvedValue({ id: "reg-1", revealedAt: null });
    mockSelect.mockImplementation(() => createSelectChain());
    mockGetGroupVenueDeal.mockResolvedValue(SUMMARY);
  });

  it("已 assigned 小组返回唯一一张可兑现权益（含暗号，仅限成员）", async () => {
    selectQueue = [MEMBER_ROWS];
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/pool-groups/group-1`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.group.venueDeal).toEqual(SUMMARY);
      expect(mockGetGroupVenueDeal).toHaveBeenCalledWith({
        venueId: "venue-1",
        venueName: "山止川行·南山店",
        assignmentStatus: "assigned",
        poolGuaranteedVenueId: null,
        poolGuaranteedDealId: null,
      });
    });
  });

  it("保底池把保底字段交给 resolver；resolver 判失效即为 null，路由不自行换券", async () => {
    mockFindPool.mockResolvedValue({ ...POOL, guaranteedVenueId: "venue-1", guaranteedDealId: "deal-9" });
    mockGetGroupVenueDeal.mockResolvedValue(null);
    selectQueue = [MEMBER_ROWS];
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/pool-groups/group-1`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.group.venueDeal).toBeNull();
      expect(mockGetGroupVenueDeal).toHaveBeenCalledWith(
        expect.objectContaining({ poolGuaranteedVenueId: "venue-1", poolGuaranteedDealId: "deal-9" }),
      );
    });
  });

  it("小组响应 pool 携带保底真值与绑定事实，且不外泄 guaranteed id（AC-08）", async () => {
    mockFindPool.mockResolvedValue({ ...POOL, guaranteedVenueId: "venue-1", guaranteedDealId: "deal-9" });
    mockComputeHasGuaranteedDeal.mockResolvedValue(true);
    selectQueue = [MEMBER_ROWS];
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/pool-groups/group-1`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.pool.hasGuaranteedDeal).toBe(true);
      expect(body.pool.hasGuaranteedDealBinding).toBe(true);
      expect(body.pool.guaranteedVenueId).toBeUndefined();
      expect(body.pool.guaranteedDealId).toBeUndefined();
    });
  });

  it("权益被撤销后：hasGuaranteedDeal=false、deal=null，但 hasGuaranteedDealBinding 仍为 true（页面据此显示已调整而非静默消失）", async () => {
    mockFindPool.mockResolvedValue({ ...POOL, guaranteedVenueId: "venue-1", guaranteedDealId: "deal-9" });
    mockComputeHasGuaranteedDeal.mockResolvedValue(false);
    mockGetGroupVenueDeal.mockResolvedValue(null);
    selectQueue = [MEMBER_ROWS];
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/pool-groups/group-1`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.pool.hasGuaranteedDeal).toBe(false);
      expect(body.pool.hasGuaranteedDealBinding).toBe(true);
      expect(body.group.venueDeal).toBeNull();
    });
  });

  it("非成员 403，且绝不调用权益装配", async () => {    mockFindRegistration.mockResolvedValue(undefined);
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/pool-groups/group-1`);
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.group).toBeUndefined();
      expect(body.venueDeal).toBeUndefined();
      expect(mockGetGroupVenueDeal).not.toHaveBeenCalled();
    });
  });

  it("未登录 401", async () => {
    currentUserId = null;
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/pool-groups/group-1`);
      expect(res.status).toBe(401);
      expect(mockGetGroupVenueDeal).not.toHaveBeenCalled();
    });
  });
});

describe("GET /api/event-pools/:id · 保底字段响应级断言（AC-05）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = "user-1";
    selectQueue = [];
    mockFindManyRegistrations.mockResolvedValue([]);
    mockExecute.mockResolvedValue({ rows: [] });
    mockSelect.mockImplementation(() => createSelectChain());
    mockComputeHasGuaranteedDeal.mockResolvedValue(true);
  });

  it("响应不含 guaranteedVenueId/guaranteedDealId，但含服务端计算的 hasGuaranteedDeal", async () => {
    mockFindPool.mockResolvedValue({
      ...POOL,
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-9",
    });
    selectQueue = [[{ archetype: "corgi" }]]; // current user archetype
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/event-pools/pool-1`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.guaranteedVenueId).toBeUndefined();
      expect(body.guaranteedDealId).toBeUndefined();
      expect(body.hasGuaranteedDeal).toBe(true);
      expect(body.registrationCount).toBe(0);
      expect(mockComputeHasGuaranteedDeal).toHaveBeenCalledWith(
        expect.objectContaining({ guaranteedVenueId: "venue-1", guaranteedDealId: "deal-9" }),
      );
    });
  });

  it("无保底池同样不携带两个字段，hasGuaranteedDeal=false", async () => {
    mockFindPool.mockResolvedValue(POOL);
    mockComputeHasGuaranteedDeal.mockResolvedValue(false);
    selectQueue = [[{ archetype: null }]];
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/event-pools/pool-1`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.guaranteedVenueId).toBeUndefined();
      expect(body.guaranteedDealId).toBeUndefined();
      expect(body.hasGuaranteedDeal).toBe(false);
    });
  });

  it("列表响应同样不含两个保底字段（AC-05 响应级）", async () => {
    selectQueue = [
      [{ ...POOL, guaranteedVenueId: "venue-1", guaranteedDealId: "deal-9" }], // visible pools
      [{ archetype: "corgi" }], // current user archetype
      [], // top archetype rows
      [], // ai copy rows
    ];
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/event-pools`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].guaranteedVenueId).toBeUndefined();
      expect(body[0].guaranteedDealId).toBeUndefined();
      expect(body[0].id).toBe("pool-1");
    });
  });
});
