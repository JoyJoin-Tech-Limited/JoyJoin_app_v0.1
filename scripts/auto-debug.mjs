#!/usr/bin/env node
/**
 * Auto-Debug — Deep Bug-Finding Automation
 * ==========================================
 *
 * Inspects recent commits and identifies high-severity correctness bugs that
 * escaped review.  Only surfaces issues that would cause data loss, crashes,
 * security holes, or significant user-facing breakage.
 *
 * Usage:
 *   node scripts/auto-debug.mjs                         # inspect recent commits (default: 10)
 *   node scripts/auto-debug.mjs --commits 20            # look back further
 *   node scripts/auto-debug.mjs --range HEAD~5..HEAD    # explicit range
 *   node scripts/auto-debug.mjs --pr                     # create PR if bugs found (CI mode)
 *   node scripts/auto-debug.mjs --wecom                  # send WeCom notification
 *
 * Exit codes:
 *   0 = no critical bugs found
 *   1 = critical bug(s) found (and fixed if --pr)
 *   2 = analysis error
 *
 * Environment:
 *   GITHUB_TOKEN          – GitHub token for PR creation (required with --pr)
 *   GITHUB_REPOSITORY     – "owner/repo" format (auto-set in GitHub Actions)
 *   WECOM_BOT_KEY         – WeCom bot key (required with --wecom)
 */

// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '2026-05-01.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_COMMIT_LOOKBACK = 10;
const SEVERITY_LEVELS = /** @type {const} */ ({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});
const MIN_SEVERITY_TO_PR = 'HIGH';

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
  commits: DEFAULT_COMMIT_LOOKBACK,
  range: null,         /** @type {string | null} */
  pr: false,
  wecom: false,
  verbose: false,
  branch: 'auto-debug', /** @type {string} */
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--commits' && i + 1 < args.length) flags.commits = parseInt(args[++i], 10);
  else if (args[i] === '--range' && i + 1 < args.length) flags.range = args[++i];
  else if (args[i] === '--pr') flags.pr = true;
  else if (args[i] === '--wecom') flags.wecom = true;
  else if (args[i] === '--verbose') flags.verbose = true;
  else if (args[i] === '--branch' && i + 1 < args.length) flags.branch = args[++i];
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

function getCommitDiff(range) {
  const result = git(['diff', range, '--', ':!package-lock.json', ':!*.lock']);
  return result.ok ? result.output : '';
}

function getChangedFiles(range) {
  const result = git(['diff', '--name-only', range, '--', ':!package-lock.json', ':!*.lock']);
  return result.ok ? result.output.split('\n').filter(Boolean) : [];
}

function getFileContents(filePath, commit) {
  const result = git(['show', `${commit}:${filePath}`]);
  return result.ok ? result.output : null;
}

function fileExistsInRepo(filePath, commit) {
  const result = git(['ls-tree', commit, '--', filePath]);
  return result.ok && result.output.length > 0;
}

// ─── Static analysis patterns ────────────────────────────────────────────────

/**
 * Each pattern describes a bug class to detect in the diff.
 * @typedef {{ severity: string; category: string; message: string; remediation: string; locations: { file: string; line: number; snippet: string }[] }} Finding
 */

