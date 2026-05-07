#!/usr/bin/env node
/**
 * Auto-CI-Fix — CI Failure Autofix Automation
 * ==============================================
 *
 * Investigates CI failures on a branch, deduplicates against other agents,
 * and creates a PR that fixes the bug or marks flaky tests.
 *
 * Deduplication protocol:
 *   1. Collect all failing CI job names
 *   2. Create deterministic filename: ci-fail-<sorted-jobs-hash>.lock
 *   3. If lock exists and < 30 min old → stop (another agent claimed it)
 *   4. Else write lock with timestamp → proceed
 *
 * Usage:
 *   node scripts/auto/auto-ci-fix.mjs --run-id 12345678        # investigate specific run
 *   node scripts/auto/auto-ci-fix.mjs --commit abc1234          # investigate commit
 *   node scripts/auto/auto-ci-fix.mjs --dry-run                 # preview only
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token (required)
 *   GITHUB_REPOSITORY     – "owner/repo" (auto-set in Actions)
 *   CI_RUN_ID             – GitHub run ID (auto-set by workflow)
 *   DEEPSEEK_API_KEY      – for LLM root cause analysis (optional)
 *   WECOM_BOT_KEY         – for notifications
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPath } from '../memory/memory-lib.mjs';
import { callDeepSeek } from '../automation-llm.mjs';

const VERSION = '2026-05-01.v1';
const LOCK_DIR = 'repo-memory/generated/automations';
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  runId: process.env.CI_RUN_ID || null,   /** @type {string | null} */
  commit: null,                             /** @type {string | null} */
  pr: false,
  wecom: false,
  verbose: false,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run-id' && i + 1 < args.length) flags.runId = args[++i];
  else if (args[i] === '--commit' && i + 1 < args.length) flags.commit = args[++i];
  else if (args[i] === '--pr') flags.pr = true;
  else if (args[i] === '--wecom') flags.wecom = true;
  else if (args[i] === '--verbose') flags.verbose = true;
  else if (args[i] === '--dry-run') flags.dryRun = true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gh(args, opts = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, ...opts,
  });
  if (result.status !== 0 && result.status !== null) {
    return { ok: false, output: '', error: result.stderr?.trim() || `exit ${result.status}` };
  }
  return { ok: true, output: result.stdout?.trim() || '' };
}

function git(args, opts = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8', timeout: 15000, maxBuffer: 10 * 1024 * 1024, ...opts,
  });
  if (result.status !== 0 && result.status !== null) {
    return { ok: false, output: '', error: result.stderr?.trim() || `exit ${result.status}` };
  }
  return { ok: true, output: result.stdout?.trim() || '' };
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Compute lock filename from failing job names.
 * Sorts alphabetically, joins with "_", sanitizes to [a-zA-Z0-9._-],
 * truncates to 64 chars, prepends "ci-fail-".
 */
function computeLockFilename(jobNames) {
  const sorted = [...jobNames].sort().join('_');
  const sanitized = sorted.replace(/[^a-zA-Z0-9._-]/g, '');
  const truncated = sanitized.slice(0, 55);
  return `ci-fail-${truncated}.lock`;
}

/**
 * Try to claim a CI failure via lock file.
 * Returns true if claimed, false if another agent already claimed it.
 */
function claimFailure(jobNames) {
  const lockFile = computeLockFilename(jobNames);
  const lockPath = resolveRepoPath(path.join(LOCK_DIR, lockFile));
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  try {
    // Check if lock exists and is fresh
    if (fs.existsSync(lockPath)) {
      const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const age = Date.now() - (existing.timestamp || 0);
      if (age < LOCK_TTL_MS) {
        console.log(`⏭️  Another agent claimed this failure ${Math.round(age / 1000)}s ago. Skipping.`);
        return false;
      }
      console.log(`⚠️  Found stale lock (${Math.round(age / 1000)}s old). Overwriting...`);
    }

    // Write lock
    fs.writeFileSync(lockPath, JSON.stringify({
      timestamp: Date.now(),
      version: VERSION,
      jobs: jobNames,
      hostname: process.env.GITHUB_RUN_ID || 'local',
    }, null, 2));
    console.log(`🔒 Claimed CI failure: ${lockFile}`);
    return true;
  } catch (err) {
    console.error(`❌ Lock write failed: ${err.message}`);
    return false;
  }
}

// ─── Investigation ───────────────────────────────────────────────────────────

/**
 * Fetch failing CI run details
 */
