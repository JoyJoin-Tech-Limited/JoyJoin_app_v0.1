#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadKnownSkillNames, readJsonCompatibleYaml, validateOrchestrationManifest } from '../orchestration/orchestration-lib.mjs';

export const RUBRIC_VERSION = '2026-04-11.v1';
export const QUALITY_PASS_THRESHOLD = 95;
export const CONFIDENCE_PASS_THRESHOLD = 99;
export const PASS_BANNER = '=== AUTO-EVAL: PASS ===';
export const FAIL_BANNER = '=== AUTO-EVAL: FAIL ===';
export const WARNING_BANNER = '=== AUTO-EVAL: WARNING ===';

const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const PASS_CACHE_RELATIVE_PATH = path.join('.git', '.auto-eval', 'pass-state.json');
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.mp3',
  '.mp4',
  '.mov',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
]);
const NODE_CHECK_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const LARGE_FILE_WARNING_LINE_COUNT = 1500;
const LARGE_FILE_FAILURE_LINE_COUNT = 2500;
const LARGE_FRONTEND_FILE_WARNING_LINE_COUNT = 1200;
const LARGE_FRONTEND_FILE_FAILURE_LINE_COUNT = 1800;
const LARGE_FILE_WARNING_BYTES = 250_000;
const ROOT_TYPECHECK_TRIGGERS = new Set(['package.json', 'tsconfig.json', 'tsconfig.base.json']);
const FRONTEND_CATEGORIES = new Set(['admin-client', 'mini-program']);
const MODES = new Set(['manual-report', 'session-start', 'pre-tool-use', 'json']);

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function shortFingerprint(fingerprint) {
  return fingerprint.slice(0, 12);
}

function defaultTimeoutProfile(mode) {
  if (mode === 'manual-report') {
    return {
      syntax: 10_000,
      guardrails: 20_000,
      workspaceTypecheck: 60_000,
      // Root `npm run typecheck` chains all workspaces; ~4min observed on dev machines.
      rootTypecheck: 300_000,
      miniProgramTypecheck: 90_000,
    };
  }

  return {
    syntax: 8_000,
    guardrails: 15_000,
    workspaceTypecheck: 45_000,
    rootTypecheck: 300_000,
    miniProgramTypecheck: 60_000,
  };
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: MAX_BUFFER_BYTES,
  });

  const error = result.error ? String(result.error.message || result.error) : null;
  const timedOut = Boolean(result.error && result.error.code === 'ETIMEDOUT');

  return {
    command,
    args,
    commandLine: [command, ...args].join(' '),
    cwd: options.cwd,
    status: typeof result.status === 'number' ? result.status : null,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error,
    timedOut,
  };
}

function resolveRepoRoot(startDir = process.cwd()) {
  const result = runCommand('git', ['rev-parse', '--show-toplevel'], {
    cwd: startDir,
    timeoutMs: 5_000,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.error || 'Unable to resolve git repository root');
  }

  return result.stdout.trim();
}

function readGitStatus(repoRoot) {
  const result = runCommand('git', ['status', '--porcelain=v1'], {
    cwd: repoRoot,
    timeoutMs: 5_000,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.error || 'Unable to inspect git status');
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStatusLine)
    .filter((entry) => entry !== null);
}

function parseStatusLine(line) {
  if (line.length < 4) {
    return null;
  }

  const status = line.slice(0, 2);
  const payload = line.slice(3);
  const isRenameOrCopy = /R|C/.test(status);

  if (isRenameOrCopy && payload.includes(' -> ')) {
    const [originalPath, nextPath] = payload.split(' -> ');
    return {
      status,
      path: nextPath,
      originalPath,
    };
  }

  return {
    status,
    path: payload,
    originalPath: null,
  };
}

function isIgnoredWorktreePath(filePath) {
  return (
    filePath.startsWith('node_modules/') ||
    filePath.includes('/node_modules/') ||
    filePath.startsWith('dist/') ||
    filePath.startsWith('build/') ||
    filePath.startsWith('coverage/') ||
    filePath.startsWith('.git/') ||
    filePath.startsWith('archived/')
  );
}

