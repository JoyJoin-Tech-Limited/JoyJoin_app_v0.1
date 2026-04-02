import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("event group outcomes persistence contract", () => {
  it("guards duplicate submissions with a schema unique index and repository upsert", () => {
    const schemaSource = readRepoFile("packages/shared/src/schema.ts");
    const repoSource = readRepoFile("apps/server/src/repositories/eventGroupOutcomesRepo.ts");

    // guards against regression: duplicate group feedback must collapse to one row per submitter
    expect(schemaSource).toContain(
      'uniqueIndex("idx_event_group_outcomes_group_submitter").on(table.groupId, table.submittedBy)',
    );
    expect(repoSource).toContain(".onConflictDoUpdate({");
    expect(repoSource).toContain("target: [eventGroupOutcomes.groupId, eventGroupOutcomes.submittedBy]");
  });
});
