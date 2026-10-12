import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { cascadeDeleteByIds } from "../lib/fkCascadeDelete";

vi.mock("../lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

/**
 * Render a Drizzle SQL object into text, including inlined string parameters.
 * Mirrors the mock style in `revokeUserSessionsContract.test.ts` so assertions
 * read the exact statements the helper builds (StringChunk values are arrays;
 * `${param}` values are pushed as primitive string chunks).
 */
function renderSql(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      const value = (chunk as { value?: unknown })?.value;
      if (Array.isArray(value)) return value.join("");
      if (chunk && (chunk as object).constructor === String) return String(chunk);
      return "";
    })
    .join("");
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
    // than requiring this endpoint to be updated table by table. The call must
    // also carry the retention config (Option B, 2026-10-09) so financial rows
    // survive; a bare 4-arg call would silently delete them again.
    expect(adminUsers).toMatch(
      /cascadeDeleteByIds\(\s*tx,\s*"users",\s*"id",\s*\[userId\],\s*\{\s*retain:\s*RETAINED_USER_TABLES,?\s*\}\s*\)/,
    );
    expect(adminUsers).not.toContain('cascadeDeleteByIds(tx, "users", "id", [userId])');
    expect(adminUsers).toContain('export const RETAINED_USER_TABLES = ["payments"] as const;');
    expect(adminUsers).toContain("if (user.isAdmin)");
    // These current schema columns intentionally have no FK, so catalog
    // discovery cannot see them and they require explicit privacy cleanup.
    expect(adminUsers).toContain("DELETE FROM social_icebreaker_participants WHERE user_id");
    expect(adminUsers).toContain("DELETE FROM social_icebreaker_lie_truths WHERE user_id");
    // W1 (host resilience): a deleted/banned host must never hard-delete a live
    // session — the room would freeze with no way to advance. Sessions are
    // reassigned to a remaining participant or tombstoned instead.
    expect(adminUsers).not.toContain("DELETE FROM social_icebreaker_sessions WHERE host_user_id");
    expect(adminUsers).toContain("reassignOrTombstoneHostedSessions");
    expect(adminUsers).toContain("DELETE FROM industry_ai_logs WHERE user_id");
    expect(adminUsers).not.toContain("DELETE FROM event_attendance WHERE user_id");
    expect(adminUsers).not.toContain("UPDATE moderation_logs SET admin_id = NULL");
  });

  it("is used for derived events / blind_box_events / pool deletion in single-test cleanup", () => {
    const singleTest = readRepoFile("apps/server/src/services/singleTestService.ts");

    // Regression guard for the 重新创建调试局 FK violation: once a played
    // session exists, blind_box_pre_attendance (确认出席), event_feedback,
    // match_history, connections, reunion_requests and venue_bookings reference
    // the test events/blind_box_events with NO ACTION FKs. Hand-enumerated
    // deletes miss them, so cleanup must cascade from pg_constraint.
    expect(singleTest).toContain('cascadeDeleteByIds(conn, "events", "id", linkedEventIds)');
    expect(singleTest).toContain('cascadeDeleteByIds(conn, "blind_box_events", "id", linkedBlindBoxEventIds)');
    expect(singleTest).toContain('cascadeDeleteByIds(conn, "blind_box_events", "id", staleBlindBoxEventIds)');
    expect(singleTest).toContain('cascadeDeleteByIds(conn, "events", "id", orphanEventIds)');
    expect(singleTest).toContain('cascadeDeleteByIds(conn, "event_pools", "id", [poolId])');
    expect(singleTest).not.toContain("conn.delete(events)");
    expect(singleTest).not.toContain("conn.delete(blindBoxEvents)");
    expect(singleTest).not.toContain("conn.delete(eventPools)");
  });
});

// ── AC-04(c): retain-option behavior with a fake catalog-backed tx.execute ──

type CatalogFkRow = { child_table: string; child_fk_column: string };

