import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AdminUserDetailSheet } from "../AdminUserDetailSheet";
import type { UserDetail } from "../types";

// Radix ScrollArea (shadcn) observes its viewport; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

function fixture(): UserDetail {
  return {
    user: {
      id: "user-1",
      displayName: "陈知遥",
      wechatNickname: "遥",
      phoneNumber: "13800000000",
      gender: "Woman",
      currentCity: "深圳",
      createdAt: "2026-05-01T10:00:00.000Z",
      isAdmin: false,
      isBanned: false,
      profileCompleteness: { score: 80, starRating: 4, missingFields: ["家乡", "行业细分", "感情状态", "人生阶段", "饮食偏好", "职业"] },
    },
    onboarding: {
      hasCompletedPersonalityTest: true,
      profileEssentialComplete: true,
      hasCompletedInterestsCarousel: true,
    },
    assessmentSession: null,
    joinedEvents: [
      {
        id: "event-1",
        title: "周五小酒馆局",
        eventType: "酒局",
        dateTime: "2026-10-10T11:00:00.000Z",
        status: "completed",
        rsvpStatus: "confirmed",
        attendanceStatus: "confirmed",
        attendeeCount: 6,
      },
      {
        id: "event-2",
        title: "已取消的饭局",
        eventType: "饭局",
        dateTime: "2026-09-20T11:00:00.000Z",
        status: "cancelled",
        rsvpStatus: "confirmed",
        attendanceStatus: null,
        attendeeCount: 0,
      },
      {
        // The generated event behind reg-1. It must not appear twice: the pool
        // row is the richer record of the same session.
        id: "event-3",
        title: "深业上城 · 破冰局 - 第2组",
        eventType: "饭局",
        dateTime: "2026-10-10T11:00:00.000Z",
        status: "completed",
        rsvpStatus: "attended",
        attendanceStatus: "late",
        attendeeCount: 5,
      },
    ],
    poolRegistrations: [
      {
        id: "reg-1",
        poolId: "3f1c0b9a-1111-2222-3333-444455556666",
        poolTitle: "深业上城 · 破冰局",
        poolEventType: "饭局",
        poolDateTime: "2026-10-10T11:00:00.000Z",
        poolCity: "深圳",
        poolDistrict: "福田区",
        poolStatus: "completed",
        groupNumber: 2,
        assignedGroupId: "group-uuid-1",
        matchStatus: "matched",
        matchScore: 87,
        registeredAt: "2026-10-01T09:30:00.000Z",
      },
      {
        id: "reg-2",
        poolId: "9a8b7c6d-1111-2222-3333-444455556666",
        poolTitle: null,
        matchStatus: "pending",
        registeredAt: "2026-10-05T09:30:00.000Z",
      },
    ],
    connections: [
      {
        id: "conn-1",
        userAId: "user-1",
        userBId: "user-2",
        eventId: "event-1",
        partnerName: "林小满",
        partnerArchetype: "太阳鸡",
        eventTitle: "周五小酒馆局",
        eventDateTime: "2026-10-10T11:00:00.000Z",
        revealedAt: "2026-10-11T10:00:00.000Z",
      },
    ],
    matchHistory: [
      {
        id: "match-1",
        user1Id: "user-1",
        user2Id: "user-2",
        eventId: "event-1",
        partnerName: "林小满",
        partnerArchetype: "太阳鸡",
        eventTitle: "周五小酒馆局",
        eventDateTime: "2026-10-10T11:00:00.000Z",
        connectionPointTypes: ["共同兴趣"],
        connectionQuality: 4,
        wouldMeetAgain: true,
        matchedAt: "2026-10-11T10:00:00.000Z",
      },
      {
        id: "match-2",
        user1Id: "user-3",
        user2Id: "user-1",
        eventId: "event-1",
        partnerName: "赵岚",
        partnerArchetype: "fox",
        eventTitle: "周五小酒馆局",
        eventDateTime: "2026-10-10T11:00:00.000Z",
        connectionPointTypes: ["互补性格"],
        connectionQuality: 3,
        wouldMeetAgain: false,
        matchedAt: "2026-10-11T10:00:00.000Z",
      },
    ],
    interests: null,
    matchingReadiness: { isReady: true, blockers: [] },
    entitlement: {
      mode: "subscription",
      availableEventCredits: 0,
      subscription: { planType: "monthly", daysRemaining: 12 },
    },
    commercial: {
      totalPaidCents: 19900,
      paidOrderCount: 2,
      attendedCount: 2,
      recentAttendedAt: "2026-10-10T11:00:00.000Z",
      attendanceRate: 66.7,
      matchedRegistrationCount: 3,
      isRepeat: true,
    },
  } as unknown as UserDetail;
}

function renderSheet() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <AdminUserDetailSheet
      selectedUser="user-1"
      onClose={() => {}}
      userDetail={fixture()}
      isLoadingDetail={false}
      onBan={() => {}}
      onUnban={() => {}}
      onDelete={() => {}}
      banPending={false}
      unbanPending={false}
      deletePending={false}
    />,
    { wrapper },
  );
}

