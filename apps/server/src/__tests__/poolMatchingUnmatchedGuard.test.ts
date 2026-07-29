import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("pool matching unmatched-marking guard", () => {
  it("only marks truly-stranded registrations as unmatched (assignedGroupId IS NULL)", () => {
    const source = readRepoFile("apps/server/src/poolMatchingService.ts");

    // Regression guard for the operator-review-gate bug: step 2 leaves matched
    // members at matchStatus='pending' when the gate is enabled, and the old
    // step 5 marked ALL 'pending' registrations 'unmatched' — flipping the
    // just-matched members out of the group. The guard must restrict step 5 to
    // registrations that never got an assignedGroupId (the true stranded).
    expect(source).toContain('matchStatus: "unmatched"');
    expect(source).toContain("isNull(eventPoolRegistrations.assignedGroupId)");
    expect(source).toContain('import { eq, and, inArray, isNull, sql } from "drizzle-orm"');
  });
});
