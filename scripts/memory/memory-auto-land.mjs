#!/usr/bin/env node
/**
 * One-shot: draft a schema-valid candidate from JSON, then promote it to repo-memory/promoted/.
 *
 * **Safety:** Requires JOYJOIN_MEMORY_AUTO_LAND=1 so promotion never runs by accident.
 *
 * Usage:
 *   JOYJOIN_MEMORY_AUTO_LAND=1 npm run memory:auto-land -- repo-memory/examples/your-spec.json
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CANDIDATE_PREFIX = 'repo-memory/candidates';

function usage() {
  console.error(`Usage:
  JOYJOIN_MEMORY_AUTO_LAND=1 npm run memory:auto-land -- <spec.json>

Same JSON as npm run memory:draft-candidate (see repo-memory/examples/draft-candidate.example.json).`);
}

function defaultFilenameFromId(id) {
  const tail = String(id).split('.').pop() ?? 'note';
  return `${tail.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.md`;
}

if (process.env.JOYJOIN_MEMORY_AUTO_LAND !== '1') {
  console.error(
    'Refusing to auto-land: set JOYJOIN_MEMORY_AUTO_LAND=1 to confirm draft + promote in one shot.\n' +
      'Otherwise: npm run memory:draft-candidate … then npm run memory:promote …',
  );
  process.exit(1);
}

const specPath = process.argv[2];
if (!specPath) {
  usage();
  process.exit(1);
}

const absoluteSpec = path.isAbsolute(specPath) ? specPath : path.join(REPO_ROOT, specPath);
if (!fs.existsSync(absoluteSpec)) {
  console.error(`Spec not found: ${specPath}`);
  process.exit(1);
}

const draftScript = path.join(__dirname, 'memory-draft-candidate.mjs');
const promoteScript = path.join(__dirname, 'memory-promote.mjs');

execFileSync(process.execPath, [draftScript, absoluteSpec], { stdio: 'inherit', cwd: REPO_ROOT });

const raw = fs.readFileSync(absoluteSpec, 'utf8');
const spec = JSON.parse(raw);
const baseName =
  typeof spec.filename === 'string' && spec.filename.trim()
    ? spec.filename.trim()
    : defaultFilenameFromId(spec.id);
const safeName = baseName.endsWith('.md') ? baseName : `${baseName}.md`;
const candidateRelative = path.posix.join(CANDIDATE_PREFIX, safeName);
const absoluteCandidate = path.join(REPO_ROOT, candidateRelative);

if (!fs.existsSync(absoluteCandidate)) {
  console.error(`Expected candidate file after draft: ${candidateRelative}`);
  process.exit(1);
}

execFileSync(process.execPath, [promoteScript, absoluteCandidate], { stdio: 'inherit', cwd: REPO_ROOT });
console.log('Auto-land complete (draft + promote). Run: npm run memory:validate');
