#!/usr/bin/env node
/**
 * Auto-Docs — Documentation Automation
 * ======================================
 *
 * Keeps technical documentation current as the codebase evolves.
 * Scans recent commits, identifies areas with weak or missing docs,
 * and generates targeted documentation updates.
 *
 * Usage:
 *   node scripts/auto/auto-docs.mjs                         # analyze recent changes (default: 20 commits)
 *   node scripts/auto/auto-docs.mjs --commits 50            # look back further
 *   node scripts/auto/auto-docs.mjs --range HEAD~10..HEAD   # explicit range
 *   node scripts/auto/auto-docs.mjs --pr                    # create PR (CI mode)
 *   node scripts/auto/auto-docs.mjs --wecom                 # send WeCom notification
 *   node scripts/auto/auto-docs.mjs --scan-all              # scan full codebase for gaps
 *
 * Exit codes:
 *   0 = no doc gaps found / PR not needed
 *   1 = doc gaps found (and PR created if --pr)
 *   2 = analysis error
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token for PR creation
 *   GITHUB_REPOSITORY     – "owner/repo" format (GitHub Actions)
 *   WECOM_BOT_KEY         – WeCom bot key
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// LLM enhancement
import { callDeepSeek } from '../automation-llm.mjs';
import { resolveRepoPath } from '../memory/memory-lib.mjs';

const VERSION = '2026-05-01.v2';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_COMMIT_LOOKBACK = 20;

const args = process.argv.slice(2);
const flags = {
  commits: DEFAULT_COMMIT_LOOKBACK,
  range: null,        /** @type {string | null} */
  pr: false,
  wecom: false,
  verbose: false,
  scanAll: false,
  branch: 'auto-docs',
  checklist: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--commits' && i + 1 < args.length) flags.commits = parseInt(args[++i], 10);
  else if (args[i] === '--range' && i + 1 < args.length) flags.range = args[++i];
  else if (args[i] === '--pr') flags.pr = true;
  else if (args[i] === '--wecom') flags.wecom = true;
  else if (args[i] === '--verbose') flags.verbose = true;
  else if (args[i] === '--branch' && i + 1 < args.length) flags.branch = args[++i];
  else if (args[i] === '--scan-all') flags.scanAll = true;
  else if (args[i] === '--checklist') flags.checklist = true;
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  const result = spawnSync('git', args, {
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

function getRecentCommits(count) {
  const logFmt = '%H||%ai||%an||%s';
  const result = git(['log', `--max-count=${count}`, `--format=${logFmt}`]);
  if (!result.ok) return [];
  return result.output.split('\n').filter(Boolean).map(line => {
    const [hash, date, author, ...rest] = line.split('||');
    return { hash, date, author, subject: rest.join('||') };
  });
}

function getChangedFiles(range) {
  const result = git(['diff', '--name-only', range, '--', ':!package-lock.json', ':!*.lock', ':!*.snap', ':!*.log']);
  return result.ok ? result.output.split('\n').filter(Boolean) : [];
}

function getCommitMessages(range) {
  const result = git(['log', '--oneline', '--no-merges', range]);
  return result.ok ? result.output.split('\n').filter(Boolean) : [];
}

// ─── Doc gap analysis ────────────────────────────────────────────────────────

/**
 * Areas of the codebase that should have corresponding documentation.
 * Each entry maps source paths to expected doc paths.
 */
const DOC_MAPPINGS = [
  // ── Server domains ──
  {
    source: 'apps/server/src/routes',
    doc: 'apps/server/src/routes/README.md',
    title: 'Server Routes',
    description: 'API route organization and domain ownership',
  },
  {
    source: 'apps/server/src/repositories',
    doc: 'apps/server/src/repositories/README.md',
    title: 'Database Repositories',
    description: 'Repository pattern, query methods, and transaction guidelines',
  },
  {
    source: 'apps/server/src/middleware',
    doc: 'apps/server/src/middleware/README.md',
    title: 'Server Middleware',
    description: 'Auth, validation, logging, and error middleware',
  },
  {
    source: 'packages/shared/src/personality',
    doc: 'packages/shared/src/personality/README.md',
    title: 'Personality Engine',
    description: '12-archetype system, ACOEXP traits, V4 assessment, MatcherV2',
  },
  {
    source: 'packages/shared/src/types',
    doc: 'packages/shared/src/types/README.md',
    title: 'Shared Types',
    description: 'Core type definitions and DTO contracts',
  },
  {
    source: 'apps/server/src',
    doc: 'apps/server/src/README.md',
    title: 'Server Root',
    description: 'Server architecture, entry point, and workspace layout',
  },
  {
    source: 'packages/shared/src',
    doc: 'packages/shared/src/README.md',
    title: 'Shared Package',
    description: 'Shared utilities, types, UI primitives, and personality engine',
  },
  // ── Domains ──
  {
    source: 'packages/shared/src/matching',
    doc: 'docs/architecture/matching.md',
    title: 'Matching Algorithm',
    description: '6D scoring, pool matching, group formation',
    optional: true,
  },
  {
    source: 'apps/server/src/services/matching',
    doc: 'docs/architecture/matching.md',
    title: 'Matching Service',
    description: 'Server-side matching orchestration',
    optional: true,
  },
  {
    source: 'apps/server/src/services/socialIcebreaker',
    doc: 'docs/architecture/social-icebreaker.md',
    title: 'Social Icebreaker',
    description: 'Session lifecycle, phase system, AI integration',
    optional: true,
  },
  {
    source: 'packages/shared/src/socialIcebreaker',
    doc: 'docs/architecture/social-icebreaker.md',
    title: 'Social Icebreaker (Shared)',
    description: 'Phase templates, manifests, tier configs',
    optional: true,
  },
  {
    source: 'apps/server/src/services/payment',
    doc: 'docs/architecture/payment.md',
    title: 'Payment System',
    description: 'Payment orchestration, WeChat Pay, entitlements',
    optional: true,
  },
  {
    source: 'apps/server/src/websocket',
    doc: 'docs/architecture/websocket.md',
    title: 'WebSocket Infrastructure',
    description: 'Connection lifecycle, rooms, broadcasting',
    optional: true,
  },
  {
    source: 'docs/automations',
    doc: 'docs/automations/README.md',
    title: 'Automations System',
    description: 'Automated workflows, WeCom integration, CI automations',
  },
];

/**
 * Track file → subsystem mapping for commit analysis
 */
const SUBSYSTEM_MAP = [
  { pattern: 'apps/server/src/routes/', name: 'Server Routes' },
  { pattern: 'apps/server/src/repositories/', name: 'Database Repositories' },
  { pattern: 'apps/server/src/middleware/', name: 'Server Middleware' },
  { pattern: 'apps/server/src/services/', name: 'Server Services' },
  { pattern: 'apps/server/src/lib/', name: 'Server Library/Helpers' },
  { pattern: 'apps/server/src/', name: 'Server Core' },
  { pattern: 'packages/shared/src/personality/', name: 'Personality Engine' },
  { pattern: 'packages/shared/src/matching/', name: 'Matching Shared' },
  { pattern: 'packages/shared/src/types/', name: 'Shared Types' },
  { pattern: 'packages/shared/src/ui/', name: 'Shared UI Primitives' },
  { pattern: 'packages/shared/src/', name: 'Shared Core' },
  { pattern: 'apps/admin-client/src/', name: 'Admin Client' },
  { pattern: 'apps/mini-program/src/', name: 'Mini-Program' },
  { pattern: 'scripts/', name: 'Scripts & Tooling' },
  { pattern: '.github/workflows/', name: 'CI/CD Workflows' },
  { pattern: '.github/skills/', name: 'AI Skills' },
  { pattern: '.github/agents/', name: 'AI Agents' },
  { pattern: 'docs/', name: 'Documentation' },
];

// ─── Canonical doc files that must exist ─────────────────────────────────────

const REQUIRED_CANONICAL_DOCS = [
  { path: 'AGENTS.md', title: 'Agent Onboarding Guide' },
  { path: 'README.md', title: 'Project README' },
  { path: 'DEVELOPER_QUICK_REFERENCE.md', title: 'Developer Quick Reference' },
  { path: 'PRODUCT_REQUIREMENTS.md', title: 'Product Requirements' },
  { path: 'CONTRIBUTING.md', title: 'Contributing Guide' },
  { path: 'docs/README.md', title: 'Documentation Index' },
];

// ─── Analysis: find docs that are missing for recently changed areas ─────────

/**
 * @param {string[]} changedFiles
 * @returns {{ mapping: typeof DOC_MAPPINGS[0]; sourceExists: boolean; docExists: boolean }[]}
 */
function analyzeDocGaps(changedFiles) {
  const changedDirs = new Set(changedFiles.map(f => {
    const parts = f.split('/');
    // Extract top-3 directory levels
    return parts.slice(0, Math.min(parts.length - 1, 4)).join('/');
  }));

  // Find which subsystems were touched
  const touchedSubsystems = new Set();
  for (const file of changedFiles) {
    for (const sub of SUBSYSTEM_MAP) {
      if (file.includes(sub.pattern)) {
        touchedSubsystems.add(sub.name);
      }
    }
  }

  // Map touched subsystems to doc mappings
  const gaps = [];
  for (const mapping of DOC_MAPPINGS) {
    const sourceExists = [...changedDirs].some(d => d.startsWith(mapping.source) || mapping.source.startsWith(d));
    // Only report gap if the source area was actually changed
    if (sourceExists || flags.scanAll) {
      const docExists = fs.existsSync(path.join(process.cwd(), mapping.doc));
      // For optional docs, only report if source exists but doc doesn't
      if (!docExists) {
        gaps.push({ mapping, sourceExists: true, docExists: false });
      } else {
        // Check if doc content is stale (small file, or just a placeholder)
        try {
          const docContent = fs.readFileSync(path.join(process.cwd(), mapping.doc), 'utf8');
          const isPlaceholder = docContent.length < 100 ||
            docContent.includes('TODO') ||
            docContent.includes('FIXME') ||
            docContent.includes('coming soon') ||
            docContent.includes('under construction');
          if (isPlaceholder) {
            gaps.push({ mapping, sourceExists: true, docExists: true, placeholder: true });
          }
        } catch {
          gaps.push({ mapping, sourceExists: true, docExists: false });
        }
      }
    }
  }

  return gaps;
}

/**
 * Check canonical docs exist and are not placeholders
 */
function analyzeCanonicalDocs() {
  const issues = [];
  for (const doc of REQUIRED_CANONICAL_DOCS) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), doc.path), 'utf8');
      if (content.length < 50) {
        issues.push({ ...doc, issue: 'File is nearly empty' });
      }
    } catch {
      issues.push({ ...doc, issue: 'Missing required doc' });
    }
  }
  return issues;
}

