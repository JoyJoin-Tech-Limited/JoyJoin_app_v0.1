import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression guardrail: admin pages must not call fetch().then(r => r.json())
 * without checking res.ok first. This pattern silently treats 4xx/5xx error
 * JSON as success data and can crash downstream code that expects arrays/objects.
 *
 * Fixes: venue management blank tab (unsafe time-slots queryFn + mutations).
 */

const ADMIN_PAGES_DIR = path.resolve(__dirname, "../pages/admin");

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(fullPath);
    if (entry.isFile() && /\.(tsx?)$/.test(entry.name)) return [fullPath];
    return [];
  });
}

// Unsafe fetch-to-json patterns that do NOT check the response status.
const unsafePatterns = [
  // fetch(...).then(r => r.json())
  /fetch\s*\([^)]*\)\s*\.then\s*\(\s*(?:\(\s*r\s*\)|r)\s*=>\s*r\.json\s*\(\s*\)\s*\)/,
];

// Allowed safe wrappers/alternatives. Lines matching these are exempt.
const safeWrappers = [
  /apiRequest\s*\(/,
  /if\s*\(\s*!r\.ok\s*\)/,
  /if\s*\(\s*!res\.ok\s*\)/,
];

function isLineUnsafe(line: string): boolean {
  if (safeWrappers.some((p) => p.test(line))) return false;
  return unsafePatterns.some((p) => p.test(line));
}

describe("admin fetch guardrail", () => {
  it("has no unchecked fetch().then(r => r.json()) patterns in admin pages", () => {
    const files = listTsFiles(ADMIN_PAGES_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (isLineUnsafe(line)) {
          violations.push(`${path.relative(process.cwd(), file)}:${idx + 1}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
