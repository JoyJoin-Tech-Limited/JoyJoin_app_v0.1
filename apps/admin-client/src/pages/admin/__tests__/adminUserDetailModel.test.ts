import { describe, expect, it } from "vitest";
import {
  commercialDisplay,
  DETAIL_LIST_LIMIT,
  entitlementDisplay,
  groupMatchHistoryByEvent,
  isDerivedPoolEventTitle,
  joinedEventAttendanceDisplay,
  listCountLabel,
  resolveArchetypeDisplay,
  splitActivityEvents,
} from "../adminUserDetailModel";
import type { JoinedEvent, MatchHistoryEntry, UserPoolRegistration } from "../types";

const registration = (
  overrides: Partial<UserPoolRegistration> & { poolId: string; poolTitle: string },
): UserPoolRegistration =>
  ({
    id: `reg-${overrides.poolId}`,
    matchStatus: "matched",
    registeredAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }) as UserPoolRegistration;

const joinedEvent = (
  overrides: Omit<Partial<JoinedEvent>, "title"> & { title?: string | null },
): JoinedEvent =>
  ({ id: "event-1", title: "活动", ...overrides }) as JoinedEvent;

function matchRow(overrides: Partial<MatchHistoryEntry>): MatchHistoryEntry {
  return {
    id: "match-1",
    user1Id: "viewer",
    user2Id: "partner-1",
    eventId: "event-1",
    ...overrides,
  } as MatchHistoryEntry;
}

describe("resolveArchetypeDisplay", () => {
  it("renders the Chinese name and keeps the machine id as a caption", () => {
    expect(resolveArchetypeDisplay("corgi")).toEqual({
      name: "社牛柯基",
      id: "corgi",
      styleKey: "corgi",
    });
  });

  it("localizes legacy Chinese names instead of echoing them", () => {
    expect(resolveArchetypeDisplay("太阳鸡")).toEqual({
      name: "小太阳鸡",
      id: "rooster",
      styleKey: "rooster",
    });
  });

  it("passes unknown values through so a data bug stays visible", () => {
    expect(resolveArchetypeDisplay("未知原型")).toEqual({
      name: "未知原型",
      id: null,
      styleKey: "未知原型",
    });
  });

  it("returns null for missing values", () => {
    expect(resolveArchetypeDisplay(null)).toBeNull();
    expect(resolveArchetypeDisplay("   ")).toBeNull();
  });
});

describe("joinedEventAttendanceDisplay", () => {
  it("reads only the check-in column", () => {
    expect(joinedEventAttendanceDisplay({ rsvpStatus: "confirmed", attendanceStatus: "confirmed" })).toBe("已签到");
    expect(joinedEventAttendanceDisplay({ rsvpStatus: "confirmed", attendanceStatus: "late" })).toBe("迟到");
    expect(joinedEventAttendanceDisplay({ rsvpStatus: "confirmed", attendanceStatus: "absent" })).toBe("缺席");
    expect(joinedEventAttendanceDisplay({ rsvpStatus: "confirmed", attendanceStatus: "pending" })).toBe("待确认");
  });

  it("does not call an RSVP-only row attended", () => {
    expect(joinedEventAttendanceDisplay({ rsvpStatus: "confirmed", attendanceStatus: null })).toBeNull();
  });

  it("reports a cancelled RSVP before any check-in label", () => {
    expect(joinedEventAttendanceDisplay({ rsvpStatus: "cancelled", attendanceStatus: "confirmed" })).toBe("已取消报名");
  });
});

describe("isDerivedPoolEventTitle", () => {
  it("matches the generated `${pool} - 第N组` form", () => {
    expect(isDerivedPoolEventTitle("深业上城 · 破冰局 - 第2组", "深业上城 · 破冰局")).toBe(true);
    expect(isDerivedPoolEventTitle("周五饭局（第3组）", "周五饭局")).toBe(true);
  });

  it("requires a separator so a longer event title is not swallowed", () => {
    expect(isDerivedPoolEventTitle("周五饭局加场", "周五饭局")).toBe(false);
  });

  it("ignores empty values", () => {
    expect(isDerivedPoolEventTitle("", "周五饭局")).toBe(false);
    expect(isDerivedPoolEventTitle("周五饭局", "  ")).toBe(false);
  });
});

describe("splitActivityEvents", () => {
  it("attaches each generated pool event to its pool and drops cancelled events", () => {
    const split = splitActivityEvents(
      [
        joinedEvent({ id: "pool-event", title: "周五饭局 - 第2组", status: "completed" }),
        joinedEvent({ id: "cancelled", title: "取消场", status: "cancelled" }),
        joinedEvent({ id: "solo", title: "独立活动", status: "completed" }),
      ],
      [registration({ poolId: "pool-1", poolTitle: "周五饭局" })],
    );

    expect(split.standaloneEvents.map((event) => event.id)).toEqual(["solo"]);
    expect(split.eventByPoolId.get("pool-1")?.id).toBe("pool-event");
    expect(split.cancelledCount).toBe(1);
  });

  it("prefers the longest matching pool title", () => {
    const split = splitActivityEvents(
      [joinedEvent({ id: "event", title: "周五饭局 · 加场 - 第1组" })],
      [
        registration({ poolId: "short", poolTitle: "周五饭局" }),
        registration({ poolId: "long", poolTitle: "周五饭局 · 加场" }),
      ],
    );

    expect(split.eventByPoolId.get("long")?.id).toBe("event");
    expect(split.eventByPoolId.has("short")).toBe(false);
  });

  it("keeps an event with no title as standalone rather than guessing", () => {
    const split = splitActivityEvents(
      [joinedEvent({ id: "untitled", title: null })],
      [registration({ poolId: "pool-1", poolTitle: "周五饭局" })],
    );

    expect(split.standaloneEvents.map((event) => event.id)).toEqual(["untitled"]);
  });
});