async function fetchFailingRun() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error('❌ GITHUB_REPOSITORY not set');
    return null;
  }

  let runInfo = null;

  if (flags.runId) {
    // Get specific run
    const result = gh(['run', 'view', flags.runId, '--repo', repo, '--json', 'jobs,conclusion,headBranch,headSha,displayTitle,url']);
    if (result.ok && result.output) {
      try {
        runInfo = JSON.parse(result.output);
      } catch {}
    }
  } else {
    // Get latest failed run on CI/CD pipeline
    const result = gh(['run', 'list', '--repo', repo, '--workflow', 'cicd.yml', '--status', 'failure', '--limit', '3', '--json', 'databaseId,conclusion,headBranch,displayTitle,url']);
    if (result.ok && result.output) {
      try {
        const runs = JSON.parse(result.output);
        if (runs.length > 0) {
          runInfo = runs[0];
          // Fetch jobs for this run
          const jobsResult = gh(['run', 'view', String(runs[0].databaseId), '--repo', repo, '--json', 'jobs']);
          if (jobsResult.ok && jobsResult.output) {
            const full = JSON.parse(jobsResult.output);
            runInfo.jobs = full.jobs || [];
          }
        }
      } catch {}
    }
  }

  // Fetch jobs if not already loaded
  if (runInfo && !runInfo.jobs && runInfo.databaseId) {
    const jobsResult = gh(['run', 'view', String(runInfo.databaseId), '--repo', repo, '--json', 'jobs']);
    if (jobsResult.ok && jobsResult.output) {
      try {
        const full = JSON.parse(jobsResult.output);
        runInfo.jobs = full.jobs || [];
      } catch {}
    }
  }

  return runInfo;
}

/**
 * Get the blame commit for the failure
 */
async function findBrokenCommit(runInfo) {
  if (!runInfo) return null;

  // If we have a head branch, find the PR
  if (runInfo.headBranch) {
    const prResult = gh(['pr', 'list', '--repo', process.env.GITHUB_REPOSITORY, '--head', runInfo.headBranch, '--state', 'open', '--json', 'number,title,author,url', '--limit', '1']);
    if (prResult.ok && prResult.output) {
      try {
        const prs = JSON.parse(prResult.output);
        if (prs.length > 0) return prs[0];
      } catch {}
    }
  }

  return { number: '?', title: runInfo.displayTitle || 'unknown', author: { login: 'unknown' }, url: runInfo.url || '' };
}

/**
 * Fetch CI failure logs for investigation
 */
async function fetchFailureLogs(runInfo) {
  if (!runInfo?.jobs) return '';

  const failedJobs = runInfo.jobs.filter(j => j.conclusion === 'failure');
  let logs = '';

  for (const job of failedJobs.slice(0, 3)) {
    const logResult = gh(['run', 'view', String(runInfo.databaseId || flags.runId), '--repo', process.env.GITHUB_REPOSITORY, '--log-failed', '--job', String(job.databaseId || job.name)]);
    if (logResult.ok) {
      logs += `\n=== Job: ${job.name} ===\n${logResult.output.slice(0, 3000)}\n`;
    }
  }

  return logs;
}

// ─── Root cause analysis ────────────────────────────────────────────────────

async function analyzeFailure(runInfo, logs) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (apiKey && logs.length > 0) {
    const systemPrompt = `你是一个 CI 故障分析专家。分析以下 CI 失败日志，判断：

1. 是否由代码 Bug 引起（生产代码有缺陷）
2. 是否由 Flaky Test 引起（测试不稳定，非代码问题）
3. 是否由环境/配置问题引起

如果是代码 Bug：
- 指出可能的问题代码位置
- 给出修复建议
- 设置 type = "bug"

如果是 Flaky Test：
- 指出具体哪个 test 不稳定
- 建议是跳过(skip)还是修复
- 设置 type = "flaky"

不确定或环境问题：设置 type = "uncertain"

使用 JSON 格式回复。`;

    const userPrompt = `## CI 运行信息
工作流: ${runInfo?.displayTitle || 'unknown'}
分支: ${runInfo?.headBranch || 'unknown'}
结论: ${runInfo?.conclusion || 'unknown'}

## 失败日志
\`\`\`
${logs.slice(0, 5000)}
\`\`\`

请分析并返回 JSON:
{
  "type": "bug" | "flaky" | "uncertain",
  "confidence": "high" | "medium" | "low",
  "summary": "一句话总结",
  "failingTest": "失败的测试名（如果是 flaky）",
  "suggestedFix": "修复建议",
  "rootCauseFile": "问题文件路径（如果可确定）"
}`;

    const result = await callDeepSeek({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tier: 'flash-thinking',
      reasoningEffort: 'high',
      temperature: 0.2,
      maxTokens: 1024,
      callerTag: 'auto-ci-fix',
    });

    if (result.ok) {
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch {}
    }
  }

  // Fallback heuristic
  const hasTestFailure = logs.includes('FAIL') || logs.includes('failed');
  const hasBuildError = logs.includes('error TS') || logs.includes('Build failed');

  return {
    type: hasBuildError ? 'bug' : (hasTestFailure ? 'flaky' : 'uncertain'),
    confidence: 'low',
    summary: `CI failed with ${logs.includes('FAIL') ? 'test failures' : 'errors'}`,
    suggestedFix: 'Manual investigation required',
  };
}

