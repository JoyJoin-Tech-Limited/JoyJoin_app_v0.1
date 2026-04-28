#!/usr/bin/env node
/**
 * harness-cost-tracker.mjs — Lightweight token usage logger per task
 *
 * Logs estimated token usage for each harness task to enable cost tracking
 * and calibration of the tier cost model.
 *
 * Usage:
 *   node scripts/harness-cost-tracker.mjs \
 *     --task-id=<id> \
 *     --tier=<1|2|3> \
 *     --agent=<name> \
 *     --input-tokens=<n> \
 *     --output-tokens=<n> \
 *     --model-tier=<mini|standard|max>
 *
 *   # Or batch-log from a file:
 *   node scripts/harness-cost-tracker.mjs --batch=<json-path>
 *
 * Outputs cumulative cost report.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import path from "path";

const COST_LOG_DIR = path.join(process.cwd(), ".git", ".orchestration", "costs");

// USD per 1M tokens (approximate, update as models/pricing change)
const PRICING = {
  mini: { input: 0.15, output: 0.60 },
  standard: { input: 2.50, output: 10.00 },
  max: { input: 5.00, output: 20.00 },
};

function ensureDir() {
  if (!existsSync(COST_LOG_DIR)) {
    mkdirSync(COST_LOG_DIR, { recursive: true });
  }
}

function logEntry(entry) {
  ensureDir();
  const logFile = path.join(COST_LOG_DIR, `cost-log-${new Date().toISOString().slice(0, 7)}.jsonl`);
  const line = JSON.stringify(entry) + "\n";

  // Append to monthly JSONL
  writeFileSync(logFile, line, { flag: "a" });

  return entry;
}

function calculateCost(inputTokens, outputTokens, modelTier) {
  const pricing = PRICING[modelTier] || PRICING.standard;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    input: inputCost,
    output: outputCost,
    total: inputCost + outputCost,
  };
}

function generateReport() {
  ensureDir();
  const files = existsSync(COST_LOG_DIR)
    ? readdirSync(COST_LOG_DIR).filter((f) => f.endsWith(".jsonl"))
    : [];

  const entries = [];
  for (const f of files) {
    const lines = readFileSync(path.join(COST_LOG_DIR, f), "utf-8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // ignore malformed lines
      }
    }
  }

  if (entries.length === 0) {
    return { totalEntries: 0, totalCost: 0, byTier: {}, byModelTier: {} };
  }

  const totalCost = entries.reduce((sum, e) => sum + (e.cost?.total || 0), 0);

  const byTier = {};
  const byModelTier = {};

  for (const e of entries) {
    const t = e.tier || "unknown";
    const mt = e.modelTier || "unknown";
    byTier[t] = (byTier[t] || 0) + (e.cost?.total || 0);
    byModelTier[mt] = (byModelTier[mt] || 0) + (e.cost?.total || 0);
  }

  // Per-task averages
  const taskCosts = {};
  for (const e of entries) {
    const tid = e.taskId || "unknown";
    if (!taskCosts[tid]) taskCosts[tid] = [];
    taskCosts[tid].push(e.cost?.total || 0);
  }

  const avgTaskCost = Object.values(taskCosts)
    .map((costs) => costs.reduce((a, b) => a + b, 0))
    .reduce((a, b) => a + b, 0) / Object.keys(taskCosts).length;

  return {
    totalEntries: entries.length,
    totalCost: parseFloat(totalCost.toFixed(4)),
    avgTaskCost: parseFloat(avgTaskCost.toFixed(4)),
    byTier: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, parseFloat(v.toFixed(4))])),
    byModelTier: Object.fromEntries(Object.entries(byModelTier).map(([k, v]) => [k, parseFloat(v.toFixed(4))])),
    tasksTracked: Object.keys(taskCosts).length,
  };
}

function main() {
  const args = process.argv.slice(2);
  let taskId = null;
  let tier = null;
  let agent = null;
  let inputTokens = null;
  let outputTokens = null;
  let modelTier = null;
  let batchPath = null;
  let reportOnly = false;

  for (const arg of args) {
    if (arg.startsWith("--task-id=")) taskId = arg.slice("--task-id=".length);
    if (arg.startsWith("--tier=")) tier = parseInt(arg.slice("--tier=".length), 10);
    if (arg.startsWith("--agent=")) agent = arg.slice("--agent=".length);
    if (arg.startsWith("--input-tokens=")) inputTokens = parseInt(arg.slice("--input-tokens=".length), 10);
    if (arg.startsWith("--output-tokens=")) outputTokens = parseInt(arg.slice("--output-tokens=".length), 10);
    if (arg.startsWith("--model-tier=")) modelTier = arg.slice("--model-tier=".length);
    if (arg.startsWith("--batch=")) batchPath = arg.slice("--batch=".length);
    if (arg === "--report") reportOnly = true;
  }

  if (reportOnly || (args.length === 0)) {
    const report = generateReport();
    console.log(JSON.stringify({
      ...report,
      pricingUsed: PRICING,
      message: "Run with --task-id, --tier, --input-tokens, --output-tokens, --model-tier to log a new entry",
    }, null, 2));
    process.exit(0);
  }

  if (batchPath) {
    if (!existsSync(batchPath)) {
      console.error(`Batch file not found: ${batchPath}`);
      process.exit(1);
    }
    const batch = JSON.parse(readFileSync(batchPath, "utf-8"));
    const logged = [];
    for (const entry of batch) {
      const cost = calculateCost(entry.inputTokens, entry.outputTokens, entry.modelTier);
      logged.push(logEntry({
        ...entry,
        cost,
        loggedAt: new Date().toISOString(),
      }));
    }
    console.log(JSON.stringify({ logged: logged.length, entries: logged }, null, 2));
    process.exit(0);
  }

  if (!taskId || !tier || inputTokens === null || outputTokens === null || !modelTier) {
    console.error("Usage:");
    console.error("  node scripts/harness-cost-tracker.mjs --task-id=<id> --tier=<n> --input-tokens=<n> --output-tokens=<n> --model-tier=<mini|standard|max> [--agent=<name>]");
    console.error("  node scripts/harness-cost-tracker.mjs --batch=<json-path>");
    console.error("  node scripts/harness-cost-tracker.mjs --report");
    process.exit(1);
  }

  const cost = calculateCost(inputTokens, outputTokens, modelTier);
  const entry = logEntry({
    taskId,
    tier,
    agent,
    modelTier,
    inputTokens,
    outputTokens,
    cost,
    loggedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({
    ok: true,
    entry,
    cumulative: generateReport(),
  }, null, 2));
}

main();
