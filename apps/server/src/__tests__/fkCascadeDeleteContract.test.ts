import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("fk cascade delete contract", () => {
  it("discovers dependents from pg_constraint and never follows ON DELETE CASCADE", () => {
    const source = readRepoFile("apps/server/src/lib/fkCascadeDelete.ts");

    // Regression guard for the reset-endpoint whack-a-mole: the helper must
    // discover FK dependents dynamically from the catalog (so new tables are
    // covered without code edits) and must skip ON DELETE CASCADE relations
    // (which the database handles itself).
    expect(source).toContain("export async function cascadeDeleteByIds");
    expect(source).toContain("pg_constraint");
    expect(source).toContain("con.confdeltype <> 'c'");
    expect(source).toContain("con.confrelid");
  });

  it("is used for virtual-user / test-bot deletion in both test cleanup paths", () => {
    const singleTest = readRepoFile("apps/server/src/services/singleTestService.ts");
    const matchingTest = readRepoFile("apps/server/src/services/matchingTestService.ts");

    // Guards against reverting to hand-enumerated deletes (which repeatedly
    // missed eventPoolRegistrations / blind_box_events / etc.).
    expect(singleTest).toContain('cascadeDeleteByIds(tx, "users", "id", virtualUserIds)');
    expect(matchingTest).toContain('cascadeDeleteByIds(tx, "users", "id", allBotIds)');
    expect(singleTest).not.toContain("delete(eventPoolRegistrations).where(inArray(eventPoolRegistrations.userId, virtualUserIds))");
    expect(matchingTest).not.toContain("delete(eventAttendance).where(inArray(eventAttendance.userId, allBotIds))");
  });

  it("is used for admin user-data deletion instead of a hand-maintained table list", () => {
    const adminUsers = readRepoFile("apps/server/src/routes/domains/adminUsers.ts");

    // Regression guard for schema drift in DELETE /api/admin/users/:id/data:
    // newly added user foreign keys must be discovered from PostgreSQL rather
    // than requiring this endpoint to be updated table by table.
    expect(adminUsers).toContain('cascadeDeleteByIds(tx, "users", "id", [userId])');
    expect(adminUsers).toContain("if (user.isAdmin)");
    // These current schema columns intentionally have no FK, so catalog
    // discovery cannot see them and they require explicit privacy cleanup.
    expect(adminUsers).toContain("DELETE FROM social_icebreaker_participants WHERE user_id");
    expect(adminUsers).toContain("DELETE FROM social_icebreaker_lie_truths WHERE user_id");
    expect(adminUsers).toContain("DELETE FROM social_icebreaker_sessions WHERE host_user_id");
    expect(adminUsers).toContain("DELETE FROM industry_ai_logs WHERE user_id");
    expect(adminUsers).not.toContain("DELETE FROM event_attendance WHERE user_id");
    expect(adminUsers).not.toContain("UPDATE moderation_logs SET admin_id = NULL");
  });
});
