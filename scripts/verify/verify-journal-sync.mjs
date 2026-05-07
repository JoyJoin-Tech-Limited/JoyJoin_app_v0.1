#!/usr/bin/env node
/**
 * verify-journal-sync.mjs
 * Ensures every .sql file in apps/server/migrations/ is tracked in meta/_journal.json.
 * Exits with code 1 if there are untracked migrations.
 */
import fs from 'fs';
import path from 'path';

const migrationsDir = 'apps/server/migrations';
const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

const sqlFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .map(f => f.replace('.sql', ''))
  .sort();

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const journalTags = new Set(journal.entries.map(e => e.tag));

const untracked = sqlFiles.filter(tag => !journalTags.has(tag));

if (untracked.length === 0) {
  console.log(`✅ All ${sqlFiles.length} migrations are tracked in _journal.json`);
  process.exit(0);
} else {
  console.error(`❌ ${untracked.length} migration(s) are NOT tracked in _journal.json:`);
  untracked.forEach(tag => console.error('  - ' + tag));
  console.error('\nFix: run node scripts/rebuild-journal.mjs or manually add them to _journal.json');
  process.exit(1);
}