/**
 * Check for source files exported from index.ts barrel exports that lack JSDoc
 */
function analyzeUndocumentedExports() {
  /** @type {{ file: string; exports: string[] }[]} */
  const gaps = [];

  // Find barrel export files
  const indexFiles = findFiles('packages/shared/src', 'index.ts');
  for (const idxFile of indexFiles) {
    try {
      const content = fs.readFileSync(idxFile, 'utf8');
      const exports = content.match(/export\s+(?:\{[^}]*\}|const\s+\w+|function\s+\w+|class\s+\w+)/g);
      if (exports && exports.length > 5) {
        // Check if the exports have associated JSDoc comments
        const exportLines = content.split('\n');
        let undocumentedCount = 0;
        for (let i = 0; i < exportLines.length; i++) {
          if (exportLines[i].startsWith('export') && i > 0) {
            const prevLine = exportLines[i - 1].trim();
            if (!prevLine.startsWith('/**') && !prevLine.startsWith('//') && !prevLine.startsWith('*')) {
              undocumentedCount++;
            }
          }
        }
        if (undocumentedCount > 3 && exportLines.length > 30) {
          gaps.push({
            file: idxFile,
            exports: [`${undocumentedCount} exports lack JSDoc comments`],
          });
        }
      }
    } catch { /* skip unreadable files */ }
  }
  return gaps;
}

