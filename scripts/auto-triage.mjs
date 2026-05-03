#!/usr/bin/env node
/**
 * Auto-Triage — Automatic PR & Issue Labeler
 * ===========================================
 *
 * Automatically labels pull requests and issues based on:
 *   1. Changed file paths → area labels (area:server, area:mini-program, etc.)
 *   2. Title/body keywords → type labels (bug, enhancement, documentation)
 *   3. File patterns → special labels (migration, payment, auth, security)
 *
 * Usage:
 *   node scripts/auto-triage.mjs                          # scan all open PRs + issues
 *   node scripts/auto-triage.mjs --dry-run                # preview without applying
 *   node scripts/auto-triage.mjs --prs                    # only PRs
 *   node scripts/auto-triage.mjs --issues                 # only issues
 *   node scripts/auto-triage.mjs --wecom                  # notify WeCom
 *   node scripts/auto-triage.mjs --number 42 --type pr    # triage one item
 *
 * Exit codes:
 *   0 = completed (labels applied or nothing to do)
 *   1 = nothing to triage
 *   2 = error
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token (required)
 *   GITHUB_REPOSITORY     – "owner/repo" format (GitHub Actions)
 *   WECOM_BOT_KEY         – WeCom bot key (required with --wecom)
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const VERSION = '2026-05-03.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NOTIFY_WECOM = args.includes('--wecom');
const ONLY_PRS = args.includes('--prs');
const ONLY_ISSUES = args.includes('--issues');
const DO_ALL = !ONLY_PRS && !ONLY_ISSUES;

let targetedNumber = null;
let targetedType = null;
const numIdx = args.indexOf('--number');
if (numIdx !== -1 && numIdx + 1 < args.length) {
  targetedNumber = parseInt(args[numIdx + 1], 10);
}
const typeIdx = args.indexOf('--type');
if (typeIdx !== -1 && typeIdx + 1 < args.length) {
  targetedType = args[typeIdx + 1];
}

// ─── Label rules ─────────────────────────────────────────────────────────────

// Path → area label mapping (order matters — first match wins)
/** @type {{ patterns: RegExp[]; label: string; description: string }[]} */
const AREA_RULES = [
  { patterns: [/^apps\/server\/src\//, /^apps\/server\//], label: 'area:server', description: 'Server/API changes' },
  { patterns: [/^apps\/mini-program\//], label: 'area:mini-program', description: 'Mini Program (Taro) changes' },
  { patterns: [/^apps\/user-client\//, /^apps\/web\//], label: 'area:web', description: 'Web user client changes' },
  { patterns: [/^apps\/admin-client\//], label: 'area:admin', description: 'Admin portal changes' },
  { patterns: [/^packages\/shared\//], label: 'area:shared', description: 'Shared package changes' },
  { patterns: [/^docs\//, /\.md$/], label: 'area:docs', description: 'Documentation changes' },
  { patterns: [/^\.github\//, /^scripts\//, /Makefile/, /Dockerfile/], label: 'area:ci', description: 'CI/infra changes' },
  { patterns: [/^repo-memory\//], label: 'area:automations', description: 'Automation/memory changes' },
];

// Title/body keyword → type label
/** @type {{ keywords: RegExp[]; label: string }[]} */
const TYPE_RULES = [
  { keywords: [/^(fix|bug|hotfix|revert|regression|broke)/i, /\bbug\b/i, /\bfix\b/i], label: 'bug' },
  { keywords: [/^(feat|feature|add|implement|support)/i, /\bfeature\b/i, /\bnew\b/i], label: 'enhancement' },
  { keywords: [/^(docs|document|readme)/i, /\bdoc(s|umentation)?\b/i], label: 'documentation' },
  { keywords: [/^(refactor|clean|move|rename|organi)/i, /\brefactor\b/i], label: 'refactor' },
  { keywords: [/^(test|spec)/i, /\btest(s|ing)?\b/i], label: 'test' },
  { keywords: [/^(chore|deps|bump|upgrade|update dep)/i, /\bdependenc(y|ies)\b/i, /\bupgrade\b/i], label: 'dependencies' },
  { keywords: [/^(perf|performance|speed|optimize)/i, /\bperformance\b/i, /\boptimize\b/i], label: 'performance' },
  { keywords: [/\bsecurity\b/i, /\bvulnerab/i], label: 'security' },
];

// File-specific annotations (applied in addition to area/type labels)
/** @type {{ patterns: RegExp[]; label: string }[]} */
const ANNOTATION_RULES = [
  { patterns: [/packages\/shared\/src\/schema\.ts/], label: 'migration' },
  { patterns: [/apps\/server\/src\/routes\/.*payment/i, /WeChatPay/i, /payments?\.ts/], label: 'payments' },
  { patterns: [/apps\/server\/src\/lib\/adminAuditLogger/i, /adminAudit/], label: 'admin-audit' },
  { patterns: [/\bpersonality\b/i, /archetype/i, /ACOEXP/i], label: 'personality' },
  { patterns: [/\bicebreaker\b/i, /social-icebreaker/i], label: 'icebreaker' },
  { patterns: [/\bonboarding\b/i], label: 'onboarding' },
  { patterns: [/\bmatching\b/i, /poolMatchingService/i], label: 'matching' },
];

/** @type {{ keywords: RegExp[]; label: string }[]} */
const ISSUE_TYPE_RULES = [
  { keywords: [/\bbug\b/i, /\bissue\b/i, /\berror\b/i, /\bfail\b/i, /\bcrash\b/i, /\bnot working\b/i, /\bdoesn.?t\b/i], label: 'bug' },
  { keywords: [/\bfeature\b/i, /\brequest\b/i, /\b希望\b/i, /\b希望增加\b/i, /\badd\b/i, /\bsupport\b/i, /\benhancement\b/i, /\bwould be nice\b/i], label: 'enhancement' },
  { keywords: [/\bdoc\b/i, /\breadme\b/i, /\b文档\b/i], label: 'documentation' },
  { keywords: [/\bquestion\b/i, /\bhow\b/i, /\b请问\b/i, /\bcan you\b/i, /\bis it possible\b/i, /\bhelp\b/i], label: 'question' },
  { keywords: [/\bsecurity\b/i, /\bvulnerab\b/i], label: 'security' },
  { keywords: [/\bperformance\b/i, /\bslow\b/i, /\b卡\b/i, /\b慢\b/i], label: 'performance' },
  { keywords: [/\bgood first\b/i, /\bbeginner\b/i, /\bnewbie\b/i, /\b新手\b/i], label: 'good first issue' },
];

// ─── GitHub API wrappers ─────────────────────────────────────────────────────

/**
 * @param {string} endpoint - GitHub API endpoint (e.g., '/repos/owner/repo/pulls')
 * @param {{ method?: string; body?: object }} [opts]
 * @returns {{ ok: boolean; data: any; error?: string }}
 */
function ghApi(endpoint, opts = {}) {
  const cmd = ['api', endpoint];
  if (opts.method) cmd.push('-X', opts.method);
  if (opts.body) cmd.push('--input', '-');

  const result = spawnSync('gh', cmd, {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
    input: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (result.status !== 0 && result.status !== null) {
    return { ok: false, data: null, error: result.stderr?.trim() || `exit ${result.status}` };
  }

  try {
    return { ok: true, data: JSON.parse(result.stdout || '{}') };
  } catch {
    return { ok: true, data: result.stdout };
  }
}

// ─── Label management ────────────────────────────────────────────────────────

/** @type {Set<string> | null} */
let existingLabels = null;

function getExistingLabels() {
  if (existingLabels) return existingLabels;

  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) return new Set();

  const result = ghApi(`/repos/${repo}/labels?per_page=100`);
  existingLabels = new Set();
  if (result.ok && Array.isArray(result.data)) {
    for (const l of result.data) {
      existingLabels.add(l.name);
    }
  }
  return existingLabels;
}

/**
 * Create a label if it doesn't exist.
 */
function ensureLabel(name, color, description = '') {
  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) return;

  const labels = getExistingLabels();
  if (labels.has(name)) return;

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would create label: ${name}`);
    return;
  }

  ghApi(`/repos/${repo}/labels`, {
    method: 'POST',
    body: { name, color, description },
  });
  labels.add(name);
  console.log(`   🏷️  Created label: ${name}`);
}

// ─── PR triage ───────────────────────────────────────────────────────────────

/**
 * @param {{ number: number; title: string; body: string | null; labels: { name: string }[]; files?: string[] }} pr
 * @returns {string[]} labels to add
 */
function triagePR(pr) {
  const labelsToAdd = [];
  const existing = new Set(pr.labels.map(l => l.name));
  const files = pr.files || [];
  const title = pr.title || '';
  const body = pr.body || '';

  // Area labels from file paths
  for (const rule of AREA_RULES) {
    const matched = files.some(f => rule.patterns.some(p => p.test(f)));
    if (matched && !existing.has(rule.label)) {
      labelsToAdd.push(rule.label);
      break; // first match only for area
    }
  }

  // Type labels from title/body
  const combined = `${title}\n${body}`;
  for (const rule of TYPE_RULES) {
    const matched = rule.keywords.some(k => k.test(combined));
    if (matched && !existing.has(rule.label)) {
      labelsToAdd.push(rule.label);
      break; // first match only for type
    }
  }

  // Annotation labels from title + file paths
  for (const rule of ANNOTATION_RULES) {
    const fileMatch = files.some(f => rule.patterns.some(p => p.test(f)));
    const titleMatch = rule.patterns.some(p => p.test(combined));
    if ((fileMatch || titleMatch) && !existing.has(rule.label)) {
      labelsToAdd.push(rule.label);
    }
  }

  return labelsToAdd;
}

// ─── Issue triage ────────────────────────────────────────────────────────────

/**
 * @param {{ number: number; title: string; body: string | null; labels: { name: string }[] }} issue
 * @returns {string[]} labels to add
 */
function triageIssue(issue) {
  const labelsToAdd = [];
  const existing = new Set(issue.labels.map(l => l.name));
  const combined = `${issue.title}\n${issue.body || ''}`;

  for (const rule of ISSUE_TYPE_RULES) {
    const matched = rule.keywords.some(k => k.test(combined));
    if (matched && !existing.has(rule.label)) {
      labelsToAdd.push(rule.label);
      break;
    }
  }

  return labelsToAdd;
}

// ─── Main triage logic ───────────────────────────────────────────────────────

/**
 * @returns {Promise<{prResults: {number:number,labels:string[]}[], issueResults: {number:number,labels:string[]}[]}>}
 */
async function runTriage() {
  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) {
    console.error('❌ GITHUB_REPOSITORY is required');
    process.exit(2);
  }

  /** @type {{number:number,labels:string[]}[]} */
  const prResults = [];
  /** @type {{number:number,labels:string[]}[]} */
  const issueResults = [];

  const NEEDED_LABELS = [
    { name: 'area:server', color: '0366d6', desc: 'Server/API changes' },
    { name: 'area:mini-program', color: '0e8a16', desc: 'Mini Program (Taro) changes' },
    { name: 'area:web', color: 'fbca04', desc: 'Web user client changes' },
    { name: 'area:admin', color: 'd876e3', desc: 'Admin portal changes' },
    { name: 'area:shared', color: '5319e7', desc: 'Shared package changes' },
    { name: 'area:docs', color: '0075ca', desc: 'Documentation changes' },
    { name: 'area:ci', color: 'b60205', desc: 'CI/infra changes' },
    { name: 'area:automations', color: '1d76db', desc: 'Automation/memory changes' },
    { name: 'refactor', color: 'c5def5', desc: 'Code refactoring' },
    { name: 'test', color: '1d76db', desc: 'Testing changes' },
    { name: 'dependencies', color: 'ededed', desc: 'Dependency updates' },
    { name: 'performance', color: 'e99695', desc: 'Performance improvements' },
    { name: 'security', color: 'b60205', desc: 'Security-related changes' },
    { name: 'migration', color: '0052cc', desc: 'Database migration' },
    { name: 'payments', color: '00b33b', desc: 'Payment-related changes' },
    { name: 'admin-audit', color: 'c2e0c6', desc: 'Admin audit logging' },
    { name: 'personality', color: 'fef2c0', desc: 'Personality/archetype' },
    { name: 'icebreaker', color: 'bfdadc', desc: 'Icebreaker/social' },
    { name: 'onboarding', color: 'cc317c', desc: 'Onboarding flow' },
    { name: 'matching', color: '0e8a16', desc: 'Matching algorithm' },
  ];

  for (const l of NEEDED_LABELS) {
    ensureLabel(l.name, l.color, l.desc);
  }

  // ─── PRs ───────────────────────────────────────────────────────────────────
  if (DO_ALL || ONLY_PRS) {
    console.log('🔍 Scanning open pull requests...');

    if (targetedNumber && targetedType === 'pr') {
      const prQuery = ghApi(`/repos/${repo}/pulls/${targetedNumber}`);
      if (prQuery.ok && prQuery.data) {
        const pr = prQuery.data;
        const filesResult = ghApi(`/repos/${repo}/pulls/${pr.number}/files?per_page=100`);
        const files = filesResult.ok && Array.isArray(filesResult.data)
          ? filesResult.data.map(f => f.filename)
          : [];

        const toAdd = triagePR({
          number: pr.number,
          title: pr.title,
          body: pr.body,
          labels: pr.labels || [],
          files,
        });

        if (toAdd.length > 0) {
          if (!DRY_RUN) {
            ghApi(`/repos/${repo}/issues/${pr.number}/labels`, {
              method: 'POST',
              body: { labels: toAdd },
            });
          }
          console.log(`   PR #${pr.number} → ${toAdd.join(', ')} ${DRY_RUN ? '[DRY RUN]' : '✅'}`);
          prResults.push({ number: pr.number, labels: toAdd });
        } else {
          console.log(`   PR #${pr.number} → already labeled`);
        }
      }
    } else {
      let page = 1;
      let totalScanned = 0;
      let totalLabeled = 0;

      while (true) {
        const pullsResult = ghApi(`/repos/${repo}/pulls?state=open&per_page=50&page=${page}`);
        if (!pullsResult.ok || !Array.isArray(pullsResult.data) || pullsResult.data.length === 0) break;

        for (const pr of pullsResult.data) {
          totalScanned++;

          const filesResult = ghApi(`/repos/${repo}/pulls/${pr.number}/files?per_page=100`);
          const files = filesResult.ok && Array.isArray(filesResult.data)
            ? filesResult.data.map(f => f.filename)
            : [];

          const toAdd = triagePR({
            number: pr.number,
            title: pr.title,
            body: pr.body,
            labels: pr.labels || [],
            files,
          });

          if (toAdd.length > 0) {
            if (!DRY_RUN) {
              ghApi(`/repos/${repo}/issues/${pr.number}/labels`, {
                method: 'POST',
                body: { labels: toAdd },
              });
            }
            console.log(`   PR #${pr.number}: "${pr.title.slice(0, 60)}" → ${toAdd.join(', ')} ${DRY_RUN ? '[DRY RUN]' : '✅'}`);
            prResults.push({ number: pr.number, labels: toAdd });
            totalLabeled++;
          }
        }

        if (pullsResult.data.length < 50) break;
        page++;
      }

      console.log(`   PRs scanned: ${totalScanned}, labeled: ${totalLabeled}`);
    }
  }

  // ─── Issues ────────────────────────────────────────────────────────────────
  if (DO_ALL || ONLY_ISSUES) {
    console.log('\n🔍 Scanning open issues (excluding PRs)...');

    let page = 1;
    let totalScanned = 0;
    let totalLabeled = 0;

    if (targetedNumber && targetedType === 'issue') {
      const issueResult = ghApi(`/repos/${repo}/issues/${targetedNumber}`);
      if (issueResult.ok && issueResult.data && !issueResult.data.pull_request) {
        const issue = issueResult.data;
        const toAdd = triageIssue({
          number: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels || [],
        });

        if (toAdd.length > 0) {
          if (!DRY_RUN) {
            ghApi(`/repos/${repo}/issues/${issue.number}/labels`, {
              method: 'POST',
              body: { labels: toAdd },
            });
          }
          console.log(`   Issue #${issue.number} → ${toAdd.join(', ')} ${DRY_RUN ? '[DRY RUN]' : '✅'}`);
          issueResults.push({ number: issue.number, labels: toAdd });
        }
      }
    } else {
      while (true) {
        const issuesResult = ghApi(`/repos/${repo}/issues?state=open&per_page=50&page=${page}&filter=all`);
        if (!issuesResult.ok || !Array.isArray(issuesResult.data) || issuesResult.data.length === 0) break;

        for (const issue of issuesResult.data) {
          if (issue.pull_request) continue;
          totalScanned++;

          const toAdd = triageIssue({
            number: issue.number,
            title: issue.title,
            body: issue.body,
            labels: issue.labels || [],
          });

          if (toAdd.length > 0) {
            if (!DRY_RUN) {
              ghApi(`/repos/${repo}/issues/${issue.number}/labels`, {
                method: 'POST',
                body: { labels: toAdd },
              });
            }
            console.log(`   Issue #${issue.number}: "${issue.title.slice(0, 60)}" → ${toAdd.join(', ')} ${DRY_RUN ? '[DRY RUN]' : '✅'}`);
            issueResults.push({ number: issue.number, labels: toAdd });
            totalLabeled++;
          }
        }

        if (issuesResult.data.length < 50) break;
        page++;
      }

      console.log(`   Issues scanned: ${totalScanned}, labeled: ${totalLabeled}`);
    }
  }

  return { prResults, issueResults };
}

// ─── WeCom notification ─────────────────────────────────────────────────────

async function sendWeComReport(prResults, issueResults) {
  if (!NOTIFY_WECOM) return;

  const totalPRs = prResults.length;
  const totalIssues = issueResults.length;
  const totalItems = totalPRs + totalIssues;

  if (totalItems === 0) {
    console.log('\n📱 No items to report, skipping WeCom');
    return;
  }

  const emoji = totalItems > 5 ? '📋' : '✅';
  const date = new Date().toISOString().split('T')[0];

  const lines = [
    `## ${emoji} JoyJoin 自动分类报告 ${date}`,
    '',
    `**模式:** ${DRY_RUN ? '🔍 预览' : '🚀 已应用'}`,
    `**已分类:** ${totalPRs} PR${totalPRs !== 1 ? 's' : ''} + ${totalIssues} Issue${totalIssues !== 1 ? 's' : ''}`,
    '',
  ];

  if (prResults.length > 0) {
    lines.push('### PR 分类');
    for (const p of prResults) {
      lines.push(`- PR #${p.number} → ${p.labels.join(', ')}`);
    }
  }

  if (issueResults.length > 0) {
    lines.push('');
    lines.push('### Issue 分类');
    for (const i of issueResults) {
      lines.push(`- Issue #${i.number} → ${i.labels.join(', ')}`);
    }
  }

  lines.push('');
  lines.push(`---`);
  lines.push(`> 由 auto-triage v${VERSION} 自动运行`);

  const proc = spawnSync('node', [
    path.join(REPO_ROOT, 'scripts/wecom-notify.mjs'),
    '--markdown', lines.join('\n'),
  ], {
    encoding: 'utf8',
    timeout: 15000,
  });

  if (proc.status === 0) {
    console.log('📱 WeCom triage report sent');
  } else {
    console.log(`⚠️  WeCom notify failed: ${proc.stderr || proc.stdout}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🏷️  Auto-Triage v${VERSION}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will apply labels)'}`);
  console.log(`   Scopes: ${DO_ALL ? 'PRs + Issues' : ONLY_PRS ? 'PRs only' : 'Issues only'}`);
  if (targetedNumber) console.log(`   Target: ${targetedType} #${targetedNumber}`);
  console.log('');

  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!repo) {
    console.error('❌ GITHUB_REPOSITORY is required (set in GitHub Actions or export locally)');
    process.exit(2);
  }

  const { prResults, issueResults } = await runTriage();

  const total = prResults.length + issueResults.length;
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary: ${total} items labeled (${prResults.length} PRs, ${issueResults.length} issues)`);
  console.log('='.repeat(50));

  await sendWeComReport(prResults, issueResults);

  return total === 0 ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Triage fatal error:', err);
    process.exit(2);
  });