function isBinaryPath(filePath) {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function classifyPath(filePath) {
  if (filePath.startsWith('apps/server/')) return 'server';
  if (filePath.startsWith('apps/admin-client/')) return 'admin-client';
  if (filePath.startsWith('apps/mini-program/')) return 'mini-program';
  if (filePath.startsWith('packages/shared/')) return 'shared';
  if (filePath.startsWith('.github/agents/')) return 'agent-customization';
  if (filePath.startsWith('.github/hooks/')) return 'hook-customization';
  if (filePath.startsWith('.github/')) return 'github-config';
  if (filePath.startsWith('scripts/')) return 'scripts';
  if (filePath.startsWith('docs/') || filePath.endsWith('.md')) return 'docs';
  if (ROOT_TYPECHECK_TRIGGERS.has(filePath)) return 'root-config';
  if (filePath.startsWith('infra/') || filePath.startsWith('deployment/')) return 'infra';
  return 'other';
}

function countLines(text) {
  if (text === '') {
    return 0;
  }

  return text.split(/\r?\n/).length;
}

function computeFileHash(absolutePath) {
  const content = fs.readFileSync(absolutePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function expandEntry(repoRoot, entry) {
  const absolutePath = path.join(repoRoot, entry.path);

  if (!fs.existsSync(absolutePath)) {
    return [entry];
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    return [entry];
  }

  const nestedEntries = [];
  const stack = [absolutePath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const currentStats = fs.statSync(currentPath);

    if (currentStats.isDirectory()) {
      const children = fs.readdirSync(currentPath);
      for (const child of children) {
        stack.push(path.join(currentPath, child));
      }
      continue;
    }

    nestedEntries.push({
      ...entry,
      path: path.relative(repoRoot, currentPath),
      originalPath: null,
    });
  }

  return nestedEntries.sort((left, right) => left.path.localeCompare(right.path));
}

function buildChangedFiles(repoRoot, entries) {
  return entries
    .flatMap((entry) => expandEntry(repoRoot, entry))
    .filter((entry) => !isIgnoredWorktreePath(entry.path))
    .map((entry) => {
      const absolutePath = path.join(repoRoot, entry.path);
      const exists = fs.existsSync(absolutePath);
      const binary = exists && isBinaryPath(entry.path);
      const category = classifyPath(entry.path);
      const hash = exists && !binary ? computeFileHash(absolutePath) : entry.status.includes('D') ? 'deleted' : null;

      let content = null;
      let lineCount = null;
      let byteSize = null;

      if (exists) {
        const stats = fs.statSync(absolutePath);
        byteSize = stats.size;
        if (!binary) {
          content = fs.readFileSync(absolutePath, 'utf8');
          lineCount = countLines(content);
        }
      }

      return {
        ...entry,
        absolutePath,
        category,
        exists,
        binary,
        hash,
        content,
        lineCount,
        byteSize,
        extension: path.extname(entry.path).toLowerCase(),
      };
    });
}

function buildFingerprint(changedFiles) {
  const serialized = JSON.stringify({
    rubricVersion: RUBRIC_VERSION,
    files: changedFiles
      .map((file) => ({
        status: file.status,
        path: file.path,
        hash: file.hash,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  });

  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function createFinding({ moduleKey, severity, filePath = null, line = null, message, evidence = null }) {
  return {
    moduleKey,
    severity,
    filePath,
    line,
    message,
    evidence,
  };
}

function relativizePath(repoRoot, filePath) {
  if (!filePath) {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return path.relative(repoRoot, filePath);
  }

  return filePath;
}

function normalizeDiscoveredPath(repoRoot, baseDir, filePath) {
  if (!filePath) {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return path.relative(repoRoot, filePath);
  }

  const resolvedFromBase = path.resolve(baseDir, filePath);
  if (resolvedFromBase.startsWith(repoRoot)) {
    return path.relative(repoRoot, resolvedFromBase);
  }

  return filePath;
}

function parseLocation(repoRoot, baseDir, text) {
  const tscMatch = text.match(/^(.*)\((\d+),(\d+)\):\s+error\s+TS\d+:/);
  if (tscMatch) {
    return {
      filePath: normalizeDiscoveredPath(repoRoot, baseDir, tscMatch[1]),
      line: Number(tscMatch[2]),
    };
  }

  const colonMatch = text.match(/([A-Za-z0-9_./ %\-]+\.[A-Za-z0-9]+):(\d+)(?::\d+)?/);
  if (colonMatch) {
    return {
      filePath: normalizeDiscoveredPath(repoRoot, baseDir, colonMatch[1]),
      line: Number(colonMatch[2]),
    };
  }

  return null;
}

function normalizeCommandLines(result) {
  return `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripLeadingLocation(text) {
  const tscMatch = text.match(/^(.*)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/);
  if (tscMatch) {
    return `TypeScript error ${tscMatch[4]}: ${tscMatch[5]}`;
  }

  const colonMatch = text.match(/^([A-Za-z0-9_./ %\-]+\.[A-Za-z0-9]+):(\d+)(?::\d+)?\s*-?\s*(.*)$/);
  if (colonMatch && colonMatch[3]) {
    return colonMatch[3];
  }

  return text;
}

function parseFailureFindings(repoRoot, moduleKey, result, commandKind) {
  const baseDir = result.cwd ?? repoRoot;
  const lines = normalizeCommandLines(result);

  if (commandKind === 'guardrails') {
    const findings = lines
      .filter((line) => line.startsWith('- '))
      .map((line) => {
        const location = parseLocation(repoRoot, baseDir, line);
        return createFinding({
          moduleKey,
          severity: 'blocker',
          filePath: location?.filePath ?? null,
          line: location?.line ?? null,
          message: line.slice(2).trim(),
          evidence: result.commandLine,
        });
      });

    if (findings.length > 0) {
      return findings;
    }
  }

  const candidateLines = lines.filter((line) => line.includes('error') || line.includes('Error') || line.includes('SyntaxError'));
  const sourceLines = candidateLines.length > 0 ? candidateLines : lines;

  const findings = sourceLines.slice(0, 8).map((line) => {
    const location = parseLocation(repoRoot, baseDir, line);
    return createFinding({
      moduleKey,
      severity: 'blocker',
      filePath: location?.filePath ?? null,
      line: location?.line ?? null,
      message: stripLeadingLocation(line),
      evidence: result.commandLine,
    });
  });

  if (findings.length > 0) {
    return findings;
  }

  return [
    createFinding({
      moduleKey,
      severity: 'blocker',
      message: `${commandKind} failed with exit code ${result.status ?? 'unknown'}`,
      evidence: result.commandLine,
    }),
  ];
}

function validateAgentFrontmatter(moduleKey, file) {
  const findings = [];
  const content = file.content ?? '';

  if (!content.startsWith('---\n')) {
    findings.push(
      createFinding({
        moduleKey,
        severity: 'blocker',
        filePath: file.path,
        line: 1,
        message: 'Agent file is missing YAML frontmatter opening markers.',
      }),
    );
    return findings;
  }

  const closingIndex = content.indexOf('\n---', 4);
  if (closingIndex === -1) {
    findings.push(
      createFinding({
        moduleKey,
        severity: 'blocker',
        filePath: file.path,
        line: 1,
        message: 'Agent file is missing YAML frontmatter closing markers.',
      }),
    );
    return findings;
  }

  const frontmatter = content.slice(4, closingIndex + 1);
  for (const requiredKey of ['name:', 'description:']) {
    if (!frontmatter.includes(requiredKey)) {
      findings.push(
        createFinding({
          moduleKey,
          severity: 'blocker',
          filePath: file.path,
          line: 1,
          message: `Agent frontmatter is missing required key ${requiredKey.replace(':', '')}.`,
        }),
      );
    }
  }

  return findings;
}

function runSyntaxPreflight(repoRoot, changedFiles, timeoutProfile) {
  const moduleKey = 'logic-correctness';
  const findings = [];
  const evidence = [];

  for (const file of changedFiles) {
    if (!file.exists || file.binary) {
      continue;
    }

    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(file.content ?? '');
        evidence.push(`json-parse:${file.path}`);
      } catch (error) {
        findings.push(
          createFinding({
            moduleKey,
            severity: 'blocker',
            filePath: file.path,
            line: 1,
            message: `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        );
      }
      continue;
    }

    if (file.path === '.github/orchestration.yaml') {
      try {
        const manifest = readJsonCompatibleYaml(file.content ?? '', file.path);
        const validation = validateOrchestrationManifest(manifest, {
          knownSkillNames: loadKnownSkillNames(repoRoot),
        });

        if (!validation.valid) {
          for (const message of validation.errors.slice(0, 10)) {
            findings.push(
              createFinding({
                moduleKey,
                severity: 'blocker',
                filePath: file.path,
                line: 1,
                message,
              }),
            );
          }
        } else {
          evidence.push(`orchestration-manifest-check:${file.path}`);
        }
      } catch (error) {
        findings.push(
          createFinding({
            moduleKey,
            severity: 'blocker',
            filePath: file.path,
            line: 1,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      continue;
    }

    if (file.path.endsWith('.agent.md')) {
      findings.push(...validateAgentFrontmatter(moduleKey, file));
      evidence.push(`frontmatter-check:${file.path}`);
      continue;
    }

    if (NODE_CHECK_EXTENSIONS.has(file.extension)) {
      const result = runCommand('node', ['--check', file.absolutePath], {
        cwd: repoRoot,
        timeoutMs: timeoutProfile.syntax,
      });

      if (result.error && result.status === null) {
        return {
          status: 'system-error',
          findings: [
            createFinding({
              moduleKey,
              severity: 'blocker',
              filePath: file.path,
              line: 1,
              message: `Syntax preflight infrastructure error: ${result.error}`,
              evidence: result.commandLine,
            }),
          ],
          evidence,
          reason: `Syntax preflight infrastructure error for ${file.path}`,
        };
      }

      if (result.status !== 0) {
        findings.push(...parseFailureFindings(repoRoot, moduleKey, result, 'syntax preflight'));
      } else {
        evidence.push(`node-check:${file.path}`);
      }
    }
  }

  return {
    status: findings.length > 0 ? 'fail' : 'pass',
    findings,
    evidence,
    reason: findings[0]?.message ?? null,
  };
}

function createModuleResult({ key, name, score, confidence, status, findings, evidence, reason = null }) {
  return {
    key,
    name,
    score: clampScore(score),
    confidence: clampScore(confidence),
    status,
    findings: findings.slice(0, 50),
    evidence,
    reason,
  };
}

function runComplexityModule(changedFiles) {
  const key = 'complexity-maintainability';
  const findings = [];
  let score = 100;
  let confidence = 100;
  let deductionCount = 0;

  for (const file of changedFiles) {
    if (!file.exists || file.binary || file.lineCount === null || file.category === 'docs') {
      continue;
    }

    const isFrontend = FRONTEND_CATEGORIES.has(file.category);
    const warningThreshold = isFrontend ? LARGE_FRONTEND_FILE_WARNING_LINE_COUNT : LARGE_FILE_WARNING_LINE_COUNT;
    const failureThreshold = isFrontend ? LARGE_FRONTEND_FILE_FAILURE_LINE_COUNT : LARGE_FILE_FAILURE_LINE_COUNT;

    if (file.lineCount > failureThreshold) {
      findings.push(
        createFinding({
          moduleKey: key,
          severity: 'minor',
          filePath: file.path,
          line: 1,
          message: `Changed file is very large (${file.lineCount} lines), which raises maintainability risk.`,
        }),
      );
      deductionCount += 1;
    } else if (file.lineCount > warningThreshold) {
      findings.push(
        createFinding({
          moduleKey: key,
          severity: 'minor',
          filePath: file.path,
          line: 1,
          message: `Changed file is large (${file.lineCount} lines); keep ownership and complexity under control.`,
        }),
      );
    }
  }

  score -= Math.min(deductionCount, 3);

  if (changedFiles.some((file) => file.binary)) {
    confidence -= 1;
  }

  const status = score >= QUALITY_PASS_THRESHOLD && confidence >= CONFIDENCE_PASS_THRESHOLD ? 'pass' : 'fail';
  const reason = findings[0]?.message ?? null;

  return createModuleResult({
    key,
    name: 'Complexity & Maintainability',
    score,
    confidence,
    status,
    findings,
    evidence: changedFiles.map((file) => `${file.status.trim() || file.status}:${file.path}`),
    reason,
  });
}

function planLogicCommands(repoRoot, changedFiles, timeoutProfile) {
  const commands = [];
  const categories = new Set(changedFiles.map((file) => file.category));
  const needsRootTypecheck = changedFiles.some(
    (file) => file.category === 'shared' || file.category === 'root-config',
  );

  if (needsRootTypecheck) {
    commands.push({
      id: 'typecheck-root',
      label: 'Root typecheck',
      command: 'npm',
      args: ['run', 'typecheck'],
      cwd: repoRoot,
      timeoutMs: timeoutProfile.rootTypecheck,
    });
  } else {
    if (categories.has('server')) {
      commands.push({
        id: 'typecheck-server',
        label: 'Server typecheck',
        command: 'npm',
        args: ['run', 'typecheck', '-w', '@joyjoin/server'],
        cwd: repoRoot,
        timeoutMs: timeoutProfile.workspaceTypecheck,
      });
    }

    // user-client paused for mini-program launch focus
    // if (categories.has('user-client')) {
    //   commands.push({
    //     id: 'typecheck-user-client',
    //     label: 'User client typecheck',
    //     command: 'npm',
    //     args: ['run', 'typecheck', '-w', '@joyjoin/user-client'],
    //     cwd: repoRoot,
    //     timeoutMs: timeoutProfile.workspaceTypecheck,
    //   });
    // }

    if (categories.has('admin-client')) {
      commands.push({
        id: 'typecheck-admin-client',
        label: 'Admin client typecheck',
        command: 'npm',
        args: ['run', 'typecheck', '-w', '@joyjoin/admin-client'],
        cwd: repoRoot,
        timeoutMs: timeoutProfile.workspaceTypecheck,
      });
    }
  }

  if (categories.has('mini-program')) {
    commands.push({
      id: 'typecheck-mini-program',
      label: 'Mini-program TypeScript check',
      command: 'npm',
      args: ['exec', '--', 'tsc', '-p', 'tsconfig.json', '--noEmit'],
      cwd: path.join(repoRoot, 'apps/mini-program'),
      timeoutMs: timeoutProfile.miniProgramTypecheck,
    });
  }

  return commands;
}

function runLogicModule(repoRoot, changedFiles, mode, timeoutProfile) {
  const key = 'logic-correctness';
  const syntaxResult = runSyntaxPreflight(repoRoot, changedFiles, timeoutProfile);

  if (syntaxResult.status === 'system-error') {
    return createModuleResult({
      key,
      name: 'Logic & Correctness',
      score: 0,
      confidence: 0,
      status: 'system-error',
      findings: syntaxResult.findings,
      evidence: syntaxResult.evidence,
      reason: syntaxResult.reason,
    });
  }

  const findings = [...syntaxResult.findings];
  const evidence = [...syntaxResult.evidence];
  const commands = planLogicCommands(repoRoot, changedFiles, timeoutProfile);

  for (const command of commands) {
    const result = runCommand(command.command, command.args, {
      cwd: command.cwd,
      timeoutMs: command.timeoutMs,
    });

    if (result.error && result.status === null) {
      return createModuleResult({
        key,
        name: 'Logic & Correctness',
        score: 0,
        confidence: 0,
        status: 'system-error',
        findings: [
          createFinding({
            moduleKey: key,
            severity: 'blocker',
            message: `${command.label} infrastructure error: ${result.error}`,
            evidence: command.id,
          }),
        ],
        evidence,
        reason: `${command.label} infrastructure error`,
      });
    }

    if (result.status !== 0) {
      findings.push(...parseFailureFindings(repoRoot, key, result, command.label));
    } else {
      evidence.push(command.id);
    }
  }

  const score = findings.length > 0 ? 60 : 100;
  const confidence = 100;
  const status = findings.length > 0 ? 'fail' : 'pass';
  const reason = findings[0]?.message ?? null;

  return createModuleResult({
    key,
    name: 'Logic & Correctness',
    score,
    confidence,
    status,
    findings,
    evidence,
    reason,
  });
}

function runSecurityModule(repoRoot, changedFiles, timeoutProfile) {
  const key = 'security-robustness';

  const result = runCommand('node', ['scripts/check/check-guardrails.mjs'], {
    cwd: repoRoot,
    timeoutMs: timeoutProfile.guardrails,
  });

  if (result.error && result.status === null) {
    return createModuleResult({
      key,
      name: 'Security & Robustness',
      score: 0,
      confidence: 0,
      status: 'system-error',
      findings: [
        createFinding({
          moduleKey: key,
          severity: 'blocker',
          message: `Guardrails infrastructure error: ${result.error}`,
          evidence: result.commandLine,
        }),
      ],
      evidence: [],
      reason: 'Guardrails infrastructure error',
    });
  }

  if (result.status !== 0) {
    const findings = parseFailureFindings(repoRoot, key, result, 'guardrails');
    return createModuleResult({
      key,
      name: 'Security & Robustness',
      score: 40,
      confidence: 100,
      status: 'fail',
      findings,
      evidence: [],
      reason: findings[0]?.message ?? 'Guardrails failed',
    });
  }

  return createModuleResult({
    key,
    name: 'Security & Robustness',
    score: 100,
    confidence: 100,
    status: 'pass',
    findings: [],
    evidence: ['guardrails'],
  });
}

function runPerformanceModule(changedFiles) {
  const key = 'performance-efficiency';
  const findings = [];
  let score = 100;
  let confidence = 99;
  let deductionCount = 0;

  for (const file of changedFiles) {
    if (!file.exists || file.binary || file.category === 'docs') {
      continue;
    }

    if (FRONTEND_CATEGORIES.has(file.category) && typeof file.lineCount === 'number') {
      if (file.lineCount > LARGE_FRONTEND_FILE_FAILURE_LINE_COUNT) {
        findings.push(
          createFinding({
            moduleKey: key,
            severity: 'minor',
            filePath: file.path,
            line: 1,
            message: `Frontend file is unusually large (${file.lineCount} lines), which increases runtime and review risk.`,
          }),
        );
        deductionCount += 1;
      } else if (file.lineCount > LARGE_FRONTEND_FILE_WARNING_LINE_COUNT) {
        findings.push(
          createFinding({
            moduleKey: key,
            severity: 'minor',
            filePath: file.path,
            line: 1,
            message: `Frontend file is large (${file.lineCount} lines); check that loading and rendering costs remain intentional.`,
          }),
        );
      }
    }

    if (typeof file.byteSize === 'number' && file.byteSize > LARGE_FILE_WARNING_BYTES) {
      findings.push(
        createFinding({
          moduleKey: key,
          severity: 'minor',
          filePath: file.path,
          line: 1,
          message: `Changed file is large on disk (${file.byteSize} bytes); check whether the added weight is intentional.`,
        }),
      );
    }
  }

  score -= Math.min(deductionCount, 3);

  const status = score >= QUALITY_PASS_THRESHOLD && confidence >= CONFIDENCE_PASS_THRESHOLD ? 'pass' : 'fail';
  const reason = findings[0]?.message ?? null;

  return createModuleResult({
    key,
    name: 'Performance & Efficiency',
    score,
    confidence,
    status,
    findings,
    evidence: ['heuristic-review'],
    reason,
  });
}

function runHarnessModule(repoRoot, changedFiles, timeoutProfile) {
  const key = 'harness-engineering';

  const result = runCommand('node', ['scripts/harness/harness-completion-gate.mjs', '--json'], {
    cwd: repoRoot,
    timeoutMs: timeoutProfile.guardrails + 5000,
  });

  if (result.error && result.status === null) {
    return createModuleResult({
      key,
      name: 'Harness Engineering',
      score: 0,
      confidence: 0,
      status: 'system-error',
      findings: [
        createFinding({
          moduleKey: key,
          severity: 'blocker',
          message: `Harness gate infrastructure error: ${result.error}`,
          evidence: result.commandLine,
        }),
      ],
      evidence: [],
      reason: 'Harness gate infrastructure error',
    });
  }

  let gateResult;
  try {
    gateResult = JSON.parse(result.stdout);
  } catch {
    return createModuleResult({
      key,
      name: 'Harness Engineering',
      score: 0,
      confidence: 0,
      status: 'system-error',
      findings: [
        createFinding({
          moduleKey: key,
          severity: 'blocker',
          message: 'Unable to parse Harness gate output',
          evidence: result.stdout.slice(0, 200),
        }),
      ],
      evidence: [],
      reason: 'Harness gate output parse error',
    });
  }

  const findings = [];
  for (const pillar of gateResult.pillars ?? []) {
    for (const f of pillar.findings ?? []) {
      findings.push(
        createFinding({
          moduleKey: key,
          severity: f.severity === 'blocker' ? 'major' : f.severity === 'concern' ? 'minor' : 'info',
          filePath: f.file,
          line: f.line ?? 1,
          message: `[${pillar.name}] ${f.message}`,
        }),
      );
    }
  }

  const score = gateResult.overallScore ?? 0;
  const status = gateResult.status === 'pass' ? 'pass' : 'fail';

  return createModuleResult({
    key,
    name: 'Harness Engineering',
    score,
    confidence: 95,
    status,
    findings,
    evidence: ['harness-completion-gate'],
    reason: findings[0]?.message ?? 'Harness gate completed',
  });
}

function summarizeChangedFiles(changedFiles) {
  const counts = {};

  for (const file of changedFiles) {
    counts[file.category] = (counts[file.category] ?? 0) + 1;
  }

  return counts;
}

function getPassCachePath(repoRoot) {
  return path.join(repoRoot, PASS_CACHE_RELATIVE_PATH);
}

export function readPassCache(repoRoot) {
  const cachePath = getPassCachePath(repoRoot);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writePassCache(repoRoot, payload) {
  const cachePath = getPassCachePath(repoRoot);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function buildResult({ repoRoot, mode, cleanWorktree, fingerprint, changedFiles, modules, status, reason, cacheHit }) {
  const executedModules = modules.filter((module) => module.status !== 'skipped');
  const overallQuality = executedModules.length > 0 ? Math.min(...executedModules.map((module) => module.score)) : 100;
  const overallConfidence = executedModules.length > 0 ? Math.min(...executedModules.map((module) => module.confidence)) : 100;
  const pass = status === 'pass';

  return {
    status,
    mode,
    repoRoot,
    cleanWorktree,
    rubricVersion: RUBRIC_VERSION,
    thresholds: {
      quality: QUALITY_PASS_THRESHOLD,
      confidence: CONFIDENCE_PASS_THRESHOLD,
    },
    fingerprint,
    fingerprintShort: fingerprint ? shortFingerprint(fingerprint) : null,
    changedFileCount: changedFiles.length,
    changedFiles: changedFiles.map((file) => ({
      path: file.path,
      status: file.status,
      category: file.category,
      exists: file.exists,
    })),
    categoryCounts: summarizeChangedFiles(changedFiles),
    modules,
    overallQuality,
    overallConfidence,
    pass,
    reason,
    cacheHit,
  };
}

function skippedModule(key, name, reason) {
  return createModuleResult({
    key,
    name,
    score: 0,
    confidence: 0,
    status: 'skipped',
    findings: [],
    evidence: [],
    reason,
  });
}

export function evaluateWorkspace(options = {}) {
  const mode = MODES.has(options.mode) ? options.mode : 'manual-report';
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : resolveRepoRoot(process.cwd());
  const timeoutProfile = defaultTimeoutProfile(mode);
  const statusEntries = readGitStatus(repoRoot);
  const changedFiles = buildChangedFiles(repoRoot, statusEntries);

  if (changedFiles.length === 0) {
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: true,
      fingerprint: null,
      changedFiles,
      modules: [
        createModuleResult({
          key: 'complexity-maintainability',
          name: 'Complexity & Maintainability',
          score: 100,
          confidence: 100,
          status: 'pass',
          findings: [],
          evidence: ['clean-worktree'],
        }),
        createModuleResult({
          key: 'logic-correctness',
          name: 'Logic & Correctness',
          score: 100,
          confidence: 100,
          status: 'pass',
          findings: [],
          evidence: ['clean-worktree'],
        }),
        createModuleResult({
          key: 'security-robustness',
          name: 'Security & Robustness',
          score: 100,
          confidence: 100,
          status: 'pass',
          findings: [],
          evidence: ['clean-worktree'],
        }),
        createModuleResult({
          key: 'performance-efficiency',
          name: 'Performance & Efficiency',
          score: 100,
          confidence: 100,
          status: 'pass',
          findings: [],
          evidence: ['clean-worktree'],
        }),
      ],
      status: 'pass',
      reason: 'No uncommitted changes detected.',
      cacheHit: false,
    });
  }

  const fingerprint = buildFingerprint(changedFiles);
  const modules = [];
  const cache = readPassCache(repoRoot);
  const cacheHit = Boolean(
    cache &&
      cache.rubricVersion === RUBRIC_VERSION &&
      cache.fingerprint === fingerprint &&
      cache.pass === true,
  );

  const complexityModule = runComplexityModule(changedFiles);
  modules.push(complexityModule);
  if (complexityModule.status !== 'pass') {
    modules.push(skippedModule('logic-correctness', 'Logic & Correctness', 'Skipped after earlier blocking module.'));
    modules.push(skippedModule('security-robustness', 'Security & Robustness', 'Skipped after earlier blocking module.'));
    modules.push(skippedModule('performance-efficiency', 'Performance & Efficiency', 'Skipped after earlier blocking module.'));
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: false,
      fingerprint,
      changedFiles,
      modules,
      status: 'fail',
      reason: complexityModule.reason,
      cacheHit,
    });
  }

  const logicModule = runLogicModule(repoRoot, changedFiles, mode, timeoutProfile);
  modules.push(logicModule);
  if (logicModule.status === 'system-error') {
    modules.push(skippedModule('security-robustness', 'Security & Robustness', 'Skipped after earlier operational error.'));
    modules.push(skippedModule('performance-efficiency', 'Performance & Efficiency', 'Skipped after earlier operational error.'));
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: false,
      fingerprint,
      changedFiles,
      modules,
      status: 'system-error',
      reason: logicModule.reason,
      cacheHit,
    });
  }

  if (logicModule.status !== 'pass') {
    modules.push(skippedModule('security-robustness', 'Security & Robustness', 'Skipped after earlier blocking module.'));
    modules.push(skippedModule('performance-efficiency', 'Performance & Efficiency', 'Skipped after earlier blocking module.'));
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: false,
      fingerprint,
      changedFiles,
      modules,
      status: 'fail',
      reason: logicModule.reason,
      cacheHit,
    });
  }

  const securityModule = runSecurityModule(repoRoot, changedFiles, timeoutProfile);
  modules.push(securityModule);
  if (securityModule.status === 'system-error') {
    modules.push(skippedModule('performance-efficiency', 'Performance & Efficiency', 'Skipped after earlier operational error.'));
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: false,
      fingerprint,
      changedFiles,
      modules,
      status: 'system-error',
      reason: securityModule.reason,
      cacheHit,
    });
  }

  if (securityModule.status !== 'pass') {
    modules.push(skippedModule('performance-efficiency', 'Performance & Efficiency', 'Skipped after earlier blocking module.'));
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: false,
      fingerprint,
      changedFiles,
      modules,
      status: 'fail',
      reason: securityModule.reason,
      cacheHit,
    });
  }

  const performanceModule = runPerformanceModule(changedFiles);
  modules.push(performanceModule);

  if (performanceModule.status !== 'pass') {
    modules.push(skippedModule('harness-engineering', 'Harness Engineering', 'Skipped after earlier blocking module.'));
    return buildResult({
      repoRoot,
      mode,
      cleanWorktree: false,
      fingerprint,
      changedFiles,
      modules,
      status: 'fail',
      reason: performanceModule.reason,
      cacheHit,
    });
  }

  const harnessModule = runHarnessModule(repoRoot, changedFiles, timeoutProfile);
  modules.push(harnessModule);

  const status = harnessModule.status === 'pass' ? 'pass' : 'fail';
  const result = buildResult({
    repoRoot,
    mode,
    cleanWorktree: false,
    fingerprint,
    changedFiles,
    modules,
    status,
    reason: performanceModule.reason,
    cacheHit,
  });

  if (result.pass) {
    writePassCache(repoRoot, {
      rubricVersion: RUBRIC_VERSION,
      fingerprint,
      fingerprintShort: shortFingerprint(fingerprint),
      overallQuality: result.overallQuality,
      overallConfidence: result.overallConfidence,
      changedFileCount: result.changedFileCount,
      pass: true,
      updatedAt: new Date().toISOString(),
    });
  }

  return result;
}