function findFiles(dir, pattern) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...findFiles(fullPath, pattern));
      } else if (entry.isFile() && entry.name === pattern) {
        results.push(fullPath);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

// ─── LLM-enhanced doc generation ─────────────────────────────────────────────

/**
 * Generate a domain README using DeepSeek to analyze source code
 * and produce meaningful documentation.
 */
async function generateDomainDoc(mapping) {
  const sourcePath = path.join(process.cwd(), mapping.source);

  try {
    const entries = fs.readdirSync(sourcePath);
    const files = entries.filter(e =>
      e.endsWith('.ts') && !e.endsWith('.test.ts') && !e.endsWith('.spec.ts') && !e.endsWith('.d.ts')
    );

    // Build a compact code summary for the LLM
    const fileSummaries = [];
    for (const file of files.slice(0, 8)) { // max 8 files to avoid token overflow
      const content = fs.readFileSync(path.join(sourcePath, file), 'utf8');
      const lines = content.split('\n');
      const exports = lines.filter(l => l.match(/^export\s+(function|class|const|type|interface|default)\s/)).join(', ');
      const firstComment = lines.slice(0, 10).filter(l => l.startsWith('//') || l.startsWith('/**') || l.startsWith('*')).join('\n').slice(0, 300);

      fileSummaries.push({
        name: file,
        size: lines.length,
        exports: exports.slice(0, 300),
        comment: firstComment.slice(0, 200),
      });
    }

    // Try LLM-generated docs
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey && fileSummaries.length > 0) {
      const systemPrompt = `你是一个技术文档工程师。根据提供的源代码信息，生成高质量的 README 文档。

要求：
- 中文撰写（术语用英文）
- 结构清晰，便于浏览
- 包含用途说明、主要导出、使用示例
- 不要编造接口或功能——只基于实际代码
- 保持简洁专业`;

      const userPrompt = `为以下模块生成 README：
- 标题：${mapping.title}
- 路径：\`${mapping.source}\`
- 描述：${mapping.description}

源文件（${fileSummaries.length} 个）：
${fileSummaries.map(f => `
## ${f.name} (${f.size} 行)
${f.comment ? `注释: ${f.comment}` : ''}
${f.exports ? `导出: ${f.exports}` : '无导出'}
`).join('\n')}

生成完整的 Markdown README 文档，包含：
1. 标题和简介
2. 模块架构/文件职责
3. 各文件主要导出和用途
4. 使用示例（如果可推断）
5. 相关链接`;

      const result = await callDeepSeek({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tier: 'flash',
        temperature: 0.3,
        maxTokens: 2048,
        callerTag: 'auto-docs-gen',
      });

      if (result.ok && result.content.length > 100) {
        return `<!-- Auto-generated by auto-docs (${new Date().toISOString().split('T')[0]}) -->\n\n${result.content}`;
      }
    }

    // Fallback: template-based generation
    return generateFallbackDoc(mapping, files, sourcePath);
  } catch (err) {
    return generateFallbackDoc(mapping, [], sourcePath);
  }
}