describe("AdminUserDetailSheet", () => {
  it("renders the overview gender as a readable word, not the raw stored value", () => {
    renderSheet();
    expect(screen.getByText("女")).toBeTruthy();
    expect(screen.queryByText("Woman")).toBeNull();
  });

  it("counts the missing profile fields instead of trailing off", () => {
    renderSheet();
    expect(screen.getByText(/缺少 6 项/)).toBeTruthy();
  });

  it("names the pool, group, and status in 活动历史", () => {
    renderSheet();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "活动历史" }));

    expect(screen.getByText("深业上城 · 破冰局")).toBeTruthy();
    expect(screen.getByText(/已排桌 · 第 2 组/)).toBeTruthy();
    expect(screen.getByText("已排桌")).toBeTruthy();
    expect(screen.getByText("待排桌")).toBeTruthy();
    expect(screen.getByText(/已结束/)).toBeTruthy();
    // Falls back to a short reference, never a bare 36-character UUID.
    expect(screen.getByText("场次 9a8b7c6d…")).toBeTruthy();
    expect(screen.queryByText(/3f1c0b9a/)).toBeNull();

    // Joined events: Chinese attendance badge, named title, no duplicated 酒局.
    expect(screen.getByText("周五小酒馆局")).toBeTruthy();
    expect(screen.getByText("已签到")).toBeTruthy();
    expect(screen.getByText("酒局 · 6 人出席")).toBeTruthy();

    // The pool's generated event is not repeated as a second row; its check-in
    // is reported on the pool row instead (迟到 is a real check-in).
    expect(screen.queryByText("深业上城 · 破冰局 - 第2组")).toBeNull();
    expect(screen.getByText("迟到 · 5 人出席")).toBeTruthy();

    // A cancelled event is not participation, and the count says so.
    expect(screen.queryByText("已取消的饭局")).toBeNull();
    expect(screen.getByText("另有 1 场已取消未计入")).toBeTruthy();
  });

  it("labels the registration score as the table score, not this user's match", () => {
    renderSheet();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "活动历史" }));

    expect(screen.getByText("同桌整体分 87/100")).toBeTruthy();
    expect(screen.getByText(/同桌整体分是这一桌的评分/)).toBeTruthy();
    expect(screen.queryByText("匹配分 87")).toBeNull();
  });

  it("renders the entitlement snapshot from the server resolver", () => {
    renderSheet();

    expect(screen.getByText("权益快照")).toBeTruthy();
    expect(screen.getByText("订阅中")).toBeTruthy();
    expect(screen.getByText("悦聚月卡 · 剩余 12 天")).toBeTruthy();
  });

  it("renders the commercial snapshot without dead counters", () => {
    renderSheet();

    expect(screen.getByText("消费与出席")).toBeTruthy();
    expect(screen.getByText("¥199.00")).toBeTruthy();
    expect(screen.getByText("2 笔")).toBeTruthy();
    expect(screen.getByText("2 次")).toBeTruthy();
    expect(screen.getByText("2/3（66.7%）")).toBeTruthy();
    expect(screen.getByText("复购用户")).toBeTruthy();
  });

  it("names the connection partner and the event in 连接关系", () => {
    renderSheet();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "连接关系" }));

    expect(screen.getByText("林小满")).toBeTruthy();
    expect(screen.getByText(/周五小酒馆局/)).toBeTruthy();
    expect(screen.getByText(/揭晓于/)).toBeTruthy();
    expect(screen.queryByText(/用户 user-2/)).toBeNull();
  });

  it("groups 同桌历史 by table instead of listing every derived pair", () => {
    renderSheet();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "同桌历史" }));

    // Two pair rows, one table: viewer + 2 partners.
    expect(screen.getByText("同桌 3 人")).toBeTruthy();
    expect(screen.getByText("愿意再聚 1/2")).toBeTruthy();
    expect(screen.getByText("周五小酒馆局")).toBeTruthy();

    // Partner archetypes are Chinese names, including legacy names.
    expect(screen.getByText("林小满")).toBeTruthy();
    expect(screen.getByText("小太阳鸡")).toBeTruthy();
    expect(screen.getByText("赵岚")).toBeTruthy();
    expect(screen.getByText("寻宝狐")).toBeTruthy();
    expect(screen.queryByText("太阳鸡")).toBeNull();

    // Per-pair noise is gone.
    expect(screen.queryByText("契合类型: 共同兴趣")).toBeNull();
    expect(screen.queryByText(/连接质量/)).toBeNull();
  });

  it("renders a retryable error surface when the detail request fails", () => {
    const onRetryDetail = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminUserDetailSheet
          selectedUser="user-1"
          onClose={() => {}}
          userDetail={undefined}
          isLoadingDetail={false}
          detailError={new Error("HTTP 500")}
          onRetryDetail={onRetryDetail}
          onBan={() => {}}
          onUnban={() => {}}
          onDelete={() => {}}
          banPending={false}
          unbanPending={false}
          deletePending={false}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("用户详情加载失败")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-retry-query"));
    expect(onRetryDetail).toHaveBeenCalledTimes(1);
  });
});
