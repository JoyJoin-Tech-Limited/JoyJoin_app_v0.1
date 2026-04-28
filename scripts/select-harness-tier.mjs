#!/usr/bin/env node
/**
 * select-harness-tier.mjs — Deterministic harness tier router
 *
 * Reads git diff + task metadata and recommends a harness tier (1, 2, or 3).
 * No LLM calls. Purely deterministic based on file patterns and heuristics.
 *
 * Usage:
 *   node scripts/select-harness-tier.mjs [--files=a.ts,b.ts] [--staged] [--diff=<path>] [--task-meta=<json>]
 *
 *   --files      Comma-separated list of files for this task (preferred — avoids full-repo diff)
 *   --staged     Use git diff --cached instead of all unstaged changes
 *   --diff       Read changed files from a file (one per line)
 *   --task-meta  JSON string with task metadata
 *
 * Exit codes:
 *   0 = Tier 1 (Direct Delivery)
 *   1 = Tier 2 (Sprint Contract Loop)
 *   2 = Tier 3 (Full Harness Lane)
 *   3 = Error / could not determine
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

// ── Tier 3 triggers (highest priority) ──────────────────────────────
const TIER_3_PATTERNS = [
  // Core engine files
  /packages\/shared\/src\/personality\//,
  /packages\/shared\/src\/poolMatchingService\.ts/,
  /apps\/server\/src\/poolMatchingService\.ts/,
  /apps\/server\/src\/personalityMatchingV2\.ts/,
  /apps\/server\/src\/archetypeChemistry\.ts/,
  /apps\/server\/src\/wechatAuth\.ts/,
  // Auth / session
  /apps\/server\/src\/routes\/domains\/(auth|demo)\.ts/,
  /apps\/server\/src\/middleware\//,
  // Payment
  /apps\/server\/src\/routes\/domains\/(payments|blindBoxEvents)\.ts/,
  /apps\/server\/src\/payment-entitlement\//,
  /apps\/server\/src\/.*[Pp]ayment.*\.ts/,
  // Major schema changes
  /packages\/shared\/src\/schema\.ts/,
];

const TIER_3_KEYWORDS = [
  "matching engine",
  "personality system",
  "archetype",
  "auth rewrite",
  "payment flow",
  "WeChat Pay",
  "refund",
  "core engine",
];

// ── Tier 2 triggers ─────────────────────────────────────────────────
const TIER_2_PATTERNS = [
  // New routes
  /apps\/server\/src\/routes\//,
  // DB migrations
  /apps\/server\/migrations\//,
  /migrations\//,
  // Multi-workspace shared changes
  /packages\/shared\/src\//,
  // AI services
  /apps\/server\/src\/ai\//,
  /apps\/server\/src\/.*[Aa][Ii].*\.ts/,
  // State machines / icebreaker
  /apps\/server\/src\/.*[Ii]cebreaker.*\.ts/,
  /apps\/server\/src\/socialIcebreaker/,
  // Mini-program pages (UI flows)
  /apps\/mini-program\/src\/pages\//,
  // Admin UI
  /apps\/admin-client\/src\/pages\//,
  /apps\/admin-client\/src\/components\//,
  // Web client pages
  /apps\/user-client\/src\/pages\//,
  /apps\/user-client\/src\/components\//,
  /apps\/user-client\/src\/features\//,
];

const TIER_2_KEYWORDS = [
  "new route",
  "new endpoint",
  "migration",
  "schema change",
  "new page",
  "new component",
  "ui flow",
  "state machine",
  "websocket",
  "cross-workspace",
  "api contract",
];

// ── Helpers ─────────────────────────────────────────────────────────
function getDiffFromRef(baseRef = "HEAD", stagedOnly = false) {
  try {
    const cmd = stagedOnly
      ? `git diff --cached --name-only ${baseRef}`
      : `git diff --name-only ${baseRef}`;
    return execSync(cmd, {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
  } catch {
    // If no git ref, try unstaged changes
    try {
      return execSync("git diff --name-only", {
        encoding: "utf-8",
        cwd: process.cwd(),
      }).trim();
    } catch {
      return "";
    }
  }
}

function getDiffStat(baseRef = "HEAD", stagedOnly = false, explicitFiles = []) {
  if (explicitFiles.length > 0) {
    // When files are explicitly provided, we can't easily get line stats
    // without running git diff on each file. Let's do a quick stat.
    let totalInsertions = 0;
    let totalDeletions = 0;
    for (const f of explicitFiles) {
      if (!existsSync(f)) continue;
      try {
        const stat = execSync(`git diff --stat ${baseRef} -- "${f}"`, {
          encoding: "utf-8",
          cwd: process.cwd(),
        }).trim();
        const match = stat.match(/(\d+) files? changed.*?([\d]+) insertions?.*?([\d]+) deletions?/);
        if (match) {
          totalInsertions += parseInt(match[2], 10);
          totalDeletions += parseInt(match[3], 10);
        }
      } catch {
        // If file is untracked, count its lines
        try {
          const content = readFileSync(f, "utf-8");
          const lines = content.split("\n").length;
          totalInsertions += lines;
        } catch {
          // ignore
        }
      }
    }
    return {
      files: explicitFiles.length,
      insertions: totalInsertions,
      deletions: totalDeletions,
      lines: totalInsertions + totalDeletions,
    };
  }

  try {
    const cmd = stagedOnly
      ? `git diff --cached --stat ${baseRef}`
      : `git diff --stat ${baseRef}`;
    const stat = execSync(cmd, {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
    const match = stat.match(/(\d+) files? changed.*?([\d]+) insertions?.*?([\d]+) deletions?/);
    if (match) {
      return {
        files: parseInt(match[1], 10),
        insertions: parseInt(match[2], 10),
        deletions: parseInt(match[3], 10),
        lines: parseInt(match[2], 10) + parseInt(match[3], 10),
      };
    }
  } catch {
    // ignore
  }
  return { files: 0, insertions: 0, deletions: 0, lines: 0 };
}

function matchesAny(str, patterns) {
  return patterns.some((p) => p.test(str));
}

function containsAny(str, keywords) {
  const lower = str.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

// ── Main logic ──────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  let diffPath = null;
  let taskMetaRaw = null;
  let explicitFiles = [];
  let stagedOnly = false;

  for (const arg of args) {
    if (arg.startsWith("--diff=")) diffPath = arg.slice("--diff=".length);
    if (arg.startsWith("--task-meta=")) taskMetaRaw = arg.slice("--task-meta=".length);
    if (arg.startsWith("--files=")) {
      explicitFiles = arg.slice("--files=".length).split(",").map((f) => f.trim()).filter(Boolean);
    }
    if (arg === "--staged") stagedOnly = true;
  }

  let changedFiles = "";
  let taskMeta = {};
  let scopeWarning = false;

  if (explicitFiles.length > 0) {
    // Use explicitly provided files
    changedFiles = explicitFiles.join("\n");
  } else if (diffPath) {
    try {
      changedFiles = readFileSync(diffPath, "utf-8").trim();
    } catch (e) {
      console.error(`Error reading diff file: ${e.message}`);
      process.exit(3);
    }
  } else {
    changedFiles = getDiffFromRef("HEAD", stagedOnly);
    if (!stagedOnly && changedFiles.split("\n").filter(Boolean).length > 20) {
      scopeWarning = true;
    }
  }

  if (taskMetaRaw) {
    try {
      taskMeta = JSON.parse(taskMetaRaw);
    } catch (e) {
      console.error(`Error parsing task metadata: ${e.message}`);
    }
  }

  const files = changedFiles
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  const stat = getDiffStat("HEAD", stagedOnly, explicitFiles);
  const allPaths = files.join("\n");
  const taskDesc = taskMeta.task || taskMeta.description || "";

  // ── Tier 3 check ──────────────────────────────────────────────────
  const tier3FileMatch = files.some((f) => matchesAny(f, TIER_3_PATTERNS));
  const tier3KeywordMatch = containsAny(taskDesc, TIER_3_KEYWORDS) || containsAny(allPaths, TIER_3_KEYWORDS);
  const isMajorRefactor = stat.files > 5 || stat.lines > 300;
  const isCoreEngine = tier3FileMatch || tier3KeywordMatch;

  if (isCoreEngine && (isMajorRefactor || stat.files > 2)) {
    const result = {
      tier: 3,
      reason: "Core engine, payment, auth, or major refactor",
      triggers: {
        coreEngineFile: tier3FileMatch,
        coreEngineKeyword: tier3KeywordMatch,
        majorRefactor: isMajorRefactor,
        fileCount: stat.files,
        lineCount: stat.lines,
      },
    };
    if (scopeWarning) {
      result.warning = "Full git diff used (>20 files). Consider using --files=<comma-list> for accurate tier detection.";
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  // ── Tier 2 check ──────────────────────────────────────────────────
  const tier2FileMatch = files.some((f) => matchesAny(f, TIER_2_PATTERNS));
  const tier2KeywordMatch = containsAny(taskDesc, TIER_2_KEYWORDS) || containsAny(allPaths, TIER_2_KEYWORDS);
  const isMultiFile = stat.files > 2;
  const isSignificant = stat.lines > 50;

  if (tier2FileMatch || tier2KeywordMatch || (isMultiFile && isSignificant)) {
    const result = {
      tier: 2,
      reason: "New route, multi-file, UI flow, migration, or stateful operation",
      triggers: {
        tier2File: tier2FileMatch,
        tier2Keyword: tier2KeywordMatch,
        multiFile: isMultiFile,
        significant: isSignificant,
        fileCount: stat.files,
        lineCount: stat.lines,
      },
    };
    if (scopeWarning) {
      result.warning = "Full git diff used (>20 files). Consider using --files=<comma-list> for accurate tier detection.";
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // ── Tier 1 fallback ───────────────────────────────────────────────
  const result = {
    tier: 1,
    reason: "Small, bounded change — deterministic gate only",
    triggers: {
      fileCount: stat.files,
      lineCount: stat.lines,
    },
  };
  if (scopeWarning) {
    result.warning = "Full git diff used (>20 files). Consider using --files=<comma-list> for accurate tier detection.";
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();
