#!/usr/bin/env node
/**
 * Harness Completion Gate — 5-Pillar Engineering Quality Gate
 *
 * Runs at the end of every implementation task to verify the 5 Harness pillars:
 * 1. Reliability    — error handling, retries, idempotency, atomicity
 * 2. Scalability    — N+1 avoidance, pagination, bounded memory, concurrency
 * 3. Security       — auth checks, fail-closed, secrets, input validation
 * 4. Observability  — structured logging, metrics, tracing, audit records
 * 5. Maintainability — code placement, domain boundaries, pattern consistency
 *
 * Usage:
 *   node scripts/harness-completion-gate.mjs
 *   node scripts/harness-completion-gate.mjs --json
 *   node scripts/harness-completion-gate.mjs --fail-on-concern
 *
 * Exit codes:
 *   0 = all pillars pass
 *   1 = one or more pillars failed (blocking)
 *   2 = concerns found (non-blocking, unless --fail-on-concern)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '2026-04-22.v1';

const SEVERITY_WEIGHTS = { blocker: 3, concern: 1, nit: 0 };
const PASS_THRESHOLD = 85; // Score out of 100

// ─── CLI ───

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const failOnConcern = args.includes('--fail-on-concern');
const verbose = args.includes('--verbose') || !jsonOutput;

// ─── Git Helpers ───

function runGit(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 });
  if (result.status !== 0) return { ok: false, error: result.stderr.trim() };
  return { ok: true, output: result.stdout.trim() };
}

function getChangedFiles() {
  const result = runGit(['diff', '--name-only', 'HEAD']);
  if (!result.ok) return [];
  const tracked = result.output.split('\n').filter(Boolean);

  const untrackedResult = runGit(['ls-files', '--others', '--exclude-standard']);
  const untracked = untrackedResult.ok ? untrackedResult.output.split('\n').filter(Boolean) : [];

  return [...new Set([...tracked, ...untracked])];
}

function getFileDiff(filePath) {
  const result = runGit(['diff', 'HEAD', '--', filePath]);
  return result.ok ? result.output : '';
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Parse git diff to extract line numbers of ADDED lines in the new file.
 * Returns a Set of 1-based line numbers that were added or modified.
 */
function parseAddedLineNumbers(diffText) {
  const addedLines = new Set();
  const lines = diffText.split('\n');
  let currentNewLine = 0;

  for (const line of lines) {
    // Hunk header: @@ -start,count +start,count @@
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch) {
      currentNewLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      // Added line
      addedLines.add(currentNewLine);
      currentNewLine++;
    } else if (line.startsWith('-')) {
      // Removed line — doesn't advance new file line number
      continue;
    } else if (line.startsWith(' ') || line === '') {
      // Context line or empty line in diff
      currentNewLine++;
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" — ignore
      continue;
    } else {
      // Any other line advances currentNewLine (context)
      currentNewLine++;
    }
  }

  return addedLines;
}

/**
 * Check if a finding's line is within the added/modified lines.
 * If finding has no line number, returns true (whole-file check).
 */
function isFindingInDiff(finding, addedLineNumbers) {
  if (!finding.line || addedLineNumbers.size === 0) return true;
  return addedLineNumbers.has(finding.line);
}

// ─── Pillar Checkers ───

