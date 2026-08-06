import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetFeatureFlag = vi.fn();
vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
  getFeatureFlagSync: vi.fn(() => true),
}));

const mockCheckTextWithMsgSecCheck = vi.fn();
const mockWarmWechatAccessToken = vi.fn();
vi.mock("../lib/wechatMsgSecCheck", () => ({
  checkTextWithMsgSecCheck: mockCheckTextWithMsgSecCheck,
  warmWechatAccessToken: mockWarmWechatAccessToken,
}));

const mockLoggerWarn = vi.fn();
vi.mock("../lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn(() => ({
  values: vi.fn(() => ({
    execute: vi.fn(() => Promise.resolve()),
  })),
}));
vi.mock("../db", () => ({
  db: {
    select: () => mockSelect(),
    insert: mockInsert,
  },
}));

const mockRecordViolation = vi.fn();
vi.mock("../abuseDetection", () => ({
  recordViolation: mockRecordViolation,
}));

const { validateContentSafeAsync } = await import("../lib/contentSafety");

describe("validateContentSafeAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlag.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.CONTENT_MODERATION_TIER1_BUDGET_MS;
  });

  it("returns safe=true for empty text without touching tier 1", async () => {
    const result = await validateContentSafeAsync("   ", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(true);
    expect(mockGetFeatureFlag).not.toHaveBeenCalled();
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("short-circuits on tier-0 violation", async () => {
    const result = await validateContentSafeAsync("傻逼", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(false);
    expect(result.violation!.source).toBe("tier0");
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("skips tier 1 when the feature flag is off", async () => {
    mockGetFeatureFlag.mockResolvedValue(false);

    const result = await validateContentSafeAsync("clean text", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(true);
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("fails open when no openid can be resolved", async () => {
    const result = await validateContentSafeAsync("clean text", "bio", {});
    expect(result.safe).toBe(true);
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "[contentSafety] Tier-1 skipped: no openid available, failing open",
      expect.anything(),
    );
  });

  it("resolves openid from the database by userId", async () => {
    mockSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ wechatOpenId: "openid-db" }])),
        })),
      })),
    }));
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });

    const result = await validateContentSafeAsync("clean text", "bio", { userId: "u1" });
    expect(result.safe).toBe(true);
    expect(mockCheckTextWithMsgSecCheck).toHaveBeenCalledWith("clean text", "openid-db");
  });

  it("fails open when the openid lookup errors", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("db down");
    });

    const result = await validateContentSafeAsync("clean text", "bio", { userId: "u1" });
    expect(result.safe).toBe(true);
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("returns a tier-1 violation when msgSecCheck flags the text", async () => {
    mockCheckTextWithMsgSecCheck.mockResolvedValue({
      risky: true,
      label: 20004,
      violationType: "harassment",
      severity: "warning",
    });

    const result = await validateContentSafeAsync("evasive abuse", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation!.source).toBe("tier1");
    expect(result.violation!.type).toBe("harassment");
    expect(result.violation!.severity).toBe("warning");
    expect(result.violation!.label).toBe(20004);
    expect(result.violation!.matchedKeywords).toContain("msgSecCheck");
    // Sync-returned violations are escalated by the route, not the wrapper.
    expect(mockRecordViolation).not.toHaveBeenCalled();
  });

  it("passes when msgSecCheck returns a clean verdict", async () => {
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });

    const result = await validateContentSafeAsync("clean text", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(true);
  });

  it("fails open when msgSecCheck errors (null verdict)", async () => {
    mockCheckTextWithMsgSecCheck.mockResolvedValue(null);

    const result = await validateContentSafeAsync("clean text", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(true);
  });

  it("fails open when the tier-1 budget is exceeded, then enforces in the background", async () => {
    process.env.CONTENT_MODERATION_TIER1_BUDGET_MS = "10";
    mockCheckTextWithMsgSecCheck.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ risky: true, label: 20004, violationType: "harassment", severity: "warning" }), 60),
        ),
    );

    const result = await validateContentSafeAsync("slow text", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockRecordViolation).toHaveBeenCalledWith("u1", "harassment", "warning");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("does not escalate when the late verdict is clean", async () => {
    process.env.CONTENT_MODERATION_TIER1_BUDGET_MS = "10";
    mockCheckTextWithMsgSecCheck.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ risky: false }), 60)),
    );

    const result = await validateContentSafeAsync("slow text", "bio", { userId: "u1", openid: "o1" });
    expect(result.safe).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockRecordViolation).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
