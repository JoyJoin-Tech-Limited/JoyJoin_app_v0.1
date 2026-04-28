#!/usr/bin/env node
/**
 * rebuild-journal.mjs
 * Rebuilds _journal.json to include every .sql file in apps/server/migrations/.
 * Preserves existing "when" timestamps where possible.
 * Use this when you add a hand-written migration and need to register it.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const migrationsDir = 'apps/server/migrations';
const metaDir = path.join(migrationsDir, 'meta');
const journalPath = path.join(metaDir, '_journal.json');

function getWhen(filename, existing) {
  const base = filename.replace('.sql', '');
  if (existing[base]) return existing[base];
  
  const dtMatch = base.match(/^(\d{14})/);
  if (dtMatch) {
    const dt = dtMatch[1];
    return Date.UTC(
      parseInt(dt.slice(0, 4)),
      parseInt(dt.slice(4, 6)) - 1,
      parseInt(dt.slice(6, 8)),
      parseInt(dt.slice(8, 10)),
      parseInt(dt.slice(10, 12)),
      parseInt(dt.slice(12, 14))
    );
  }
  return Date.now();
}

const existingJournal = fs.existsSync(journalPath)
  ? JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  : { version: '7', dialect: 'postgresql', entries: [] };

const existingWhen = {};
for (const entry of existingJournal.entries) {
  existingWhen[entry.tag] = entry.when;
}

const sqlFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

const entries = [];
let idx = 0;
for (const file of sqlFiles) {
  const tag = file.replace('.sql', '');
  entries.push({
    idx,
    version: '7',
    when: getWhen(file, existingWhen),
    tag,
    breakpoints: true
  });
  idx++;
}

const journal = { version: '7', dialect: 'postgresql', entries };
fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
console.log(`✅ Rebuilt _journal.json with ${entries.length} entries`);