function checkReliability(changedFiles, fileContents) {
  const findings = [];

  for (const file of changedFiles) {
    const content = fileContents[file] || '';
    const ext = path.extname(file);
    const isCode = ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
    if (!isCode) continue;

    // Skip the gate script and its test file (they contain test fixtures that match checks)
    if (file === 'scripts/harness-completion-gate.mjs' || file === 'scripts/harness-completion-gate.test.mjs') continue;

    // Check for setState or side effects in loops without safeguards
    if (/for\s*\([^)]*\)\s*\{[\s\S]*?\.(mutate|setState|setData)\(/g.test(content)) {
      findings.push({
        severity: 'concern',
        file,
        message: 'Side effect (mutate/setState/setData) inside a loop — consider batching or idempotency',
      });
    }

    // Check for missing error handling on fetch/apiRequest
    // Skip test files — they intentionally use fetch without catch blocks for assertion-based flow control
    if (!/\.(test|spec)\.|__tests__/.test(file)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Only flag top-level await or unwrapped Promise chains, not return await
          if (/\b(fetch|apiRequest)\s*\(/.test(line) && !/return\s+await/.test(line) && !/try|catch|\.catch\(|await.*catch/.test(content.substring(Math.max(0, content.indexOf(line) - 500), content.indexOf(line)))) {
          findings.push({
            severity: 'concern',
            file,
            line: i + 1,
            message: `API call may lack error handling: "${line.trim().slice(0, 80)}"`,
          });
        }
      }
    }

    // Check for transaction boundaries on multi-step DB operations
    if (/db\.(insert|update|delete)/g.test(content) && content.split(/db\.(insert|update|delete)/g).length > 3) {
      if (!/transaction|trx|BEGIN|COMMIT/gi.test(content)) {
        findings.push({
          severity: 'concern',
          file,
          message: 'Multiple DB operations without explicit transaction boundary',
        });
      }
    }
  }

  return findings;
}

function checkScalability(changedFiles, fileContents) {
  const findings = [];

  for (const file of changedFiles) {
    const content = fileContents[file] || '';
    const ext = path.extname(file);
    const isCode = ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
    if (!isCode) continue;

    // Skip test files (they contain intentional fixture patterns)
    if (/\.test\.|\.spec\.|__tests__/.test(file)) continue;

    // N+1: query inside loop (look for actual DB methods, not just any await)
    const dbMethods = /\b(db\.|query\(|findMany\(|findFirst\(|select\(|insert\(|update\(|delete\()/;
    const loopRegex = /for\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
    let loopMatch;
    while ((loopMatch = loopRegex.exec(content)) !== null) {
      if (dbMethods.test(loopMatch[0])) {
        const lineNum = content.substring(0, loopMatch.index).split('\n').length;
        findings.push({
          severity: 'blocker',
          file,
          line: lineNum,
          message: 'Potential N+1 query: database call inside a loop. Use batch loading or inArray.',
        });
      }
    }

    // Unbounded array spread / .push in event handlers
    // Only flag if there's an actual event handler (onClick, onChange, etc.) in the same file
    const hasEventHandler = /\bon(?:Click|Change|Submit|Input|Touch|Mouse|Key|Scroll|Load|Focus|Blur)\s*[=:]/g.test(content);
    if (hasEventHandler && /\[\s*\.{3}[\w\s,]+\]\s*\.(?:push|unshift|splice|concat)/g.test(content)) {
      findings.push({
        severity: 'concern',
        file,
        message: 'Unbounded array accumulation in event handler — consider max size limit',
      });
    }

    // Missing pagination on list queries
    if (/(findMany|select\(|query\()[\s\S]*limit/gi.test(content) === false && /(findMany|select\(|all\(|getAll)/gi.test(content)) {
      const isRoute = /\/(routes|api)\//.test(file) || file.includes('routes/');
      if (isRoute) {
        findings.push({
          severity: 'concern',
          file,
          message: 'List query may lack pagination limit — verify this is intentional',
        });
      }
    }

    // setInterval without cleanup
    if (/setInterval\s*\(/.test(content) && !/clearInterval|useEffect.*return/.test(content)) {
      findings.push({
        severity: 'concern',
        file,
        message: 'setInterval without clearInterval — memory leak risk',
      });
    }
  }

  return findings;
}

function checkSecurity(changedFiles, fileContents) {
  const findings = [];

  for (const file of changedFiles) {
    const content = fileContents[file] || '';
    const ext = path.extname(file);
    const isCode = ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);

    // Skip MCP config files and env templates (they use ${VAR} syntax intentionally)
    if (/\.mcp\.json$|\.env\./.test(file)) continue;

    // Skip test files (they contain intentional fixture patterns)
    if (/\.test\.|\.spec\.|__tests__/.test(file)) continue;

    // Secrets in code — skip template syntax like "${ENV_VAR}" and "<%= var %>"
    const secretPatterns = [
      { pattern: /['"`][a-zA-Z0-9_]*(?:password|secret|token|private_key)['"`]\s*[:=]\s*['"`][^'"`\$\{]{8,}['"`]/gi, desc: 'hardcoded secret' },
      { pattern: /['"`]sk-[a-zA-Z0-9]{20,}['"`]/g, desc: 'API key' },
      { pattern: /['"`]AKIA[0-9A-Z]{16}['"`]/g, desc: 'AWS key' },
    ];
    for (const { pattern, desc } of secretPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          findings.push({
            severity: 'blocker',
            file,
            message: `Potential ${desc} in source code: "${match.slice(0, 40)}..."`,
          });
        }
      }
    }

    if (!isCode) continue;

    // New route without auth middleware
    const isServerRoute = file.startsWith('apps/server/src/routes/');
    if (isServerRoute && /router\.(get|post|put|patch|delete)\s*\(/.test(content)) {
      if (!/requireAuth|adminMiddleware|auth\s*\)/gi.test(content) && !/\/health|\/metrics|\/readyz/.test(content)) {
        findings.push({
          severity: 'blocker',
          file,
          message: 'New route endpoint may be missing authentication/authorization check',
        });
      }
    }

    // SQL injection risk (raw string interpolation in actual SQL context)
    // Skip CSS/styled-components and JSX style props that may contain SQL-like words
    // Skip Drizzle ORM files: drizzle's `sql` is a typed template tag, not raw SQL.
    if (!/\.css$|\.scss$|\.less$/i.test(file) && !/styled|css|style\s*=/gi.test(content.substring(0, 500)) && !/drizzle-orm/.test(content)) {
      const sqlMatches = content.match(/(?:sql|query)\s*[:=]\s*`[^`]*\$\{[^}]*\}[^`]*`/gi);
      if (sqlMatches) {
        findings.push({
          severity: 'blocker',
          file,
          message: 'Potential SQL injection: template literal in SQL query context',
        });
      }
    }

    // eval / Function constructor (skip the gate script itself since it documents these patterns)
    if (file === 'scripts/harness-completion-gate.mjs') continue;
    if (/\beval\s*\(|new\s+Function\s*\(/g.test(content)) {
      findings.push({
        severity: 'blocker',
        file,
        message: 'Dangerous eval() or new Function() usage detected',
      });
    }

    // Missing input validation on new API routes
    if (isServerRoute && /req\.(body|query|params)/g.test(content) && !/(zod|Zod|safeParse|parse\()/gi.test(content)) {
      findings.push({
        severity: 'concern',
        file,
        message: 'Request body/query/params used without Zod validation',
      });
    }

    // debugger statements left in code
    if (/\bdebugger\b/g.test(content)) {
      findings.push({
        severity: 'blocker',
        file,
        message: 'debugger statement left in source code',
      });
    }

    // console.log in non-test code (skip analytics placeholders)
    if (!/\.test\.|spec\.|__tests__|\.test\.mjs/.test(file) && file !== 'scripts/harness-completion-gate.mjs') {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/console\.log\s*\(/.test(line)) {
          // Skip analytics placeholders
          if (/console\.log\s*\(\s*['"`]\[(?:Analytics|DEBUG|dev)\]/i.test(line)) continue;
          // Skip CLI tools and scripts — console.log is the correct stdout mechanism
          if (/(?:^|[/\\])(cli|scripts)[/\\]|\.cli\.(ts|mjs|js)$/.test(file)) continue;
          findings.push({
            severity: 'concern',
            file,
            line: i + 1,
            message: 'console.log in production code — remove or use structured logger',
          });
        }
      }
    }
  }

  return findings;
}

function checkObservability(changedFiles, fileContents) {
  const findings = [];

  for (const file of changedFiles) {
    const content = fileContents[file] || '';
    const ext = path.extname(file);
    const isServerCode = file.startsWith('apps/server/src/') && ['.ts', '.mjs'].includes(ext);
    if (!isServerCode) continue;

    // Error handler without logger
    // Use brace-balanced extraction to handle nested blocks correctly
    const catchRegex = /catch\s*\([^)]*\)\s*\{/g;
    let catchMatch;
    while ((catchMatch = catchRegex.exec(content)) !== null) {
      const start = catchMatch.index + catchMatch[0].length;
      let depth = 1;
      let end = start;
      while (depth > 0 && end < content.length) {
        if (content[end] === '{') depth++;
        else if (content[end] === '}') depth--;
        end++;
      }
      const block = content.slice(catchMatch.index, end);
      // Skip if error is rethrown (not silently swallowed)
      if (/\bthrow\b/.test(block)) continue;
      if (!/logger\.(error|warn|info)/g.test(block) && !/console\.(error|warn)/g.test(block)) {
        findings.push({
          severity: 'concern',
          file,
          message: 'catch block without structured logging — errors will be silent in production',
        });
      }
    }

    // console.* in server handlers (should use logger)
    if (/console\.(log|error|warn)\s*\(/g.test(content) && !/\.test\.|spec\.|__tests__/.test(file)) {
      findings.push({
        severity: 'nit',
        file,
        message: 'console.* used in server code — prefer structured logger',
      });
    }

    // New mutation without audit log
    if (/(insert|update|delete)\s*\(/gi.test(content) && /admin|payment|refund|ban/i.test(file)) {
      if (!/audit|AuditLogger|adminAuditLogger/gi.test(content)) {
        findings.push({
          severity: 'concern',
          file,
          message: 'Sensitive mutation without audit logging — see admin-audit-and-rbac-governance skill',
        });
      }
    }
  }

  return findings;
}

function checkMaintainability(changedFiles, fileContents) {
  const findings = [];

  for (const file of changedFiles) {
    const content = fileContents[file] || '';
    const ext = path.extname(file);
    const isCode = ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
    if (!isCode) continue;

    // Cross-app imports
    const crossAppPatterns = [
      { from: 'apps/user-client', to: 'apps/admin-client' },
      { from: 'apps/user-client', to: 'apps/mini-program' },
      { from: 'apps/admin-client', to: 'apps/user-client' },
      { from: 'apps/admin-client', to: 'apps/mini-program' },
      { from: 'apps/mini-program', to: 'apps/user-client' },
      { from: 'apps/mini-program', to: 'apps/admin-client' },
    ];
    for (const { from, to } of crossAppPatterns) {
      const appName = to.replace('apps/', '');
      // Match any relative traversal into another app directory, or absolute app path
      const pattern = new RegExp(`from\\s+['"](?:\\.\\.\\/)+${appName}\\b|from\\s+['"]${to}`, 'g');
      if (file.startsWith(from) && pattern.test(content)) {
        findings.push({
          severity: 'blocker',
          file,
          message: `Cross-app import detected: ${from} importing from ${to} — use @joyjoin/shared instead`,
        });
      }
    }

    // Legacy shared/ root import
    if (/from\s+['"]\.\.\/\.\.\/shared\//g.test(content) || /from\s+['"]shared\//g.test(content)) {
      findings.push({
        severity: 'blocker',
        file,
        message: 'Legacy shared/ directory import — use @joyjoin/shared instead',
      });
    }

    // File size
    const lines = content.split('\n').length;
    const isFrontend = file.includes('admin-client') || file.includes('mini-program');
    const warnLimit = isFrontend ? 1200 : 1500;
    const failLimit = isFrontend ? 1800 : 2500;
    if (lines > failLimit) {
      findings.push({
        severity: 'blocker',
        file,
        message: `File too large: ${lines} lines (limit: ${failLimit}). Extract into smaller modules.`,
      });
    } else if (lines > warnLimit) {
      findings.push({
        severity: 'concern',
        file,
        message: `File approaching size limit: ${lines} lines (warn: ${warnLimit}, fail: ${failLimit})`,
      });
    }

    // Hardcoded Chinese strings in shared package (should be in display data)
    if (file.startsWith('packages/shared/') && /['"][^'"]*[\u4e00-\u9fff]{6,}['"]/g.test(content)) {
      findings.push({
        severity: 'nit',
        file,
        message: 'Long hardcoded Chinese string in shared package — ensure this is display data, not business logic',
      });
    }

    // .only left in test files
    if (/\.(test|spec)\./.test(file) && /\b(it|describe|test)\.only\s*\(/g.test(content)) {
      findings.push({
        severity: 'blocker',
        file,
        message: 'Test focus (.only) left in test file — will skip all other tests',
      });
    }

    // TODO/FIXME without issue reference (skip the gate script itself)
    if (file !== 'scripts/harness-completion-gate.mjs') {
      const todoMatches = content.match(/(?:TODO|FIXME)\s*[:\(]?\s*(?!#\d+|https?:\/\/)/gi);
      if (todoMatches && todoMatches.length > 0) {
        findings.push({
          severity: 'nit',
          file,
          message: `${todoMatches.length} TODO/FIXME without issue reference — link to a GitHub issue or ticket`,
        });
      }
    }
  }

  return findings;
}

// ─── Scoring ───

function scorePillar(findings) {
  const weightedFindings = findings.map((f) => ({
    ...f,
    weight: SEVERITY_WEIGHTS[f.severity] || 0,
  }));
  const totalWeight = weightedFindings.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.max(0, 100 - totalWeight * 15);
  const status = score >= PASS_THRESHOLD ? 'pass' : findings.some((f) => f.severity === 'blocker') ? 'fail' : 'concern';
  return { score, status, findings };
}

// ─── Report Formatting ───

function formatReport(result) {
  const lines = [];
  lines.push(`\n╔══════════════════════════════════════════════════════════════════════╗`);
  lines.push(`║     Harness Completion Gate  —  ${result.status.toUpperCase().padEnd(39)} ║`);
  lines.push(`╚══════════════════════════════════════════════════════════════════════╝`);
  lines.push(`  Version: ${result.version}  |  Files checked: ${result.filesChecked}`);
  lines.push('');

  for (const pillar of result.pillars) {
    const icon = pillar.status === 'pass' ? '✅' : pillar.status === 'fail' ? '❌' : '⚠️';
    lines.push(`  ${icon}  ${pillar.name.padEnd(25)}  Score: ${String(pillar.score).padStart(3)}/100`);
    for (const f of pillar.findings.slice(0, 5)) {
      const sev = f.severity === 'blocker' ? '[BLOCKING]' : f.severity === 'concern' ? '[concern] ' : '[nit]     ';
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`      ${sev} ${loc}`);
      lines.push(`               ${f.message}`);
    }
    if (pillar.findings.length > 5) {
      lines.push(`      ... and ${pillar.findings.length - 5} more finding(s)`);
    }
    if (pillar.findings.length > 0) lines.push('');
  }

  lines.push('');
  lines.push(`  Overall: ${result.status.toUpperCase()}  |  Score: ${result.overallScore}/100`);
  lines.push('');
  return lines.join('\n');
}

// ─── Main ───

function main() {
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    const result = {
      version: VERSION,
      status: 'pass',
      overallScore: 100,
      filesChecked: 0,
      pillars: [
        { name: 'Reliability', key: 'reliability', score: 100, status: 'pass', findings: [] },
        { name: 'Scalability', key: 'scalability', score: 100, status: 'pass', findings: [] },
        { name: 'Security', key: 'security', score: 100, status: 'pass', findings: [] },
        { name: 'Observability', key: 'observability', score: 100, status: 'pass', findings: [] },
        { name: 'Maintainability', key: 'maintainability', score: 100, status: 'pass', findings: [] },
      ],
    };
    if (jsonOutput) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write('\n✅ Harness Gate: PASS — no uncommitted changes.\n\n');
    }
    process.exit(0);
  }

  const fileContents = {};
  const fileDiffRanges = {};
  for (const file of changedFiles) {
    fileContents[file] = readFileContent(file);
    const diff = getFileDiff(file);
    fileDiffRanges[file] = parseAddedLineNumbers(diff);
  }

  const reliabilityRaw = checkReliability(changedFiles, fileContents);
  const scalabilityRaw = checkScalability(changedFiles, fileContents);
  const securityRaw = checkSecurity(changedFiles, fileContents);
  const observabilityRaw = checkObservability(changedFiles, fileContents);
  const maintainabilityRaw = checkMaintainability(changedFiles, fileContents);

  // Filter findings to only those on added/modified lines
  const reliability = scorePillar(reliabilityRaw.filter((f) => isFindingInDiff(f, fileDiffRanges[f.file])));
  const scalability = scorePillar(scalabilityRaw.filter((f) => isFindingInDiff(f, fileDiffRanges[f.file])));
  const security = scorePillar(securityRaw.filter((f) => isFindingInDiff(f, fileDiffRanges[f.file])));
  const observability = scorePillar(observabilityRaw.filter((f) => isFindingInDiff(f, fileDiffRanges[f.file])));
  const maintainability = scorePillar(maintainabilityRaw.filter((f) => isFindingInDiff(f, fileDiffRanges[f.file])));

  const pillars = [
    { name: 'Reliability', key: 'reliability', ...reliability },
    { name: 'Scalability', key: 'scalability', ...scalability },
    { name: 'Security', key: 'security', ...security },
    { name: 'Observability', key: 'observability', ...observability },
    { name: 'Maintainability', key: 'maintainability', ...maintainability },
  ];

  const overallScore = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);
  const hasBlocker = pillars.some((p) => p.findings.some((f) => f.severity === 'blocker'));
  const hasConcern = pillars.some((p) => p.findings.some((f) => f.severity === 'concern'));

  let status;
  if (hasBlocker) status = 'fail';
  else if (hasConcern && failOnConcern) status = 'fail';
  else if (hasConcern) status = 'concern';
  else status = 'pass';

  const result = {
    version: VERSION,
    status,
    overallScore,
    filesChecked: changedFiles.length,
    changedFiles,
    pillars,
  };

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(result));
  }

  const exitCode = status === 'pass' ? 0 : status === 'concern' ? 2 : 1;
  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
