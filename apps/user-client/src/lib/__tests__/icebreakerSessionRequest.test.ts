import { describe, expect, it } from "vitest";
import {
  IcebreakerSessionRequestError,
  getIcebreakerSessionErrorCopy,
} from "../icebreakerSessionRequest";

describe("icebreaker session request copy", () => {
  it("classifies unauthorized, missing, and expired responses for the page UI", () => {
    expect(getIcebreakerSessionErrorCopy(new IcebreakerSessionRequestError(403, "Forbidden"))).toEqual({
      title: "你还不在这场活动中",
      description: "只有本场活动的参与者才能进入破冰会话。",
    });

    expect(getIcebreakerSessionErrorCopy(new IcebreakerSessionRequestError(404, "Missing"))).toEqual({
      title: "会话不存在",
      description: "这场破冰会话可能还没开始，或已被移除。",
    });

    expect(getIcebreakerSessionErrorCopy(new IcebreakerSessionRequestError(410, "Expired"))).toEqual({
      title: "会话已结束",
      description: "这场破冰会话已经结束，请返回活动页查看最新状态。",
    });
  });
});
