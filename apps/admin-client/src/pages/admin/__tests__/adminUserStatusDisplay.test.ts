import { describe, expect, it } from "vitest";
import {
  CANCEL_POLICY_LABELS,
  MATCH_STATUS_LABELS,
  cancelPolicyLabel,
  joinedEventAttendanceLabel,
  matchStatusLabel,
  shortId,
} from "../adminUserStatusDisplay";

describe("matchStatusLabel", () => {
  it("maps every machine match status to Chinese", () => {
    expect(matchStatusLabel("pending")).toBe("待排桌");
    expect(matchStatusLabel("matched")).toBe("已排桌");
    expect(matchStatusLabel("unmatched")).toBe("未成行");
    expect(matchStatusLabel("cancelled")).toBe("已取消");
    expect(matchStatusLabel("refunded")).toBe("已退款");
  });

  it("treats a missing status as 待处理, never an empty badge", () => {
    expect(matchStatusLabel(null)).toBe("待处理");
    expect(matchStatusLabel(undefined)).toBe("待处理");
    expect(matchStatusLabel("")).toBe("待处理");
  });

  it("passes through values it does not know so data bugs stay visible", () => {
    expect(matchStatusLabel("awaiting_venue")).toBe("awaiting_venue");
    // Legacy Chinese rows predate the machine vocabulary.
    expect(matchStatusLabel("等待匹配")).toBe("等待匹配");
  });

  it("has a label for each documented machine status", () => {
    expect(Object.keys(MATCH_STATUS_LABELS).sort()).toEqual([
      "cancelled",
      "matched",
      "pending",
      "refunded",
      "unmatched",
    ]);
  });
});

describe("cancelPolicyLabel", () => {
  it("maps the server-computed policy branches", () => {
    expect(cancelPolicyLabel("refundable")).toBe("可全额退款");
    expect(cancelPolicyLabel("non_refundable")).toBe("不可退款");
  });

  it("renders nothing when the detail endpoint omits the policy", () => {
    expect(cancelPolicyLabel(undefined)).toBe("");
    expect(cancelPolicyLabel(null)).toBe("");
  });

  it("passes through unknown policy codes", () => {
    expect(cancelPolicyLabel("partial_refund")).toBe("partial_refund");
  });

  it("documents both branches", () => {
    expect(Object.keys(CANCEL_POLICY_LABELS).sort()).toEqual(["non_refundable", "refundable"]);
  });
});

describe("joinedEventAttendanceLabel", () => {
  it("maps the War Room vocabulary and the cancellation state", () => {
    expect(joinedEventAttendanceLabel("pending")).toBe("待确认");
    expect(joinedEventAttendanceLabel("confirmed")).toBe("已签到");
    expect(joinedEventAttendanceLabel("late")).toBe("迟到");
    expect(joinedEventAttendanceLabel("absent")).toBe("缺席");
    expect(joinedEventAttendanceLabel("cancelled")).toBe("已取消");
  });

  it("does not coerce an unknown historical status to 待确认", () => {
    expect(joinedEventAttendanceLabel("no_show")).toBe("no_show");
    expect(joinedEventAttendanceLabel(undefined)).toBe("");
  });
});

describe("shortId", () => {
  it("is only a fallback identifier", () => {
    expect(shortId("3f1c0b9a-1111-2222-3333-444455556666")).toBe("3f1c0b9a…");
    expect(shortId("3f1c0b9a-1111", 4)).toBe("3f1c…");
    expect(shortId(null)).toBe("—");
  });
});
