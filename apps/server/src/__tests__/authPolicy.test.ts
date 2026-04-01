import { afterEach, describe, expect, it } from "vitest";
import {
  assertProductionAuthDebugSurfaceAllowed,
  canUseMockWechatAuth,
  isDevAuthToolsEnabled,
  WECHAT_TEST_CODE_PREFIX,
} from "../auth/policy";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("auth policy", () => {
  it("fails closed for dev auth tools unless explicitly enabled", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_DEV_AUTH_TOOLS;
    expect(isDevAuthToolsEnabled()).toBe(false);

    process.env.ENABLE_DEV_AUTH_TOOLS = "1";
    expect(isDevAuthToolsEnabled()).toBe(true);
  });

  it("allows mock WeChat auth only for prefixed test codes outside production", () => {
    process.env.NODE_ENV = "development";
    expect(canUseMockWechatAuth(`${WECHAT_TEST_CODE_PREFIX}abc`)).toBe(true);
    expect(canUseMockWechatAuth("plain-dev-code")).toBe(false);

    process.env.NODE_ENV = "production";
    expect(canUseMockWechatAuth(`${WECHAT_TEST_CODE_PREFIX}abc`)).toBe(false);
  });

  it("blocks production debug surfaces unless an explicit override is set", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRODUCTION_AUTH_DEBUG;
    expect(() => assertProductionAuthDebugSurfaceAllowed("bypassLogin CLI")).toThrow(
      /disabled in production/
    );

    process.env.ALLOW_PRODUCTION_AUTH_DEBUG = "1";
    expect(() => assertProductionAuthDebugSurfaceAllowed("bypassLogin CLI")).not.toThrow();
  });
});
