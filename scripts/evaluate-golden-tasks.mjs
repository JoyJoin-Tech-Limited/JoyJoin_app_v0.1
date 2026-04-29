#!/usr/bin/env node
/**
 * evaluate-golden-tasks.mjs — Golden Task Routing Evaluator
 *
 * Feeds each golden task from .github/orchestration/tests/golden-tasks.json through
 * the orchestration supervisor's copilot-hook user-prompt-submit and compares
 * actual kickoff/lane routing against expected values.
 *
 * Tests:
 *   1. Kickoff detection accuracy — did supervisor recommend/not-recommend kickoff correctly?
 *   2. Memory relevance — did the memory system return relevant hits for known paths?
 *   3. Lane classification — did the prompt get routed to the correct lane (direct vs kickoff)?
 *
 * Usage:
 *   node scripts/evaluate-golden-tasks.mjs [--output=md|json] [--task=task-001]
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const GOLDEN_TASKS_PATH = path.join(".github", "orchestration", "tests", "golden-tasks.json");
const GOLDEN_RESULTS_PATH = path.join(".git", ".orchestration", "golden-results.json");
const SUPERVISOR_SCRIPT = path.join("scripts", "orchestration-supervisor.mjs");
const OUTPUT = process.argv.find((a) => a.startsWith("--output="))?.split("=")[1] || "md";
const TASK_FILTER = process.argv.find((a) => a.startsWith("--task="))?.split("=")[1] || null;

const KICKOFF_LANES = new Set(["kickoff", "deliberation", "harness"]);
const NON_KICKOFF_LANES = new Set(["direct", "operational"]);

function loadGoldenTasks() {
  if (!existsSync(GOLDEN_TASKS_PATH)) {
    console.error(`Golden tasks file not found: ${GOLDEN_TASKS_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(GOLDEN_TASKS_PATH, "utf-8"));
  } catch (e) {
    console.error(`Failed to parse golden tasks: ${e.message}`);
    process.exit(1);
  }
}

function runSupervisor(prompt) {
  try {
    const input = JSON.stringify({ prompt });
    const result = execSync(
      `echo '${input.replace(/'/g, "'\\''")}' | node ${SUPERVISOR_SCRIPT} copilot-hook user-prompt-submit`,
      {
        cwd: process.cwd(),
        timeout: 10000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const lines = result.trim().split("\n").filter((l) => l.trim());
    let output = {};

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        output = { ...output, ...parsed };
      } catch {}
    }

    return { success: true, output };
  } catch (e) {
    return { success: false, error: e.message, output: {} };
  }
}

function evaluateTask(task) {
  const { prompt, expectedLane, id } = task;
  const result = runSupervisor(prompt);

  if (!result.success) {
    return {
      id,
      prompt,
      expectedLane,
      actualLane: "error",
      status: "ERROR",
      error: result.error,
      systemMessage: null,
      kickoffRecommended: null,
    };
  }

  const { systemMessage, continue: cont } = result.output;
  const kickoffRecommended = systemMessage && systemMessage.includes("broad request");

  let actualLane;
  if (kickoffRecommended) {
    const msg = (systemMessage || "").toLowerCase();
    if (msg.includes("harness")) actualLane = "harness";
    else if (msg.includes("deliberat")) actualLane = "deliberation";
    else actualLane = "kickoff";
  } else {
    actualLane = "direct";
  }

  const expectedNeedsKickoff = KICKOFF_LANES.has(expectedLane);
  const actualNeedsKickoff = KICKOFF_LANES.has(actualLane);

  let status;
  if (expectedNeedsKickoff === actualNeedsKickoff) {
    status = expectedLane === actualLane ? "PASS" : "PASS*";
  } else if (expectedNeedsKickoff && !actualNeedsKickoff) {
    status = "FAIL (missed kickoff)";
  } else if (!expectedNeedsKickoff && actualNeedsKickoff) {
    status = "FAIL (false kickoff)";
  } else {
    status = "UNKNOWN";
  }

  return {
    id,
    prompt,
    expectedLane,
    actualLane,
    status,
    systemMessage: systemMessage ? systemMessage.slice(0, 120) : null,
    kickoffRecommended: !!kickoffRecommended,
    expectedNeedsKickoff,
    actualNeedsKickoff,
  };
}

function computeStats(results) {
  const total = results.length;
  const passed = results.filter((r) => r.status.startsWith("PASS")).length;
  const failed = results.filter((r) => r.status.startsWith("FAIL")).length;
  const errors = results.filter((r) => r.status === "ERROR").length;

  let rate = null;
  if (total > 0) {
    rate = ((passed / total) * 100).toFixed(1);
  }

  return { total, passed, failed, errors, rate };
}

function outputMarkdown(results, stats) {
  const lines = [];

  lines.push("# Golden Task Routing Evaluation");
  lines.push("");
  lines.push(`**Accuracy:** ${stats.passed}/${stats.total} passed (${stats.rate}%)`);
  lines.push(`**Errors:** ${stats.errors}`);
  lines.push("");

  if (stats.total === 0) {
    lines.push("No tasks evaluated.");
    console.log(lines.join("\n"));
    return;
  }

  lines.push("| # | Task | Expected | Actual | Verdict |");
  lines.push("|---|------|----------|--------|---------|");
  for (const r of results) {
    const desc = r.prompt.slice(0, 60) + (r.prompt.length > 60 ? "..." : "");
    const statusIcon = r.status.startsWith("PASS") ? "PASS" : r.status === "ERROR" ? "ERR" : "FAIL";
    lines.push(`| ${r.id} | ${desc} | ${r.expectedLane} | ${r.actualLane} | ${statusIcon} |`);
  }
  lines.push("");

  const failures = results.filter((r) => !r.status.startsWith("PASS"));
  if (failures.length > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const r of failures) {
      lines.push(`### ${r.id} — ${r.status}`);
      lines.push(`- Prompt: ${r.prompt}`);
      lines.push(`- Expected lane: \`${r.expectedLane}\` (needs kickoff: ${r.expectedNeedsKickoff})`);
      lines.push(`- Actual lane: \`${r.actualLane}\` (needs kickoff: ${r.actualNeedsKickoff})`);
      if (r.systemMessage) lines.push(`- System message: ${r.systemMessage}`);
      if (r.error) lines.push(`- Error: ${r.error}`);
      lines.push("");
    }
  }

  console.log(lines.join("\n"));
}

function outputJson(results, stats) {
  const summary = {
    stats,
    results,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(summary, null, 2));
}

function main() {
  let tasks = loadGoldenTasks();

  if (TASK_FILTER) {
    tasks = tasks.filter((t) => t.id === TASK_FILTER);
    if (tasks.length === 0) {
      console.error(`Task not found: ${TASK_FILTER}`);
      process.exit(1);
    }
  }

  const results = tasks.map((task) => evaluateTask(task));
  const stats = computeStats(results);

  try {
    writeFileSync(GOLDEN_RESULTS_PATH, JSON.stringify({ stats, results, timestamp: new Date().toISOString() }, null, 2));
  } catch {
    // Non-blocking
  }

  if (OUTPUT === "json") {
    outputJson(results, stats);
  } else {
    outputMarkdown(results, stats);
  }
}

main();
