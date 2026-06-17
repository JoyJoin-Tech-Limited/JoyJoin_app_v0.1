import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getTestPriceCents } from "../lib/paymentTestPrice";

describe("getTestPriceCents", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.APP_MODE;
    delete process.env.TEST_PAYMENT_PRICE_IN_CENTS;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("returns null when TEST_PAYMENT_PRICE_IN_CENTS is unset", () => {
    process.env.APP_MODE = "development";
    expect(getTestPriceCents()).toBeNull();
  });

  it("returns the configured price in development", () => {
    process.env.APP_MODE = "development";
    process.env.TEST_PAYMENT_PRICE_IN_CENTS = "1";
    expect(getTestPriceCents()).toBe(1);
  });

  it("returns the configured price in staging", () => {
    process.env.APP_MODE = "staging";
    process.env.TEST_PAYMENT_PRICE_IN_CENTS = "1";
    expect(getTestPriceCents()).toBe(1);
  });

  it("returns the configured price in test", () => {
    process.env.APP_MODE = "test";
    process.env.TEST_PAYMENT_PRICE_IN_CENTS = "1";
    expect(getTestPriceCents()).toBe(1);
  });

  it("always returns null in production regardless of the env var", () => {
    process.env.APP_MODE = "production";
    process.env.TEST_PAYMENT_PRICE_IN_CENTS = "1";
    expect(getTestPriceCents()).toBeNull();
  });

  it("returns null for invalid numeric values", () => {
    process.env.APP_MODE = "development";
    process.env.TEST_PAYMENT_PRICE_IN_CENTS = "not-a-number";
    expect(getTestPriceCents()).toBeNull();
  });

  it("returns null for negative values", () => {
    process.env.APP_MODE = "development";
    process.env.TEST_PAYMENT_PRICE_IN_CENTS = "-5";
    expect(getTestPriceCents()).toBeNull();
  });
});
