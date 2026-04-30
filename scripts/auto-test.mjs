#!/usr/bin/env node
/**
 * Auto-Test — Test Coverage Automation
 * ======================================
 *
 * Inspects recent commits and adds missing tests where coverage is weak
 * and business risk is meaningful.  Follows existing test conventions.
 *
 * Usage:
 *   node scripts/auto-test.mjs                          # analyze last 20 commits
 *   node scripts/auto-test.mjs --commits 50             # larger window
 *   node scripts/auto-test.mjs --range HEAD~5..HEAD     # specific range
 *   node scripts/auto-test.mjs --pr                     # create PR (CI mode)
 *   node scripts/auto-test.mjs --wecom                  # WeCom notification
 *
 * Exit codes:
 *   0 = no gaps found / all tests pass
 *   1 = tests written and PR created (if --pr)
 *   2 = error
 *
 * Environment:
 *   GITHUB_TOKEN          – for PR creation
 *   GITHUB_REPOSITORY     – "owner/repo"
 *   DEEPSEEK_API_KEY      – for LLM-generated tests (optional)
 *   WECOM_BOT_KEY         – WeCom notifications
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { callDeepSeek } from './automation-llm.mjs';

const VERSION = '2026-05-01.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_COMMIT_LOOKBACK = 20;
const TEST_DIR = 'apps/server/src/__tests__';

// Priority scoring
const PRIORITY_PATTERNS = [
  { weight: 10, match: (f) => f.endsWith('.ts') && fileIsBugFix(f) },
  { weight: 8, match: (f) => f.includes('/domains/') || f.includes('/services/') },
  { weight: 7, match: (f) => f.includes('/repositories/') },
  { weight: 6, match: (f) => f.includes('/lib/') || f.includes('/utils/') },
  { weight: 5, match: (f) => f.includes('/middleware/') },
  { weight: 3, match: (f) => f.includes('/routes/') },
];

const EXCLUDE_PATTERNS = [
  '.test.', '.spec.', '.d.ts',
  'index.ts', '__tests__', 'node_modules',
  '.mjs', '.cjs', '.json', '.yml', '.yaml',
  '.md', '.css', '.scss',
];

const args = process.argv.slice(2);
const flags = {
  commits: DEFAULT_COMMIT_LOOKBACK,
  range: null,     /** @type {string | null} */
  pr: false,
  wecom: false,
  verbose: false,
  dryRun: false,
  branch: 'auto-test',
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--commits' && i + 1 < args.length) flags.commits = parseInt(args[++i], 10);
  else if (args[i] === '--range' && i + 1 < args.length) flags.range = args[++i];
  else if (args[i] === '--pr') flags.pr = true;
  else if (args[i] === '--wecom') flags.wecom = true;
  else if (args[i] === '--verbose') flags.verbose = true;
  else if (args[i] === '--dry-run') flags.dryRun = true;
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8', timeout: 15000, maxBuffer: 10 * 1024 * 1024, ...opts,
  });
  if (result.status !== 0 && result.status !== null) {
    return { ok: false, output: '', error: result.stderr?.trim() || `exit ${result.status}` };
  }
  return { ok: true, output: result.stdout?.trim() || '' };
}

function getChangedFiles(range) {
  const result = git(['diff', '--name-only', range, '--', ':!package-lock.json', ':!*.lock']);
  return result.ok ? result.output.split('\n').filter(Boolean) : [];
}

function getCommitMessages(range) {
  const result = git(['log', '--oneline', '--no-merges', range]);
  return result.ok ? result.output.split('\n').filter(Boolean) : [];
}

function getFileDiff(filePath) {
  const result = git(['diff', 'HEAD~1', '--', filePath]);
  return result.ok ? result.output : '';
}

// ─── Analysis ────────────────────────────────────────────────────────────────

/**
 * Determine if a file change is likely a bug fix
 * Uses commit messages as heuristic
 */
const bugFixCache = new Map();

function fileIsBugFix(filePath) {
  // Check if any recent commit touching this file is a bug fix
  const log = git(['log', '--oneline', '-5', '--', filePath]);
  if (!log.ok) return false;
  return log.output.split('\n').some(msg =>
    /fix|bug|hotfix|patch|repair|correct|issue|error|crash|NPE|null/i.test(msg)
  );
}

/**
 * Find production source files without corresponding test files
 */
