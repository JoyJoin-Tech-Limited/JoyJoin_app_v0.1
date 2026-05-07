#!/usr/bin/env node
/**
 * Auto-Merge — Autonomous PR Merger for Auto-Generated PRs
 * ==========================================================
 *
 * Watches for PRs opened by the automation system (auto-debug, auto-docs,
 * auto-test) and auto-merges them when CI passes, with blast-radius gating.
 *
 * Safety rules:
 *   Docs PRs   → merge immediately (CI passing required)
 *   Test PRs   → 30-minute cooldown from PR creation
 *   Fix PRs    → 1-hour cooldown from PR creation
 *   Max 3 auto-merges per 24h window (circuit breaker)
 *
 * What it does NOT merge:
 *   - PRs to main from humans
 *   - PRs with failing CI
 *   - PRs with merge conflicts
 *   - PRs that touch .github/workflows/* (infra changes need human review)
 *   - Draft PRs
 *
 * Usage:
 *   node scripts/auto/auto-merge.mjs                    # dry run (show what would merge)
 *   node scripts/auto/auto-merge.mjs --live             # execute auto-merges
 *   node scripts/auto/auto-merge.mjs --wecom            # notify WeCom
 *   node scripts/auto/auto-merge.mjs --live --wecom      # merge + notify
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token (contents:write + pull-requests:write)
 *   GITHUB_REPOSITORY     – "owner/repo" format (GitHub Actions)
 *   WECOM_BOT_KEY         – WeCom bot key (required with --wecom)
 */

// @ts-check

import fs from 'node:fs';
import path from 'node:path';

const VERSION = '2026-05-04.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const PER_24H_LIMIT = 3;
const COOLDOWNS_MS = {
  docs: 0,           // immediate
  test: 30 * 60 * 1000,  // 30 minutes
  fix: 60 * 60 * 1000,    // 1 hour
};
const AUTO_BRANCHES = ['auto-debug', 'auto-docs', 'auto-test'];
const PROTECTED_PATHS = ['.github/workflows/'];
const BASE_URL = `https://api.github.com`;

const args = process.argv.slice(2);
const flags = {
  live: false,
  wecom: false,
  verbose: false,
};
for (const arg of args) {
  if (arg === '--live') flags.live = true;
  else if (arg === '--wecom') flags.wecom = true;
  else if (arg === '--verbose') flags.verbose = true;
}

const repo = process.env.GITHUB_REPOSITORY || '';
const token = process.env.GITHUB_TOKEN || process.env.AUTO_DEBUG_TOKEN || '';

