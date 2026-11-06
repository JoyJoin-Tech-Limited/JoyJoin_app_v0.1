import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createNotification: vi.fn(),
  getFeatureFlag: vi.fn(),
  broadcastToUser: vi.fn(),
  invalidateUser: vi.fn(),
  generateAndSaveEventTheme: vi.fn(),
  processInvitationRewards: vi.fn(),
  assignVenuesToGroups: vi.fn(),
  saveVenueAssignments: vi.fn(),
  notifyPoolMatched: vi.fn(),
  notifyVenueAssignmentResult: vi.fn(),
  sendMatchSuccessSubscribeMessages: vi.fn(),
  generateAndAssignEventThemeTitle: vi.fn(),
  refundUnmatchedRegistrations: vi.fn(),
}));

vi.mock("@shared/schema", () => ({ eventPools: {} }));
vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: { createNotification: mocks.createNotification },
}));
vi.mock("../lib/featureFlags", () => ({ getFeatureFlag: mocks.getFeatureFlag }));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../wsService", () => ({
  wsService: { broadcastToUser: mocks.broadcastToUser },
}));
vi.mock("../lib/shellCache", () => ({
  shellCache: { invalidateUser: mocks.invalidateUser },
}));
vi.mock("../eventThemeGeneratorService", () => ({
  generateAndSaveEventTheme: mocks.generateAndSaveEventTheme,
}));
vi.mock("../poolMatchingInvitationRewards", () => ({
  processInvitationRewards: mocks.processInvitationRewards,
}));
vi.mock("../venueAssignmentService", () => ({
  assignVenuesToGroups: mocks.assignVenuesToGroups,
  saveVenueAssignments: mocks.saveVenueAssignments,
}));
vi.mock("../lib/wecomNotifications/matching", () => ({
  notifyPoolMatched: mocks.notifyPoolMatched,
  notifyVenueAssignmentResult: mocks.notifyVenueAssignmentResult,
}));
vi.mock("../lib/wechatSubscribeMessage", () => ({
  sendMatchSuccessSubscribeMessages: mocks.sendMatchSuccessSubscribeMessages,
}));
vi.mock("../eventThemeTitleGenerator", () => ({
  generateAndAssignEventThemeTitle: mocks.generateAndAssignEventThemeTitle,
}));
vi.mock("../services/autoRefundService", () => ({
  refundUnmatchedRegistrations: mocks.refundUnmatchedRegistrations,
}));

const { executePostMatchCommitSideEffects } = await import("../lib/matchingPostMatchEffects");

describe("executePostMatchCommitSideEffects venue notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNotification.mockResolvedValue(undefined);
    mocks.getFeatureFlag.mockResolvedValue(true);
    mocks.generateAndSaveEventTheme.mockResolvedValue(undefined);
    mocks.processInvitationRewards.mockResolvedValue(undefined);
    mocks.saveVenueAssignments.mockResolvedValue(undefined);
    mocks.notifyPoolMatched.mockResolvedValue(undefined);
    mocks.notifyVenueAssignmentResult.mockResolvedValue(undefined);
    mocks.sendMatchSuccessSubscribeMessages.mockResolvedValue(undefined);
    mocks.generateAndAssignEventThemeTitle.mockResolvedValue(null);
    mocks.refundUnmatchedRegistrations.mockResolvedValue(undefined);
    mocks.assignVenuesToGroups.mockResolvedValue({
      assignments: new Map(),
      unassigned: new Map([
        [1, "no_available_venue"],
        [2, "no_available_venue"],
      ]),
    });
  });

  it("uses each unassigned group's ID for venue_tbd deep links, never the pool ID", async () => {
    const groups = [
      {
        members: [{ userId: "user-1" }, { userId: "user-2" }],
        overallScore: 80,
        avgChemistryScore: 80,
        temperatureLevel: "warm",
      },
      {
        members: [{ userId: "user-3" }],
        overallScore: 85,
        avgChemistryScore: 85,
        temperatureLevel: "warm",
      },
    ] as any;
    const pool = {
      id: "pool-1",
      title: "Test Pool",
      dateTime: new Date("2026-11-07T11:00:00.000Z"),
      city: "上海",
      district: "徐汇",
      eventType: "饭局",
      totalRegistrations: 3,
    } as any;

    await executePostMatchCommitSideEffects(
      "pool-1",
      groups,
      ["group-1", "group-2"],
      pool,
    );

    await vi.waitFor(() => {
      const venueTbdCount = mocks.createNotification.mock.calls
        .map(([data]) => data)
        .filter((data) => data.type === "venue_tbd")
        .length;
      expect(venueTbdCount).toBe(3);
    });

    const venueTbdLinks = mocks.createNotification.mock.calls
      .map(([data]) => data)
      .filter((data) => data.type === "venue_tbd")
      .map((data) => ({ userId: data.userId, relatedResourceId: data.relatedResourceId }));

    expect(venueTbdLinks).toEqual([
      { userId: "user-1", relatedResourceId: "group-1" },
      { userId: "user-2", relatedResourceId: "group-1" },
      { userId: "user-3", relatedResourceId: "group-2" },
    ]);
  });
});