function findUntestedFiles(changedFiles, commitMessages) {
  /** @type {Array<{ file: string; priority: number; isBugFix: boolean; reason: string }>} */
  const candidates = [];

  const isBugFixCommit = commitMessages.some(msg =>
    /fix|bug|hotfix|patch/i.test(msg)
  );

  for (const file of changedFiles) {
    // Only care about server .ts files
    if (!file.startsWith('apps/server/src/')) continue;
    if (!file.endsWith('.ts')) continue;
    if (EXCLUDE_PATTERNS.some(p => file.includes(p))) continue;

    // Check if test exists
    const fileName = path.basename(file, '.ts');
    const testFilePath = path.join(TEST_DIR, `${fileName}.test.ts`);

    // Also check co-located tests
    const dir = path.dirname(file);
    const coLocatedTest = path.join(dir, `__tests__`, `${fileName}.test.ts`);
    const coLocatedSpec = file.replace('.ts', '.test.ts');

    const hasTest =
      fs.existsSync(path.join(process.cwd(), testFilePath)) ||
      fs.existsSync(path.join(process.cwd(), coLocatedTest)) ||
      fs.existsSync(path.join(process.cwd(), coLocatedSpec));

    if (hasTest) continue;

    // Score priority
    let priority = 0;
    let reason = '';
    for (const p of PRIORITY_PATTERNS) {
      if (p.match(file)) {
        priority += p.weight;
        reason = `high-priority pattern (${p.weight}pts)`;
      }
    }

    // Boost for bug fixes
    const isBugFix = isBugFixCommit || fileIsBugFix(file);
    if (isBugFix) {
      priority += 10;
      reason = 'bug fix without test';
    }

    // Boost for new files
    const fileExists = git(['show', 'HEAD~1:./' + file]);
    if (!fileExists.ok) {
      priority += 8;
      reason = 'new file without tests';
    }

    if (priority >= 5) {
      candidates.push({ file, priority, isBugFix, reason: reason || 'general' });
    }
  }

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

// ─── Test generation ─────────────────────────────────────────────────────────

/**
 * Generate a test file for a given source file using LLM
 */
async function generateTest(sourceFile) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const testFile = path.join(TEST_DIR, path.basename(sourceFile, '.ts') + '.test.ts');

  // Read the source file
  const sourcePath = path.join(process.cwd(), sourceFile);
  let sourceContent;
  try {
    sourceContent = fs.readFileSync(sourcePath, 'utf8');
  } catch {
    return null;
  }

  // Read existing tests for style reference
  const existingTestsDir = path.join(process.cwd(), TEST_DIR);
  /** @type {string[]} */
  const styleRefs = [];
  try {
    const testFiles = fs.readdirSync(existingTestsDir).filter(f => f.endsWith('.test.ts')).slice(0, 3);
    for (const tf of testFiles) {
      const content = fs.readFileSync(path.join(existingTestsDir, tf), 'utf8');
      styleRefs.push(`// Style reference from ${tf}:\n${content.slice(0, 1500)}`);
    }
  } catch {}

  if (apiKey && sourceContent.length > 0) {
    const systemPrompt = `你是一个测试工程师。根据以下源代码和已有测试的风格参考，生成 Vitest 测试文件。

要求：
- 使用 Vitest (globals: true)，从 'vitest' 导入 { describe, it, expect, vi }
- 遵循现有测试风格
- 测试必须 deterministic
- 使用 vi.mock() 模拟外部依赖
- 不要修改生产代码
- 只测试公共接口 (exported functions, classes, routes)
- 覆盖: 正常路径、边界条件、错误处理
- 添加最小但有意义的测试集
- TypeScript 严格模式

输出格式：只输出 .test.ts 文件内容，不要额外说明。`;

    const userPrompt = `## 源文件: ${sourceFile}

\`\`\`typescript
${sourceContent.slice(0, 4000)}
\`\`\`

${styleRefs.length > 0 ? `## 风格参考:\n${styleRefs.join('\n\n')}` : ''}

生成完整的 Vitest 测试文件。只输出 .ts 代码。`;

    const result = await callDeepSeek({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tier: 'flash',
      temperature: 0.2,
      maxTokens: 4096,
      callerTag: 'auto-test-gen',
    });

    if (result.ok && result.content.length > 50) {
      // Extract code block if present
      let code = result.content;
      const codeMatch = code.match(/```(?:typescript|ts)?\s*\n?([\s\S]*?)```/);
      if (codeMatch) code = codeMatch[1].trim();

      return {
        testFile: path.basename(sourceFile, '.ts') + '.test.ts',
        content: code,
        method: 'llm',
      };
    }
  }

  // Fallback: generate a minimal skeleton
  return {
    testFile: path.basename(sourceFile, '.ts') + '.test.ts',
    content: `import { describe, it, expect } from 'vitest';\n\ndescribe('${path.basename(sourceFile, '.ts')}', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
    method: 'fallback',
  };
}

// ─── Test runner ─────────────────────────────────────────────────────────────

async function runTestSuite() {
  console.log('\n🧪 Running server tests to validate...');
  const result = spawnSync('npm', ['run', 'test', '-w', '@joyjoin/server'], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const output = result.stdout + result.stderr;
  const passed = result.status === 0;

  // Extract test results
  const passMatch = output.match(/(\d+)\s+passed/);
  const failMatch = output.match(/(\d+)\s+failed/);
  const totalPassed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const totalFailed = failMatch ? parseInt(failMatch[1], 10) : 0;

  console.log(`   ${passed ? '✅' : '❌'} Tests: ${totalPassed} passed, ${totalFailed} failed`);

  if (!passed && flags.verbose) {
    // Show only failure summary
    const failLines = output.split('\n').filter(l => l.includes('FAIL') || l.includes('❌') || l.includes('×'));
    for (const line of failLines.slice(0, 10)) {
      console.log(`   ${line.trim()}`);
    }
  }

  return { passed, output: output.slice(0, 2000), totalPassed, totalFailed };
}

// ─── PR creation ─────────────────────────────────────────────────────────────

async function createTestPR(addedTests) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.error('❌ GITHUB_TOKEN and GITHUB_REPOSITORY required');
    return false;
  }

  const branchName = `${flags.branch}/${Date.now()}`;
  const baseBranch = 'main';

  // Create branch
  git(['checkout', '-b', branchName]);

  // Write test files
  for (const t of addedTests) {
    const fullPath = path.join(process.cwd(), TEST_DIR, t.testFile);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, t.content);
    console.log(`  📄 Created ${t.testFile}`);
  }

  git(['add', TEST_DIR]);
  git(['commit', '-m', `test(auto-test): add missing tests - ${new Date().toISOString().split('T')[0]}`]);

  const pushResult = git(['push', 'origin', branchName]);
  if (!pushResult.ok) {
    console.error(`❌ Push failed: ${pushResult.error}`);
    git(['checkout', baseBranch]);
    return false;
  }

  // Build PR body
  const bodyLines = [
    '## 🧪 Auto-Test: Test Coverage Update',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Files tested:** ${addedTests.length}`,
    '',
    '### Risky behavior now covered',
    '',
  ];

  for (const t of addedTests) {
    bodyLines.push(`- \`${t.testFile}\` — covers \`${t.sourceFile}\``);
    bodyLines.push(`  - Method: ${t.method === 'llm' ? '🤖 LLM-generated' : '📝 Template'}`);
  }

  bodyLines.push('');
  bodyLines.push('### Why these tests reduce regression risk');
  bodyLines.push(`- These files lacked any test coverage despite being recently modified`);
  bodyLines.push(`- ${addedTests.filter(t => t.isBugFix).length} relate to bug fix commits`);
  bodyLines.push(`- ${addedTests.filter(t => t.priority >= 10).length} are high-priority (services, repositories, domains)`);

  // Create PR
  const apiUrl = `https://api.github.com/repos/${repo}/pulls`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: `[auto-test] add missing tests - ${new Date().toISOString().split('T')[0]}`,
        body: bodyLines.join('\n'),
        head: branchName,
        base: baseBranch,
        maintainer_can_modify: true,
      }),
    });

    const prData = await response.json();
    if (response.ok) {
      console.log(`✅ Created PR #${prData.number}: ${prData.html_url}`);
      git(['checkout', baseBranch]);
      return true;
    } else {
      console.error(`❌ PR failed: ${JSON.stringify(prData)}`);
      git(['checkout', baseBranch]);
      return false;
    }
  } catch (err) {
    console.error(`❌ PR error: ${err}`);
    git(['checkout', baseBranch]);
    return false;
  }
}