if (!repo) {
  console.error('❌ GITHUB_REPOSITORY not set');
  process.exit(2);
}
if (!token) {
  console.error('❌ GITHUB_TOKEN not set');
  process.exit(2);
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

/**
 * @param {string} endpoint  — e.g. "/repos/owner/repo/pulls"
 * @param {string} [method]
 * @param {object} [body]
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function ghApi(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const opts = {
    method,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { message: err.message } };
  }
}

/**
 * Get combined CI status for a commit SHA
 * @param {string} sha
 * @returns {Promise<{state: string, checks: any[]}>}
 */
async function getCommitStatus(sha) {
  const { ok, data } = await ghApi(`/repos/${repo}/commits/${sha}/status`);
  if (!ok) return { state: 'unknown', checks: [] };

  // Also check check runs for more detail
  const cr = await ghApi(`/repos/${repo}/commits/${sha}/check-runs`);
  const checks = cr.ok ? (cr.data.check_runs || []) : [];

  return { state: data.state, checks };
}

/**
 * Check if PR has any merge conflicts
 * @param {string} prHead
 * @returns {Promise<boolean>}
 */
async function hasConflict(prHead) {
  // Get the base branch (main)
  const { ok, data } = await ghApi(`/repos/${repo}/compare/main...${prHead}`);
  if (!ok) return true; // assume conflict on error
  return data.status === 'diverged' && data.behind_by > 0;
}

// ─── Category resolution ─────────────────────────────────────────────────────

/**
 * @param {any} pr
 * @returns {'docs' | 'test' | 'fix' | 'unknown'}
 */
function categorizePr(pr) {
  const head = pr.head.ref || '';
  const title = (pr.title || '').toLowerCase();
  const labels = (pr.labels || []).map(/** @type {{name:string}} */ l => l.name.toLowerCase());

  if (head.startsWith('auto-docs') || labels.some(l => l.includes('auto-docs') || l.includes('documentation')))
    return 'docs';
  if (head.startsWith('auto-test') || labels.some(l => l.includes('auto-test') || l.includes('test')))
    return 'test';
  if (head.startsWith('auto-debug') || labels.some(l => l.includes('auto-debug') || l.includes('bug')))
    return 'fix';

  return 'unknown';
}

// ─── Merge history (circuit breaker) ─────────────────────────────────────────

function getMergeCountFile() {
  const dir = path.resolve('.repo-memory');
  return path.join(dir, '_auto_merge_history.json');
}

/**
 * @returns {{ date: string, count: number, prs: string[] }}
 */
function readMergeHistory() {
  const file = getMergeCountFile();
  if (!fs.existsSync(file)) return { date: '', count: 0, prs: [] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { date: '', count: 0, prs: [] };
  }
}

function writeMergeHistory(history) {
  const file = getMergeCountFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

/**
 * @returns {number}
 */
function getRemainingCapacity() {
  const today = new Date().toISOString().slice(0, 10);
  const history = readMergeHistory();
  if (history.date !== today) return PER_24H_LIMIT;
  return Math.max(0, PER_24H_LIMIT - history.count);
}

/**
 * @param {string} prUrl
 */
function recordMerge(prUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const history = readMergeHistory();
  if (history.date !== today) {
    writeMergeHistory({ date: today, count: 1, prs: [prUrl] });
  } else {
    history.count += 1;
    history.prs.push(prUrl);
    writeMergeHistory(history);
  }
}

// ─── Protected path check ────────────────────────────────────────────────────

/**
 * @param {string} prNumber
 * @returns {Promise<{touchesProtected: boolean, files: string[]}>}
 */
async function checkProtectedPaths(prNumber) {
  const { ok, data } = await ghApi(`/repos/${repo}/pulls/${prNumber}/files`);
  if (!ok) return { touchesProtected: true, files: [] };
  const files = (data || []).map(/** @type {{filename:string}} */ f => f.filename);
  const touchesProtected = files.some(f => PROTECTED_PATHS.some(p => f.startsWith(p)));
  return { touchesProtected, files };
}

// ─── Core logic ──────────────────────────────────────────────────────────────

/**
 * @returns {Promise<{mergeable: any[], skipped: any[]}>}
 */
async function findAutoPrs() {
  const { ok, data } = await ghApi(
    `/repos/${repo}/pulls?state=open&sort=created&direction=desc&per_page=30`
  );
  if (!ok) {
    console.error(`❌ Failed to list PRs: ${data.message}`);
    return { mergeable: [], skipped: [] };
  }

  const prs = Array.isArray(data) ? data : [];
  console.log(`📋 Found ${prs.length} open PRs`);

  const autoPRs = prs.filter(pr => {
    const headRef = pr.head?.ref || '';
    const isAuto = AUTO_BRANCHES.some(b => headRef.startsWith(b));
    const isDraft = pr.draft === true;
    return isAuto && !isDraft;
  });

  console.log(`🤖 ${autoPRs.length} are automation PRs`);

  if (autoPRs.length === 0) {
    console.log('✅ No automation PRs to process.');
    return { mergeable: [], skipped: [] };
  }

  const mergeable = [];
  const skipped = [];

  for (const pr of autoPRs) {
    const prNum = pr.number;
    const title = pr.title || '(no title)';
    const createdAt = new Date(pr.created_at);
    const ageMs = Date.now() - createdAt.getTime();
    const category = categorizePr(pr);
    const cooldown = COOLDOWNS_MS[category] || COOLDOWNS_MS.fix;

    console.log(`\n📌 PR #${prNum}: "${title}"`);
    console.log(`   Category: ${category} | Age: ${Math.round(ageMs / 60000)}min | Cooldown: ${Math.round(cooldown / 60000)}min`);

    // Check cooldown
    if (ageMs < cooldown) {
      const remaining = Math.ceil((cooldown - ageMs) / 60000);
      console.log(`   ⏳ Skipped: cooldown remaining (${remaining}min)`);
      skipped.push({ pr, reason: `Cooldown: ${remaining}min remaining` });
      continue;
    }

    // Check CI status
    const sha = pr.head?.sha;
    if (!sha) {
      console.log(`   ⚠️  Skipped: no head SHA`);
      skipped.push({ pr, reason: 'No head SHA' });
      continue;
    }

    const status = await getCommitStatus(sha);
    console.log(`   CI status: ${status.state}`);

    if (status.state !== 'success') {
      const failing = status.checks.filter(c => c.status === 'completed' && c.conclusion !== 'success');
      const msg = failing.length > 0
        ? `CI not passing (${failing.map(c => c.name).join(', ')})`
        : `CI state: ${status.state}`;
      console.log(`   ❌ Skipped: ${msg}`);
      skipped.push({ pr, reason: msg });
      continue;
    }

    // Check merge conflicts
    const headRef = pr.head?.ref;
    if (headRef) {
      const conflict = await hasConflict(headRef);
      if (conflict) {
        console.log(`   ❌ Skipped: merge conflicts detected`);
        skipped.push({ pr, reason: 'Merge conflicts' });
        continue;
      }
    }

    // Check protected paths
    const pathCheck = await checkProtectedPaths(String(prNum));
    if (pathCheck.touchesProtected) {
      console.log(`   🛡️  Skipped: touches protected paths (workflows/infra)`);
      skipped.push({ pr, reason: 'Touches protected paths (.github/workflows/)' });
      continue;
    }

    // Check mergeable state
    if (pr.mergeable === false) {
      console.log(`   ❌ Skipped: not mergeable`);
      skipped.push({ pr, reason: 'Not mergeable' });
      continue;
    }

    // Check reviews — if any human requested changes, skip
    if (pr.requested_reviewers?.length > 0) {
      console.log(`   ⚠️  Skipped: has pending review requests`);
      skipped.push({ pr, reason: 'Pending review requests' });
      continue;
    }

    console.log(`   ✅ Eligible for auto-merge`);
    mergeable.push({ pr, category });
  }

  return { mergeable, skipped };
}

/**
 * @param {any} pr
 * @returns {Promise<boolean>}
 */
async function executeMerge(pr) {
  const prNum = pr.number;
  const title = pr.title || '(no title)';
  const method = 'squash'; // auto-merged PRs get squashed for clean history

  console.log(`\n🔀 Merging PR #${prNum}: "${title}"`);

  const { ok, status, data } = await ghApi(
    `/repos/${repo}/pulls/${prNum}/merge`,
    'PUT',
    { merge_method: method }
  );

  if (ok) {
    console.log(`   ✅ Merged successfully (${data.merged ? 'merged' : 'completed'})`);
    return true;
  }

  // 405 = not mergeable, 409 = conflict
  console.error(`   ❌ Merge failed (HTTP ${status}): ${data.message || 'unknown'}`);
  return false;
}

// ─── WeCom notification ──────────────────────────────────────────────────────

/**
 * @param {{ merged: any[], skipped: any[], capacity: number }} result
 */
async function sendWeCom(result) {
  const { merged, skipped, capacity } = result;

  let md = `## 🤖 Auto-Merge 执行报告\n\n`;
  md += `**时间:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
  md += `**今日剩余合并额度:** ${capacity}\n\n`;

  if (merged.length > 0) {
    md += `### ✅ 已自动合并 (${merged.length})\n\n`;
    for (const { pr, category } of merged) {
      md += `- **${category}:** [${pr.title}](${pr.html_url}) (#${pr.number})\n`;
    }
  } else {
    md += `### ℹ️ 本次无自动合并\n\n`;
  }

  if (skipped.length > 0) {
    md += `### ⏭️ 跳过 (${skipped.length})\n\n`;
    for (const { pr, reason } of skipped) {
      md += `- [#${pr.number}](${pr.html_url}) "${pr.title}"\n`;
      md += `  > ${reason}\n`;
    }
  }

  const { spawnSync } = await import('node:child_process');
  spawnSync('node', ['scripts/wecom-notify.mjs', '--markdown', md], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env },
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Auto-Merge v${VERSION}`);
  console.log(`   Mode: ${flags.live ? 'LIVE (executing merges)' : 'DRY RUN (report only)'}\n`);

  const capacity = getRemainingCapacity();
  console.log(`📊 Daily capacity: ${capacity}/${PER_24H_LIMIT} remaining`);

  if (capacity <= 0) {
    console.log('🛑 24h merge limit reached. Stopping.');
    return 0;
  }

  const { mergeable, skipped } = await findAutoPrs();

  const merged = [];
  for (const { pr, category } of mergeable) {
    if (merged.length >= capacity) {
      console.log(`\n🛑  Merge capacity exhausted (${merged.length}/${capacity})`);
      skipped.push({ pr, reason: 'Daily merge limit reached' });
      break;
    }

    if (flags.live) {
      const success = await executeMerge(pr);
      if (success) {
        merged.push({ pr, category });
        recordMerge(pr.html_url);
        console.log(`   📊 Capacity remaining: ${capacity - merged.length}`);
      } else {
        skipped.push({ pr, reason: 'Merge API call failed' });
      }
    } else {
      console.log(`\n   [DRY RUN] Would merge: ${pr.title} (#${pr.number})`);
      merged.push({ pr, category });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (flags.live) {
    console.log(`✅ Merged: ${merged.length} | ⏭️ Skipped: ${skipped.length}`);
  } else {
    console.log(`[DRY RUN] Would merge: ${merged.length} | Would skip: ${skipped.length}`);
  }

  for (const { pr, reason } of skipped.slice(0, 5)) {
    console.log(`   ⏭️  #${pr.number}: ${reason}`);
  }

  // WeCom
  if (flags.wecom && (merged.length > 0 || skipped.length > 0)) {
    console.log('\n📱 Sending WeCom notification...');
    await sendWeCom({ merged, skipped, capacity: capacity - merged.length });
  }

  return merged.length > 0 ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Merge fatal error:', err.message);
    process.exit(2);
  });
