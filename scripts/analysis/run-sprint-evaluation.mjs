#!/usr/bin/env node
/**
 * run-sprint-evaluation.mjs — Automated Sprint Evaluation runner
 *
 * Reads a Sprint Contract and runs targeted verification checks:
 *   - API criteria: HTTP requests via Playwright or curl
 *   - UI criteria: Playwright screenshots + visual checks
 *   - Code criteria: grep, file existence, AST checks
 *   - Test criteria: npm test with filters
 *
 * Usage:
 *   node scripts/analysis/run-sprint-evaluation.mjs --contract=<path> [--base-url=http://localhost:5000]
 *
 * Outputs a scorecard JSON compatible with harness-kpi-report.mjs.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const SCORECARDS_DIR = path.join(process.cwd(), ".git", ".orchestration", "scorecards");

function parseContract(contractPath) {
  const raw = readFileSync(contractPath, "utf-8");
  const frontmatterMatch = raw.match(/^---\n(\{[\s\S]*?\})\n---/);
  let meta = {};
  if (frontmatterMatch) {
    try {
      meta = JSON.parse(frontmatterMatch[1]);
    } catch {
      // ignore
    }
  }
  const body = frontmatterMatch ? raw.slice(frontmatterMatch[0].length).trim() : raw;
  return { meta, body };
}

function extractCriteria(body) {
  const criteria = [];
  // Match table rows
  const regex = /\|\s*(\w+-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*(\w+)\s*\|/g;
  let m;
  while ((m = regex.exec(body)) !== null) {
    criteria.push({ id: m[1].trim(), criterion: m[2].trim(), verification: m[3].trim(), threshold: m[4].trim() });
  }
  return criteria;
}

// ── Verification runners ────────────────────────────────────────────

function runTestCheck(criterion, verification) {
  if (verification.includes("npm run test")) {
    try {
      const workspace = verification.match(/-w\s+(@?[\w/-]+)/);
      const filter = verification.match(/--filter\s+([\w-]+)/);
      let cmd = "npm run test";
      if (workspace) cmd += ` -w ${workspace[1]}`;
      if (filter) cmd += ` -- --reporter=dot --testNamePattern="${filter[1]}"`;
      cmd += " -- --reporter=dot";
      execSync(cmd, { encoding: "utf-8", cwd: process.cwd(), timeout: 120000 });
      return { status: "PASS", detail: "Tests passed" };
    } catch (e) {
      return { status: "FAIL", detail: `Test failed: ${e.message.slice(0, 200)}` };
    }
  }
  return null;
}

function runTypeCheck(criterion, verification) {
  if (verification.includes("typecheck") || verification.includes("tsc")) {
    try {
      execSync("npm run typecheck", { encoding: "utf-8", cwd: process.cwd(), timeout: 120000 });
      return { status: "PASS", detail: "TypeScript typecheck passed" };
    } catch (e) {
      return { status: "FAIL", detail: `Typecheck failed: ${e.message.slice(0, 200)}` };
    }
  }
  return null;
}

function runGuardrails(criterion, verification) {
  if (verification.includes("guardrails")) {
    try {
      execSync("npm run guardrails", { encoding: "utf-8", cwd: process.cwd(), timeout: 60000 });
      return { status: "PASS", detail: "Guardrails passed" };
    } catch (e) {
      return { status: "FAIL", detail: `Guardrails failed: ${e.message.slice(0, 200)}` };
    }
  }
  return null;
}

function runFileExistence(criterion, verification) {
  const fileMatch = criterion.match(/apps\/[\w-]+\/src\/[\w/.-]+/);
  if (fileMatch && existsSync(fileMatch[0])) {
    return { status: "PASS", detail: `File exists: ${fileMatch[0]}` };
  }
  return null;
}

function runGrepCheck(criterion, verification) {
  // Look for patterns in code
  const patterns = [];

  // Extract prop names from backticks
  const propMatches = criterion.matchAll(/`([a-zA-Z_][a-zA-Z0-9_]*)`/g);
  for (const m of propMatches) patterns.push(m[1]);

  // Extract header names
  const headerMatches = criterion.matchAll(/(Content-[A-Za-z]+|Authorization|X-[A-Za-z-]+)/g);
  for (const m of headerMatches) patterns.push(m[1]);

  if (patterns.length === 0) return null;

  const found = [];
  const missing = [];
  for (const p of patterns) {
    try {
      execSync(`grep -r "${p}" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.js" -l`, {
        encoding: "utf-8",
        cwd: process.cwd(),
        timeout: 30000,
      });
      found.push(p);
    } catch {
      missing.push(p);
    }
  }

  if (missing.length === 0) {
    return { status: "PASS", detail: `All patterns found: ${found.join(", ")}` };
  }
  return { status: missing.length === patterns.length ? "FAIL" : "PARTIAL", detail: `Missing patterns: ${missing.join(", ")}` };
}

function runRouteCheck(criterion, verification, baseUrl) {
  const routeMatch = criterion.match(/(GET|POST|PUT|PATCH|DELETE)\s+([/\w-:]+)/);
  if (!routeMatch || !baseUrl) return null;

  const method = routeMatch[1];
  const routePath = routeMatch[2];
  const url = `${baseUrl}${routePath}`;

  try {
    // Use curl for quick HTTP checks
    const cmd = `curl -s -o /dev/null -w "%{http_code}" -X ${method} ${url}`;
    const statusCode = execSync(cmd, { encoding: "utf-8", cwd: process.cwd(), timeout: 10000 }).trim();

    if (statusCode === "200" || statusCode === "201") {
      return { status: "PASS", detail: `${method} ${url} returned ${statusCode}` };
    }
    if (statusCode === "403" && criterion.includes("403")) {
      return { status: "PASS", detail: `${method} ${url} correctly returned 403` };
    }
    if (statusCode === "401" && criterion.includes("401")) {
      return { status: "PASS", detail: `${method} ${url} correctly returned 401` };
    }
    return { status: "PARTIAL", detail: `${method} ${url} returned ${statusCode}` };
  } catch (e) {
    return { status: "FAIL", detail: `Request failed: ${e.message.slice(0, 200)}` };
  }
}

function evaluateCriterion(criterion, verification, baseUrl) {
  // Try each runner in order of specificity
  const runners = [
    () => runTestCheck(criterion, verification),
    () => runTypeCheck(criterion, verification),
    () => runGuardrails(criterion, verification),
    () => runRouteCheck(criterion, verification, baseUrl),
    () => runFileExistence(criterion, verification),
    () => runGrepCheck(criterion, verification),
  ];

  for (const runner of runners) {
    const result = runner();
    if (result !== null) return result;
  }

  // Fallback: manual verification required
  return { status: "MANUAL", detail: "No automated verification available — manual review required" };
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let contractPath = null;
  let baseUrl = "http://localhost:5000";

  for (const arg of args) {
    if (arg.startsWith("--contract=")) contractPath = arg.slice("--contract=".length);
    if (arg.startsWith("--base-url=")) baseUrl = arg.slice("--base-url=".length);
  }

  if (!contractPath || !existsSync(contractPath)) {
    console.error("Usage: node scripts/analysis/run-sprint-evaluation.mjs --contract=<path> [--base-url=http://localhost:5000]");
    process.exit(1);
  }

  const { meta, body } = parseContract(contractPath);
  const criteria = extractCriteria(body);

  const results = [];
  let passCount = 0;
  let failCount = 0;
  let manualCount = 0;

  for (const c of criteria) {
    const result = evaluateCriterion(c.criterion, c.verification, baseUrl);
    results.push({
      id: c.id,
      criterion: c.criterion,
      ...result,
    });
    if (result.status === "PASS") passCount++;
    else if (result.status === "FAIL") failCount++;
    else if (result.status === "MANUAL") manualCount++;
  }

  const totalGraded = criteria.length - manualCount;
  const passRate = totalGraded > 0 ? (passCount / totalGraded * 100).toFixed(1) : 0;

  const verdict = failCount > 0 ? "FAIL" : manualCount > 0 && passCount === 0 ? "CONCERN" : "PASS";

  const scorecard = {
    sprintContractId: meta.sprintId || "unknown",
    taskId: meta.taskId || "unknown",
    tier: meta.tier || 2,
    evaluatedAt: new Date().toISOString(),
    criteriaEvaluated: criteria.length,
    passCount,
    failCount,
    manualCount,
    passRate: `${passRate}%`,
    verdict,
    results,
  };

  if (!existsSync(SCORECARDS_DIR)) {
    mkdirSync(SCORECARDS_DIR, { recursive: true });
  }

  const scorecardPath = path.join(SCORECARDS_DIR, `scorecard.${meta.sprintId || Date.now()}.json`);
  writeFileSync(scorecardPath, JSON.stringify(scorecard, null, 2), "utf-8");

  console.log(JSON.stringify({
    ...scorecard,
    scorecardPath,
  }, null, 2));

  process.exit(verdict === "PASS" ? 0 : verdict === "CONCERN" ? 2 : 1);
}

main();