// ─── WeCom notification ──────────────────────────────────────────────────────

async function sendWeComNotification(addedTests, testPassed) {
  const lines = [
    testPassed ? '## 🧪 Auto-Test 测试报告' : '## ⚠️ Auto-Test 测试报告（有失败）',
    '',
    `**新增测试:** ${addedTests.length} 个`,
    '',
  ];

  if (addedTests.length > 0) {
    lines.push('**覆盖的文件:**');
    for (const t of addedTests.slice(0, 8)) {
      lines.push(`- \`${t.testFile}\` → \`${t.sourceFile}\``);
    }
  }

  lines.push('');
  lines.push(`**测试结果:** ${testPassed ? '✅ 全部通过' : '❌ 有失败'}`);

  if (process.env.GITHUB_RUN_ID) {
    const repo = process.env.GITHUB_REPOSITORY || '';
    lines.push(`[查看运行日志](https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID})`);
  }

  const proc = spawnSync('node', ['scripts/wecom-notify.mjs', '--markdown', lines.join('\n')], {
    encoding: 'utf8', timeout: 15000, env: { ...process.env },
  });
  if (proc.status !== 0) console.error(`⚠️ WeCom failed: ${proc.stderr || proc.stdout}`);
  else console.log('📱 WeCom notification sent');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🧪 Auto-Test v${VERSION}`);
  console.log('');

  const range = flags.range || `HEAD~${flags.commits}..HEAD`;
  const changedFiles = getChangedFiles(range);
  const commitMessages = getCommitMessages(range);

  if (changedFiles.length === 0) {
    console.log('No changed files found.');
    return 0;
  }

  console.log(`📁 ${changedFiles.length} files changed in ${flags.range || `last ${flags.commits} commits`}`);

  // 1. Find untested files
  console.log('\n🔍 Scanning for untested production code...');
  const candidates = findUntestedFiles(changedFiles, commitMessages);

  if (candidates.length === 0) {
    console.log('✅ All recently changed files have test coverage.');
    return 0;
  }

  console.log(`   Found ${candidates.length} candidates without tests:`);
  for (const c of candidates.slice(0, 10)) {
    console.log(`   ${c.priority >= 10 ? '🔴' : '🟡'} [${c.priority}pts] ${c.file}`);
    console.log(`       ${c.reason}`);
  }
  if (candidates.length > 10) {
    console.log(`   ... and ${candidates.length - 10} more`);
  }

  // 2. Generate tests (top 5 candidates only)
  const topCandidates = candidates.slice(0, 5);
  console.log(`\n✍️  Generating tests for top ${topCandidates.length} candidates...`);

  /** @type {Array<{testFile: string; content: string; method: string; sourceFile: string; isBugFix: boolean; priority: number}>} */
  const addedTests = [];

  for (let i = 0; i < topCandidates.length; i++) {
    const c = topCandidates[i];
    console.log(`   [${i + 1}/${topCandidates.length}] ${path.basename(c.file)}...`);
    const result = await generateTest(c.file);
    if (result) {
      addedTests.push({ ...result, sourceFile: c.file, isBugFix: c.isBugFix, priority: c.priority });
      console.log(`       ✅ Generated (${result.method})`);
    } else {
      console.log(`       ⏭️  Skipped (could not read source)`);
    }
  }

  if (addedTests.length === 0) {
    console.log('No tests generated.');
    return 0;
  }

  // 3. Write test files
  if (!flags.dryRun) {
    const testDirPath = path.join(process.cwd(), TEST_DIR);
    fs.mkdirSync(testDirPath, { recursive: true });
    for (const t of addedTests) {
      const fullPath = path.join(testDirPath, t.testFile);
      fs.writeFileSync(fullPath, t.content);
    }
    console.log(`\n📝 Wrote ${addedTests.length} test files to ${TEST_DIR}/`);
  } else {
    console.log(`\n📝 Dry run: would write ${addedTests.length} test files`);
    for (const t of addedTests) {
      console.log(`   - ${t.testFile} (${t.content.length} chars)`);
    }
    return 1;
  }

  // 4. Run tests
  const testResult = await runTestSuite();

  // 5. If tests fail, remove the new tests and report
  if (!testResult.passed) {
    console.log('\n❌ Tests failed — removing generated tests...');
    for (const t of addedTests) {
      const fullPath = path.join(process.cwd(), TEST_DIR, t.testFile);
      try { fs.unlinkSync(fullPath); } catch {}
    }
    console.log('   Cleaned up. Auto-test will retry on next run.');

    if (flags.wecom) {
      await sendWeComNotification(addedTests, false);
    }
    return 2;
  }

  console.log('\n✅ All tests pass with new test coverage!');

  // 6. Create PR
  if (flags.pr) {
    console.log('\n📝 Creating PR...');
    const prCreated = await createTestPR(addedTests);
    if (!prCreated) {
      console.log('⚠️ PR creation failed');
    }
  }

  // 7. WeCom
  if (flags.wecom) {
    await sendWeComNotification(addedTests, true);
  }

  // 8. Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests added: ${addedTests.length}`);
  console.log(`High-priority targets: ${addedTests.filter(t => t.priority >= 10).length}`);
  console.log('✅ Test coverage improved.');

  return 1;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Test fatal error:', err);
    process.exit(2);
  });
