import { describe, expect, it } from "vitest";
import { canApplyUserAction } from "../reportActions";

describe("canApplyUserAction", () => {
  it("allows 封禁 / 警告 when the report names a user", () => {
    expect(canApplyUserAction({ reported_user_id: "user-1" })).toBe(true);
  });

  it("blocks 封禁 / 警告 for content-only reports (NULL reported_user_id)", () => {
    expect(canApplyUserAction({ reported_user_id: null })).toBe(false);
  });

  it("blocks 封禁 / 警告 for an empty id", () => {
    expect(canApplyUserAction({ reported_user_id: "" })).toBe(false);
  });
});
