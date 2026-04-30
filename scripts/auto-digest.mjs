#!/usr/bin/env node
/**
 * Auto-Digest — Daily Engineering Digest
 * =========================================
 *
 * Produces a concise, high-signal summary of what changed in the last 24 hours.
 * Clusters commits and PRs into themes, highlights risks, and sends to WeCom.
 *
 * Usage:
 *   node scripts/auto-digest.mjs                         # last 24h
 *   node scripts/auto-digest.mjs --hours 48              # custom window
 *   node scripts/auto-digest.mjs --since "2026-04-29"    # since date
 *   node scripts/auto-digest.mjs --wecom                 # notify WeCom
 *
 * Exit codes:
 *   0 = digest published
 *   1 = no changes in period
 *   2 = error
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token for PR queries (required)
 *   GITHUB_REPOSITORY     – "owner/repo" format (GitHub Actions)
 *   WECOM_BOT_KEY         – WeCom bot key (required with --wecom)
 *   DEEPSEEK_API_KEY      – For LLM-enhanced digest (optional, uses template if absent)
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { callDeepSeek } from './automation-llm.mjs';

const VERSION = '2026-05-01.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_HOURS = 24;

const args = process.argv.slice(2);
const flags = {
  hours: DEFAULT_HOURS,
  since: null,     /** @type {string|null} */
  wecom: false,
  verbose: false,
  pr: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--hours' && i + 1 < args.length) flags.hours = parseInt(args[++i], 10);
  else if (args[i] === '--since' && i + 1 < args.length) flags.since = args[++i];
  else if (args[i] === '--wecom') flags.wecom = true;
  else if (args[i] === '--verbose') flags.verbose = true;
  else if (args[i] === '--pr') flags.pr = true;
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
    ...opts,
  });
  if (result.status !== 0 && result.status !== null) {
    return { ok: false, output: '', error: result.stderr?.trim() || `exit ${result.status}` };
  }
  return { ok: true, output: result.stdout?.trim() || '' };
}

function gh(args, opts = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
    ...opts,
  });
  if (result.status !== 0 && result.status !== null) {
    return { ok: false, output: '', error: result.stderr?.trim() || `exit ${result.status}` };
  }
  return { ok: true, output: result.stdout?.trim() || '' };
}

/**
 * @returns {Promise<{commits: Array<{hash:string,date:string,author:string,subject:string,files:string[]}>, prs: Array<{number:number,title:string,author:string,mergedAt:string,labels:string[]}>}>}
 */
