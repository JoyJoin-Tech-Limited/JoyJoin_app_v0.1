#!/usr/bin/env node
/**
 * Auto-Prune — Weekly Repository Hygiene
 * =========================================
 *
 * Cleans up stale branches, old workflow artifacts, expired repo-memory
 * candidates, and old reports. Safe by design — nothing irreversible without
 * explicit --live flag.
 *
 * What it cleans:
 *   1. Stale local branches (merged to main, inactive >14 days)
 *   2. Remote stale branches via GitHub API (--live only, always with report)
 *   3. Old workflow run artifacts (>30 days, via GitHub API, --live only)
 *   4. Expired repo-memory candidates (files >14 days old that were promoted)
 *   5. Old reports in reports/ (>60 days, preserves static analysis reports)
 *
 * Usage:
 *   node scripts/auto/auto-prune.mjs                    # dry run (reports only)
 *   node scripts/auto/auto-prune.mjs --live             # execute cleanup
 *   node scripts/auto/auto-prune.mjs --wecom            # notify WeCom
 *   node scripts/auto/auto-prune.mjs --branches --live  # delete only branches
 *
 * Exit codes:
 *   0 = completed (nothing to do or dry run)
 *   1 = some operations skipped
 *   2 = error
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token (required for remote operations)
 *   GITHUB_REPOSITORY     – "owner/repo" format (GitHub Actions)
 *   WECOM_BOT_KEY         – WeCom bot key (required with --wecom)
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const VERSION = '2026-05-03.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--live');
const NOTIFY_WECOM = process.argv.includes('--wecom');
const ONLY_BRANCHES = process.argv.includes('--branches');
const ONLY_ARTIFACTS = process.argv.includes('--artifacts');
const ONLY_MEMORY = process.argv.includes('--memory');
const ONLY_REPORTS = process.argv.includes('--reports');

const BRANCH_STALE_DAYS = 14;
const ARTIFACT_STALE_DAYS = 30;
const MEMORY_CANDIDATE_STALE_DAYS = 14;
const REPORT_STALE_DAYS = 60;

/** @type {{ name: string; deletions: string[]; skipped: string[] }} */
const results = {
  name: 'auto-prune',
  deletions: [],
  skipped: [],
};

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
    cwd: REPO_ROOT,
    ...opts,
  });
  return result.ok || result.status === 0
    ? { ok: true, output: result.stdout?.trim() || '' }
    : { ok: false, output: '', error: result.stderr?.trim() || `exit ${result.status}` };
}

// ─── 1. Stale Local Branches ─────────────────────────────────────────────────

function pruneLocalBranches() {
  console.log('🔍 Checking stale local branches...');

  // Ensure we're on main
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch.output !== 'main') {
    console.log('   Skipping: not on main branch');
    return;
  }

  // Get all local branches
  const branches = git(['branch', '--format=%(refname:short)|%(committerdate:iso8601)']);
  if (!branches.ok) return;

  const main = 'main';
  const cutoff = Date.now() - BRANCH_STALE_DAYS * 86400000;

  for (const line of branches.output.split('\n')) {
    const [name, dateStr] = line.split('|');
    if (!name || name === main || name.startsWith('*')) continue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date.getTime() > cutoff) continue;

    // Check if branch is fully merged
    const merged = git(['branch', '--merged', main, name]);
    if (merged.ok && merged.output.includes(name)) {
      if (!DRY_RUN) {
        const del = git(['branch', '-D', name]);
        console.log(`   ${del.ok ? '✅ Deleted' : '❌ Failed'}: ${name}`);
      } else {
        console.log(`   [DRY RUN] Would delete: ${name}`);
      }
      results.deletions.push(`branch:${name}`);
    }
  }
}

// ─── 2. Remote Stale Branches ────────────────────────────────────────────────