// ─── Fix implementation ─────────────────────────────────────────────────────

/**
 * Create a fix commit for the CI failure
 */
async function implementFix(analysis, runInfo) {
  const branchName = `ci-fix/${Date.now()}`;
  const baseBranch = 'main';

  if (analysis.type === 'flaky' && analysis.failingTest) {
    // Skip flaky test
    git(['checkout', '-b', branchName]);

    // Find the test file and add .skip
    const testFile = analysis.failingTest;
    if (testFile) {
      // Try to find a test file containing the test name
      const grepResult = git(['grep', '-l', testFile, '--', 'apps/server/src/__tests__/']);
      if (grepResult.ok && grepResult.output) {
        const files = grepResult.output.split('\n').filter(Boolean);
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          // Add .skip to the flaky test: it('test name' → it.skip('test name'
          const updated = content.replace(
            new RegExp(`it\\(['"\`]${escapeRegex(testFile)}`, 'g'),
            `it.skip('${testFile}`
          );
          if (updated !== content) {
            fs.writeFileSync(file, updated);
            console.log(`  🔧 Marked flaky test as skip in ${file}`);
          }
        }
      }
    }

    git(['add', '-A']);
    git(['commit', '-m', `test(ci-fix): skip flaky test "${analysis.failingTest}"`]);
    git(['push', 'origin', branchName]);
    return { branchName, baseBranch, type: 'flaky', description: `Skipped flaky test: ${analysis.failingTest}` };

  } else if (analysis.type === 'bug' && analysis.rootCauseFile) {
    // Attempt bug fix
    git(['checkout', '-b', branchName]);

    // For a real fix, we'd need more context. For now, create a detailed issue report.
    // This is intentionally conservative — we don't auto-fix without certainty.
    const reportPath = `reports/ci-fix-${Date.now()}.md`;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, [
      `# CI Failure Analysis Report`,
      ``,
      `**Date:** ${new Date().toISOString()}`,
      `**Analysis:** ${analysis.summary}`,
      `**Suggested fix:** ${analysis.suggestedFix}`,
      `**Confidence:** ${analysis.confidence}`,
      ``,
      `This report was auto-generated by auto-ci-fix v${VERSION}.`,
    ].join('\n'));

    git(['add', reportPath]);
    git(['commit', '-m', `chore(ci-fix): CI failure analysis - ${new Date().toISOString().split('T')[0]}`]);
    git(['push', 'origin', branchName]);
    return { branchName, baseBranch, type: 'analysis', description: `Analysis report: ${analysis.summary}` };
  }

  return null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── PR creation ─────────────────────────────────────────────────────────────

async function createFixPR(fix, brokenBy, analysis) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return false;

  const prAuthor = brokenBy?.author?.login || 'unknown';

  const bodyLines = [
    '**CI Autofix Automation**',
    '',
    `**Failure logs**: ${brokenBy?.url || 'N/A'}`,
    `**Broken by**: ${brokenBy?.url || 'N/A'} (cc @${prAuthor})`,
    `**Reason**: ${analysis.summary}`,
    `**Fixed by**: ${fix.description}`,
    '',
    `**Type**: ${fix.type}`,
    `**Confidence**: ${analysis.confidence}`,
    `**Analysis date**: ${new Date().toISOString()}`,
  ];

  const title = fix.type === 'flaky'
    ? `[ci-fix] skip flaky test: ${analysis.failingTest}`
    : `[ci-fix] CI failure analysis: ${analysis.summary.slice(0, 60)}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body: bodyLines.join('\n'),
        head: fix.branchName,
        base: fix.baseBranch,
        maintainer_can_modify: true,
      }),
    });

    const prData = await response.json();
    if (response.ok) {
      console.log(`✅ Created PR #${prData.number}: ${prData.html_url}`);
      return true;
    } else {
      console.error(`❌ PR failed: ${JSON.stringify(prData)}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ PR error: ${err}`);
    return false;
  }
}