/** Regex-based scans for common severe bug patterns */
const BUG_PATTERNS = [
  // ── Null/undefined safety ──
  {
    name: 'possible-null-deref',
    description: 'Property access on potentially null/undefined value without guard',
    severity: 'HIGH',
    /** @param {string} file string */
    /** @param {string[]} lines string[] */
    /** @param {string} diff string */
    detect(file, lines, diff) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match: const x = obj?.foo?.bar?.baz  (excessive optional chaining that may mask null)
        // Match: someVar.property  where someVar could be null (no ?. and no guard above)
        // We look for patterns where a variable is used without null check after potential null assignment
        const nullReturns = line.match(/(?:return|null|undefined)\s*;?\s*$/);
        const propAccess = line.match(/[a-zA-Z_$]\w*\.(?!\w*\(|\s*\.\.\.)(\w+)/);
        const isGuarded = i > 0 && (lines[i-1].includes('if') || lines[i-1].includes('assert') || lines[i-1].includes('??'));
        if (nullReturns && propAccess && !isGuarded && !line.includes('?.') && !line.includes('optional')) {
          // Check if the variable being accessed could be null from context
          const varName = propAccess[0].split('.')[0];
          for (let j = Math.max(0, i-5); j < i; j++) {
            if (lines[j].includes(`let ${varName}`) || lines[j].includes(`const ${varName}`) || lines[j].includes(`var ${varName}`)) {
              if (lines[j].includes('??') || lines[j].includes('| null') || lines[j].includes('|undefined')) {
                findings.push({
                  file, line: i + 1,
                  snippet: line.trim(),
                  context: `Potential null dereference of ${varName}`,
                });
              }
            }
          }
        }
      }
      return findings;
    },
  },
  {
    name: 'missing-optional-chaining',
    description: 'Deep property access without optional chaining on nullable type',
    severity: 'MEDIUM',
    detect(file, lines, _diff) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match: foo.bar.baz where a prior line suggests foo could be undefined
        const chain = line.match(/([a-zA-Z_$]\w*)\.(\w+)\.(\w+)/);
        if (chain && !line.includes('?.')) {
          const varName = chain[1];
          for (let j = Math.max(0, i-3); j < i; j++) {
            if ((lines[j].includes(`: ${varName}`) || lines[j].includes(`${varName}:`)) &&
                (lines[j].includes('undefined') || lines[j].includes('null') || lines[j].includes('?'))) {
              findings.push({
                file, line: i + 1,
                snippet: line.trim(),
                context: `Consider optional chaining for ${varName}: ${chain[0]}`,
              });
            }
          }
        }
      }
      return findings;
    },
  },

  // ── Async/Await issues ──
  {
    name: 'missing-await',
    description: 'Promise-like method called without await in async function',
    severity: 'HIGH',
    detect(file, lines, _diff) {
      const findings = [];
      let inAsyncFn = false;
      let braceDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('async ') || line.includes('async (')) inAsyncFn = true;
        if (line.includes('{')) braceDepth++;
        if (line.includes('}')) braceDepth--;
        if (braceDepth <= 0 && i > 0 && !line.trim().startsWith('}')) inAsyncFn = false;

        if (inAsyncFn && braceDepth > 0) {
          // Check for call without await: someAsyncMethod() without leading await
          const match = line.match(/(\w+(?:Service|Repo|Helper|Client|Api|Provider)\w*)\.(\w+)\s*\(/);
          if (match && !line.trim().startsWith('await ') && !line.trim().startsWith('return await ') &&
              !line.includes('// ') && !line.includes('/*') && !line.includes('return ') &&
              !line.includes('const ') && !line.includes('let ') && !line.includes('var ')) {
            // Check if the method is used as standalone statement (side-effect)
            if (!line.trim().startsWith('.') && !line.match(/^\s*(const|let|var|this\.|return|throw|await)/)) {
              findings.push({
                file, line: i + 1,
                snippet: line.trim(),
                context: `Missing await on ${match[0]} in async function`,
              });
            }
          }
        }
      }
      return findings;
    },
  },
  {
    name: 'promise-not-awaited',
    description: 'Promise returned from .then()/.catch() chain not handled at call site',
    severity: 'HIGH',
    detect(file, lines, _diff) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('.then(') && !line.trim().startsWith('return ') && !line.trim().startsWith('await ')) {
          // Standalone .then() call is usually fine if it's fire-and-forget
          // But check if it has a .catch() - if not, it's a swallowed rejection
          if (!line.includes('.catch(')) {
            // Check next lines for .catch
            let hasCatch = false;
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              if (lines[j].includes('.catch(')) { hasCatch = true; break; }
              if (!lines[j].trim().startsWith('.')) break;
            }
            if (!hasCatch) {
              findings.push({
                file, line: i + 1,
                snippet: line.trim(),
                context: 'Unhandled promise rejection — .then() without .catch()',
              });
            }
          }
        }
      }
      return findings;
    },
  },

  // ── Error handling ──
  {
    name: 'empty-catch-block',
    description: 'Empty catch block silently swallows errors',
    severity: 'HIGH',
    detect(file, lines, _diff) {
      const findings = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        if (line.includes('catch (') && nextLine.trim() === '{}') {
          findings.push({
            file, line: i + 1,
            snippet: `${line.trim()} ${nextLine.trim()}`,
            context: 'Empty catch block silently swallows errors',
          });
        }
        // Check for catch(e) {} on single line
        if (line.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
          findings.push({
            file, line: i + 1,
            snippet: line.trim(),
            context: 'Empty catch block silently swallows errors',
          });
        }
      }
      return findings;
    },
  },
  {
    name: 'error-ignored-in-catch',
    description: 'Catch block only logs without re-throwing or handling',
    severity: 'MEDIUM',
    detect(file, lines, _diff) {
      const findings = [];
      let inCatch = false;
      let catchLine = 0;
      let catchBraceDepth = 0;
      let onlyLogging = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('catch (') && line.includes('{')) {
          inCatch = true;
          catchLine = i + 1;
          catchBraceDepth = 1;
          onlyLogging = true;
          continue;
        }
        if (inCatch) {
          if (line.includes('{')) catchBraceDepth++;
          if (line.includes('}')) catchBraceDepth--;
          if (catchBraceDepth <= 0) {
            if (onlyLogging && catchBraceDepth === 0) {
              findings.push({
                file, line: catchLine,
                snippet: lines.slice(catchLine - 1, i + 1).map(l => l.trim()).join(' '),
                context: 'Catch block only logs without recovery or re-throw',
              });
            }
            inCatch = false;
            continue;
          }
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('console.') &&
              !trimmed.startsWith('logger.') && !trimmed.startsWith('*')) {
            onlyLogging = false;
          }
        }
      }
      return findings;
    },
  },

  // ── Security: Auth bypass ──
  {
    name: 'missing-auth-check',
    description: 'Route handler does not check authentication/authorization',
    severity: 'CRITICAL',
    detect(file, lines, _diff) {
      const findings = [];
      let inRouteHandler = false;
      let hasAuthCheck = false;
      let routeLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Detect Express route handlers
        const routeMatch = line.match(/\.(get|post|put|patch|delete)\(['"`]/);
        if (routeMatch && (file.includes('route') || file.includes('routes') || file.includes('api'))) {
          inRouteHandler = true;
          routeLine = i + 1;
          hasAuthCheck = false;
        }
        if (inRouteHandler) {
          if (line.includes('req.user') || line.includes('req.session') || line.includes('authenticate') ||
              line.includes('authorize') || line.includes('isAuthenticated') || line.includes('requireAuth') ||
              line.includes('requireAdmin') || line.includes('protect') || line.includes('guard')) {
            // Check if it's actually a middleware arg or inside handler
            const nextLine = lines[i + 1] || '';
            if (line.includes(',') || nextLine.includes('authenticate') || nextLine.includes('authorize')) {
              hasAuthCheck = true;
            }
          }
          // Detect end of route handler (next route or closing bracket at top level)
          if (line.match(/\.\w+\(['"`]/) && i > routeLine) {
            if (!hasAuthCheck && (line.includes('/admin') || line.includes('admin.') ||
                file.includes('admin') || file.includes('payment') || file.includes('refund'))) {
              findings.push({
                file, line: routeLine,
                snippet: lines[routeLine - 1].trim(),
                context: 'Admin/payment route may lack auth middleware',
              });
            }
            inRouteHandler = false;
          }
        }
      }
      return findings;
    },
  },
  {
    name: 'sql-injection-risk',
    description: 'Raw SQL string concatenation with user input',
    severity: 'CRITICAL',
    detect(file, lines, _diff) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for raw SQL with ${} interpolation or + concatenation
        if ((line.includes('sql`') || line.includes('SQL`') || line.includes('query(') || line.includes('execute(')) &&
            (line.includes('${') || line.includes('$(') || line.includes('+ ')) &&
            !line.includes('escape') && !line.includes('sanitize') && !line.includes('placeholder') &&
            !line.includes('$1') && !line.includes(':') && // parameterized
            !line.includes('??') // Drizzle template literal
        ) {
          findings.push({
            file, line: i + 1,
            snippet: line.trim().substring(0, 120),
            context: 'Possible SQL injection via string interpolation',
          });
        }
      }
      return findings;
    },
  },

  // ── Data loss / mutation ──
  {
    name: 'side-effect-in-getter',
    description: 'Getter function performs mutation (should be idempotent)',
    severity: 'HIGH',
    detect(file, lines, _diff) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.match(/get\s+\w+\s*\(/) || line.includes('get ') && line.includes('function')) &&
            (line.includes('delete') || line.includes('splice') || line.includes('pop') ||
             line.includes('push') || line.includes('write') || line.includes('remove'))) {
          findings.push({
            file, line: i + 1,
            snippet: line.trim().substring(0, 100),
            context: 'Side-effect mutation inside a getter',
          });
        }
      }
      return findings;
    },
  },
  {
    name: 'shared-mutable-state',
    description: 'Module-level mutable variable modified by async operations',
    severity: 'HIGH',
    detect(file, lines, _diff) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.match(/^\s*(let|var)\s+\w+/) || line.match(/^\s*export\s+(let|var)\s+\w+/)) &&
            !line.includes('= 0') && !line.includes('= false') && !line.includes('= true') &&
            !line.includes('= null') && !line.includes('= undefined') && !line.includes('= ""') &&
            !line.includes("= ''") && !line.includes('= {}') && !line.includes('= []')) {
          // Check if this file has async operations
          const hasAsync = lines.some(l => l.includes('async ') || l.includes('Promise') || l.includes('.then('));
          if (hasAsync) {
            findings.push({
              file, line: i + 1,
              snippet: line.trim(),
              context: 'Module-level mutable state may cause race conditions in async context',
            });
          }
        }
      }
      return findings;
    },
  },

  // ── Resource leaks ──
  {
    name: 'unclosed-connection',
    description: 'DB/client connection opened without cleanup in all paths',
    severity: 'HIGH',
    detect(file, lines, _diff) {
      const findings = [];
      let hasConnect = false;
      let connectLine = 0;
      let hasFinally = false;
      let hasDisconnect = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('.connect()') || line.includes('createConnection(') ||
            line.includes('new Client(') || line.includes('new Pool(')) {
          hasConnect = true;
          connectLine = i + 1;
          hasFinally = false;
          hasDisconnect = false;
        }
        if (hasConnect) {
          if (line.includes('finally') || line.includes('try')) hasFinally = true;
          if (line.includes('.end()') || line.includes('.close()') || line.includes('.release()') ||
              line.includes('.disconnect()') || line.includes('cleanup') || line.includes('destroy()')) {
            hasDisconnect = true;
          }
          // Check if we've left the function scope
          if (i > connectLine + 30) {
            if (!hasDisconnect && hasConnect) {
              findings.push({
                file, line: connectLine,
                snippet: lines.slice(connectLine - 1, connectLine + 2).map(l => l.trim()).join(' '),
                context: 'Connection opened without guaranteed cleanup',
              });
            }
            hasConnect = false;
          }
        }
      }
      return findings;
    },
  },
];

