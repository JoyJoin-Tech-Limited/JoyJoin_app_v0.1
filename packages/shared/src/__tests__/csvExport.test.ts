import { describe, it, expect } from "vitest";
import { escapeCsv, buildCsvContent } from "../csvExport";

describe("csvExport", () => {
  describe("escapeCsv", () => {
    it("wraps plain values in double quotes", () => {
      expect(escapeCsv("hello")).toBe('"hello"');
    });

    it("escapes inner double quotes", () => {
      expect(escapeCsv('say "hello"')).toBe('"say ""hello"""');
    });

    it("prefixes formula-starting values with a tab", () => {
      expect(escapeCsv("=SUM(A1)")).toBe('"\t=SUM(A1)"');
      expect(escapeCsv("+123")).toBe('"\t+123"');
      expect(escapeCsv("-456")).toBe('"\t-456"');
      expect(escapeCsv("@user")).toBe('"\t@user"');
    });

    it("handles null and undefined as empty string", () => {
      expect(escapeCsv(null)).toBe('""');
      expect(escapeCsv(undefined)).toBe('""');
    });
  });

  describe("buildCsvContent", () => {
    it("builds CSV with BOM, headers, and rows", () => {
      const csv = buildCsvContent({
        headers: ["Name", "Amount"],
        rows: [
          ["Alice", 100],
          ["Bob", 200],
        ],
      });
      expect(csv.startsWith("\uFEFF")).toBe(true);
      const lines = csv.split("\n");
      expect(lines[0]).toBe('\uFEFF"Name","Amount"');
      expect(lines[1]).toBe('"Alice","100"');
      expect(lines[2]).toBe('"Bob","200"');
    });
  });
});
