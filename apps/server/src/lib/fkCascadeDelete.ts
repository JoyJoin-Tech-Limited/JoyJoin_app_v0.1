import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Catalog-driven recursive FK cascade delete.
 *
 * Why: test cleanup (single-test / matching-test) deletes virtual users and test
 * pools, but hand-enumerating every table with a FK to users.id / eventPools.id
 * is whack-a-mole — each missed child table surfaces as a fresh FK violation on
 * the next reset. This helper discovers dependents from pg_constraint at runtime
 * (so newly added tables are covered automatically) and deletes deepest-first.
 *
 * Safety model (for explicit destructive cleanup paths only):
 *   - Root ids must be UUIDs (validated) — they are inlined into DELETE/SELECT
 *     statements, so format validation is the injection guard.
 *   - Only NON-cascade FKs are followed; `ON DELETE CASCADE` relations are left
 *     to the database.
 *   - Depth is capped and a visited-set prevents cycles.
 */

type DbLike = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 10;

function assertUuidIds(ids: string[]): void {
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new Error(`fkCascadeDelete: refusing non-UUID id "${id}"`);
    }
  }
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function idList(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(",");
}

interface FkDependent {
  childTable: string;
  childFkColumn: string;
  childPkColumn: string | null;
}

interface ExecuteRow {
  child_table: string;
  child_fk_column: string;
}

interface PkRow {
  attname: string;
}

async function getFkDependents(
  tx: DbLike,
  parentTable: string,
  parentColumn: string,
): Promise<FkDependent[]> {
  const result = (await tx.execute(sql`
    SELECT con.conrelid::regclass::text AS child_table, child_att.attname AS child_fk_column
    FROM pg_constraint con
    JOIN pg_attribute child_att
      ON child_att.attrelid = con.conrelid AND child_att.attnum = ANY(con.conkey)
    JOIN pg_attribute parent_att
      ON parent_att.attrelid = con.confrelid AND parent_att.attnum = ANY(con.confkey)
    WHERE con.contype = 'f'
      AND con.confrelid = ${parentTable}::regclass
      AND parent_att.attname = ${parentColumn}
      AND con.confdeltype <> 'c'
  `)) as { rows?: ExecuteRow[] };
  const rows = result.rows ?? [];

  const dependents: FkDependent[] = [];
  for (const row of rows) {
    // Single-column primary key of the child table (for recursion); null if composite/none.
    const pkResult = (await tx.execute(sql`
      SELECT a.attname
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
      WHERE con.contype = 'p' AND con.conrelid = ${row.child_table}::regclass
    `)) as { rows?: PkRow[] };
    const pkRows = pkResult.rows ?? [];
    const childPkColumn = pkRows.length === 1 ? pkRows[0].attname : null;
    dependents.push({
      childTable: row.child_table,
      childFkColumn: row.child_fk_column,
      childPkColumn,
    });
  }
  return dependents;
}

async function selectPkValues(
  tx: DbLike,
  table: string,
  pkColumn: string,
  fkColumn: string,
  parentIds: string[],
): Promise<string[]> {
  // `table` comes from pg_constraint's regclass::text (already safely formatted
  // by Postgres, possibly schema-qualified) — use it verbatim; only quote the
  // plain identifier columns.
  const query = sql.raw(
    `SELECT ${quoteIdent(pkColumn)} AS id FROM ${table} WHERE ${quoteIdent(fkColumn)} IN (${idList(parentIds)})`,
  );
  const result = (await tx.execute(query)) as { rows?: Array<{ id: string }> };
  return (result.rows ?? []).map((r) => r.id);
}

async function deleteByFkColumn(
  tx: DbLike,
  table: string,
  fkColumn: string,
  parentIds: string[],
): Promise<void> {
  const query = sql.raw(
    `DELETE FROM ${table} WHERE ${quoteIdent(fkColumn)} IN (${idList(parentIds)})`,
  );
  await tx.execute(query);
}

async function cascadeDeleteInternal(
  tx: DbLike,
  table: string,
  pkColumn: string,
  ids: string[],
  visited: Set<string>,
  depth: number,
): Promise<void> {
  if (ids.length === 0) return;
  if (depth > MAX_DEPTH) {
    logger.warn("[fkCascadeDelete] max depth reached; stopping recursion", { table, depth });
    return;
  }
  assertUuidIds(ids);

  const dependents = await getFkDependents(tx, table, pkColumn);
  for (const dep of dependents) {
    const edgeKey = `${table}.${pkColumn}->${dep.childTable}.${dep.childFkColumn}`;
    if (visited.has(edgeKey)) continue;
    visited.add(edgeKey);

    // Recurse into the child's own dependents first (deepest-first delete).
    if (dep.childPkColumn) {
      const childIds = await selectPkValues(
        tx,
        dep.childTable,
        dep.childPkColumn,
        dep.childFkColumn,
        ids,
      );
      await cascadeDeleteInternal(tx, dep.childTable, dep.childPkColumn, childIds, visited, depth + 1);
    }
    await deleteByFkColumn(tx, dep.childTable, dep.childFkColumn, ids);
  }
}

/**
 * Delete rows from `rootTable` where `rootColumn` is in `rootIds`, after first
 * deleting every row that (transitively) references them via a non-cascade FK.
 * Discovered from pg_constraint, so new tables are handled without code edits.
 */
export async function cascadeDeleteByIds(
  tx: DbLike,
  rootTable: string,
  rootColumn: string,
  rootIds: string[],
): Promise<void> {
  if (rootIds.length === 0) return;
  assertUuidIds(rootIds);
  const visited = new Set<string>();
  await cascadeDeleteInternal(tx, rootTable, rootColumn, rootIds, visited, 0);
  // Finally delete the root rows themselves (cascade FKs handled by the DB).
  const query = sql.raw(
    `DELETE FROM ${quoteIdent(rootTable)} WHERE ${quoteIdent(rootColumn)} IN (${idList(rootIds)})`,
  );
  await tx.execute(query);
  logger.info("[fkCascadeDelete] cascade delete complete", {
    rootTable,
    rootColumn,
    rootCount: rootIds.length,
    edges: visited.size,
  });
}