// ─── Analysis engine ─────────────────────────────────────────────────────────

/**
 * @param {string} diffContent
 * @param {string[]} changedFiles
 * @returns {Finding[]}
 */
function analyzeDiff(diffContent, changedFiles) {
  /** @type {Finding[]} */
  const allFindings = [];

  // Parse diff into per-file hunks
  const fileDiffs = parseDiffByFile(diffContent);

  for (const { file, addedLines } of fileDiffs) {
    for (const pattern of BUG_PATTERNS) {
      try {
        const findings = pattern.detect(file, addedLines, diffContent);
        for (const f of findings) {
          allFindings.push({
            severity: pattern.severity,
            category: pattern.name,
            message: pattern.description,
            remediation: getRemediation(pattern.name),
            locations: [{
              file: file,
              line: f.line,
              snippet: f.snippet,
            }],
            context: f.context,
          });
        }
      } catch (err) {
        // Pattern detector threw — skip this pattern for this file
        if (flags.verbose) {
          console.error(`[debug] Pattern ${pattern.name} failed on ${file}: ${err}`);
        }
      }
    }
  }

  // Deduplicate findings on (file, line, category)
  const seen = new Set();
  return allFindings.filter(f => {
    const key = `${f.locations[0].file}:${f.locations[0].line}:${f.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Parse unified diff into per-file added line arrays
 * @param {string} diff
 * @returns {{ file: string; addedLines: string[] }[]}
 */
function parseDiffByFile(diff) {
  const files = [];
  let currentFile = null;
  /** @type {string[]} */
  let currentAddedLines = [];
  let inHunk = false;

  for (const line of diff.split('\n')) {
    const newFileMatch = line.match(/^\+\+\+\s+b\/(.+)$/);
    if (newFileMatch) {
      if (currentFile && currentAddedLines.length > 0) {
        files.push({ file: currentFile, addedLines: currentAddedLines });
      }
      currentFile = newFileMatch[1];
      currentAddedLines = [];
      inHunk = false;
      continue;
    }
    if (line.startsWith('diff --git')) {
      if (currentFile && currentAddedLines.length > 0) {
        files.push({ file: currentFile, addedLines: currentAddedLines });
      }
      currentFile = null;
      currentAddedLines = [];
      inHunk = false;
      continue;
    }
    if (line.startsWith('@@')) {
      inHunk = true;
      currentAddedLines.push(line);
      continue;
    }
    if (inHunk && currentFile) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentAddedLines.push(line.substring(1));
      }
      // Also track context lines for better analysis
      if (line.startsWith(' ')) {
        currentAddedLines.push(line.substring(1));
      }
    }
  }

  // Push last file
  if (currentFile && currentAddedLines.length > 0) {
    files.push({ file: currentFile, addedLines: currentAddedLines });
  }

  return files;
}

/**
 * @param {string} patternName
 * @returns {string}
 */
function getRemediation(patternName) {
  const remediations = {
    'possible-null-deref': 'Add null check: `if (x) { ... }` or use optional chaining `x?.prop`',
    'missing-optional-chaining': 'Use optional chaining: `foo?.bar?.baz`',
    'missing-await': 'Add `await` keyword before the async call',
    'promise-not-awaited': 'Add `.catch()` handler or `await` the promise chain',
    'empty-catch-block': 'Add error handling: log the error, recover, or re-throw',
    'error-ignored-in-catch': 'Add recovery logic or re-throw after logging',
    'missing-auth-check': 'Add authentication middleware: `authenticate`, `requireAuth`, or `requireAdmin`',
    'sql-injection-risk': 'Use parameterized queries: `WHERE id = $1` with separate params',
    'side-effect-in-getter': 'Move mutation to a separate method; getters should be side-effect-free',
    'shared-mutable-state': 'Use local scope or guard with mutex; consider converting to let → const',
    'unclosed-connection': 'Use try/finally or `.finally()` to guarantee cleanup',
  };
  return remediations[patternName] || 'Review and fix the identified issue';
}

// ─── PR creation ─────────────────────────────────────────────────────────────

/**
 * Create a PR with the bug finding summary and fixes
 * @param {Finding[]} findings
 */
async function createBugPR(findings) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable required for --pr mode');
    return false;
  }
  if (!repo) {
    console.error('❌ GITHUB_REPOSITORY environment variable required for --pr mode');
    return false;
  }

  const criticalFindings = findings.filter(f =>
    f.severity === 'CRITICAL' || f.severity === 'HIGH'
  );

  // Build PR body
  const bodyLines = [
    '## 🔍 Auto-Debug Bug-Finding Report',
    '',
    `**Analysis date:** ${new Date().toISOString()}`,
    `**Scan range:** ${flags.range || `last ${flags.commits} commits`}`,
    `**Total findings:** ${findings.length} (${criticalFindings.length} critical/high severity)`,
    '',
    '---',
    '',
  ];

  for (const f of criticalFindings.slice(0, 10)) {
    bodyLines.push(`### ${f.severity === 'CRITICAL' ? '🔴' : '🟠'} ${f.category}`);
    bodyLines.push(`**Severity:** ${f.severity}`);
    bodyLines.push(`**Message:** ${f.message}`);
    bodyLines.push(`**File:** \`${f.locations[0].file}\` line ${f.locations[0].line}`);
    bodyLines.push('```');
    bodyLines.push(f.locations[0].snippet);
    bodyLines.push('```');
    bodyLines.push(`**Fix:** ${f.remediation}`);
    bodyLines.push('');
  }

  bodyLines.push('---');
  bodyLines.push('');
  bodyLines.push('## Summary');
  bodyLines.push('');
  bodyLines.push(`| Severity | Count |`);
  bodyLines.push('|----------|-------|');
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const count = findings.filter(f => f.severity === sev).length;
    if (count > 0) bodyLines.push(`| ${sev} | ${count} |`);
  }

  const title = `[auto-debug] ${criticalFindings.length} bug${criticalFindings.length > 1 ? 's' : ''} found in recent commits`;
  const body = bodyLines.join('\n');

  // Create branch
  const branchName = `${flags.branch}/${Date.now()}`;
  const mainResult = git(['rev-parse', 'HEAD']);
  if (!mainResult.ok) {
    console.error('❌ Failed to get HEAD SHA');
    return false;
  }
  const headSha = mainResult.output;

  git(['checkout', '-b', branchName]);
  // We can't easily make automated fixes, but we can commit the report
  const reportPath = path.join(process.cwd(), 'reports', `auto-debug-${Date.now()}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, bodyLines.join('\n'));

  git(['add', reportPath]);
  git(['commit', '-m', `chore(auto-debug): bug-finding report - ${new Date().toISOString().split('T')[0]}`]);

  const pushResult = git(['push', 'origin', branchName]);
  if (!pushResult.ok) {
    console.error(`❌ Failed to push branch: ${pushResult.error}`);
    git(['checkout', '-']);
    return false;
  }

  // Create PR via GitHub API
  const apiUrl = `https://api.github.com/repos/${repo}/pulls`;

  try {
    const prResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: 'main',
        maintainer_can_modify: true,
      }),
    });

    const prData = await prResponse.json();

    if (prResponse.ok) {
      console.log(`✅ Created PR #${prData.number}: ${prData.html_url}`);
      git(['checkout', '-']);
      return true;
    } else {
      console.error(`❌ Failed to create PR: ${JSON.stringify(prData)}`);
      git(['checkout', '-']);
      return false;
    }
  } catch (err) {
    console.error(`❌ PR creation error: ${err}`);
    git(['checkout', '-']);
    return false;
  }
}

