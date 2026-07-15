import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../migrations/0062_military_spirit.sql", import.meta.url)
);
const snapshot61Path = fileURLToPath(
  new URL("../../migrations/meta/0061_snapshot.json", import.meta.url)
);
const snapshot62Path = fileURLToPath(
  new URL("../../migrations/meta/0062_snapshot.json", import.meta.url)
);
const snapshot64Path = fileURLToPath(
  new URL("../../migrations/meta/0064_snapshot.json", import.meta.url)
);
const progressPointMigrationPath = fileURLToPath(
  new URL("../../migrations/0067_add_alang_progress_test_points.sql", import.meta.url)
);
const snapshot67Path = fileURLToPath(
  new URL("../../migrations/meta/0067_snapshot.json", import.meta.url)
);
const journalPath = fileURLToPath(
  new URL("../../migrations/meta/_journal.json", import.meta.url)
);
const schemaPath = fileURLToPath(
  new URL("../../../../packages/shared/src/schema/_definitions_extended.ts", import.meta.url)
);

describe("Alang migration metadata", () => {
  it("contains only the three Alang tables and is explicitly transactional", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(3);
    expect(sql).toContain('CREATE TABLE "alang_missions"');
    expect(sql).toContain('CREATE TABLE "alang_mission_progress"');
    expect(sql).toContain('CREATE TABLE "alang_story_archives"');
    expect(sql).not.toMatch(
      /user_location|content_filter|payment_ritual|social_icebreaker|event_pools|venues|user_coupons/
    );
  });

  it("keeps schema, SQL, snapshot, and journal aligned on uniqueness", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const schema = readFileSync(schemaPath, "utf8");
    const previous = JSON.parse(readFileSync(snapshot61Path, "utf8"));
    const current = JSON.parse(readFileSync(snapshot62Path, "utf8"));
    const latest = JSON.parse(readFileSync(snapshot64Path, "utf8"));
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));

    const progressIndexes = current.tables["public.alang_mission_progress"].indexes;
    const archiveIndexes = current.tables["public.alang_story_archives"].indexes;
    const addedTables = Object.keys(current.tables)
      .filter((tableName) => !(tableName in previous.tables))
      .sort();

    for (const indexName of [
      "uq_alang_progress_user_mission",
      "uq_alang_archive_progress",
    ]) {
      expect(schema).toContain(indexName);
      expect(sql).toContain(indexName);
    }
    expect(progressIndexes.uq_alang_progress_user_mission.isUnique).toBe(true);
    expect(archiveIndexes.uq_alang_archive_progress.isUnique).toBe(true);
    expect(addedTables).toEqual([
      "public.alang_mission_progress",
      "public.alang_missions",
      "public.alang_story_archives",
    ]);
    expect(current.prevId).toBe(previous.id);
    expect(latest.prevId).toBe(current.id);
    expect(latest.tables["public.alang_missions"]).toBeDefined();

    const alangJournalIndex = journal.entries.findIndex(
      (entry: { tag: string }) => entry.tag === "0062_military_spirit"
    );
    expect(alangJournalIndex).toBeGreaterThan(0);
    expect(journal.entries[alangJournalIndex]).toMatchObject({
      idx: alangJournalIndex,
      tag: "0062_military_spirit",
    });
    expect(journal.entries[alangJournalIndex - 1]?.tag).toBe(
      "0061_condemned_phil_sheldon"
    );
    expect(journal.entries[alangJournalIndex + 1]?.tag).toBe(
      "0063_orange_gambit"
    );
  });

  it("keeps the per-run test point migration, snapshot, schema, and journal aligned", () => {
    const sql = readFileSync(progressPointMigrationPath, "utf8");
    const schema = readFileSync(schemaPath, "utf8");
    const snapshot = JSON.parse(readFileSync(snapshot67Path, "utf8"));
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const progressColumns = snapshot.tables["public.alang_mission_progress"].columns;

    expect(sql.trimStart().startsWith("-- Per-run internal Alang coordinates.")).toBe(true);
    expect(sql).toContain("BEGIN;");
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);

    for (const columnName of ["target_location", "companion_end_location"]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "${columnName}" jsonb`);
      expect(progressColumns[columnName]).toMatchObject({
        name: columnName,
        type: "jsonb",
        notNull: false,
      });
    }
    expect(schema).toContain('jsonb("target_location")');
    expect(schema).toContain('jsonb("companion_end_location")');

    const journalIndex = journal.entries.findIndex(
      (entry: { tag: string }) => entry.tag === "0067_add_alang_progress_test_points"
    );
    expect(journalIndex).toBeGreaterThan(0);
    expect(journal.entries[journalIndex]).toMatchObject({
      idx: journalIndex,
      tag: "0067_add_alang_progress_test_points",
    });
  });
});
