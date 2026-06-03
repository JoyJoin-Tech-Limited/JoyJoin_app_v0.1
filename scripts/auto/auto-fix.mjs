#!/usr/bin/env node
/**
 * Auto-Fix — Automatic Bug Fixing (PR Mode)
 * ============================================
 *
 * Run the auto-debug regex engine to find bugs, then automatically create
 * fix PRs for patterns that are deterministic enough to safely auto-fix.
 *
 * This is PR mode — fixes are opened as pull requests for human review,
 * never committed directly to main.
 *
 * Patterns with auto-fix capability:
 *   empty-catch-block        → adds logger.error(err) inside empty catch
 *   missing-await             → adds await keyword before the call
 *   promise-not-awaited       → adds .catch(err => logger.error(err))
 *
 * Patterns flagged but NOT auto-fixed (needs human judgment):
 *   missing-auth-check, sql-injection-risk, possible-null-deref,
 *   shared-mutable-state, unclosed-connection, side-effect-in-getter
 *
 * Usage:
 *   node scripts/auto/auto-fix.mjs                        # dry run (show what would fix)
 *   node scripts/auto/auto-fix.mjs --pr                   # create fix PR
 *   node scripts/auto/auto-fix.mjs --pr --wecom            # fix PR + WeCom notify
 *   node scripts/auto/auto-fix.mjs --commits 20            # look back further
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

const VERSION = '2026-05-04.v1';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_COMMIT_LOOKBACK = 10;
const AUTO_FIX_BRANCH = 'auto-fix';

const args = process.argv.slice(2);
const flags = {
  commits: DEFAULT_COMMIT_LOOKBACK,
  range: null,         /** @type {string | null} */
  pr: false,
  wecom: false,
  verbose: false,
  live: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--commits' && i + 1 < args.length) flags.commits = parseInt(args[++i], 10);
  else if (args[i] === '--range' && i + 1 < args.length) flags.range = args[++i];
  else if (args[i] === '--pr') flags.pr = true;
  else if (args[i] === '--wecom') flags.wecom = true;
  else if (args[i] === '--verbose') flags.verbose = true;
  else if (args[i] === '--live') flags.live = true;
}

