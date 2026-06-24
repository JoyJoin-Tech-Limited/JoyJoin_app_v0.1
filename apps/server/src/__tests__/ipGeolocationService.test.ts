import { describe, it, expect, beforeEach } from "vitest";
import {
  anonymizeIPv4,
  hashIP,
  getSaltDate,
  isPrivateOrReservedIP,
  parseQqwryAddress,
  getLocationFromIP,
  resetQqwryForTests,
} from "../services/ipGeolocationService";

describe("ipGeolocationService", () => {
  beforeEach(() => {
    resetQqwryForTests();
  });

  describe("anonymizeIPv4", () => {
    it("zeros the last octet", () => {
      expect(anonymizeIPv4("223.5.5.5")).toBe("223.5.5.0");
      expect(anonymizeIPv4("192.168.1.100")).toBe("192.168.1.0");
    });

    it("returns 0.0.0.0 for invalid input", () => {
      expect(anonymizeIPv4("not-an-ip")).toBe("0.0.0.0");
    });
  });

  describe("hashIP", () => {
    it("produces a stable sha256 hex for the same salt date", () => {
      const h1 = hashIP("223.5.5.0", "2026-06-23");
      const h2 = hashIP("223.5.5.0", "2026-06-23");
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hashes for different dates", () => {
      const h1 = hashIP("223.5.5.0", "2026-06-23");
      const h2 = hashIP("223.5.5.0", "2026-06-24");
      expect(h1).not.toBe(h2);
    });
  });

  describe("getSaltDate", () => {
    it("returns YYYY-MM-DD", () => {
      expect(getSaltDate(new Date("2026-06-23T12:34:56Z"))).toBe("2026-06-23");
    });
  });

  describe("isPrivateOrReservedIP", () => {
    it("identifies RFC1918 and loopback addresses", () => {
      expect(isPrivateOrReservedIP("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIP("192.168.1.1")).toBe(true);
      expect(isPrivateOrReservedIP("127.0.0.1")).toBe(true);
    });

    it("allows public addresses", () => {
      expect(isPrivateOrReservedIP("223.5.5.5")).toBe(false);
      expect(isPrivateOrReservedIP("1.1.1.1")).toBe(false);
    });

    it("treats malformed input as reserved", () => {
      expect(isPrivateOrReservedIP("not-an-ip")).toBe(true);
      expect(isPrivateOrReservedIP("256.1.1.1")).toBe(true);
    });
  });

  describe("parseQqwryAddress", () => {
    it("parses province/city/district from a mainland address", () => {
      const result = parseQqwryAddress("浙江省杭州市西湖区");
      expect(result).toMatchObject({
        country: "中国",
        province: "浙江",
        city: "杭州市",
        district: "西湖区",
        isMainland: true,
        source: "qqwry",
      });
    });

    it("parses province/city without district", () => {
      const result = parseQqwryAddress("广东省深圳市");
      expect(result).toMatchObject({
        country: "中国",
        province: "广东",
        city: "深圳市",
        district: null,
        isMainland: true,
      });
    });

    it("returns unknown country for non-mainland addresses", () => {
      const result = parseQqwryAddress("美国");
      expect(result).toMatchObject({
        country: "美国",
        province: null,
        city: null,
        isMainland: false,
        source: "overseas",
      });
    });

    it("returns missing source for empty address", () => {
      const result = parseQqwryAddress("");
      expect(result.source).toBe("missing");
    });
  });

  describe("getLocationFromIP", () => {
    it("degrades gracefully when qqwry.dat is missing", () => {
      process.env.QQWRY_DAT_PATH = "/nonexistent/qqwry.dat";
      resetQqwryForTests();
      const result = getLocationFromIP("223.5.5.5");
      expect(result.source).toBe("missing");
      delete process.env.QQWRY_DAT_PATH;
    });

    it("marks private IPs as invalid", () => {
      const result = getLocationFromIP("192.168.1.1");
      expect(result.source).toBe("invalid");
    });
  });
});