async function collectChanges() {
  const sinceDate = flags.since || new Date(Date.now() - flags.hours * 3600000).toISOString().split('T')[0];
  const since = flags.since ? `${flags.since}T00:00:00Z` : new Date(Date.now() - flags.hours * 3600000).toISOString();

  // 1. Commits
  const logFmt = '%H||%ai||%an||%s';
  const logResult = git(['log', `--since=${since}`, `--format=${logFmt}`, '--no-merges']);
  const commits = logResult.ok && logResult.output
    ? logResult.output.split('\n').filter(Boolean).map(line => {
        const [hash, date, author, ...rest] = line.split('||');
        return { hash, date, author, subject: rest.join('||') };
      })
    : [];

  // Get file stats for each commit
  for (const c of commits) {
    const filesResult = git(['diff-tree', '--no-commit-id', '--name-only', '-r', c.hash]);
    c.files = filesResult.ok ? filesResult.output.split('\n').filter(Boolean) : [];
  }

  // 2. Merged PRs
  const repo = process.env.GITHUB_REPOSITORY || '';
  const prs = [];

  if (repo) {
    const token = process.env.GITHUB_TOKEN;
    if (token || flags.verbose) {
      // Use gh CLI to list recently merged PRs
      const ghResult = gh([
        'pr', 'list',
        '--repo', repo,
        '--state', 'merged',
        '--limit', '20',
        '--json', 'number,title,author,mergedAt,labels,url',
        '--search', `merged:>=${sinceDate}`,
      ]);
      if (ghResult.ok && ghResult.output) {
        try {
          const parsed = JSON.parse(ghResult.output);
          for (const pr of parsed) {
            prs.push({
              number: pr.number,
              title: pr.title,
              author: pr.author?.login || 'unknown',
              mergedAt: pr.mergedAt,
              labels: (pr.labels || []).map(l => l.name),
              url: pr.url,
            });
          }
        } catch {}
      }
    }
  }

  return { commits, prs };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeStats(commits, prs) {
  const authorCommits = new Map();
  for (const c of commits) {
    authorCommits.set(c.author, (authorCommits.get(c.author) || 0) + 1);
  }

  // File type breakdown
  const fileTypes = new Map();
  for (const c of commits) {
    for (const f of c.files) {
      const ext = path.extname(f) || '(root)';
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
    }
  }

  // Author PRs
  const authorPRs = new Map();
  for (const pr of prs) {
    authorPRs.set(pr.author, (authorPRs.get(pr.author) || 0) + 1);
  }

  // Modified dirs
  const dirs = new Map();
  for (const c of commits) {
    for (const f of c.files) {
      const dir = path.dirname(f);
      dirs.set(dir, (dirs.get(dir) || 0) + 1);
    }
  }
  const topDirs = [...dirs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return {
    totalCommits: commits.length,
    totalPRs: prs.length,
    totalFiles: new Set(commits.flatMap(c => c.files)).size,
    authors: [...authorCommits.keys()],
    topDirs,
    fileTypes: [...fileTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    authorCommitCounts: [...authorCommits.entries()].sort((a, b) => b[1] - a[1]),
    authorPRCounts: [...authorPRs.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ─── LLM digest generation ────────────────────────────────────────────────────

/**
 * @param {{ commits: any[], prs: any[] }} changes
 * @param {ReturnType<computeStats>} stats
 * @returns {Promise<string>}
 */
async function generateDigest(changes, stats) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // Build context for LLM
  const commitLines = changes.commits.slice(0, 30).map(c =>
    `  [${c.hash.slice(0, 8)}] ${c.subject} (${c.author}, ${c.files.length} files)`
  ).join('\n');

  const prLines = changes.prs.slice(0, 15).map(p =>
    `  PR #${p.number}: ${p.title} (${p.author}, labels: ${p.labels.join(', ') || 'none'})`
  ).join('\n');

  const dirLines = stats.topDirs.map(([dir, count]) =>
    `  ${dir} (${count} changes)`
  ).join('\n');

  if (apiKey) {
    const systemPrompt = `你是一个工程团队的每日摘要编辑。根据以下全天变更数据，生成一份简洁的工程日报。

要求：
- 用中文撰写
- 3-7 个要点，涵盖最重要的变更
- 将相关变更聚类成主题（例如"匹配算法优化"、"Icebreaker 修复"）
- 每个要点需引用具体的 commit hash 或 PR 号
- "Watchlist"部分列出 1-3 个值得关注的风险或待办事项
- 优先信号密度，不要追求完整列表
- 易于快速浏览

格式：
## 📋 JoyJoin 工程日报 YYYY-MM-DD

**覆盖时段:** ...
**提交:** N | **PR:** N | **涉及作者:** N | **变更文件:** N

### 关键变更
- [主题] 具体变更描述 (commit/PR引用)

### Watchlist
- ⚠️ 风险项...

---

### 数据源
提交：${changes.commits.length} | PR：${changes.prs.length} | 作者：${stats.authors.length}`;

    const userPrompt = `## 提交历史（最近 ${changes.commits.length} 个）
${commitLines}

## 合并的 PR（最近 ${changes.prs.length} 个）
${prLines}

## 变更热点目录
${dirLines}

## 作者统计
${stats.authorCommitCounts.map(([a, c]) => `  ${a}: ${c} commits`).join('\n')}`;

    const result = await callDeepSeek({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tier: 'flash',
      temperature: 0.3,
      maxTokens: 2048,
      callerTag: 'auto-digest',
    });

    if (result.ok && result.content.length > 50) {
      return result.content;
    }
  }

  // Fallback: template digest
  return generateFallbackDigest(changes, stats);
}

function generateFallbackDigest(changes, stats) {
  const date = new Date().toISOString().split('T')[0];
  const sinceStr = flags.since || `${date} (last ${flags.hours}h)`;

  const lines = [
    `## 📋 JoyJoin 工程日报 ${date}`,
    '',
    `**覆盖时段:** ${sinceStr}`,
    `**提交:** ${stats.totalCommits} | **PR:** ${stats.totalPRs} | **作者:** ${stats.authors.length} | **变更文件:** ${stats.totalFiles}`,
    '',
    '### 关键变更',
  ];

  // Group commits by author for bullet points
  const authorGroups = new Map();
  for (const c of changes.commits) {
    if (!authorGroups.has(c.author)) authorGroups.set(c.author, []);
    authorGroups.get(c.author).push(c);
  }

  for (const [author, commits] of authorGroups) {
    const subjects = commits.map(c => c.subject).join('; ');
    lines.push(`- ${author} (${commits.length} commits): ${subjects}`);
  }

  if (changes.prs.length > 0) {
    lines.push('');
    lines.push('### 合并的 PR');
    for (const pr of changes.prs) {
      lines.push(`- PR [#${pr.number}](${pr.url}): ${pr.title} — ${pr.author}`);
    }
  }

  lines.push('');
  lines.push('### Watchlist');
  lines.push('- 无自动识别的风险项');

  lines.push('');
  lines.push('---');
  lines.push(`> 由 auto-digest v${VERSION} 自动生成 | ${changes.commits.length} commits, ${changes.prs.length} PRs`);

  return lines.join('\n');
}

// ─── WeCom notification ──────────────────────────────────────────────────────

async function sendWeComDigest(digestContent) {
  // The digest is already in markdown; prefix for WeCom
  const proc = spawnSync('node', [
    'scripts/wecom-notify.mjs',
    '--markdown',
    digestContent,
  ], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env },
  });

  if (proc.status !== 0) {
    console.error(`⚠️ WeCom digest notification failed: ${proc.stderr || proc.stdout}`);
    return false;
  }
  console.log('📱 WeCom digest sent');
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📋 Auto-Digest v${VERSION}`);
  console.log(`   Window: ${flags.since || `last ${flags.hours}h`}`);
  console.log('');

  // 1. Collect changes
  console.log('📡 Collecting commits and PRs...');
  const { commits, prs } = await collectChanges();

  if (commits.length === 0 && prs.length === 0) {
    console.log('✅ No changes in the period.');
    return 0;
  }

  console.log(`   ${commits.length} commits, ${prs.length} merged PRs`);

  // 2. Compute stats
  const stats = computeStats(commits, prs);

  if (flags.verbose) {
    console.log('\n📊 Stats:');
    console.log(`   Files changed: ${stats.totalFiles}`);
    console.log(`   Authors: ${stats.authors.join(', ')}`);
    console.log(`   Top directories:`);
    for (const [dir, count] of stats.topDirs) {
      console.log(`     ${dir} (${count})`);
    }
  }

  // 3. Generate digest
  console.log('\n✍️  Generating digest...');
  const digest = await generateDigest({ commits, prs }, stats);
  console.log('\n' + '='.repeat(50));
  console.log(digest);
  console.log('='.repeat(50));

  // 4. Save report
  const date = new Date().toISOString().split('T')[0];
  const reportDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `digest-${date}.md`);
  fs.writeFileSync(reportPath, digest);
  console.log(`\n📝 Report saved: ${reportPath}`);

  // 5. WeCom notification
  if (flags.wecom) {
    console.log('\n📱 Sending digest to WeCom...');
    await sendWeComDigest(digest);
  }

  return 1;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Digest fatal error:', err);
    process.exit(2);
  });