/**
 * Template-based fallback when LLM is unavailable
 */
function generateFallbackDoc(mapping, files, sourcePath) {
  const lines = [
    `# ${mapping.title}`,
    '',
    mapping.description,
    '',
    `> Auto-generated by auto-docs (${new Date().toISOString().split('T')[0]})`,
    '',
    '## Overview',
    '',
    `This directory contains ${files.length} source file(s).`,
    '',
    '## Files',
    '',
  ];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(sourcePath, file), 'utf8');
      const firstLine = content.split('\n')[0]?.replace(/^\/\/\s*/, '').replace(/^\/\*\*?\s*/, '').replace(/\*\/$/, '').trim() || '';
      lines.push(`- \`${file}\` — ${firstLine || 'No description'}`);
    } catch {
      lines.push(`- \`${file}\``);
    }
  }

  lines.push('');
  lines.push('## Usage');
  lines.push('');
  lines.push('```typescript');
  lines.push(`import { ... } from '@shared/...';`);
  lines.push('```');
  lines.push('');
  lines.push('## Related');
  lines.push('');
  lines.push('- [Server Architecture](../../README.md)');

  return lines.join('\n');
}

// ─── Memory tracking ─────────────────────────────────────────────────────────

const MEMORY_AUTO_DIR = 'repo-memory/generated/automations';

/**
 * Write auto-docs tracking record to repo-memory
 * @param {{ gaps: any[]; canonicalIssues: any[] }} analysis
 */
