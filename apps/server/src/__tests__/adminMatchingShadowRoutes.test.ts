import { describe, expect, it } from "vitest";
import { classifyShadowExperimentError } from "../routes/domains/matchingShadowErrors";

describe("adminMatchingShadow route helpers", () => {
  it("maps missing pool errors to 404", () => {
    expect(classifyShadowExperimentError(new Error("活动池不存在"))).toEqual({
      status: 404,
      message: "Pool not found",
    });
  });

  it("maps insufficient registration errors to 400", () => {
    expect(classifyShadowExperimentError(new Error("报名人数不足，至少需要4人"))).toEqual({
      status: 400,
      message: "Insufficient pending registrations for matching shadow experiment request",
    });
  });

  it("falls back to 500 for unexpected errors", () => {
    expect(classifyShadowExperimentError(new Error("boom"))).toEqual({
      status: 500,
      message: "Failed to run matching shadow experiment",
    });
  });
});