async function pruneRemoteBranches() {
  console.log('\n🔍 Checking stale remote branches...');

  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) {
    console.log('   Skipping: GITHUB_REPOSITORY not set');
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('   Skipping: GITHUB_TOKEN not set');
    return;
  }

  try {
    // Fetch all remote branches via gh CLI (paginated — the first page alone
    // used to be capped at 100 names)
    const ghResult = spawnSync('gh', [
      'api',
      '--paginate',
      `/repos/${repo}/branches?per_page=100`,
      '--jq', '.[].name',
    ], { encoding: 'utf8', timeout: 60000 });

    if (ghResult.status !== 0) {
      console.log(`   GitHub API error: ${ghResult.stderr}`);
      return;
    }

    const allBranches = ghResult.stdout.trim().split('\n').filter(Boolean);
    const alwaysKeep = new Set(['main', 'feat/mini-program-foundation']);

    // Open pull requests are never safe to prune: deleting the head branch of
    // an open PR leaves it unmergeable (2026-11-04: this function deleted
    // `fix/shared-archetype-mix-test` while PR #658 was green and open).
    const openResult = spawnSync('gh', [
      'pr', 'list',
      '--repo', repo,
      '--state', 'open',
      '--limit', '200',
      '--json', 'headRefName',
    ], { encoding: 'utf8', timeout: 30000 });

    /** @type {Set<string>} */
    const openPrBranches = new Set();
    if (openResult.status === 0) {
      try {
        for (const pr of JSON.parse(openResult.stdout)) {
          if (pr.headRefName) openPrBranches.add(pr.headRefName);
        }
      } catch {}
    } else {
      // Fail closed: without the open-PR list we cannot prove a branch is safe.
      console.log('   Skipping: could not list open pull requests');
      return;
    }

    // Merged pull requests are the only reliable "this work landed" signal for
    // a squash-merging repo: the branch tip is never an ancestor of main.
    const mergedResult = spawnSync('gh', [
      'pr', 'list',
      '--repo', repo,
      '--state', 'merged',
      '--limit', '200',
      '--json', 'headRefName,mergedAt',
    ], { encoding: 'utf8', timeout: 30000 });

    /** @type {Map<string, number>} */
    const mergedAtByBranch = new Map();
    if (mergedResult.status === 0) {
      try {
        for (const pr of JSON.parse(mergedResult.stdout)) {
          const mergedTs = Date.parse(pr.mergedAt);
          if (pr.headRefName && Number.isFinite(mergedTs)) {
            mergedAtByBranch.set(pr.headRefName, mergedTs);
          }
        }
      } catch {}
    }

    const cutoff = Date.now() - BRANCH_STALE_DAYS * 86400000;

    let deleted = 0;
    let candidates = 0;
    for (const branch of allBranches) {
      if (alwaysKeep.has(branch)) continue;

      if (openPrBranches.has(branch)) {
        results.skipped.push(`remote-branch:${branch}`);
        continue;
      }

      const mergedTs = mergedAtByBranch.get(branch);
      const mergedByAncestry = git(['merge-base', '--is-ancestor', `origin/${branch}`, 'origin/main']).ok;

      // Neither signal means the branch still holds work main does not have.
      if (mergedTs === undefined && !mergedByAncestry) {
        results.skipped.push(`remote-branch:${branch}`);
        continue;
      }

      const tip = git(['log', '-1', '--format=%ct', `origin/${branch}`]);
      const tipTs = Number(tip.output) * 1000;
      if (!tip.ok || !Number.isFinite(tipTs) || tipTs <= 0) {
        results.skipped.push(`remote-branch:${branch}`);
        continue;
      }

      // A commit pushed after the merge means the branch outlived its PR.
      if (mergedTs !== undefined && tipTs > mergedTs + 60_000) {
        results.skipped.push(`remote-branch:${branch}`);
        continue;
      }

      const landedTs = mergedTs ?? tipTs;
      if (landedTs > cutoff) continue;

      candidates++;

      if (!DRY_RUN) {
        try {
          const delResult = spawnSync('gh', [
            'api',
            '-X', 'DELETE',
            `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
          ], { encoding: 'utf8', timeout: 15000 });

          if (delResult.status === 0 || delResult.status === 204) {
            console.log(`   ✅ Deleted remote: ${branch}`);
            results.deletions.push(`remote-branch:${branch}`);
            deleted++;
          } else {
            const msg = JSON.parse(delResult.stdout || '{}').message || delResult.stderr;
            console.log(`   ⚠️  Skipped: ${branch} (${msg})`);
            results.skipped.push(`remote-branch:${branch}`);
          }
        } catch {
          results.skipped.push(`remote-branch:${branch}`);
        }
      } else {
        console.log(`   [DRY RUN] Would delete remote: ${branch} (landed ${new Date(landedTs).toISOString()})`);
      }
    }

    if (DRY_RUN) {
      const protect = openPrBranches.size + alwaysKeep.size;
      console.log(`   Dry run: ${candidates} deletable remote branch(es); ${protect} protected by open PRs / always-keep`);
    } else {
      console.log(`   Deleted ${deleted} of ${candidates} deletable remote branch(es)`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
}

// ─── 3. Old Workflow Run Artifacts ───────────────────────────────────────────

async function pruneArtifacts() {
  console.log('\n🔍 Checking old workflow artifacts...');

  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) {
    console.log('   Skipping: GITHUB_REPOSITORY not set');
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('   Skipping: GITHUB_TOKEN not set');
    return;
  }

  try {
    // For simplicity, use artifacts API directly (paginated: the first page
    // alone is 100 entries and the repo has had 500+ artifacts)
    const artifactsResult = spawnSync('gh', [
      'api',
      '--paginate',
      `/repos/${repo}/actions/artifacts?per_page=100`,
      '--jq', '.artifacts[] | select(.expired == false) | "\\(.id)|\\(.name)|\\(.created_at)"',
    ], { encoding: 'utf8', timeout: 60000 });

    if (artifactsResult.status !== 0 && artifactsResult.status !== null) {
      console.log(`   gh API error: ${artifactsResult.stderr?.slice(0, 200)}`);
      return;
    }

    const cutoff = Date.now() - ARTIFACT_STALE_DAYS * 86400000;
    const lines = (artifactsResult.stdout || '').trim().split('\n').filter(Boolean);
    let expired = 0;

    for (const line of lines) {
      const [id, name, createdAt] = line.split('|');
      if (!id) continue;

      const created = new Date(createdAt);
      if (isNaN(created.getTime()) || created.getTime() > cutoff) continue;

      if (!DRY_RUN) {
        const delResult = spawnSync('gh', [
          'api',
          '-X', 'DELETE',
          `/repos/${repo}/actions/artifacts/${id}`,
        ], { encoding: 'utf8', timeout: 15000 });

        if (delResult.status === 0 || delResult.status === 204) {
          console.log(`   ✅ Deleted artifact: ${name} (${id})`);
          results.deletions.push(`artifact:${id}`);
          expired++;
        }
      } else {
        console.log(`   [DRY RUN] Would delete artifact: ${name} (${id}, created ${createdAt})`);
        expired++;
      }
    }

    if (expired === 0) {
      console.log(`   No expired artifacts found (>${ARTIFACT_STALE_DAYS}d)`);
    } else if (DRY_RUN) {
      console.log(`   Dry run: would delete ${expired} artifacts`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
}

// ─── 4. Repo-Memory Candidate Cleanup ────────────────────────────────────────

function pruneMemoryCandidates() {
  console.log('\n🔍 Checking repo-memory candidates...');

  const candidateDir = path.join(REPO_ROOT, 'repo-memory', 'candidates');
  if (!fs.existsSync(candidateDir)) {
    console.log('   No candidates directory');
    return;
  }

  const promotedDir = path.join(REPO_ROOT, 'repo-memory', 'promoted');
  const promotedFiles = new Set();
  if (fs.existsSync(promotedDir)) {
    const walk = (dir, prefix = '') => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(fullPath, rel);
        } else {
          promotedFiles.add(rel);
        }
      }
    };
    try { walk(promotedDir); } catch {}
  }

  const cutoff = Date.now() - MEMORY_CANDIDATE_STALE_DAYS * 86400000;
  let cleaned = 0;

  const entries = fs.readdirSync(candidateDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'README.md') continue;

    const fullPath = path.join(candidateDir, entry.name);

    // For directories, check if any file inside has been promoted
    if (entry.isDirectory()) {
      const walkDir = (dir, base) => {
        for (const sub of fs.readdirSync(dir, { withFileTypes: true })) {
          const subPath = path.join(dir, sub.name);
          const subRel = `${base}/${sub.name}`;
          if (sub.isDirectory()) {
            walkDir(subPath, subRel);
          } else {
            const stat = fs.statSync(subPath);
            if (stat.mtimeMs < cutoff) {
              const promoted = promotedFiles.has(entry.name) || [...promotedFiles].some(f => f.includes(entry.name));
              if (promoted || stat.mtimeMs < cutoff - 30 * 86400000) {
                results.deletions.push(`memory-candidate:${subRel}`);
                if (!DRY_RUN) {
                  fs.rmSync(subPath, { force: true });
                  cleaned++;
                }
              }
            }
          }
        }
      };
      walkDir(fullPath, entry.name);
    } else {
      const stat = fs.statSync(fullPath);

      if (stat.mtimeMs < cutoff) {
        const promoted = promotedFiles.has(entry.name);
        if (promoted || stat.mtimeMs < cutoff - 30 * 86400000) {
          results.deletions.push(`memory-candidate:${entry.name}`);
          if (!DRY_RUN) {
            fs.unlinkSync(fullPath);
            console.log(`   ✅ Deleted candidate: ${entry.name}`);
            cleaned++;
          } else {
            console.log(`   [DRY RUN] Would delete candidate: ${entry.name}`);
          }
        }
      }
    }
  }

  if (cleaned === 0 && DRY_RUN) {
    console.log(`   Dry run: candidates to clean`);
  }
}

// ─── 5. Old Reports ──────────────────────────────────────────────────────────

function pruneReports() {
  console.log('\n🔍 Checking old reports...');

  const reportsDir = path.join(REPO_ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) {
    console.log('   No reports directory');
    return;
  }

  const cutoff = Date.now() - REPORT_STALE_DAYS * 86400000;
  const preservedPatterns = [
    /audit/i, /reference/i, /analysis/i, /roadmap/i, /brief/i,
    /coordination/i, /naming/i, /brand/i,
  ];

  let cleaned = 0;
  const entries = fs.readdirSync(reportsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;

    const isPreserved = preservedPatterns.some(p => p.test(entry.name)) ||
      (entry.name.startsWith('digest-') && /digest-\d{4}-\d{2}-\d{2}\.md/.test(entry.name));

    if (isPreserved) continue;

    const fullPath = path.join(reportsDir, entry.name);
    const stat = fs.statSync(fullPath);

    if (stat.mtimeMs < cutoff) {
      results.deletions.push(`report:${entry.name}`);
      if (!DRY_RUN) {
        fs.unlinkSync(fullPath);
        console.log(`   ✅ Deleted old report: ${entry.name}`);
        cleaned++;
      } else {
        console.log(`   [DRY RUN] Would delete: ${entry.name}`);
      }
    }
  }

  if (cleaned === 0 && DRY_RUN) {
    console.log(`   No expired reports found (>${REPORT_STALE_DAYS}d)`);
  }
}

// ─── WeCom notification ──────────────────────────────────────────────────────

async function sendWeComReport() {
  if (!NOTIFY_WECOM) return;

  const totalDeleted = results.deletions.length;
  if (totalDeleted === 0 && DRY_RUN) {
    console.log('\n📱 Dry run, skipping WeCom notification');
    return;
  }

  const emoji = totalDeleted > 0 ? '🧹' : '✅';
  const lines = [
    `## ${emoji} JoyJoin 仓库清理报告 ${new Date().toISOString().split('T')[0]}`,
    '',
    `**模式:** ${DRY_RUN ? '🔍 干运行（预览）' : '🚀 实时执行'}`,
    `**清理项:** ${totalDeleted}`,
    `**跳过项:** ${results.skipped.length}`,
    '',
  ];

  if (results.deletions.length > 0) {
    lines.push('### 已删除');
    const grouped = {};
    for (const d of results.deletions) {
      const [type] = d.split(':');
      grouped[type] = (grouped[type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(grouped)) {
      const typeLabel = {
        branch: '本地分支',
        'remote-branch': '远程分支',
        artifact: 'CI 制品',
        'memory-candidate': '记忆候选',
        report: '旧报表',
      }[type] || type;
      lines.push(`- ${typeLabel}: ${count}`);
    }
  }

  if (results.skipped.length > 0) {
    lines.push('');
    lines.push('### 已跳过');
    const grouped = {};
    for (const s of results.skipped) {
      const [type] = s.split(':');
      grouped[type] = (grouped[type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(grouped)) {
      lines.push(`- ${type}: ${count}`);
    }
  }

  lines.push('');
  lines.push(`---`);
  lines.push(`> 由 auto-prune v${VERSION} 自动运行`);

  const content = lines.join('\n');
  const proc = spawnSync('node', [
    path.join(REPO_ROOT, 'scripts/wecom-notify.mjs'),
    '--markdown', content,
  ], {
    encoding: 'utf8',
    timeout: 15000,
  });

  if (proc.status === 0) {
    console.log('📱 WeCom prune report sent');
  } else {
    console.log(`⚠️  WeCom notify failed: ${proc.stderr || proc.stdout}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🧹 Auto-Prune v${VERSION}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (report only)' : 'LIVE (will delete)'}`);
  console.log(`   Scopes: branches(${BRANCH_STALE_DAYS}d) | artifacts(${ARTIFACT_STALE_DAYS}d) | memory(${MEMORY_CANDIDATE_STALE_DAYS}d) | reports(${REPORT_STALE_DAYS}d)`);
  console.log('');

  const doAll = !ONLY_BRANCHES && !ONLY_ARTIFACTS && !ONLY_MEMORY && !ONLY_REPORTS;

  if (doAll || ONLY_BRANCHES) {
    pruneLocalBranches();
  }

  if (doAll || ONLY_BRANCHES) {
    await pruneRemoteBranches();
  }
  if (doAll || ONLY_ARTIFACTS) {
    await pruneArtifacts();
  }

  if (doAll || ONLY_MEMORY) {
    pruneMemoryCandidates();
  }
  if (doAll || ONLY_REPORTS) {
    pruneReports();
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary: ${results.deletions.length} items ${DRY_RUN ? 'identified' : 'deleted'}, ${results.skipped.length} skipped`);
  console.log('='.repeat(50));

  await sendWeComReport();

  return results.deletions.length > 0 && DRY_RUN ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Prune fatal error:', err);
    process.exit(2);
  });
