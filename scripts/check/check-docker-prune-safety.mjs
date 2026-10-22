#!/usr/bin/env node
/**
 * Docker prune safety ratchet — an unfiltered `docker image prune -af` on the
 * shared CVM deletes images the *other* environment just pulled.
 *
 * Why (2026-10-22, staging deploy latency Phase 1): staging and production now
 * run concurrently on the same Docker engine (`joyjoin-cvm-staging` vs
 * `joyjoin-cvm-remote`, see deployment/README.md §并发锁模型). Before the split
 * they were serialized by one lock, which made an unfiltered `image prune -af`
 * merely wasteful. After the split it is destructive: a staging deploy that
 * prunes between production's `docker pull` and its `docker compose up` leaves
 * production with no image to start, and vice versa.
 *
 * The fix everywhere is `--filter "until=24h"` — reclaim images that have been
 * unused for a day, never the ones a parallel deploy is about to run. This gate
 * keeps that property from silently regrowing.
 *
 * Scope: `deployment/scripts/**` (shell) + `.github/workflows/**` (YAML, where
 * the disk-pressure paths live inline). Rules:
 *   - `docker image prune` / `docker system prune` with an all-flag
 *     (`-a`, `-af`, `--all`) MUST carry `--filter` on the same logical line.
 *   - `docker builder prune -af` is exempt: build cache only, no images.
 *   - Comment-only lines are ignored (prose explaining the rule is fine).
 *   - Backslash line continuations are joined first, so a filter on the next
 *     physical line still counts.
 *
 * No baseline: every occurrence in the repo is already compliant, so any hit is
 * a new regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TARGETS = [
  { dir: join(ROOT, 'deployment/scripts'), exts: ['.sh'] },
  { dir: join(ROOT, '.github/workflows'), exts: ['.yml', '.yaml'] },
];

const PRUNE = /docker\s+(image|system)\s+prune/;
const ALL_FLAG = /(^|\s)(-a|-af|--all)(\s|$)/;
const FILTER = /--filter/;

function walk(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      out.push(...walk(path, exts));
    } else if (exts.some((ext) => name.endsWith(ext))) {
      out.push(path);
    }
  }
  return out;
}

/** Join `\`-continued physical lines so a filter on the next line still counts. */
function logicalLines(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  let buffer = '';
  let startLine = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (buffer === '') startLine = i + 1;
    if (line.trimEnd().endsWith('\\')) {
      buffer += `${line.trimEnd().slice(0, -1)} `;
      continue;
    }
    result.push({ line: startLine, text: buffer + line });
    buffer = '';
  }
  if (buffer !== '') result.push({ line: startLine, text: buffer });
  return result;
}

const violations = [];

for (const { dir, exts } of TARGETS) {
  for (const file of walk(dir, exts)) {
    const text = readFileSync(file, 'utf8');
    for (const { line, text: raw } of logicalLines(text)) {
      const trimmed = raw.trim();
      if (trimmed.startsWith('#')) continue;
      if (!PRUNE.test(trimmed)) continue;
      if (!ALL_FLAG.test(trimmed)) continue;
      if (FILTER.test(trimmed)) continue;
      violations.push({
        file: relative(ROOT, file),
        line,
        text: trimmed.slice(0, 160),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    '❌ docker prune safety: unfiltered `docker image|system prune -a` found.\n' +
      '   staging and production now share one Docker engine, so an unfiltered prune\n' +
      '   can delete images the other environment just pulled but has not started.\n' +
      '   Add `--filter "until=24h"` (see deployment/README.md §并发锁模型).\n',
  );
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(1);
}

console.log('✅ docker prune safety: all image prunes are age-filtered.');
