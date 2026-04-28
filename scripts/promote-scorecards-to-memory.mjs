#!/usr/bin/env node
/**
 * promote-scorecards-to-memory.mjs — Promote scorecard aggregates to repo memory
 *
 * Reads scorecards from .git/.orchestration/scorecards/ and writes weekly
 * aggregate summaries to repo-memory/candidates/ for long-term trend analysis.
 *
 * Usage:
 *   node scripts/promote-scorecards-to-memory.mjs [--weeks=8] [--dry-run]
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const SCORECARDS_DIR = path.join(process.cwd(), ".git", ".orchestration", "scorecards");
const MEMORY_DIR = path.join(process.cwd(), "repo-memory", "candidates");

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

function calculateWeeklyAggregates(scorecards, weeksToAggregate = 8) {
  const now = new Date();
  const weekStarts = [];
  for (let i = weeksToAggregate - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(getWeekStart(d.toISOString()));
  }

  const byWeek = {};
  for (const ws of weekStarts) {
    byWeek[ws] = [];
  }

  for (const sc of scorecards) {
    const ws = getWeekStart(sc.evaluatedAt || sc.createdAt || now.toISOString());
    if (byWeek[ws]) byWeek[ws].push(sc);
  }

  const aggregates = [];
  for (const ws of weekStarts) {
    const week = byWeek[ws];
    if (week.length === 0) continue;

    const total = week.length;
    const pass = week.filter((sc) => sc.verdict === "PASS").length;
    const fail = week.filter((sc) => sc.verdict === "FAIL").length;
    const concern = week.filter((sc) => sc.verdict === "CONCERN").length;

    // Per-pillar averages
    const pillarTotals = {};
    const pillarCounts = {};
    for (const sc of week) {
      if (sc.pillarScores) {
        for (const [pillar, score] of Object.entries(sc.pillarScores)) {
          pillarTotals[pillar] = (pillarTotals[pillar] || 0) + score;
          pillarCounts[pillar] = (pillarCounts[pillar] || 0) + 1;
        }
      }
    }
    const pillarAverages = {};
    for (const p of Object.keys(pillarTotals)) {
      pillarAverages[p] = parseFloat((pillarTotals[p] / pillarCounts[p]).toFixed(2));
    }

    aggregates.push({
      weekStart: ws,
      totalTasks: total,
      verdicts: { pass, fail, concern },
      passRate: parseFloat((pass / total * 100).toFixed(1)),
      pillarAverages,
      avgIterations: week.filter((sc) => sc.iterations).length > 0
        ? parseFloat((week.filter((sc) => sc.iterations).reduce((a, sc) => a + sc.iterations, 0) / week.filter((sc) => sc.iterations).length).toFixed(2))
        : null,
    });
  }

  return aggregates;
}

function generateMemoryEntry(aggregates) {
  const now = new Date().toISOString();
  const latest = aggregates[aggregates.length - 1];

  const content = [
    "# Harness Scorecard Aggregate",
    "",
    `**Period:** ${aggregates[0]?.weekStart || "N/A"} → ${latest?.weekStart || "N/A"}`,
    `**Generated:** ${now}`,
    "",
    "## Weekly Trends",
    "",
    "| Week | Tasks | Pass Rate | Avg Iterations | Pillar Averages |",
    "|------|-------|-----------|----------------|-----------------|",
  ];

  for (const agg of aggregates) {
    const pillarStr = Object.entries(agg.pillarAverages)
      .map(([p, s]) => `${p}:${s}`)
      .join(", ");
    content.push(`| ${agg.weekStart} | ${agg.totalTasks} | ${agg.passRate}% | ${agg.avgIterations || "—"} | ${pillarStr || "—"} |`);
  }

  content.push("");
  content.push("## Key Observations");
  content.push("");

  if (latest) {
    const trendingUp = aggregates.length >= 2 && aggregates[aggregates.length - 2].passRate < latest.passRate;
    const trendingDown = aggregates.length >= 2 && aggregates[aggregates.length - 2].passRate > latest.passRate;

    if (trendingUp) content.push("- 📈 Pass rate is trending upward.");
    if (trendingDown) content.push("- 📉 Pass rate is trending downward — investigate root cause.");
    if (latest.avgIterations && latest.avgIterations > 2) content.push("- ⚠️ Average iterations > 2 — contracts may need better pre-negotiation.");
    if (latest.passRate >= 90) content.push("- ✅ Excellent first-pass success rate.");
    if (latest.passRate < 50) content.push("- 🔴 Low pass rate — consider tightening contract templates or upgrading evaluators.");
  }

  content.push("");
  content.push("## Pillar Score Trends");
  content.push("");

  const allPillars = new Set();
  for (const agg of aggregates) {
    Object.keys(agg.pillarAverages).forEach((p) => allPillars.add(p));
  }

  for (const pillar of allPillars) {
    const scores = aggregates.map((agg) => agg.pillarAverages[pillar]).filter((s) => s !== undefined);
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "N/A";
    const latestScore = aggregates[aggregates.length - 1]?.pillarAverages[pillar];
    content.push(`- **${pillar}**: avg ${avg}/5, latest ${latestScore || "N/A"}/5`);
  }

  content.push("");
  content.push("---");
  content.push("*This entry was auto-generated by `promote-scorecards-to-memory.mjs`. Do not edit manually.*");

  return content.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  let weeks = 8;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith("--weeks=")) weeks = parseInt(arg.slice("--weeks=".length), 10);
    if (arg === "--dry-run") dryRun = true;
  }

  const scorecards = loadScorecards();

  if (scorecards.length === 0) {
    console.log(JSON.stringify({ ok: true, message: "No scorecards found — nothing to promote", scorecardsDir: SCORECARDS_DIR }, null, 2));
    process.exit(0);
  }

  const aggregates = calculateWeeklyAggregates(scorecards, weeks);

  if (aggregates.length === 0) {
    console.log(JSON.stringify({ ok: true, message: "No aggregates for the specified period", weeks }, null, 2));
    process.exit(0);
  }

  const memoryContent = generateMemoryEntry(aggregates);
  const memoryFileName = `harness-scorecard-aggregate-${aggregates[0].weekStart}-to-${aggregates[aggregates.length - 1].weekStart}.md`;
  const memoryPath = path.join(MEMORY_DIR, memoryFileName);

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      wouldWriteTo: memoryPath,
      aggregates: aggregates.length,
      scorecardsRead: scorecards.length,
      preview: memoryContent.slice(0, 500) + "...",
    }, null, 2));
    process.exit(0);
  }

  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }

  writeFileSync(memoryPath, memoryContent, "utf-8");

  console.log(JSON.stringify({
    ok: true,
    memoryPath,
    aggregates: aggregates.length,
    scorecardsRead: scorecards.length,
    period: `${aggregates[0].weekStart} → ${aggregates[aggregates.length - 1].weekStart}`,
  }, null, 2));
}

main();
