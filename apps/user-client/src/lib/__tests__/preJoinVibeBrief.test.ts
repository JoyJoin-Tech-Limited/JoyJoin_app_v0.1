import { describe, expect, it } from "vitest";
import { buildPreJoinVibeBriefUrl } from "../preJoinVibeBrief";

describe("buildPreJoinVibeBriefUrl", () => {
  it("uses only the query params supported by the backend", () => {
    expect(
      buildPreJoinVibeBriefUrl({
        eventType: "饭局",
        area: "深圳•南山区",
      }),
    ).toBe(
      "/api/ai/pre-join-vibe-brief?eventType=%E9%A5%AD%E5%B1%80&area=%E6%B7%B1%E5%9C%B3%E2%80%A2%E5%8D%97%E5%B1%B1%E5%8C%BA",
    );
  });

  it("omits area when it is absent", () => {
    expect(
      buildPreJoinVibeBriefUrl({
        eventType: "酒局",
      }),
    ).toBe("/api/ai/pre-join-vibe-brief?eventType=%E9%85%92%E5%B1%80");
  });
});