function formatFinding(finding) {
  const location = finding.filePath
    ? finding.line
      ? `${finding.filePath}:${finding.line}`
      : finding.filePath
    : 'workspace';

  return `- [${finding.severity}] ${location} — ${finding.message}`;
}

export function formatManualReport(result) {
  if (result.cleanWorktree) {
    return [
      PASS_BANNER,
      'Clean worktree. No uncommitted changes detected.',
      'Overall quality: 100',
      'Overall confidence: 100',
    ].join('\n');
  }

  const banner = result.status === 'pass' ? PASS_BANNER : result.status === 'fail' ? FAIL_BANNER : WARNING_BANNER;
  const lines = [
    banner,
    `Fingerprint: ${result.fingerprintShort}`,
    `Thresholds: quality >= ${QUALITY_PASS_THRESHOLD}, confidence >= ${CONFIDENCE_PASS_THRESHOLD}`,
    `Overall quality: ${result.overallQuality}`,
    `Overall confidence: ${result.overallConfidence}`,
    `Changed files: ${result.changedFileCount}`,
    '',
    'Modules:',
  ];

  for (const module of result.modules) {
    lines.push(
      `- ${module.name}: ${module.status.toUpperCase()} (quality ${module.score}, confidence ${module.confidence})`,
    );
  }

  const findings = result.modules.flatMap((module) => module.findings).slice(0, 20);
  if (findings.length > 0) {
    lines.push('', 'Findings:');
    for (const finding of findings) {
      lines.push(formatFinding(finding));
    }
  } else {
    lines.push('', 'Findings:', '- None.');
  }

  if (result.reason) {
    lines.push('', `Blocking reason: ${result.reason}`);
  }

  if (result.status !== 'pass') {
    lines.push('', 'Recovery path:', '- Re-run this report after fixing the blocking findings.');
    lines.push('- The current pass cache only becomes valid when the exact dirty-worktree fingerprint passes.');
  }

  return lines.join('\n');
}