function writeMemoryRecord(analysis) {
  try {
    const dir = resolveRepoPath(MEMORY_AUTO_DIR);
    fs.mkdirSync(dir, { recursive: true });

    const date = new Date().toISOString().split('T')[0];
    const record = {
      id: `auto-docs-${date}`,
      title: `Auto-Docs Coverage Report ${date}`,
      status: 'candidate',
      owner: 'auto-docs',
      lastValidatedAt: new Date().toISOString(),
      tags: ['auto-docs', 'documentation'],
      triggerTerms: ['docs', 'documentation', 'readme'],
      relatedPaths: [
        ...analysis.gaps.map(g => g.mapping.doc),
        ...analysis.gaps.map(g => g.mapping.source),
      ],
      sources: ['scripts/auto-docs.mjs'],
      confidence: analysis.gaps.length > 0 ? 'medium' : 'high',
      summary: {
        totalGaps: analysis.gaps.length,
        canonicalIssues: analysis.canonicalIssues.length,
        scanRange: flags.range || `last ${flags.commits} commits`,
        gaps: analysis.gaps.slice(0, 10).map(g => ({
          doc: g.mapping.doc,
          source: g.mapping.source,
          status: g.docExists ? (g.placeholder ? 'placeholder' : 'exists') : 'missing',
        })),
      },
    };

    const filePath = path.join(dir, `docs-${date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    if (flags.verbose) console.log(`   [memory] Wrote ${filePath}`);
  } catch (err) {
    if (flags.verbose) console.error(`   [memory] Write failed: ${err}`);
  }
}

// ─── PR creation ─────────────────────────────────────────────────────────────

/**
 * @param {{ gaps: any[]; canonicalIssues: any[]; undocumentedExports: any[] }} analysis
 */
async function createDocPR(analysis) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    console.error('❌ GITHUB_TOKEN and GITHUB_REPOSITORY required for --pr mode');
    return false;
  }

  const branchName = `${flags.branch}/${Date.now()}`;
  const baseBranch = 'main';

  // Generate new doc files (LLM-enhanced)
  console.log('\n📝 Generating documentation via LLM...');
  const newDocs = [];
  for (let i = 0; i < analysis.gaps.length; i++) {
    const gap = analysis.gaps[i];
    if (!gap.docExists) {
      console.log(`   [${i + 1}/${analysis.gaps.filter(g => !g.docExists).length}] ${gap.mapping.doc}`);
      const content = await generateDomainDoc(gap.mapping);
      newDocs.push({ path: gap.mapping.doc, content, description: gap.mapping.description });
    }
  }

  if (newDocs.length === 0) {
    console.log('No new docs to generate.');
    return false;
  }

  // Create branch and commit docs
  git(['checkout', '-b', branchName]);

  for (const doc of newDocs) {
    const fullPath = path.join(process.cwd(), doc.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, doc.content);
    console.log(`  📄 Created ${doc.path}`);
  }

  git(['add', ...newDocs.map(d => d.path)]);
  const commitMsg = `docs(auto-docs): update documentation - ${new Date().toISOString().split('T')[0]}`;
  git(['commit', '-m', commitMsg]);

  const pushResult = git(['push', 'origin', branchName]);
  if (!pushResult.ok) {
    console.error(`❌ Failed to push: ${pushResult.error}`);
    git(['checkout', baseBranch]);
    return false;
  }

  // PR body
  const bodyLines = [
    '## 📚 Auto-Docs Documentation Update',
    '',
    `**Analysis date:** ${new Date().toISOString()}`,
    `**Scan range:** ${flags.range || `last ${flags.commits} commits`}`,
    '',
    '### Docs Added/Updated',
    '',
  ];

  for (const doc of newDocs) {
    bodyLines.push(`- \`${doc.path}\` — ${doc.description || 'N/A'}`);
  }

  if (analysis.canonicalIssues.length > 0) {
    bodyLines.push('');
    bodyLines.push('### Canonical Doc Issues');
    for (const issue of analysis.canonicalIssues) {
      bodyLines.push(`- ⚠️ \`${issue.path}\`: ${issue.issue}`);
    }
  }

  if (analysis.undocumentedExports.length > 0) {
    bodyLines.push('');
    bodyLines.push('### Undocumented Exports');
    for (const exp of analysis.undocumentedExports) {
      bodyLines.push(`- \`${exp.file}\`: ${exp.exports.join(', ')}`);
    }
  }

  bodyLines.push('');
  bodyLines.push('### Related Codepaths');
  for (const gap of analysis.gaps) {
    bodyLines.push(`- Source: \`${gap.mapping.source}\``);
  }

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
        title: `[auto-docs] Documentation update - ${new Date().toISOString().split('T')[0]}`,
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
      console.error(`❌ PR creation failed: ${JSON.stringify(prData)}`);
      // Fallback: try gh CLI (bypasses GITHUB_TOKEN restrictions in scheduled workflows)
      console.log('   Retrying via gh CLI...');
      const ghProc = spawnSync('gh', [
        'pr', 'create',
        '--title', `[auto-docs] Documentation update - ${new Date().toISOString().split('T')[0]}`,
        '--body', bodyLines.join('\n'),
        '--head', branchName,
        '--base', baseBranch,
        '--label', 'auto-docs',
      ], { encoding: 'utf8', timeout: 30000 });
      if (ghProc.status === 0) {
        const prUrl = ghProc.stdout.trim();
        console.log(`✅ Created PR via gh CLI: ${prUrl}`);
        git(['checkout', baseBranch]);
        return true;
      } else {
        console.error(`❌ gh CLI also failed: ${ghProc.stderr || ghProc.stdout}`);
        git(['checkout', baseBranch]);
        return false;
      }
    }
  } catch (err) {
    console.error(`❌ PR creation error: ${err}`);
    git(['checkout', baseBranch]);
    return false;
  }
}

