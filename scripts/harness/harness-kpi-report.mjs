#!/usr/bin/env node
/**
 * harness-kpi-report.mjs — Harness Engineering Framework KPI Dashboard
 *
 * Reads all scorecard JSON files from .git/.orchestration/scorecards/ and
 * calculates weekly KPIs for the Harness Engineering Framework.
 *
 * Usage:
 *   node scripts/harness/harness-kpi-report.mjs [--weeks=4] [--output=md|json]
 *
 * Top-level KPIs:
 *   1. Bug Escape Rate     — bugs found in production / total tasks
 *   2. Rework Rate         — tasks needing >1 iteration / total tasks
 *   3. First-Pass Success  — tasks passing QA on first try / total tasks
 *   4. Avg Contract Time   — mean time from draft → accepted
 *   5. Cost Multiplier     — actual cost / estimated solo cost
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";

const SCORECARDS_DIR = path.join(process.cwd(), ".git", ".orchestration", "scorecards");
const SPRINTS_DIR = path.join(process.cwd(), ".git", ".orchestration", "sprints");

function parseJSONFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

function loadScorecards() {
  if (!existsSync(SCORECARDS_DIR)) return [];
  const files = readdirSync(SCORECARDS_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => parseJSONFile(path.join(SCORECARDS_DIR, f)))
    .filter(Boolean);
}

function loadContracts() {
  if (!existsSync(SPRINTS_DIR)) return [];
  const files = readdirSync(SPRINTS_DIR).filter((f) => f.startsWith("sprint-contract.") && f.endsWith(".md"));
  return files.map((f) => {
    const raw = readFileSync(path.join(SPRINTS_DIR, f), "utf-8");
    const frontmatterMatch = raw.match(/^---\n(\{[\s\S]*?\})\n---/);
    if (frontmatterMatch) {
      try {
        return JSON.parse(frontmatterMatch[1]);
      } catch {
        return null;
      }
    }
    return null;
  }).filter(Boolean);
}

function loadFeedback() {
  if (!existsSync(SPRINTS_DIR)) return [];
  const files = readdirSync(SPRINTS_DIR).filter((f) => f.includes("-feedback.json"));
  return files
    .map((f) => parseJSONFile(path.join(SPRINTS_DIR, f)))
    .filter(Boolean);
}

function calculateKPIs(scorecards, contracts, feedback, weeksToShow = 4) {
  const now = new Date();
  const weekStarts = [];
  for (let i = weeksToShow - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(getWeekStart(d.toISOString()));
  }

  // Group scorecards by week
  const byWeek = {};
  for (const ws of weekStarts) {
    byWeek[ws] = { scorecards: [], contracts: [], feedback: [] };
  }

  for (const sc of scorecards) {
    const ws = getWeekStart(sc.evaluatedAt || sc.createdAt || now.toISOString());
    if (byWeek[ws]) byWeek[ws].scorecards.push(sc);
  }

  for (const c of contracts) {
    const ws = getWeekStart(c.acceptedAt || c.createdAt || now.toISOString());
    if (byWeek[ws]) byWeek[ws].contracts.push(c);
  }

  for (const fb of feedback) {
    const ws = getWeekStart(fb.evaluatedAt || fb.createdAt || now.toISOString());
    if (byWeek[ws]) byWeek[ws].feedback.push(fb);
  }

  const results = [];
  for (const ws of weekStarts) {
    const week = byWeek[ws];
    const totalTasks = week.scorecards.length;
    if (totalTasks === 0) {
      results.push({
        weekStart: ws,
        totalTasks: 0,
        bugEscapeRate: null,
        reworkRate: null,
        firstPassSuccess: null,
        avgContractMinutes: null,
        avgHarnessScore: null,
      });
      continue;
    }

    // Bug escape rate: scorecards with postDeployBugs > 0
    const postDeployBugs = week.scorecards.filter((sc) => (sc.postDeployBugs || 0) > 0).length;
    const bugEscapeRate = (postDeployBugs / totalTasks * 100).toFixed(1);

    // Rework rate: feedback with iterations > 1 or scorecards with iterations > 1
    const reworked = week.scorecards.filter((sc) => (sc.iterations || 1) > 1).length;
    const reworkRate = (reworked / totalTasks * 100).toFixed(1);

    // First-pass success: verdict === "PASS" and iterations === 1
    const firstPass = week.scorecards.filter((sc) => sc.verdict === "PASS" && (sc.iterations || 1) === 1).length;
    const firstPassSuccess = (firstPass / totalTasks * 100).toFixed(1);

    // Avg contract time
    const contractTimes = week.contracts
      .filter((c) => c.createdAt && c.acceptedAt)
      .map((c) => {
        const created = new Date(c.createdAt);
        const accepted = new Date(c.acceptedAt);
        return (accepted - created) / (1000 * 60); // minutes
      });
    const avgContractMinutes = contractTimes.length > 0
      ? (contractTimes.reduce((a, b) => a + b, 0) / contractTimes.length).toFixed(1)
      : null;

    // Avg harness score (1–5 per pillar)
    const scores = week.scorecards
      .filter((sc) => sc.pillarScores)
      .map((sc) => {
        const vals = Object.values(sc.pillarScores);
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      });
    const avgHarnessScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      : null;

    results.push({
      weekStart: ws,
      totalTasks,
      bugEscapeRate: `${bugEscapeRate}%`,
      reworkRate: `${reworkRate}%`,
      firstPassSuccess: `${firstPassSuccess}%`,
      avgContractMinutes,
      avgHarnessScore,
    });
  }

  return results;
}

function generateMarkdownReport(kpis, allTime) {
  const lines = [
    "# Harness Engineering Framework — KPI Dashboard",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## All-Time Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Tasks Evaluated | ${allTime.totalTasks} |`,
    `| Bug Escape Rate | ${allTime.bugEscapeRate} |`,
    `| Rework Rate | ${allTime.reworkRate} |`,
    `| First-Pass Success | ${allTime.firstPassSuccess} |`,
    `| Avg Contract Time | ${allTime.avgContractMinutes || "N/A"} min |`,
    `| Avg Harness Score | ${allTime.avgHarnessScore || "N/A"} / 5 |`,
    "",
    "## Weekly Trends",
    "",
    `| Week | Tasks | Bug Escape | Rework | 1st Pass | Avg Contract | Avg Score |`,
    `|------|-------|------------|--------|----------|--------------|-----------|`,
  ];

  for (const row of kpis) {
    lines.push(
      `| ${row.weekStart} | ${row.totalTasks} | ${row.bugEscapeRate || "—"} | ${row.reworkRate || "—"} | ${row.firstPassSuccess || "—"} | ${row.avgContractMinutes || "—"} | ${row.avgHarnessScore || "—"} |`
    );
  }

  lines.push("");
  lines.push("## Target Benchmarks");
  lines.push("");
  lines.push("| KPI | Target | Current | Status |");
  lines.push("|-----|--------|---------|--------|");
  lines.push(`| Bug Escape Rate | < 5% | ${allTime.bugEscapeRate} | ${parseFloat(allTime.bugEscapeRate) < 5 ? "✅" : "🔴"} |`);
  lines.push(`| Rework Rate | < 15% | ${allTime.reworkRate} | ${parseFloat(allTime.reworkRate) < 15 ? "✅" : "🟡"} |`);
  lines.push(`| First-Pass Success | > 80% | ${allTime.firstPassSuccess} | ${parseFloat(allTime.firstPassSuccess) > 80 ? "✅" : "🟡"} |`);
  lines.push(`| Avg Contract Time | < 10 min | ${allTime.avgContractMinutes || "N/A"} min | ${allTime.avgContractMinutes && parseFloat(allTime.avgContractMinutes) < 10 ? "✅" : "🟡"} |`);
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  let weeks = 4;
  let outputFormat = "md";

  for (const arg of args) {
    if (arg.startsWith("--weeks=")) weeks = parseInt(arg.slice("--weeks=".length), 10);
    if (arg.startsWith("--output=")) outputFormat = arg.slice("--output=".length);
  }

  const scorecards = loadScorecards();
  const contracts = loadContracts();
  const feedback = loadFeedback();

  const kpis = calculateKPIs(scorecards, contracts, feedback, weeks);

  // All-time summary
  const allTasks = scorecards.length;
  const allBugs = scorecards.filter((sc) => (sc.postDeployBugs || 0) > 0).length;
  const allRework = scorecards.filter((sc) => (sc.iterations || 1) > 1).length;
  const allFirstPass = scorecards.filter((sc) => sc.verdict === "PASS" && (sc.iterations || 1) === 1).length;

  const allContractTimes = contracts
    .filter((c) => c.createdAt && c.acceptedAt)
    .map((c) => {
      const created = new Date(c.createdAt);
      const accepted = new Date(c.acceptedAt);
      return (accepted - created) / (1000 * 60);
    });

  const allScores = scorecards
    .filter((sc) => sc.pillarScores)
    .map((sc) => {
      const vals = Object.values(sc.pillarScores);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });

  const allTime = {
    totalTasks: allTasks,
    bugEscapeRate: allTasks > 0 ? `${(allBugs / allTasks * 100).toFixed(1)}%` : "N/A",
    reworkRate: allTasks > 0 ? `${(allRework / allTasks * 100).toFixed(1)}%` : "N/A",
    firstPassSuccess: allTasks > 0 ? `${(allFirstPass / allTasks * 100).toFixed(1)}%` : "N/A",
    avgContractMinutes: allContractTimes.length > 0 ? `${(allContractTimes.reduce((a, b) => a + b, 0) / allContractTimes.length).toFixed(1)}` : null,
    avgHarnessScore: allScores.length > 0 ? `${(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2)}` : null,
  };

  if (outputFormat === "json") {
    console.log(JSON.stringify({ allTime, weekly: kpis }, null, 2));
  } else {
    console.log(generateMarkdownReport(kpis, allTime));
  }
}

main();
