import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSubscribeReminderScheduler,
  createFeedbackInviteNotifications,
  resolvePoolReminderMoment,
  FEEDBACK_INVITE_NOTIFICATION,
  type SubscribeReminderDependencies,
} from "../lib/subscribeReminderScheduler";

/**
 * db mock for the scheduler tick tests: every scheduler query is a
 * `select → from → where` chain (awaited directly) or ends in `.limit(1)`
 * (the feedback-invite existence check). The queue yields one row-set per
 * query in order.
 */
const dbState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
}));

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const rows = dbState.selectQueue.shift() ?? [];
          const pending = Promise.resolve(rows) as Promise<unknown[]> & { limit: unknown };
          pending.limit = vi.fn(() => Promise.resolve(rows));
          return pending;
        }),
      })),
    })),
  },
}));

const notificationsRepoMock = vi.hoisted(() => ({
  createNotification: vi.fn(),
}));

vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: notificationsRepoMock,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

/**
 * Moment-window contract for the subscribe reminder scheduler (notification
 * strategy 2026-09-16): event_day fires 3–12h before the event during
 * 08:00–22:00; recap fires 20–30h after during 09:00–21:00. Everything else
 * stays silent.
 */
describe("resolvePoolReminderMoment", () => {
  // 2026-09-20 was a Saturday; construct times in local time via Date parts.
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

  it("fires event_day for an evening event on the same morning", () => {
    expect(resolvePoolReminderMoment(at(20, 19), at(20, 9))).toBe("event_day");
  });

  it("fires event_day at the window boundaries", () => {
    expect(resolvePoolReminderMoment(at(20, 14), at(20, 10))).toBe("event_day"); // +4h
    expect(resolvePoolReminderMoment(at(20, 22), at(20, 10))).toBe("event_day"); // +12h
  });

  it("holds event_day when the event is too far ahead or too close", () => {
    expect(resolvePoolReminderMoment(at(21, 19), at(20, 9))).toBeNull(); // +34h
    expect(resolvePoolReminderMoment(at(20, 12), at(20, 10))).toBeNull(); // +2h < 3h floor
  });

  it("never pushes event_day outside waking hours", () => {
    expect(resolvePoolReminderMoment(at(21, 12), at(20, 23))).toBeNull(); // night
    expect(resolvePoolReminderMoment(at(21, 12), at(20, 6))).toBeNull(); // pre-08:00
  });

  it("fires recap 20–30h after the event during recap hours", () => {
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 17))).toBe("recap"); // +22h ago
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 20))).toBe("recap"); // +25h ago
  });

  it("holds recap when too fresh, too stale, or too late at night", () => {
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 10))).toBeNull(); // 15h ago
    expect(resolvePoolReminderMoment(at(18, 19), at(20, 10))).toBeNull(); // 39h ago
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 22))).toBeNull(); // after 21:00
  });

  it("locks the pool scan to exclude cancelled pools (regression: a cancelled matched pool must never receive 今天见/回顾 pushes)", () => {
    const source = readFileSync(
      new URL("../lib/subscribeReminderScheduler.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('ne(eventPools.status, "cancelled")');
  });

  it("locks the P0 member-query fix: completed registrations are recap-eligible", () => {
    // 2026-10-16 P0: poolCompletionSweep flips matched → completed at start
    // +3h, so a 'matched'-only query silently zeroed every pool recap push
    // since 2026-10-06. Both statuses must stay in the member query.
    const source = readFileSync(
      new URL("../lib/subscribeReminderScheduler.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('inArray(eventPoolRegistrations.matchStatus, ["matched", "completed"])');
  });

  it("locks the test-pool exclusion on the pool scan (tester pools stay silent)", () => {
    const source = readFileSync(
      new URL("../lib/subscribeReminderScheduler.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("eq(eventPools.isTestPool, false)");
  });
});

/**
 * Tick-level behaviour for the recap branch (2026-10-16 feedback activation,
 * plan D8): every recap recipient gets the push AND an in-app
 * feedback_invite notification; the in-app fan-out is idempotent across the
 * 10-minute ticks.
 */
describe("subscribe reminder tick — recap fan-out", () => {
  // Local-part Date construction keeps the send-hour gates TZ-independent.
  const NOW = new Date(2026, 9, 16, 12, 0); // Fri Oct 16 2026 12:00 local
  const POOL_TIME = new Date(2026, 9, 15, 11, 0); // 25h earlier → recap window

  function makeDeps(overrides: Partial<SubscribeReminderDependencies> = {}): SubscribeReminderDependencies {
    return {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => NOW,
      isEnabled: async () => true,
      sendEventDay: vi.fn(async () => {}),
      sendRecap: vi.fn(async () => {}),
      createFeedbackInvites: vi.fn(async () => 0),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    dbState.selectQueue = [];
  });

  it("recap tick sends the push and fans out in-app feedback invites to all matched+completed members", async () => {
    dbState.selectQueue = [
      // findMatchedPoolsInReminderRange — completed-status registrations are
      // selected by the SQL inArray (locked above); the mock stands in for it.
      [{ id: "pool-1", title: "周五夜聊酒局", dateTime: POOL_TIME }],
      // findMatchedMembers
      [
        { userId: "user-a", assignedGroupId: "group-1" },
        { userId: "user-b", assignedGroupId: "group-1" },
      ],
    ];
    const deps = makeDeps();
    const scheduler = createSubscribeReminderScheduler(deps);

    await scheduler.run();

    expect(deps.sendRecap).toHaveBeenCalledTimes(1);
    expect(deps.sendRecap).toHaveBeenCalledWith(
      ["user-a", "user-b"],
      expect.objectContaining({
        poolId: "pool-1",
        hint: "来聊聊感受，帮下次排桌更合拍",
      }),
    );
    expect(deps.createFeedbackInvites).toHaveBeenCalledTimes(1);
    expect(deps.createFeedbackInvites).toHaveBeenCalledWith("pool-1", ["user-a", "user-b"]);
    expect(deps.sendEventDay).not.toHaveBeenCalled();
  });

  it("a pool scan with no eligible pools (e.g. test pools excluded by SQL) produces zero sends and zero invites", async () => {
    dbState.selectQueue = [[]];
    const deps = makeDeps();
    const scheduler = createSubscribeReminderScheduler(deps);

    await scheduler.run();

    expect(deps.sendRecap).not.toHaveBeenCalled();
    expect(deps.sendEventDay).not.toHaveBeenCalled();
    expect(deps.createFeedbackInvites).not.toHaveBeenCalled();
  });

  it("a recap pool with zero matched members fans out nothing", async () => {
    dbState.selectQueue = [
      [{ id: "pool-1", title: "周五夜聊酒局", dateTime: POOL_TIME }],
      [], // findMatchedMembers → empty
    ];
    const deps = makeDeps();
    const scheduler = createSubscribeReminderScheduler(deps);

    await scheduler.run();

    expect(deps.sendRecap).not.toHaveBeenCalled();
    expect(deps.createFeedbackInvites).not.toHaveBeenCalled();
  });

  it("event_day pools never receive feedback invites (recap-only fan-out)", async () => {
    const eventDayPoolTime = new Date(2026, 9, 16, 19, 0); // +7h ahead → event_day
    dbState.selectQueue = [
      [{ id: "pool-2", title: "饭局", dateTime: eventDayPoolTime }],
      [{ userId: "user-a", assignedGroupId: "group-1" }], // findMatchedMembers
      [{ id: "group-1", venueName: "测试餐厅" }], // findGroupVenues
    ];
    const deps = makeDeps();
    const scheduler = createSubscribeReminderScheduler(deps);

    await scheduler.run();

    expect(deps.sendEventDay).toHaveBeenCalledTimes(1);
    expect(deps.sendRecap).not.toHaveBeenCalled();
    expect(deps.createFeedbackInvites).not.toHaveBeenCalled();
  });
});

describe("createFeedbackInviteNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.selectQueue = [];
    notificationsRepoMock.createNotification.mockResolvedValue(undefined);
  });

  it("creates an activities/feedback_invite row per recipient, keyed on the pool", async () => {
    dbState.selectQueue = [[], []]; // no existing rows for either user

    const created = await createFeedbackInviteNotifications("pool-1", ["user-a", "user-b"]);

    expect(created).toBe(2);
    expect(notificationsRepoMock.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationsRepoMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-a",
        category: "activities",
        type: "feedback_invite",
        title: FEEDBACK_INVITE_NOTIFICATION.title,
        message: FEEDBACK_INVITE_NOTIFICATION.message,
        relatedResourceId: "pool-1",
      }),
    );
  });

  it("is idempotent across two ticks (select-then-insert on user+type+pool)", async () => {
    // Tick 1: no existing row → insert.
    dbState.selectQueue = [[]];
    const createdFirst = await createFeedbackInviteNotifications("pool-1", ["user-a"]);
    expect(createdFirst).toBe(1);
    expect(notificationsRepoMock.createNotification).toHaveBeenCalledTimes(1);

    // Tick 2: the row from tick 1 exists → skip.
    dbState.selectQueue = [[{ id: "notif-1" }]];
    const createdSecond = await createFeedbackInviteNotifications("pool-1", ["user-a"]);
    expect(createdSecond).toBe(0);
    expect(notificationsRepoMock.createNotification).toHaveBeenCalledTimes(1);
  });

  it("fails open per recipient — one bad insert never aborts the batch", async () => {
    dbState.selectQueue = [[], []];
    notificationsRepoMock.createNotification
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(undefined);

    const created = await createFeedbackInviteNotifications("pool-1", ["user-a", "user-b"]);

    expect(created).toBe(1);
    expect(notificationsRepoMock.createNotification).toHaveBeenCalledTimes(2);
  });

  it("keeps the copy service-toned and incentive-free (WeChat review posture)", () => {
    expect(FEEDBACK_INVITE_NOTIFICATION.title).toBe("昨晚的活动怎么样？");
    expect(FEEDBACK_INVITE_NOTIFICATION.message).toBe("来说一句感受，帮下次排桌更合拍");
    // 排桌/合拍 vocabulary; no 匹配/社交/灵魂/撮合/AI, no points/reward hooks.
    const combined = `${FEEDBACK_INVITE_NOTIFICATION.title}${FEEDBACK_INVITE_NOTIFICATION.message}`;
    for (const banned of ["匹配", "社交", "灵魂", "撮合", "AI", "积分", "奖励"]) {
      expect(combined).not.toContain(banned);
    }
  });
});