const repo = process.env.GITHUB_REPOSITORY || '';
const token = process.env.GITHUB_TOKEN || process.env.AUTO_DEBUG_TOKEN || '';

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(cmdArgs, opts = {}) {
  const result = spawnSync('git', cmdArgs, {
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

/**
 * @param {string} filePath
 * @returns {string[]}
 */
function readFileLines(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split('\n');
  } catch {
    return [];
  }
}

// ─── Bug patterns (same as auto-debug) ───────────────────────────────────────

/** @typedef {{ severity: string; category: string; message: string; locations: { file: string; line: number; snippet: string }[]; context: string }} Finding */
/** @typedef {{ file: string; line: number; fix: string; pattern: string; context: string }} FixCandidate */

const BUG_PATTERNS = [
  {
    name: 'empty-catch-block',
    description: 'Empty catch block silently swallows errors',
    severity: 'HIGH',
    autoFix: true,
    detect(file, lines) {
      const findings = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        if (line.includes('catch (') && nextLine.trim() === '{}') {
          findings.push({ file, line: i + 1, snippet: `${line.trim()} ${nextLine.trim()}`, context: 'Empty catch block' });
        }
        if (line.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
          findings.push({ file, line: i + 1, snippet: line.trim(), context: 'Empty catch block' });
        }
      }
      return findings;
    },
    /** @returns {string} */
    getFix(lineText, lineNum) {
      const match = lineText.match(/catch\s*(\([^)]*\))\s*\{\s*\}/);
      if (match) {
        const indent = lineText.match(/^(\s*)/)?.[1] || '';
        return `${indent}catch ${match[1]} {\n${indent}  console.error('Operation failed:', ${match[1].replace(/[()]/g, '').trim() || 'err'});\n${indent}}`;
      }
      return lineText;
    },
  },
  {
    name: 'missing-await',
    description: 'Promise-like method called without await in async function',
    severity: 'HIGH',
    autoFix: true,
    detect(file, lines) {
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
          const match = line.match(/(\w+(?:Service|Repo|Helper|Client|Api|Provider)\w*)\.(\w+)\s*\(/);
          if (match && !line.trim().startsWith('await ') && !line.trim().startsWith('return await ') &&
              !line.includes('// ') && !line.includes('/*') && !line.includes('return ') &&
              !line.includes('const ') && !line.includes('let ') && !line.includes('var ')) {
            if (!line.trim().startsWith('.') && !line.match(/^\s*(const|let|var|this\.|return|throw|await)/)) {
              findings.push({
                file, line: i + 1, snippet: line.trim(),
                context: `Missing await on ${match[0]} in async function`,
              });
            }
          }
        }
      }
      return findings;
    },
    getFix(lineText) {
      const indent = lineText.match(/^(\s*)/)?.[1] || '';
      return indent + 'await ' + lineText.trim();
    },
  },
  {
    name: 'promise-not-awaited',
    description: 'Promise .then() without .catch() handler',
    severity: 'HIGH',
    autoFix: true,
    detect(file, lines) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('.then(') && !line.trim().startsWith('return ') && !line.trim().startsWith('await ')) {
          if (!line.includes('.catch(')) {
            let hasCatch = false;
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              if (lines[j].includes('.catch(')) { hasCatch = true; break; }
              if (!lines[j].trim().startsWith('.')) break;
            }
            if (!hasCatch) {
              findings.push({
                file, line: i + 1, snippet: line.trim(),
                context: 'Unhandled promise rejection — .then() without .catch()',
              });
            }
          }
        }
      }
      return findings;
    },
    getFix(lineText) {
      // Append .catch(err => console.error('Promise error:', err))
      const indent = lineText.match(/^(\s*)/)?.[1] || '';
      const hasSemicolon = lineText.trimEnd().endsWith(';');
      const base = hasSemicolon ? lineText.trimEnd().slice(0, -1) : lineText.trimEnd();
      const suffix = hasSemicolon ? ';' : '';
      return `${base}\n${indent}  .catch(err => console.error('Promise error:', err))${suffix}`;
    },
  },
  // Additional patterns — detected but NOT auto-fixed
  {
    name: 'possible-null-deref',
    description: 'Property access on potentially null value without guard',
    severity: 'HIGH',
    autoFix: false,
    detect(file, lines) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const propAccess = line.match(/[a-zA-Z_$]\w*\.(?!\w*\(|\s*\.\.\.)(\w+)/);
        const isGuarded = i > 0 && (lines[i - 1].includes('if') || lines[i - 1].includes('assert') || lines[i - 1].includes('??'));
        if (propAccess && !isGuarded && !line.includes('?.') && !line.includes('optional')) {
          const varName = propAccess[0].split('.')[0];
          for (let j = Math.max(0, i - 5); j < i; j++) {
            if (lines[j].includes(`let ${varName}`) || lines[j].includes(`const ${varName}`) || lines[j].includes(`var ${varName}`)) {
              if (lines[j].includes('??') || lines[j].includes('| null') || lines[j].includes('|undefined')) {
                findings.push({ file, line: i + 1, snippet: line.trim(), context: `Potential null dereference of ${varName}` });
              }
            }
          }
        }
      }
      return findings;
    },
  },
  {
    name: 'shared-mutable-state',
    description: 'Module-level mutable variable modified by async operations',
    severity: 'HIGH',
    autoFix: false,
    detect(file, lines) {
      const findings = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.match(/^\s*(let|var)\s+\w+/) || line.match(/^\s*export\s+(let|var)\s+\w+/)) &&
            !line.includes('= 0') && !line.includes('= false') && !line.includes('= true') &&
            !line.includes('= null') && !line.includes('= undefined') && !line.includes('= ""') &&
            !line.includes("= ''") && !line.includes('= {}') && !line.includes('= []')) {
          const hasAsync = lines.some(l => l.includes('async ') || l.includes('Promise') || l.includes('.then('));
          if (hasAsync) {
            findings.push({ file, line: i + 1, snippet: line.trim(), context: 'Module-level mutable state in async context' });
          }
        }
      }
      return findings;
    },
  },
  {
    name: 'unclosed-connection',
    description: 'DB/client connection opened without cleanup',
    severity: 'HIGH',
    autoFix: false,
    detect(file, lines) {
      const findings = [];
      let hasConnect = false;
      let connectLine = 0;
      let hasDisconnect = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('.connect()') || line.includes('createConnection(') || line.includes('new Client(') || line.includes('new Pool(')) {
          hasConnect = true; connectLine = i + 1; hasDisconnect = false;
        }
        if (hasConnect) {
          if (line.includes('.end()') || line.includes('.close()') || line.includes('.release()') ||
              line.includes('.disconnect()') || line.includes('cleanup') || line.includes('destroy()')) {
            hasDisconnect = true;
          }
          if (i > connectLine + 30) {
            if (!hasDisconnect && hasConnect) {
              findings.push({ file, line: connectLine, snippet: lines.slice(connectLine - 1, connectLine + 2).map(l => l.trim()).join(' '), context: 'Connection opened without guaranteed cleanup' });
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
 * @returns {{ findings: Finding[], fixCandidates: FixCandidate[] }}
 */
function analyzeDiff(diffContent, changedFiles) {
  /** @type {Finding[]} */
  const allFindings = [];
  /** @type {FixCandidate[]} */
  const fixCandidates = [];

  // Parse diff into per-file hunks
  const fileDiffs = parseDiffByFile(diffContent);

  for (const { file, addedLines } of fileDiffs) {
    const existingLines = readFileLines(file);

    for (const pattern of BUG_PATTERNS) {
      try {
        const findings = pattern.detect(file, addedLines.length > 0 ? addedLines : existingLines);
        for (const f of findings) {
          const finding = {
            severity: pattern.severity,
            category: pattern.name,
            message: pattern.description,
            locations: [{ file: f.file, line: f.line, snippet: f.snippet }],
            context: f.context,
          };
          allFindings.push(finding);

          if (pattern.autoFix && f.line <= existingLines.length && f.line > 0) {
            const currentLine = existingLines[f.line - 1];
            const fix = pattern.getFix(currentLine, f.line);
            if (fix && fix !== currentLine) {
              fixCandidates.push({
                file: f.file,
                line: f.line,
                fix,
                pattern: pattern.name,
                context: f.context,
              });
            }
          }
        }
      } catch (err) {
        if (flags.verbose) console.error(`[debug] Pattern ${pattern.name} failed: ${err}`);
      }
    }
  }

  // Deduplicate findings
  const seen = new Set();
  const uniqueFindings = allFindings.filter(f => {
    const key = `${f.locations[0].file}:${f.locations[0].line}:${f.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Deduplicate fix candidates
  const seenFixes = new Set();
  const uniqueFixes = fixCandidates.filter(f => {
    const key = `${f.file}:${f.line}:${f.pattern}`;
    if (seenFixes.has(key)) return false;
    seenFixes.add(key);
    return true;
  });

  return { findings: uniqueFindings, fixCandidates: uniqueFixes };
}

/**
 * Parse unified diff into per-file added line arrays
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
    if (line.startsWith('@@') && currentFile) {
      inHunk = true;
      continue;
    }
    if (inHunk && currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      currentAddedLines.push(line.slice(1));
    }
  }
  if (currentFile && currentAddedLines.length > 0) {
    files.push({ file: currentFile, addedLines: currentAddedLines });
  }
  return files;
}

// ─── Apply fixes ─────────────────────────────────────────────────────────────

/**
 * @param {FixCandidate[]} fixCandidates
 * @returns {string[]} list of changed files
 */
function applyFixes(fixCandidates) {
  // Group fixes by file
  /** @type {Map<string, FixCandidate[]>} */
  const byFile = new Map();
  for (const fix of fixCandidates) {
    if (!byFile.has(fix.file)) byFile.set(fix.file, []);
    byFile.get(fix.file).push(fix);
  }

  const changedFiles = [];

  for (const [file, fixes] of byFile) {
    // Sort by line descending so we can edit top-down without offset issues
    fixes.sort((a, b) => b.line - a.line);

    const lines = readFileLines(file);
    if (lines.length === 0) {
      console.log(`   ⚠️  Cannot read ${file}, skipping`);
      continue;
    }

    for (const fix of fixes) {
      if (fix.line <= 0 || fix.line > lines.length) {
        console.log(`   ⚠️  Line ${fix.line} out of range for ${file}`);
        continue;
      }

      const idx = fix.line - 1;
      const newLines = fix.fix.split('\n');

      if (newLines.length === 1) {
        // Single line replacement
        lines[idx] = fix.fix;
      } else {
        // Multi-line replacement
        lines.splice(idx, 1, ...newLines);
      }

      console.log(`   ✏️  ${fix.file}:${fix.line} [${fix.pattern}] ${fix.context}`);
    }

    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    changedFiles.push(file);
  }

  return changedFiles;
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

/**
 * @param {string} endpoint
 * @param {string} [method]
 * @param {object} [body]
 */
async function ghApi(endpoint, method = 'GET', body = null) {
  const url = `https://api.github.com${endpoint}`;
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
 * @param {string} branchName
 * @returns {Promise<string | null>} — SHA of parent branch
 */
async function getDefaultBranchSha() {
  const { ok, data } = await ghApi(`/repos/${repo}/git/ref/heads/main`);
  if (ok) return data.object?.sha;
  const ma = await ghApi(`/repos/${repo}/git/ref/heads/master`);
  if (ma.ok) return ma.data.object?.sha;
  return null;
}

/**
 * @param {string} branchName
 * @param {string} baseSha
 * @returns {Promise<boolean>}
 */
async function createBranch(branchName, baseSha) {
  const { ok, data } = await ghApi(`/repos/${repo}/git/refs`, 'POST', {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });
  if (!ok && data.message?.includes('already exists')) {
    return true; // branch already exists, use it
  }
  return ok;
}

/**
 * @param {string} branch branch name
 * @returns {Promise<boolean>}
 */
async function deleteBranch(branch) {
  const { ok } = await ghApi(`/repos/${repo}/git/refs/heads/${branch}`, 'DELETE');
  return ok;
}

/**
 * @param {FixCandidate[]} fixCandidates
 * @param {string} branchName
 * @returns {Promise<{prCreated: boolean, prUrl: string}>}
 */
async function createFixPR(fixCandidates, branchName) {
  // Group fixes for the PR body
  /** @type {Map<string, FixCandidate[]>} */
  const byFile = new Map();
  for (const fix of fixCandidates) {
    if (!byFile.has(fix.file)) byFile.set(fix.file, []);
    byFile.get(fix.file).push(fix);
  }

  // Build PR body
  let body = `## 🤖 Auto-Fix Report\n\n`;
  body += `**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
  body += `**Fixes applied:** ${fixCandidates.length}\n\n`;

  body += `### Fixed Issues\n\n`;
  for (const [file, fixes] of byFile) {
    body += `#### \`${file}\`\n\n`;
    for (const fix of fixes) {
      body += `- **[${fix.pattern}]** Line ${fix.line}: ${fix.context}\n`;
      body += `  \`\`\`\n  ${fix.fix.trim()}\n  \`\`\`\n\n`;
    }
  }

  body += `### Notes\n\n`;
  body += `> ⚠️ These are automated fixes for deterministic bug patterns.\n`;
  body += `> Please review each change before merging — some may need context-specific adjustments.\n`;
  body += `> Auto-fix patterns: \`empty-catch-block\`, \`missing-await\`, \`promise-not-awaited\`\n`;

  // Labels
  const labels = ['auto-fix', 'bug'];

  // Create PR
  const { ok, data } = await ghApi(`/repos/${repo}/pulls`, 'POST', {
    title: `🤖 Auto-Fix: ${fixCandidates.length} bug pattern(s) fixed`,
    body,
    head: branchName,
    base: 'main',
    labels,
  });

  if (ok) {
    return { prCreated: true, prUrl: data.html_url };
  }

  console.error(`   ❌ PR creation failed: ${data.message}`);
  return { prCreated: false, prUrl: '' };
}

// ─── WeCom notification ──────────────────────────────────────────────────────

/**
 * @param {{ fixed: FixCandidate[], unfixed: Finding[], prUrl: string }} result
 */
async function sendWeComNotification(result) {
  let md = `## 🤖 Auto-Fix 执行报告\n\n`;
  md += `**时间:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n\n`;

  if (result.fixed.length > 0) {
    md += `### ✅ 已自动修复 (${result.fixed.length})\n\n`;
    for (const fix of result.fixed) {
      md += `- **[${fix.pattern}]** \`${fix.file}:${fix.line}\`\n`;
      md += `  > ${fix.context}\n`;
    }
    if (result.prUrl) {
      md += `\n📎 **PR:** ${result.prUrl}\n`;
    }
  } else {
    md += `### ℹ️ 本次无可自动修复的问题\n\n`;
  }

  if (result.unfixed.length > 0) {
    const flagged = result.unfixed.filter(f => !['empty-catch-block', 'missing-await', 'promise-not-awaited'].includes(f.category));
    if (flagged.length > 0) {
      md += `### ⚠️ 需人工排查 (${flagged.length})\n\n`;
      for (const f of flagged.slice(0, 5)) {
        md += `- **[${f.category}]** \`${f.locations[0].file}:${f.locations[0].line}\`\n`;
        md += `  > ${f.context}\n`;
      }
    }
  }

  const proc = spawnSync('node', ['scripts/wecom-notify.mjs', '--markdown', md], {
    encoding: 'utf8', timeout: 15000, env: { ...process.env },
  });
  if (proc.status !== 0 && flags.verbose) {
    console.error(`WeCom notify failed: ${proc.stderr}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔧 Auto-Fix v${VERSION}`);
  console.log(`   Mode: ${flags.pr ? 'PR (opens pull request)' : 'DRY RUN (report only)'}\n`);

  // 1. Determine commit range
  const range = flags.range || `HEAD~${flags.commits}..HEAD`;
  console.log(`📜 Scanning range: ${range}`);

  const diffContent = getCommitDiff(range);
  const changedFiles = getChangedFiles(range);

  if (changedFiles.length === 0) {
    console.log('No changed files found. Nothing to analyze.');
    return 0;
  }

  console.log(`📁 ${changedFiles.length} files changed\n`);

  // 2. Analyze
  console.log('🔬 Analyzing code for fixable bug patterns...');
  const { findings, fixCandidates } = analyzeDiff(diffContent, changedFiles);

  console.log(`\n📊 Found ${findings.length} potential issue(s)`);
  console.log(`   Auto-fixable: ${fixCandidates.length}`);
  console.log(`   Flagged (human review needed): ${findings.length - fixCandidates.length}\n`);

  // 3. Show auto-fix candidates
  const fixablePatterns = new Set(['empty-catch-block', 'missing-await', 'promise-not-awaited']);
  const autoFixFindings = findings.filter(f => fixablePatterns.has(f.category));
  const humanFindings = findings.filter(f => !fixablePatterns.has(f.category));

  if (autoFixFindings.length > 0) {
    console.log('🔧 Auto-fixable issues:');
    for (const f of autoFixFindings) {
      console.log(`   [${f.category}] ${f.locations[0].file}:${f.locations[0].line}`);
      console.log(`     > ${f.context}`);
    }
    console.log('');
  }

  if (humanFindings.length > 0) {
    console.log('⚠️  Issues flagged for human review:');
    for (const f of humanFindings.slice(0, 5)) {
      console.log(`   [${f.category}] ${f.locations[0].file}:${f.locations[0].line}`);
      console.log(`     > ${f.context}`);
    }
    if (humanFindings.length > 5) console.log(`   ... and ${humanFindings.length - 5} more`);
    console.log('');
  }

  // 4. Apply fixes and create PR
  let prUrl = '';

  if (fixCandidates.length === 0) {
    console.log('✅ No auto-fixable patterns found.');
    return 0;
  }

  if (flags.pr) {
    // Verify we have a GitHub token and repo
    if (!repo || !token) {
      console.error('❌ GITHUB_TOKEN and GITHUB_REPOSITORY required for --pr mode');
      return 2;
    }

    // Get base SHA
    const baseSha = await getDefaultBranchSha();
    if (!baseSha) {
      console.error('❌ Could not resolve main branch SHA');
      return 2;
    }

    // Get default branch name
    const mainBranch = (await ghApi(`/repos/${repo}`)).ok
      ? (await ghApi(`/repos/${repo}`)).data.default_branch || 'main'
      : 'main';

    // Delete existing auto-fix branch if it exists
    await deleteBranch(AUTO_FIX_BRANCH);

    // Create auto-fix branch
    console.log(`\n🌿 Creating branch: ${AUTO_FIX_BRANCH}`);
    const branchOk = await createBranch(AUTO_FIX_BRANCH, baseSha);
    if (!branchOk) {
      console.error('❌ Failed to create auto-fix branch');
      return 2;
    }

    // Checkout the branch
    // We can't actually push from local, so we use the API-based approach
    // Create blobs, trees, and commits via API

    console.log('\n🔧 Applying auto-fixes...');

    // Group fixes by file
    /** @type {Map<string, FixCandidate[]>} */
    const byFile = new Map();
    for (const fix of fixCandidates) {
      if (!byFile.has(fix.file)) byFile.set(fix.file, []);
      byFile.get(fix.file).push(fix);
    }

    /** @type {{ path: string; content: string }[]} */
    const fileUpdates = [];

    for (const [file, fixes] of byFile) {
      // Sort by line descending for top-down editing
      fixes.sort((a, b) => b.line - a.line);

      // Get current file content from API
      let content;
      try {
        const fileInfo = await ghApi(`/repos/${repo}/contents/${file}?ref=${baseSha}`);
        if (!fileInfo.ok || !fileInfo.data.content) {
          console.log(`   ⚠️  Could not read ${file} from GitHub, skipping`);
          continue;
        }
        content = Buffer.from(fileInfo.data.content, 'base64').toString('utf8');
      } catch {
        console.log(`   ⚠️  Error reading ${file}, skipping`);
        continue;
      }

      let lines = content.split('\n');

      for (const fix of fixes) {
        if (fix.line <= 0 || fix.line > lines.length) {
          console.log(`   ⚠️  Line ${fix.line} out of range for ${file}`);
          continue;
        }

        const idx = fix.line - 1;
        const newLines = fix.fix.split('\n');

        if (newLines.length === 1) {
          lines[idx] = fix.fix;
        } else {
          lines.splice(idx, 1, ...newLines);
        }

        console.log(`   ✏️  ${file}:${fix.line} [${fix.pattern}] ${fix.context}`);
      }

      fileUpdates.push({ path: file, content: lines.join('\n') });
    }

    if (fileUpdates.length === 0) {
      console.log('⚠️  No files could be updated.');
      await deleteBranch(AUTO_FIX_BRANCH);
      return 0;
    }

    // Use the gh CLI to commit and push changes to the auto-fix branch
    // First, check if we can use the local git approach
    console.log('\n📦 Committing and pushing fixes...');

    // Create files locally
    for (const { path: filePath, content } of fileUpdates) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    }

    // Stage and commit
    for (const { path: filePath } of fileUpdates) {
      const add = git(['add', filePath]);
      if (!add.ok) console.log(`   ⚠️  Failed to stage ${filePath}`);
    }

    const filesList = fileUpdates.map(f => f.path).join(', ');
    const commitMsg = `🤖 auto-fix: ${fixCandidates.length} bug pattern(s) fixed\n\n` +
      `Auto-fixed patterns:\n` +
      fixCandidates.map(f => `  - [${f.pattern}] ${f.file}:${f.line}: ${f.context}`).join('\n') +
      `\n\nApplied by auto-fix v${VERSION}`;

    // Create local branch
    git(['checkout', '-b', AUTO_FIX_BRANCH]);
    const commitResult = git(['commit', '-m', commitMsg]);

    if (!commitResult.ok) {
      console.log(`   ⚠️  Commit may have failed: ${commitResult.error}`);
    }

    // Push directly — this should create the branch on remote
    const pushResult = git(['push', 'origin', AUTO_FIX_BRANCH, '--force']);
    if (!pushResult.ok) {
      console.log(`   ⚠️  Push may have failed: ${pushResult.error}`);
      console.log('   Trying to create PR via GitHub API instead...');

      // Fallback: create PR using the auto-fix branch (it may already exist)
      const { prCreated, prUrl: url } = await createFixPR(fixCandidates, AUTO_FIX_BRANCH);
      if (prCreated) {
        prUrl = url;
        console.log(`✅ PR created: ${prUrl}`);
      }
    } else {
      // Push succeeded, now create PR
      const { prCreated, prUrl: url } = await createFixPR(fixCandidates, AUTO_FIX_BRANCH);
      if (prCreated) {
        prUrl = url;
        console.log(`✅ PR created: ${prUrl}`);
      }
    }

    // Switch back to main
    git(['checkout', mainBranch]);
  } else {
    console.log('\n[DRY RUN] Would fix:');
    for (const fix of fixCandidates) {
      console.log(`   ✏️  ${fix.file}:${fix.line} [${fix.pattern}]`);
      console.log(`      ${fix.fix.trim()}`);
    }
  }

  // 5. WeCom notification
  if (flags.wecom) {
    console.log('\n📱 Sending WeCom notification...');
    await sendWeComNotification({
      fixed: fixCandidates,
      unfixed: humanFindings,
      prUrl,
    });
  }

  // 6. Summary
  console.log('\n' + '='.repeat(50));
  if (fixCandidates.length > 0) {
    if (prUrl) {
      console.log(`✅ Fixed ${fixCandidates.length} issue(s) — PR: ${prUrl}`);
    } else if (flags.pr) {
      console.log(`⚠️  ${fixCandidates.length} issue(s) identified but PR creation may have failed`);
    } else {
      console.log(`[DRY RUN] ${fixCandidates.length} auto-fixable issue(s) found (use --pr to create PR)`);
    }
  } else {
    console.log('✅ No auto-fixable issues found.');
  }

  if (humanFindings.length > 0) {
    console.log(`⚠️  ${humanFindings.length} issue(s) flagged for human review`);
  }

  return fixCandidates.length > 0 ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('❌ Auto-Fix fatal error:', err.message);
    process.exit(2);
  });
