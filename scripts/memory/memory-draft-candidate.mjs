#!/usr/bin/env node
/**
 * Creates a schema-valid candidate note under repo-memory/candidates/ from JSON.
 * Use for agent-assisted automation; humans still review the PR and run memory:promote when ready.
 *
 * Usage:
 *   node scripts/memory/memory-draft-candidate.mjs <path-to.json>
 *   cat spec.json | node scripts/memory/memory-draft-candidate.mjs
 *
 * See repo-memory/examples/draft-candidate.example.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANDIDATE_DIR_RELATIVE_PATH,
  loadMemoryNotes,
  resolveFilePath,
  validateMemoryNotes,
  writeMemoryNoteFile,
} from './memory-lib.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.error(`Usage:
  node scripts/memory/memory-draft-candidate.mjs <path-to.json>
  cat spec.json | node scripts/memory/memory-draft-candidate.mjs

Options (env):
  MEMORY_DRAFT_FORCE=1  Overwrite if candidate file already exists (use sparingly).`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function defaultFilenameFromId(id) {
  const tail = String(id).split('.').pop() ?? 'note';
  return `${tail.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.md`;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  let raw;
  if (process.argv[2]) {
    const p = resolveFilePath(process.argv[2]);
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${process.argv[2]}`);
      process.exit(1);
    }
    raw = fs.readFileSync(p, 'utf8');
  } else if (!process.stdin.isTTY) {
    raw = await readStdin();
  } else {
    usage();
    process.exit(1);
  }

  const spec = parseJson(raw.trim());
  const {
    id,
    title,
    owner,
    tags,
    triggerTerms,
    relatedPaths,
    sources,
    confidence,
    body,
    lastValidatedAt,
    filename,
  } = spec;

  const missing = [];
  for (const key of ['id', 'title', 'owner', 'tags', 'triggerTerms', 'relatedPaths', 'sources', 'confidence', 'body']) {
    if (spec[key] === undefined || spec[key] === null) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    console.error(`Missing required fields: ${missing.join(', ')}`);
    process.exit(1);
  }

  const baseName = typeof filename === 'string' && filename.trim() ? filename.trim() : defaultFilenameFromId(id);
  const safeName = baseName.endsWith('.md') ? baseName : `${baseName}.md`;
  const relativePath = path.posix.join(CANDIDATE_DIR_RELATIVE_PATH, safeName);
  const absolutePath = path.join(REPO_ROOT, relativePath);

  if (fs.existsSync(absolutePath) && process.env.MEMORY_DRAFT_FORCE !== '1') {
    console.error(`Candidate already exists: ${relativePath} (set MEMORY_DRAFT_FORCE=1 to overwrite)`);
    process.exit(1);
  }

  const metadata = {
    id: String(id).trim(),
    title: String(title).trim(),
    status: 'candidate',
    owner: String(owner).trim(),
    lastValidatedAt: typeof lastValidatedAt === 'string' && lastValidatedAt.trim() ? lastValidatedAt.trim().slice(0, 10) : todayUtc(),
    tags,
    triggerTerms,
    relatedPaths,
    sources,
    confidence: String(confidence).trim(),
  };

  const note = {
    metadata,
    body: String(body).trim(),
  };

  if (process.env.MEMORY_DRAFT_FORCE === '1' && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }

  writeMemoryNoteFile(absolutePath, note);

  const allNotes = loadMemoryNotes();
  const validation = validateMemoryNotes(allNotes);

  if (validation.errors.length > 0) {
    fs.unlinkSync(absolutePath);
    console.error('Draft failed validation; file was not kept:');
    for (const err of validation.errors) {
      if (err.includes(relativePath) || err.includes(metadata.id)) {
        console.error(`- ${err}`);
      }
    }
    for (const err of validation.errors) {
      if (!err.includes(relativePath) && !err.includes(metadata.id)) {
        console.error(`- ${err}`);
      }
    }
    process.exit(1);
  }

  console.log(`Wrote valid candidate note: ${relativePath}`);
  console.log('Next: git diff, PR review, then optionally npm run memory:promote -- <path>');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