// ─── WeCom notification ──────────────────────────────────────────────────────

async function sendWeComNotification(gaps, canonicalIssues) {
  const msgLines = [
    '## 📚 Auto-Docs 文档更新报告',
    '',
    `**扫描范围:** ${flags.range || `最近 ${flags.commits} 个提交`}`,
    `**发现文档缺口:** ${gaps.length} 个`,
    ...(canonicalIssues.length > 0 ? [`**规范文档问题:** ${canonicalIssues.length} 个`] : []),
    '',
  ];

  if (gaps.length > 0) {
    msgLines.push('**需要补充的文档:**');
    for (const gap of gaps.slice(0, 8)) {
      const status = gap.docExists
        ? (gap.placeholder ? '⚠️ 占位内容' : '✅ 已存在')
        : '❌ 缺失';
      msgLines.push(`- [${status}] \`${gap.mapping.doc}\` — ${gap.mapping.description}`);
    }
  }

  if (msgLines.length <= 4) {
    msgLines.push('✅ 所有对应文档均已覆盖，无需更新。');
  }

  if (process.env.GITHUB_RUN_ID) {
    const repo = process.env.GITHUB_REPOSITORY || '';
    msgLines.push('');
    msgLines.push(`[查看运行日志](${`https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`})`);
  }

  const proc = spawnSync('node', [
    'scripts/wecom-notify.mjs',
    '--markdown',
    msgLines.join('\n'),
  ], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env },
  });

  if (proc.status !== 0) {
    console.error(`⚠️ WeCom notification failed: ${proc.stderr || proc.stdout}`);
  } else {
    console.log('📱 WeCom notification sent');
  }
}

// ─── Checklist output ────────────────────────────────────────────────────────

/**
 * @param {{ gaps: any[]; canonicalIssues: any[]; undocumentedExports: any[] }} analysis
 */
