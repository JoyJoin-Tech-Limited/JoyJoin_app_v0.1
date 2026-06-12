import { describe, it, expect } from "vitest";
import { validateContentSafe, contentViolationResponse } from "../lib/contentSafety";

describe("validateContentSafe", () => {
  it("returns safe=true for clean text", () => {
    const result = validateContentSafe("你好，今天天气不错", "displayName");
    expect(result.safe).toBe(true);
    expect(result.violation).toBeUndefined();
  });

  it("returns safe=false for harassment keyword", () => {
    const result = validateContentSafe("傻逼", "displayName");
    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation).toBeDefined();
    expect(result.violation!.type).toBe("harassment");
    expect(result.violation!.severity).toBe("warning");
    expect(result.violation!.field).toBe("displayName");
    expect(result.violation!.matchedKeywords).toContain("傻逼");
  });

  it("returns safe=false for severe keyword", () => {
    const result = validateContentSafe("约炮", "bio");
    expect(result.safe).toBe(false);
    expect(result.violation!.severity).toBe("severe");
    expect(result.violation!.type).toBe("pornographic");
  });

  it("returns safe=true for empty string", () => {
    const result = validateContentSafe("", "displayName");
    expect(result.safe).toBe(true);
  });

  it("returns safe=false for mixed clean+blocked text", () => {
    const result = validateContentSafe("你好，你这个傻逼", "displayName");
    expect(result.safe).toBe(false);
  });

  it("propagates field name correctly", () => {
    const result = validateContentSafe("傻逼", "industryRawInput");
    expect(result.violation!.field).toBe("industryRawInput");
  });
});

describe("contentViolationResponse", () => {
  it("returns 400 status with correct body shape", () => {
    const violation = {
      type: "harassment" as const,
      severity: "warning" as const,
      field: "displayName",
      message: "内容包含不当用语",
      matchedKeywords: ["傻逼"],
    };
    const response = contentViolationResponse(violation);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("内容包含不当用语");
    expect(response.body.code).toBe("CONTENT_VIOLATION");
    expect(response.body.violation).toEqual(violation);
  });
});
