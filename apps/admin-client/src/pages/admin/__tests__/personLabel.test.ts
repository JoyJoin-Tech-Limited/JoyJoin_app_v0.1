import { describe, expect, it } from "vitest";
import { personLabel } from "../personLabel";

describe("personLabel", () => {
  it("prefers the chosen display name", () => {
    expect(
      personLabel({
        displayName: "林小满",
        wechatNickname: "momo",
        firstName: "Xiaoman",
        lastName: "Lin",
        id: "3f1c0b9a-1111-2222-3333-444455556666",
      }),
    ).toBe("林小满");
  });

  it("falls back to the WeChat nickname when no display name is set", () => {
    expect(personLabel({ displayName: null, wechatNickname: "momo" })).toBe("momo");
  });

  it("falls back to the legacy name pair", () => {
    expect(personLabel({ firstName: "Xiaoman", lastName: "Lin" })).toBe("Xiaoman Lin");
    expect(personLabel({ firstName: "Xiaoman", lastName: null })).toBe("Xiaoman");
  });

  it("uses a truncated id, never a full UUID, as the last identity", () => {
    expect(personLabel({ id: "3f1c0b9a-1111-2222-3333-444455556666" })).toBe("用户 3f1c0b9a…");
  });

  it("honours a surface-specific fallback when there is no identity at all", () => {
    expect(personLabel({ fallback: "未设置昵称" })).toBe("未设置昵称");
    expect(personLabel({})).toBe("未知用户");
  });

  it("treats whitespace-only names as missing", () => {
    expect(personLabel({ displayName: "   ", wechatNickname: "momo" })).toBe("momo");
    expect(personLabel({ displayName: "  ", firstName: " ", lastName: " " })).toBe("未知用户");
  });
});