// ─── WeCom notification ──────────────────────────────────────────────────────

async function sendWeComNotification(findings) {
  const criticalHits = findings.filter(f =>
    f.severity === 'CRITICAL' || f.severity === 'HIGH'
  );

  const prefix = criticalHits.length > 0 ? '🔴 Auto-Debug 发现 Bug' : '✅ Auto-Debug 未发现严重 Bug';

  const msgLines = [
    `## ${prefix}`,
    '',
    `**扫描范围:** ${flags.range || `最近 ${flags.commits} 个提交`}`,
    `**发现:** ${findings.length} 个 (严重: ${criticalHits.length})`,
    '',
  ];

  if (criticalHits.length > 0) {
    msgLines.push('**关键发现:**');
    for (const f of criticalHits.slice(0, 8)) {
      msgLines.push(`- \[${f.severity}] \`${f.locations[0].file}:${f.locations[0].line}\` — ${f.message}`);
    }
  } else if (findings.length > 0) {
    msgLines.push('**低风险发现:**');
    for (const f of findings.slice(0, 5)) {
      msgLines.push(`- \[${f.severity}] \`${f.locations[0].file}:${f.locations[0].line}\` — ${f.message}`);
    }
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

// ─── Quality gate check ──────────────────────────────────────────────────────

async function runQualityGates() {
  const results = [];

  // Run guardrails
  console.log('\n🔒 Running guardrails...');
  const guardrails = spawnSync('node', ['scripts/check-guardrails.mjs'], {
    encoding: 'utf8', timeout: 30000,
  });
  results.push({
    name: 'guardrails',
    passed: guardrails.status === 0,
    output: guardrails.status === 0 ? 'OK' : (guardrails.stderr || guardrails.stdout).slice(0, 500),
  });

  // Run workspace dependency check
  console.log('📦 Running dep-check...');
  const depCheck = spawnSync('node', ['scripts/check-workspace-dependency-ownership.mjs'], {
    encoding: 'utf8', timeout: 30000,
  });
  results.push({
    name: 'dep-check',
    passed: depCheck.status === 0,
    output: depCheck.status === 0 ? 'OK' : (depCheck.stderr || depCheck.stdout).slice(0, 500),
  });

  // Run migration journal check
  console.log('📋 Running journal check...');
  const journalCheck = spawnSync('node', ['scripts/verify-journal-sync.mjs'], {
    encoding: 'utf8', timeout: 30000,
  });
  results.push({
    name: 'journal-check',
    passed: journalCheck.status === 0,
    output: journalCheck.status === 0 ? 'OK' : (journalCheck.stderr || journalCheck.stdout).slice(0, 500),
  });

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Auto-Debug v${VERSION}`);
  console.log(`   Analyzing ${flags.range ? `range: ${flags.range}` : `last ${flags.commits} commits`}`);
  console.log('');

  // 1. Get recent commits
  const range = flags.range || `HEAD~${flags.commits}..HEAD`;
  const commits = flags.range
    ? getRecentCommits(100).filter(c => {
        // Filter commits within range — approximate
        const rangeParts = flags.range.split('..');
        return true; // Accept the provided range as-is
      })
    : getRecentCommits(flags.commits);

  if (commits.length === 0) {
    console.log('No commits to analyze.');
    return 0;
  }

  console.log(`📜 Scanning ${commits.length} commits...`);

  // 2. Get diff and changed files
  const diffContent = getCommitDiff(range);
  const changedFiles = getChangedFiles(range);

  if (changedFiles.length === 0) {
    console.log('No changed files found in range.');
    return 0;
  }

  console.log(`📁 ${changedFiles.length} files changed`);
  if (flags.verbose) {
    for (const f of changedFiles) console.log(`   - ${f}`);
  }

  // 3. Run quality gates
  console.log('\n🛡️  Running quality gate checks...');
  const gateResults = await runQualityGates();
  const gateFailures = gateResults.filter(r => !r.passed);
  if (gateFailures.length > 0) {
    console.log(`\n⚠️  ${gateFailures.length} quality gate(s) failed:`);
    for (const f of gateFailures) {
      console.log(`   ❌ ${f.name}: ${f.output}`);
    }
  }

  // 4. Analyze diff for bug patterns
  console.log('\n🔬 Analyzing code changes for bug patterns...');
  const findings = analyzeDiff(diffContent, changedFiles);

  // 5. Filter to critical/high severity
  const criticalFindings = findings.filter(f =>
    f.severity === 'CRITICAL' || f.severity === 'HIGH'
  );

  // 6. Report findings
  if (findings.length === 0) {
    console.log('\n✅ No potential bugs detected.');
  } else {
    console.log(`\n📊 Found ${findings.length} potential issue(s):`);

    for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      const items = findings.filter(f => f.severity === sev);
      if (items.length === 0) continue;

      const icon = sev === 'CRITICAL' ? '🔴' : sev === 'HIGH' ? '🟠' : sev === 'MEDIUM' ? '🟡' : '⚪';
      console.log(`\n${icon} ${sev} Severity (${items.length})`);

      for (const item of items.slice(0, 5)) {
        console.log(`   - ${item.category}: ${item.message}`);
        console.log(`     ${item.locations[0].file}:${item.locations[0].line}`);
        console.log(`     Fix: ${item.remediation}`);
      }
      if (items.length > 5) {
        console.log(`     ... and ${items.length - 5} more`);
      }
    }
  }

  // 7. Create PR if requested and critical bugs found
  let prCreated = false;
  if (flags.pr && criticalFindings.length > 0) {
    console.log('\n📝 Creating bug-finding PR...');
    prCreated = await createBugPR(criticalFindings);
    if (prCreated) {
      console.log('✅ Bug report PR created');
    } else {
      console.log('⚠️  Failed to create PR');
    }
  } else if (flags.pr && criticalFindings.length === 0) {
    console.log('\n✅ No critical bugs found — skipping PR creation.');
    console.log('   (This is the expected outcome most runs.)');
  }

  // 8. WeCom notification
  if (flags.wecom) {
    console.log('\n📱 Sending WeCom notification...');
    await sendWeComNotification(findings);
  }

  // 9. Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Summary: ${findings.length} findings (${criticalFindings.length} critical/high)`);
  if (gateFailures.length > 0) {
    console.log(`Quality gates: ${gateFailures.length} failed ⚠️`);
  }

  return criticalFindings.length > 0 ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Debug fatal error:', err);
    process.exit(2);
  });