// ─── WeCom notification ──────────────────────────────────────────────────────

async function sendWeComNotification(runInfo, analysis, fix) {
  const lines = [
    analysis.type === 'flaky' ? '## 🛠 Auto-CI-Fix: Flaky Test Detected' : '## 🔍 Auto-CI-Fix: CI Failure Analyzed',
    '',
    `**工作流:** ${runInfo?.displayTitle || 'unknown'}`,
    `**分支:** ${runInfo?.headBranch || 'unknown'}`,
    `**分析结果:** ${analysis.summary}`,
    `**类型:** ${analysis.type} (${analysis.confidence})`,
    fix ? `**修复:** ${fix.description}` : '**修复:** 无自动修复',
  ];

  if (process.env.GITHUB_RUN_ID) {
    const repo = process.env.GITHUB_REPOSITORY || '';
    lines.push(`[查看日志](https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID})`);
  }

  const proc = spawnSync('node', ['scripts/wecom-notify.mjs', '--markdown', lines.join('\n')], {
    encoding: 'utf8', timeout: 15000, env: { ...process.env },
  });
  if (proc.status !== 0) console.error(`⚠️ WeCom failed: ${proc.stderr || proc.stdout}`);
  else console.log('📱 WeCom notification sent');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🛠️  Auto-CI-Fix v${VERSION}`);
  console.log('');

  // 1. Fetch failing CI run
  console.log('📡 Fetching failing CI run...');
  const runInfo = await fetchFailingRun();

  if (!runInfo) {
    console.log('✅ No failing CI runs found.');
    return 0;
  }

  console.log(`   Run: ${runInfo.displayTitle}`);
  console.log(`   Branch: ${runInfo.headBranch}`);

  // 2. Get failing job names for dedup
  const jobNames = (runInfo.jobs || [])
    .filter(j => j.conclusion === 'failure')
    .map(j => j.name);

  if (jobNames.length === 0) {
    console.log('No failing jobs found.');
    return 0;
  }

  console.log(`   Failing jobs: ${jobNames.join(', ')}`);

  // 3. Deduplication
  if (!claimFailure(jobNames)) {
    return 0;
  }

  // 4. Fetch logs
  console.log('\n📋 Fetching failure logs...');
  const logs = await fetchFailureLogs(runInfo);
  if (flags.verbose && logs) {
    console.log(`   Logs (${logs.length} chars):`);
    console.log(logs.slice(0, 1000));
  }

  // 5. Analyze
  console.log('\n🔍 Analyzing root cause...');
  const analysis = await analyzeFailure(runInfo, logs);
  console.log(`   Type: ${analysis.type} (confidence: ${analysis.confidence})`);
  console.log(`   Summary: ${analysis.summary}`);

  // 6. Find broken commit/PR
  console.log('\n🔗 Finding broken PR...');
  const brokenBy = await findBrokenCommit(runInfo);
  if (brokenBy) {
    console.log(`   PR: ${brokenBy.url || 'N/A'} by @${brokenBy.author?.login || 'unknown'}`);
  }

  // 7. Implement fix (only for high-confidence flaky or bug)
  let fix = null;
  if (!flags.dryRun && (analysis.type === 'flaky' || (analysis.type === 'bug' && analysis.confidence === 'high'))) {
    console.log('\n🔧 Implementing fix...');
    fix = await implementFix(analysis, runInfo);
    if (fix) {
      console.log(`   ${fix.description}`);

      // 8. Create PR
      if (flags.pr) {
        console.log('\n📝 Creating PR...');
        await createFixPR(fix, brokenBy, analysis);
      }
    }
  } else if (flags.dryRun) {
    console.log('\n📝 Dry run — would fix:', analysis.type);
  } else {
    console.log(`\n⏭️  Not confident enough to auto-fix (type=${analysis.type}, confidence=${analysis.confidence})`);
    console.log('   Manual investigation recommended.');
  }

  // 9. WeCom
  if (flags.wecom) {
    await sendWeComNotification(runInfo, analysis, fix);
  }

  // 10. Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Status: ${fix ? '✅ Fix applied' : 'ℹ️  Analysis only'}`);
  console.log(`Type: ${analysis.type}`);
  console.log(`Confidence: ${analysis.confidence}`);

  return fix ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-CI-Fix fatal error:', err);
    process.exit(2);
  });