describe("listCountLabel", () => {
  it("flags a server-capped list as recent, not total", () => {
    expect(listCountLabel(DETAIL_LIST_LIMIT)).toBe(`最近 ${DETAIL_LIST_LIMIT} 条`);
    expect(listCountLabel(DETAIL_LIST_LIMIT - 1)).toBe(`${DETAIL_LIST_LIMIT - 1}`);
  });
});

describe("groupMatchHistoryByEvent", () => {
  it("collapses pair rows into one table and de-duplicates partners", () => {
    const groups = groupMatchHistoryByEvent(
      [
        matchRow({ id: "a", user2Id: "partner-1", partnerName: "林小满", partnerArchetype: "太阳鸡", wouldMeetAgain: true }),
        matchRow({ id: "b", user2Id: "partner-1", partnerName: "林小满", partnerArchetype: "太阳鸡", wouldMeetAgain: null }),
        matchRow({ id: "c", user1Id: "partner-2", user2Id: "viewer", partnerName: "赵岚", partnerArchetype: "fox", wouldMeetAgain: false }),
      ],
      "viewer",
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].partners.map((partner) => partner.name)).toEqual(["林小满", "赵岚"]);
    expect(groups[0].tableSize).toBe(3);
    // `null` means "no verdict", not "no".
    expect(groups[0].answeredPairs).toBe(2);
    expect(groups[0].willingPairs).toBe(1);
  });

  it("keeps separate events separate", () => {
    const groups = groupMatchHistoryByEvent(
      [
        matchRow({ id: "a", eventId: "event-1" }),
        matchRow({ id: "b", eventId: "event-2", user2Id: "partner-2" }),
      ],
      "viewer",
    );

    expect(groups.map((group) => group.eventId)).toEqual(["event-1", "event-2"]);
  });
});

describe("entitlementDisplay", () => {
  it("renders the subscription branch with the plan name", () => {
    expect(
      entitlementDisplay({
        mode: "subscription",
        availableEventCredits: 0,
        subscription: { planType: "quarterly", daysRemaining: 41 },
      }),
    ).toEqual({ modeLabel: "订阅中", detail: "悦聚季卡 · 剩余 41 天", tone: "active" });
  });

  it("renders credits, test mode, and no entitlement distinctly", () => {
    expect(
      entitlementDisplay({ mode: "event_pack", availableEventCredits: 3, subscription: null }),
    ).toMatchObject({ modeLabel: "局包", detail: "剩余 3 次", tone: "credits" });
    expect(
      entitlementDisplay({ mode: "test", availableEventCredits: 0, subscription: null }),
    ).toMatchObject({ modeLabel: "测试模式", tone: "test" });
    expect(
      entitlementDisplay({ mode: null, availableEventCredits: 0, subscription: null }),
    ).toMatchObject({ modeLabel: "无权益", tone: "none" });
  });

  it("says the snapshot is missing instead of claiming no entitlement", () => {
    expect(entitlementDisplay(null)).toMatchObject({ modeLabel: "权益未知", tone: "none" });
  });
});

describe("commercialDisplay", () => {
  it("renders the attendance ratio and never divides by zero", () => {
    const display = commercialDisplay({
      totalPaidCents: 19900,
      paidOrderCount: 2,
      attendedCount: 2,
      recentAttendedAt: "2026-10-10T11:00:00.000Z",
      attendanceRate: 66.7,
      matchedRegistrationCount: 3,
      isRepeat: true,
    });

    expect(display?.totalPaid).toBe("¥199.00");
    expect(display?.attendanceRate).toBe("2/3（66.7%）");
    expect(display?.attendanceRateNote).toBeNull();
    expect(display?.repeat).toBe("复购用户");
  });

  it("withholds a rate above 100% and explains the wider attendance count", () => {
    const display = commercialDisplay({
      totalPaidCents: 0,
      paidOrderCount: 0,
      attendedCount: 5,
      recentAttendedAt: null,
      attendanceRate: 166.7,
      matchedRegistrationCount: 3,
      isRepeat: true,
    });

    expect(display?.attendanceRate).toBeNull();
    expect(display?.attendanceRateNote).toBe("出席 5 次 · 已排桌 3 次");
  });

  it("returns null counts rather than 0% when nothing was seated", () => {
    const display = commercialDisplay({
      totalPaidCents: 0,
      paidOrderCount: 0,
      attendedCount: 0,
      recentAttendedAt: null,
      attendanceRate: null,
      matchedRegistrationCount: 0,
      isRepeat: false,
    });

    expect(display?.attendanceRate).toBeNull();
    expect(display?.attendanceRateNote).toBeNull();
    expect(display?.recentAttended).toBe("暂无出席记录");
    expect(display?.repeat).toBe("未复购");
  });

  it("returns null when the server did not send a snapshot", () => {
    expect(commercialDisplay(undefined)).toBeNull();
  });
});
