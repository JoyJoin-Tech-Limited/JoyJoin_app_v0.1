import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isSingleTestMode, isMatchingTestMode } from "../lib/isSingleTestMode";

describe("isSingleTestMode / isMatchingTestMode", () => {
  const originalAppMode = process.env.APP_MODE;
  const originalEnableSingleTest = process.env.ENABLE_SINGLE_TEST_MODE;
  const originalEnableMatchingTest = process.env.ENABLE_MATCHING_TEST_MODE;

  beforeEach(() => {
    delete process.env.APP_MODE;
    delete process.env.ENABLE_SINGLE_TEST_MODE;
    delete process.env.ENABLE_MATCHING_TEST_MODE;
  });

  afterEach(() => {
    if (originalAppMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = originalAppMode;
    }
    if (originalEnableSingleTest === undefined) {
      delete process.env.ENABLE_SINGLE_TEST_MODE;
    } else {
      process.env.ENABLE_SINGLE_TEST_MODE = originalEnableSingleTest;
    }
    if (originalEnableMatchingTest === undefined) {
      delete process.env.ENABLE_MATCHING_TEST_MODE;
    } else {
      process.env.ENABLE_MATCHING_TEST_MODE = originalEnableMatchingTest;
    }
  });

  it("returns false when no env flags are set", () => {
    expect(isSingleTestMode()).toBe(false);
    expect(isMatchingTestMode()).toBe(false);
  });

  it("returns true when APP_MODE=test", () => {
    process.env.APP_MODE = "test";
    expect(isSingleTestMode()).toBe(true);
  });

  it("returns true when ENABLE_SINGLE_TEST_MODE=true", () => {
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    expect(isSingleTestMode()).toBe(true);
  });

  it("matching-test requires both single-test mode and ENABLE_MATCHING_TEST_MODE=true", () => {
    process.env.APP_MODE = "test";
    expect(isMatchingTestMode()).toBe(false);

    process.env.ENABLE_MATCHING_TEST_MODE = "true";
    expect(isMatchingTestMode()).toBe(true);
  });

  it("matching-test is always false in production even with flags set", () => {
    process.env.APP_MODE = "production";
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    process.env.ENABLE_MATCHING_TEST_MODE = "true";
    expect(isMatchingTestMode()).toBe(false);
  });
});
