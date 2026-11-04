#!/usr/bin/env node
/**
 * Remote-branch prune safety ratchet.
 *
 * Why (2026-11-04): the weekly `Auto-Prune Repository` run deleted
 * `fix/shared-archetype-mix-test` — the head branch of open, fully green
 * PR #658. `pruneRemoteBranches()` listed every remote branch, kept only
 * `main` / `feat/mini-program-foundation`, and deleted everything that was
 * not merged inside the last 14 days. A branch with an *open* PR has no
 * merge timestamp, so it fell straight through to deletion, leaving the PR
 * unmergeable and the work reachable only from a local clone.
 *
 * Deleting a ref cannot be undone by CI, so the guard is structural:
 *
 *   1. Any script that DELETEs `git/refs/heads/...` must first build an
 *      open-PR set (`gh pr list --state open`) and test membership before
 *      the delete call.
 *   2. It must also require positive evidence that the work landed — a
 *      merged PR (`mergedAt`) or `merge-base --is-ancestor` against main —
 *      because squash merges never make the branch tip an ancestor.
 *   3. Fail closed: if the open-PR list cannot be fetched, delete nothing.
 *
 * Checks are source-shape assertions (the script is a top-level executable
 * with GitHub side effects, so it has no unit-test seam), and they run in the
 * guardrails chain next to `check-docker-prune-safety.mjs`, which protects the
 * same class of shared-resource cleanup.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCAN_DIR = join(ROOT, 'scripts');
const SELF = fileURLToPath(import.meta.url);

/**
 * Files allowed to delete a remote ref without the open-PR protocol.
 * `auto-fix.mjs` only ever deletes `AUTO_FIX_BRANCH`, the branch it created in
 * the same run (callers at lines ~724 and ~794), so it cannot orphan a PR.
 */
const ALLOWLIST = new Map([
  ['scripts/auto/auto-fix.mjs', 'deletes only its own AUTO_FIX_BRANCH constant'],
]);

const REF_DELETE = /git\/refs\/heads\//;
const OPEN_PR_SET = /openPrBranches/;
const OPEN_PR_FETCH = /'--state',\s*'open'|--state=open|state:\s*'open'/;
const MEMBERSHIP_GUARD = /openPrBranches\.has\(/;
const MERGED_SIGNAL = /mergedAtByBranch|merge-base',\s*'--is-ancestor'/;
const FAIL_CLOSED = /could not list open pull requests/;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (name === 'node_modules') continue;
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...walk(path));
    } else if (name.endsWith('.mjs') || name.endsWith('.js')) {
      out.push(path);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SCAN_DIR)) {
  if (file === SELF) continue;
  const text = readFileSync(file, 'utf8');
  if (!REF_DELETE.test(text)) continue;

  const rel = relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;
  const deleteIndex = text.search(REF_DELETE);
  const add = (message) => violations.push({ file: rel, message });

  if (!OPEN_PR_SET.test(text)) {
    add('deletes a remote branch but never builds an open-PR set (gh pr list --state open)');
    continue;
  }
  if (!OPEN_PR_FETCH.test(text)) {
    add('has an open-PR set but does not fetch it with `gh pr list ... --state open`');
  }
  if (!MERGED_SIGNAL.test(text)) {
    add('deletes a remote branch without requiring merged evidence (mergedAt / merge-base --is-ancestor)');
  }
  if (!FAIL_CLOSED.test(text)) {
    add('does not fail closed when the open-PR list cannot be fetched');
  }

  const guardIndex = text.search(MEMBERSHIP_GUARD);
  if (guardIndex === -1) {
    add('never tests `openPrBranches.has(...)` before deleting');
  } else if (guardIndex > deleteIndex) {
    add('tests `openPrBranches.has(...)` only after the delete call');
  }
}

if (violations.length > 0) {
  console.error(
    '❌ auto-prune branch safety: a script can delete a remote branch that an open PR owns.\n' +
      '   On 2026-11-04 the weekly Auto-Prune run deleted the head branch of open PR #658\n' +
      '   because an open PR has no merge timestamp.\n' +
      '   Every remote-ref deletion needs: an open-PR set, a membership guard before the\n' +
      '   delete, merged evidence, and a fail-closed path when the PR list is unavailable.\n',
  );
  for (const v of violations) {
    console.error(`   ${v.file}: ${v.message}`);
  }
  process.exit(1);
}

console.log('✅ auto-prune branch safety: remote branch deletes are open-PR guarded.');
