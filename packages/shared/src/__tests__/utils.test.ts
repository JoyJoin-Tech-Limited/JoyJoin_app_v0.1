import { describe, it, expect } from "vitest";
import { getAgeBand, formatAgeRangeBand } from "../utils";

describe("getAgeBand", () => {
  it("returns a raw 5-year band for common ages", () => {
    expect(getAgeBand(25)).toBe("25-29");
    expect(getAgeBand(29)).toBe("25-29");
    expect(getAgeBand(30)).toBe("30-34");
    expect(getAgeBand(42)).toBe("40-44");
  });

  it("handles boundary ages", () => {
    expect(getAgeBand(18)).toBe("15-19");
    expect(getAgeBand(20)).toBe("20-24");
    expect(getAgeBand(50)).toBe("50-54");
  });
});

describe("formatAgeRangeBand", () => {
  it("returns a 5-year band when visibility allows", () => {
    const result = formatAgeRangeBand("1998-06-15", "show_age_range");
    expect(result).toMatch(/^\d{2}-\d{2}$/);
  });

  it("returns null when visibility is hide_all", () => {
    expect(formatAgeRangeBand("1998-06-15", "hide_all")).toBeNull();
  });

  it("returns null when birthdate is missing", () => {
    expect(formatAgeRangeBand(null, "show_age_range")).toBeNull();
    expect(formatAgeRangeBand(undefined, "show_age_range")).toBeNull();
  });
});