function printChecklist(analysis) {
  console.log('\n## 📋 Documentation Checklist\n');

  // Canonical docs
  console.log('### Required Canonical Docs');
  for (const doc of REQUIRED_CANONICAL_DOCS) {
    const exists = fs.existsSync(path.join(process.cwd(), doc.path));
    const status = exists ? '✅' : '❌';
    console.log(` ${status} \`${doc.path}\``);
  }

  // Doc gaps
  console.log('\n### Documentation Gaps (recent changes)');
  if (analysis.gaps.length === 0) {
    console.log(' ✅ No gaps found');
  } else {
    for (const gap of analysis.gaps) {
      const icon = gap.docExists ? (gap.placeholder ? '⚠️' : '✅') : '❌';
      const note = gap.docExists ? (gap.placeholder ? ' (placeholder only)' : '') : ' (missing)';
      console.log(` ${icon} \`${gap.mapping.doc}\`${note}`);
      console.log(`     Source: \`${gap.mapping.source}\``);
    }
  }

  // Canonical doc issues
  if (analysis.canonicalIssues.length > 0) {
    console.log('\n### Canonical Doc Issues');
    for (const issue of analysis.canonicalIssues) {
      console.log(` ⚠️ \`${issue.path}\`: ${issue.issue}`);
    }
  }

  // Undocumented exports
  if (analysis.undocumentedExports.length > 0) {
    console.log('\n### Undocumented Barrel Exports');
    for (const exp of analysis.undocumentedExports) {
      console.log(` ⚠️ ${exp.file}`);
      for (const e of exp.exports) console.log(`     - ${e}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📚 Auto-Docs v${VERSION}`);
  console.log('');

  // 1. Get recent changes
  const range = flags.range || `HEAD~${flags.commits}..HEAD`;
  const commits = getRecentCommits(flags.commits);
  const changedFiles = getChangedFiles(range);
  const commitMessages = getCommitMessages(range);

  console.log(`📜 Commits analyzed: ${commits.length}`);
  console.log(`📁 Files changed: ${changedFiles.length}`);

  if (flags.verbose && commitMessages.length > 0) {
    console.log('\nRecent commits:');
    for (const msg of commitMessages.slice(0, 10)) {
      console.log(`   ${msg}`);
    }
  }

  // 2. Analyze doc gaps
  console.log('\n🔍 Analyzing documentation gaps...');
  const gaps = analyzeDocGaps(changedFiles);
  const canonicalIssues = analyzeCanonicalDocs();
  const undocumentedExports = analyzeUndocumentedExports();

  // 3. Report
  console.log(`\n📊 Results:`);
  console.log(`   Doc gaps found: ${gaps.length}`);
  console.log(`   Canonical doc issues: ${canonicalIssues.length}`);
  console.log(`   Undocumented exports: ${undocumentedExports.length}`);

  if (gaps.length > 0) {
    console.log('\nMissing/outdated docs:');
    for (const gap of gaps.slice(0, 10)) {
      const status = gap.docExists
        ? (gap.placeholder ? '⚠️ Placeholder' : '✅ OK')
        : '❌ Missing';
      console.log(`   ${status} — ${gap.mapping.doc}`);
    }
  }

  if (canonicalIssues.length > 0) {
    console.log('\nCanonical doc issues:');
    for (const issue of canonicalIssues) {
      console.log(`   ⚠️ ${issue.path}: ${issue.issue}`);
    }
  }

  // 4. Write memory record
  try {
    writeMemoryRecord({ gaps, canonicalIssues });
  } catch {}

  // 5. Print checklist
  if (flags.checklist) {
    printChecklist({ gaps, canonicalIssues, undocumentedExports });
  }

  // 6. Create PR
  let prCreated = false;
  const hasGaps = gaps.length > 0 || canonicalIssues.length > 0;
  if (flags.pr && hasGaps) {
    console.log('\n📝 Creating documentation update PR...');
    try {
      prCreated = await createDocPR({ gaps, canonicalIssues, undocumentedExports });
    } catch (err) {
      console.error(`⚠️ PR creation failed (continuing): ${err.message}`);
    }
  } else if (flags.pr && !hasGaps) {
    console.log('\n✅ No documentation gaps found — skipping PR.');
  }

  // 7. WeCom notification
  if (flags.wecom) {
    console.log('\n📱 Sending WeCom notification...');
    await sendWeComNotification(gaps, canonicalIssues);
  }

  // 8. Summary
  const needsUpdate = gaps.length > 0 || canonicalIssues.length > 0;
  console.log('\n' + '='.repeat(50));
  console.log(`Docs gaps: ${gaps.length}, Canonical issues: ${canonicalIssues.length}`);
  if (needsUpdate) {
    console.log('📋 Documentation update recommended.');
  } else {
    console.log('✅ All documentation is current.');
  }

  return needsUpdate ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(async err => {
    console.error('❌ Auto-Docs fatal error:', err.message);
    // Attempt WeCom notification even on crash
    try {
      if (flags.wecom) await sendWeComNotification([], []);
    } catch {}
    process.exit(2);
  });
