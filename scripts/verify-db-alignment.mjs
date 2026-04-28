#!/usr/bin/env node
/**
 * verify-db-alignment.mjs
 * Compares schema.ts table/column definitions against the live database.
 * Exits with code 1 if any schema table/column is missing from the DB.
 * Exits with code 0 if fully aligned.
 */
import { Pool } from 'pg';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const schema = fs.readFileSync('packages/shared/src/schema.ts', 'utf8');

// Extract pgTable definitions (handles multi-line pgTable("name", {))
const tables = {};
const tableStartRegex = /export const (\w+) = pgTable\s*\(\s*"([^"]+)"\s*,\s*\{/g;
let m;
while ((m = tableStartRegex.exec(schema)) !== null) {
  const tableName = m[2];
  const startIdx = m.index + m[0].length;
  let braceCount = 1;
  let endIdx = startIdx;
  while (braceCount > 0 && endIdx < schema.length) {
    if (schema[endIdx] === '{') braceCount++;
    else if (schema[endIdx] === '}') braceCount--;
    endIdx++;
  }
  const body = schema.slice(startIdx, endIdx - 1);
  const colRegex = /(\w+):\s+\w+\("([^"]+)"/g;
  const columns = [];
  let cm;
  while ((cm = colRegex.exec(body)) !== null) {
    columns.push(cm[2]);
  }
  tables[tableName] = columns;
}

// Sanity check: ensure regex parser didn't silently break
const MIN_EXPECTED_TABLES = 85;
const parsedTableCount = Object.keys(tables).length;
if (parsedTableCount < MIN_EXPECTED_TABLES) {
  console.error(`❌ Schema parser only found ${parsedTableCount} tables (expected ≥ ${MIN_EXPECTED_TABLES}). The regex parser may be broken.`);
  process.exit(1);
}

async function main() {
  const dbResult = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position
  `);

  const dbTables = {};
  for (const row of dbResult.rows) {
    if (!dbTables[row.table_name]) dbTables[row.table_name] = new Set();
    dbTables[row.table_name].add(row.column_name);
  }

  const issues = [];

  for (const [tableName, schemaCols] of Object.entries(tables)) {
    const dbCols = dbTables[tableName];
    if (!dbCols) {
      issues.push(`MISSING TABLE: ${tableName}`);
    } else {
      for (const col of schemaCols) {
        if (!dbCols.has(col)) {
          issues.push(`MISSING COLUMN: ${tableName}.${col}`);
        }
      }
    }
  }

  // Also flag orphaned tables (except known system/legacy ones)
  const knownOrphaned = new Set(); // add any intentionally-orphaned tables here
  const schemaTableNames = new Set(Object.keys(tables));
  for (const dbTableName of Object.keys(dbTables)) {
    if (!schemaTableNames.has(dbTableName) && !knownOrphaned.has(dbTableName)) {
      issues.push(`ORPHANED TABLE: ${dbTableName}`);
    }
  }

  if (issues.length === 0) {
    console.log('✅ Schema and DB are fully aligned');
    await pool.end();
    process.exit(0);
  } else {
    console.error(`❌ Found ${issues.length} alignment issue(s):`);
    issues.forEach(i => console.error('  - ' + i));
    await pool.end();
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
