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
        attendanceStatus: "confirmed",
        attendeeCount: 6,
      },
      {
        id: "event-2",
        title: null,
        eventType: "饭局",
        dateTime: "2026-09-20T11:00:00.000Z",
        attendanceStatus: "cancelled",
        attendeeCount: 0,
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
        eventId: "event-1",
        partnerName: "林小满",
        partnerArchetype: "太阳鸡",
        eventTitle: "周五小酒馆局",
        connectionPointTypes: ["共同兴趣"],
        connectionQuality: 4,
        wouldMeetAgain: true,
        matchedAt: "2026-10-11T10:00:00.000Z",
      },
    ],
    interests: null,
    matchingReadiness: { isReady: true, blockers: [] },
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
    // Falls back to a short reference, never a bare 36-character UUID.
    expect(screen.getByText("场次 9a8b7c6d…")).toBeTruthy();
    expect(screen.queryByText(/3f1c0b9a/)).toBeNull();

    // Joined events: Chinese attendance badge, named title, no duplicated 酒局.
    expect(screen.getByText("周五小酒馆局")).toBeTruthy();
    expect(screen.getByText("已签到")).toBeTruthy();
    expect(screen.getByText("已取消")).toBeTruthy();
    expect(screen.getByText("未命名活动")).toBeTruthy();
    expect(screen.getByText("酒局 · 6 人出席")).toBeTruthy();
    // A real zero still renders rather than being filtered out.
    expect(screen.getByText("饭局 · 0 人出席")).toBeTruthy();
  });

  it("names the connection partner and the event in 连接关系", () => {
    renderSheet();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "连接关系" }));

    expect(screen.getByText("林小满")).toBeTruthy();
    expect(screen.getByText(/周五小酒馆局/)).toBeTruthy();
    expect(screen.getByText(/揭晓于/)).toBeTruthy();
    expect(screen.queryByText(/用户 user-2/)).toBeNull();
  });

  it("does not append an ellipsis to a real partner name in 匹配历史", () => {
    renderSheet();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "匹配历史" }));

    const partnerLine = screen.getByText(/对方:/);
    expect(partnerLine.textContent).toBe("对方: 林小满太阳鸡");
    expect(partnerLine.textContent).not.toContain("…");
  });
});
