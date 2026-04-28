#!/usr/bin/env node
/**
 * evaluate-sprint-contract.mjs — Sprint Contract vs. Implementation validation
 *
 * Compares the Sprint Contract against the actual git diff to detect scope drift,
 * missing criteria, and gratuitous additions. Uses multi-layer validation:
 *   1. File existence checks (does expected file exist?)
 *   2. Prop/method name extraction + grep in implementation
 *   3. Pattern-based checks (headers, error handling, routes)
 *   4. Keyword fallback for unmatched criteria
 *
 * Usage:
 *   node scripts/evaluate-sprint-contract.mjs --contract=<path> [--diff=<baseRef>]
 *
 * Outputs a JSON verdict with drift findings.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

function getDiff(baseRef = "HEAD") {
  try {
    const staged = execSync(`git diff --cached ${baseRef}`, { encoding: "utf-8", cwd: process.cwd() }).trim();
    const unstaged = execSync("git diff", { encoding: "utf-8", cwd: process.cwd() }).trim();
    const untrackedFiles = execSync("git ls-files --others --exclude-standard", { encoding: "utf-8", cwd: process.cwd() }).trim().split("\n").filter(Boolean);
    const untrackedContent = untrackedFiles.map((f) => {
      try {
        return `--- a/dev/null\n+++ b/${f}\n` + readFileSync(f, "utf-8");
      } catch {
        return "";
      }
    }).join("\n");
    return [staged, unstaged, untrackedContent].join("\n");
  } catch {
    return "";
  }
}

function parseContract(contractPath) {
  const raw = readFileSync(contractPath, "utf-8");
  const frontmatterMatch = raw.match(/^---\n(\{[\s\S]*?\})\n---/);
  if (frontmatterMatch) {
    try {
      const meta = JSON.parse(frontmatterMatch[1]);
      return { meta, body: raw.slice(frontmatterMatch[0].length).trim() };
    } catch {
      // fall through
    }
  }
  return { meta: {}, body: raw };
}

function extractCriteria(body) {
  const criteria = [];
  const regex = /\|\s*(\w+-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*(\w+)\s*\|/g;
  let m;
  while ((m = regex.exec(body)) !== null) {
    criteria.push({ id: m[1].trim(), criterion: m[2].trim(), verification: m[3].trim(), threshold: m[4].trim() });
  }
  return criteria;
}

// ── Smart extraction: file paths, prop names, method names, route paths ──
function extractPatternsFromCriterion(criterion) {
  const patterns = [];
  const lower = criterion.toLowerCase();

  // Extract file paths (e.g., apps/server/src/...)
  const fileRegex = /apps\/[\w-]+\/src\/[\w/.-]+/g;
  let fm;
  while ((fm = fileRegex.exec(criterion)) !== null) {
    patterns.push({ type: "file", value: fm[0] });
  }

  // Extract function/prop names (camelCase or PascalCase in backticks or quotes)
  const propRegex = /`([a-zA-Z_][a-zA-Z0-9_]*)`|"([a-zA-Z_][a-zA-Z0-9_]*)"|'([a-zA-Z_][a-zA-Z0-9_]*)'/g;
  let pm;
  while ((pm = propRegex.exec(criterion)) !== null) {
    patterns.push({ type: "prop", value: pm[1] || pm[2] || pm[3] });
  }

  // Extract HTTP methods + paths
  const routeRegex = /(GET|POST|PUT|PATCH|DELETE)\s+([/\w-]+)/gi;
  let rm;
  while ((rm = routeRegex.exec(criterion)) !== null) {
    patterns.push({ type: "route", method: rm[1].toUpperCase(), path: rm[2] });
  }

  // Extract header names
  const headerRegex = /([A-Za-z-]+-[A-Za-z-]+|Content-\w+|Authorization|X-[A-Za-z-]+)/g;
  let hm;
  while ((hm = headerRegex.exec(criterion)) !== null) {
    patterns.push({ type: "header", value: hm[1] });
  }

  // Extract status codes
  const statusRegex = /(\d{3})\s*(status|error|response)?/gi;
  let sm;
  while ((sm = statusRegex.exec(criterion)) !== null) {
    const code = parseInt(sm[1], 10);
    if (code >= 200 && code <= 599) {
      patterns.push({ type: "status", value: sm[1] });
    }
  }

  // Extract patterns like "without errors", "handles X"
  if (lower.includes("handle") && lower.includes("error")) {
    patterns.push({ type: "pattern", value: "error-handling" });
  }
  if (lower.includes("rate limit")) {
    patterns.push({ type: "pattern", value: "rate-limiting" });
  }
  if (lower.includes("audit log")) {
    patterns.push({ type: "pattern", value: "audit-logging" });
  }
  if (lower.includes("streaming")) {
    patterns.push({ type: "pattern", value: "streaming" });
  }
  if (lower.includes("pagination")) {
    patterns.push({ type: "pattern", value: "pagination" });
  }
  if (lower.includes("debounce")) {
    patterns.push({ type: "pattern", value: "debounce" });
  }
  if (lower.includes("loading state")) {
    patterns.push({ type: "pattern", value: "loading-state" });
  }
  if (lower.includes("timezone")) {
    patterns.push({ type: "pattern", value: "timezone" });
  }

  return patterns;
}

function checkPatternsInDiff(patterns, diff) {
  const diffLower = diff.toLowerCase();
  let found = 0;
  const matched = [];
  const unmatched = [];

  for (const p of patterns) {
    let check = false;
    switch (p.type) {
      case "file":
        check = diffLower.includes(p.value.toLowerCase());
        break;
      case "prop":
        check = diffLower.includes(p.value.toLowerCase());
        break;
      case "route":
        check = diffLower.includes(p.path.toLowerCase());
        break;
      case "header":
        check = diffLower.includes(p.value.toLowerCase());
        break;
      case "status":
        check = diffLower.includes(p.value);
        break;
      case "pattern":
        // Pattern checks are fuzzy
        switch (p.value) {
          case "error-handling":
            check = /catch\s*\(|try\s*\{|throw\s+new|\.status\(|\.json\(\s*\{/.test(diffLower);
            break;
          case "rate-limiting":
            check = /rate.?limit|RateLimit|throttle/i.test(diff);
            break;
          case "audit-logging":
            check = /auditLog|audit_log|adminAuditLogger/i.test(diff);
            break;
          case "streaming":
            check = /stream|pipeline|pipe\s*\(/i.test(diff);
            break;
          case "pagination":
            check = /limit|offset|page|cursor|hasNextPage/i.test(diff);
            break;
          case "debounce":
            check = /debounce|throttle|setTimeout/i.test(diff);
            break;
          case "loading-state":
            check = /loading|isLoading|spinner|Skeleton/i.test(diff);
            break;
          case "timezone":
            check = /timezone|tz|utc|moment|dayjs|toISOString/i.test(diff);
            break;
          default:
            check = false;
        }
        break;
    }
    if (check) {
      found++;
      matched.push(p);
    } else {
      unmatched.push(p);
    }
  }

  return { found, total: patterns.length, matched, unmatched };
}

function checkFileExistence(patterns) {
  const filePatterns = patterns.filter((p) => p.type === "file");
  const results = [];
  for (const p of filePatterns) {
    const exists = existsSync(p.value);
    results.push({ file: p.value, exists });
  }
  return results;
}

function checkCriterionInDiff(criterion, diff) {
  const patterns = extractPatternsFromCriterion(criterion);
  const fileChecks = checkFileExistence(patterns);
  const patternCheck = checkPatternsInDiff(patterns, diff);

  // Layer 1: If specific files are mentioned and exist, that's strong evidence
  const filesExist = fileChecks.filter((f) => f.exists).length;
  const filesMentioned = fileChecks.length;

  // Layer 2: If patterns match in diff, that's good evidence
  const patternCoverage = patterns.length > 0 ? patternCheck.found / patterns.length : 0;

  // Layer 3: Fallback keyword heuristic for unmatched criteria
  const lower = criterion.toLowerCase();
  const diffLower = diff.toLowerCase();
  const keywords = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "must", "have", "been", "will", "should", "could", "would", "does", "each", "only", "also", "than", "when", "where", "what", "they", "them", "their", "there", "then", "than", "into", "over", "under", "above", "below", "between", "through", "during", "before", "after", "since", "until", "while", "because", "since", "although", "though", "unless", "whether", "either", "neither", "both", "all", "any", "some", "many", "much", "more", "most", "other", "such", "same", "different", "several", "various", "certain", "particular", "specific", "general", "common", "usual", "normal", "regular", "special", "unique", "individual", "personal", "local", "global", "public", "private", "internal", "external", "central", "main", "major", "minor", "primary", "secondary", "initial", "final", "previous", "following", "next", "last", "first", "second", "third", "fourth", "fifth", "early", "late", "old", "new", "young", "good", "bad", "better", "best", "worse", "worst", "high", "low", "higher", "lower", "highest", "lowest", "great", "small", "large", "little", "big", "long", "short", "full", "empty", "whole", "complete", "partial", "total", "equal", "unequal", "similar", "related", "close", "open", "true", "false", "right", "wrong", "correct", "incorrect", "exact", "accurate", "precise", "clear", "obvious", "visible", "hidden", "known", "unknown", "familiar", "strange", "possible", "impossible", "likely", "unlikely", "probable", "certain", "sure", "uncertain", "safe", "dangerous", "risky", "secure", "available", "ready", "prepared", "done", "finished", "complete", "incomplete", "active", "inactive", "busy", "free", "used", "unused", "working", "broken", "valid", "invalid", "legal", "illegal", "formal", "informal", "official", "unofficial", "direct", "indirect", "straight", "flat", "sharp", "smooth", "rough", "soft", "hard", "light", "heavy", "deep", "shallow", "wide", "narrow", "thick", "thin", "strong", "weak", "firm", "loose", "tight", "fast", "slow", "quick", "rapid", "sudden", "gradual", "steady", "constant", "continuous", "repeated", "frequent", "regular", "occasional", "rare", "once", "twice", "again", "back", "forward", "ahead", "behind", "beside", "near", "far", "away", "together", "apart", "alone", "along", "across", "around", "among", "within", "inside", "outside", "beyond", "against", "toward", "towards"].includes(w));

  const matchedKeywords = keywords.filter((k) => diffLower.includes(k));
  const keywordCoverage = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;

  // Combine layers
  // Strong signal: files exist OR good pattern coverage
  // Medium signal: keyword coverage > 0.3
  const hasStrongSignal = filesMentioned > 0 && filesExist > 0 && patternCoverage > 0;
  const hasMediumSignal = keywordCoverage > 0.3 || patternCoverage > 0.3;

  const found = hasStrongSignal || hasMediumSignal;

  return {
    found,
    patterns,
    fileChecks,
    patternCheck,
    keywordCoverage,
    matchedKeywords,
    allKeywords: keywords,
  };
}

function main() {
  const args = process.argv.slice(2);
  let contractPath = null;
  let diffRef = "HEAD";

  for (const arg of args) {
    if (arg.startsWith("--contract=")) contractPath = arg.slice("--contract=".length);
    if (arg.startsWith("--diff=")) diffRef = arg.slice("--diff=".length);
  }

  if (!contractPath || !existsSync(contractPath)) {
    console.error("Usage: node scripts/evaluate-sprint-contract.mjs --contract=<path> [--diff=<baseRef>]");
    process.exit(1);
  }

  const { meta, body } = parseContract(contractPath);
  const criteria = extractCriteria(body);
  const diff = getDiff(diffRef);

  const findings = [];
  let missingCount = 0;

  for (const c of criteria) {
    const check = checkCriterionInDiff(c.criterion, diff);
    const found = check.found;
    findings.push({
      id: c.id,
      criterion: c.criterion,
      foundInDiff: found,
      patternsDetected: check.patterns.length,
      patternsMatched: check.patternCheck.found,
      filesMentioned: check.fileChecks.length,
      filesExist: check.fileChecks.filter((f) => f.exists).length,
      keywordCoverage: Math.round(check.keywordCoverage * 100),
      missingPatterns: check.patternCheck.unmatched.map((p) => `${p.type}:${p.value}`),
    });
    if (!found) missingCount++;
  }

  // Check for gratuitous additions (files not mentioned in contract)
  const contractFiles = new Set();
  const fileRegex = /apps\/[\w-]+\/src\/[\w/.-]+/g;
  let fm;
  while ((fm = fileRegex.exec(body)) !== null) {
    contractFiles.add(fm[0]);
  }

  const diffFiles = [];
  const diffFileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  let dfm;
  while ((dfm = diffFileRegex.exec(diff)) !== null) {
    diffFiles.push(dfm[2]);
  }

  // Also check untracked files
  try {
    const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf-8", cwd: process.cwd() }).trim().split("\n").filter(Boolean);
    for (const f of untracked) {
      if (!diffFiles.includes(f)) diffFiles.push(f);
    }
  } catch {
    // ignore
  }

  const gratuitous = diffFiles.filter((f) => !Array.from(contractFiles).some((cf) => f.includes(cf) || cf.includes(f)));

  const verdict = missingCount === 0 && gratuitous.length === 0 ? "PASS" : missingCount > 0 ? "FAIL" : "CONCERN";

  console.log(JSON.stringify({
    contractPath,
    goal: meta.goal || "(not parsed)",
    tier: meta.tier || "(unknown)",
    criteriaEvaluated: criteria.length,
    criteriaMissing: missingCount,
    findings,
    diffFiles,
    gratuitousFiles: gratuitous,
    verdict,
    evaluatedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(verdict === "PASS" ? 0 : verdict === "CONCERN" ? 2 : 1);
}

main();
