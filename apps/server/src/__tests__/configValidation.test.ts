/**
 * Tests for startup config validation
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";

// Capture process.exit calls
const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null) => {
  throw new Error(`process.exit(${_code})`);
});

// Import after setting up mocks
const { validateConfig } = await import("../lib/configValidation");

const REQUIRED_VARS = {
  DATABASE_URL: "postgresql://localhost/test",
  SESSION_SECRET: "a".repeat(32),
  WECHAT_APPID: "wx1234567890abcdef",
  WECHAT_SECRET: "secret_value",
};

describe("validateConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.WECHAT_PAY_APP_ID;
    delete process.env.WECHAT_PAY_MCH_ID;
    delete process.env.WECHAT_PAY_SERIAL_NO;
    delete process.env.WECHAT_PAY_PRIVATE_KEY;
    delete process.env.WECHAT_PAY_APIV3_KEY;
    delete process.env.WECHAT_PAY_PLATFORM_CERT;
    // Reset to a known-good environment before each test
    Object.assign(process.env, REQUIRED_VARS);
    // Tests exercise production-mode validation; APP_MODE must match NODE_ENV.
    process.env.APP_MODE = "production";
  });

  afterEach(() => {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  afterAll(() => {
    exitSpy.mockRestore();
  });

  it("does not exit when all required vars are set (non-production)", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_MODE = "development";
    expect(() => validateConfig()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("does not exit in production when all required vars are set", () => {
    process.env.NODE_ENV = "production";
    expect(() => validateConfig()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("calls process.exit(1) in production when DATABASE_URL is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    expect(() => validateConfig()).toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) in production when SESSION_SECRET is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("calls process.exit(1) in production when SESSION_SECRET is too short", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "tooshort";
    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("calls process.exit(1) in production when WECHAT_APPID is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.WECHAT_APPID;
    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("calls process.exit(1) in production when WECHAT_APPID does not look like a WeChat app id", () => {
    process.env.NODE_ENV = "production";
    process.env.WECHAT_APPID = "not-a-wechat-appid";
    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("calls process.exit(1) in production when payments are enabled but platform cert is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.PAYMENTS_ENABLED = "true";
    process.env.WECHAT_PAY_APP_ID = "wx-pay-app";
    process.env.WECHAT_PAY_MCH_ID = "mch_123";
    process.env.WECHAT_PAY_SERIAL_NO = "serial_123";
    process.env.WECHAT_PAY_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----fake";
    process.env.WECHAT_PAY_APIV3_KEY = "a".repeat(32);
    delete process.env.WECHAT_PAY_PLATFORM_CERT;

    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("calls process.exit(1) in production when mini-program auth and payment app ids differ", () => {
    process.env.NODE_ENV = "production";
    process.env.PAYMENTS_ENABLED = "true";
    process.env.WECHAT_APPID = "wx-auth-app";
    process.env.WECHAT_PAY_APP_ID = "wx-pay-app";
    process.env.WECHAT_PAY_MCH_ID = "mch_123";
    process.env.WECHAT_PAY_SERIAL_NO = "serial_123";
    process.env.WECHAT_PAY_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----fake";
    process.env.WECHAT_PAY_APIV3_KEY = "a".repeat(32);
    process.env.WECHAT_PAY_PLATFORM_CERT = "-----BEGIN CERTIFICATE-----fake";

    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("does NOT call process.exit in development when required vars are missing", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_MODE = "development";
    delete process.env.DATABASE_URL;
    delete process.env.SESSION_SECRET;
    // Should warn but not exit
    expect(() => validateConfig()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("emits a warning for invalid DATABASE_URL scheme in non-production", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_MODE = "development";
    process.env.DATABASE_URL = "mysql://invalid";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateConfig();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
    warnSpy.mockRestore();
  });

  it("exits in production when DATABASE_URL has invalid scheme", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "mysql://invalid";
    expect(() => validateConfig()).toThrow("process.exit(1)");
  });

  it("does not exit in production when fatal issues exist but exitOnFatal is disabled", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    const result = validateConfig({ exitOnFatal: false });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DATABASE_URL is not set"),
      ]),
    );
  });
});