/** Minimal FK graph: users → payments → refund_attempts, users → registrations → attendance. */
const FK_GRAPH: Record<string, CatalogFkRow[]> = {
  users: [
    { child_table: "payments", child_fk_column: "user_id" },
    { child_table: "event_pool_registrations", child_fk_column: "user_id" },
  ],
  payments: [{ child_table: "refund_attempts", child_fk_column: "payment_id" }],
  refund_attempts: [],
  event_pool_registrations: [
    { child_table: "event_attendance", child_fk_column: "registration_id" },
  ],
  event_attendance: [],
};

/** Child PK fixtures — valid UUIDs because the helper validates every recursed id. */
const CHILD_IDS: Record<string, string[]> = {
  payments: ["11111111-1111-4111-8111-111111111111"],
  refund_attempts: ["22222222-2222-4222-8222-222222222222"],
  event_pool_registrations: ["33333333-3333-4333-8333-333333333333"],
  event_attendance: ["44444444-4444-4444-8444-444444444444"],
};

const ROOT_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createCatalogTx() {
  const deletedTables: string[] = [];
  const discoveredParents: string[] = [];
  const selectedTables: string[] = [];

  const execute = vi.fn(async (query: unknown) => {
    const statement = renderSql(query);

    // Dependent discovery (pg_constraint) — route by the referenced parent.
    if (statement.includes("AS child_table")) {
      const parent = /con\.confrelid = (\S+)::regclass/.exec(statement)?.[1] ?? "";
      discoveredParents.push(parent);
      return { rows: FK_GRAPH[parent] ?? [] };
    }

    // Single-column PK discovery (recursion is possible only with a PK match).
    if (statement.includes("con.contype = 'p'")) {
      return { rows: [{ attname: "id" }] };
    }

    // Child PK value lookup before recursing / deleting.
    if (statement.startsWith("SELECT ")) {
      const table = /FROM (\S+) WHERE/.exec(statement)?.[1] ?? "";
      selectedTables.push(table);
      return { rows: (CHILD_IDS[table] ?? []).map((id) => ({ id })) };
    }

    // Deepest-first child delete + final root delete.
    if (statement.startsWith("DELETE FROM ")) {
      const table = /^DELETE FROM "?([^"\s]+)"? WHERE/.exec(statement)?.[1] ?? "";
      deletedTables.push(table);
      return { rowCount: 1 };
    }

    return { rows: [] };
  });

  return { execute, deletedTables, discoveredParents, selectedTables };
}

describe("cascadeDeleteByIds retain option (AC-02 / AC-04c)", () => {
  it("retains a configured table without deleting or recursing into its children", async () => {
    const tx = createCatalogTx();

    await cascadeDeleteByIds(tx, "users", "id", [ROOT_USER_ID], { retain: ["payments"] });

    // (i) Neither the retained table nor its child rows are deleted…
    expect(tx.deletedTables).toEqual([
      "event_attendance",
      "event_pool_registrations",
      "users",
    ]);
    expect(tx.deletedTables).not.toContain("payments");
    expect(tx.deletedTables).not.toContain("refund_attempts");

    // (ii) …and its subtree (refund_attempts) is never discovered or selected.
    expect(tx.discoveredParents).not.toContain("payments");
    expect(tx.selectedTables).not.toContain("refund_attempts");

    // Non-retained branches still recurse and delete normally.
    expect(tx.discoveredParents).toContain("event_pool_registrations");
    expect(tx.deletedTables).toContain("event_attendance");
  });

  it("keeps default (no retain config) behavior unchanged", async () => {
    const tx = createCatalogTx();

    await cascadeDeleteByIds(tx, "users", "id", [ROOT_USER_ID]);

    expect(tx.deletedTables).toEqual([
      "refund_attempts",
      "payments",
      "event_attendance",
      "event_pool_registrations",
      "users",
    ]);
    expect(tx.discoveredParents).toContain("payments");
    expect(tx.selectedTables).toContain("refund_attempts");
  });

  it("matches schema-qualified / quoted retain entries by normalized table name", async () => {
    const tx = createCatalogTx();

    await cascadeDeleteByIds(tx, "users", "id", [ROOT_USER_ID], {
      retain: ['public."payments"'],
    });

    expect(tx.deletedTables).not.toContain("payments");
    expect(tx.discoveredParents).not.toContain("payments");
  });
});
