#!/usr/bin/env node
/**
 * harness-full.mjs — Tier 3 Full Harness Orchestrator
 *
 * Runs the complete Planner → Generator → Evaluator cycle for high-stakes changes.
 * This is a thin orchestration script that coordinates agent handoffs via file artifacts.
 *
 * Usage:
 *   node scripts/harness/harness-full.mjs --task=<description> --plan=<planFile> [--max-rounds=2]
 *
 * Workflow:
 *   1. Read the Planner's locked Sprint Contract
 *   2. Delegate to Generator (engineer implements)
 *   3. Run Evaluator (QA Agent Sprint Evaluation + Verifier spot-check)
 *   4. If rejected and rounds < max → feedback → back to step 2
 *   5. If accepted → run Harness Completion Gate → done
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const SPRINTS_DIR = ".git/.orchestration/sprints";
const SCORECARDS_DIR = ".git/.orchestration/scorecards";

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadSprintContract(contractPath) {
  if (!existsSync(contractPath)) {
    throw new Error(`Sprint Contract not found: ${contractPath}`);
  }
  const raw = readFileSync(contractPath, "utf-8");
  const frontmatterMatch = raw.match(/^---\n(\{[\s\S]*?\})\n---/);
  const meta = frontmatterMatch ? JSON.parse(frontmatterMatch[1]) : {};
  return { meta, body: raw };
}

function writeVerdict(sprintId, verdict, iteration, details) {
  ensureDir(SCORECARDS_DIR);
  const file = path.join(SCORECARDS_DIR, `scorecard-${sprintId}.json`);
  const payload = {
    sprintId,
    iteration,
    verdict,
    ...details,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function main() {
  const args = process.argv.slice(2);
  let taskDesc = "";
  let contractPath = "";
  let maxRounds = 2;

  for (const arg of args) {
    if (arg.startsWith("--task=")) taskDesc = arg.slice("--task=".length);
    if (arg.startsWith("--contract=")) contractPath = arg.slice("--contract=".length);
    if (arg.startsWith("--max-rounds=")) maxRounds = parseInt(arg.slice("--max-rounds=".length), 10);
  }

  if (!contractPath) {
    console.error("Usage: node scripts/harness/harness-full.mjs --contract=<path> [--max-rounds=2]");
    process.exit(1);
  }

  const { meta } = loadSprintContract(contractPath);
  const sprintId = meta.sprintId || path.basename(contractPath, ".md");

  console.log(`=== Harness Full Orchestrator ===`);
  console.log(`Sprint: ${sprintId}`);
  console.log(`Goal: ${meta.goal || taskDesc || "(none)"}`);
  console.log(`Max QA rounds: ${maxRounds}`);
  console.log();

  // In a fully automated system, this script would spawn agents.
  // In the Kimi Code CLI context, it produces instructions for the human
  // or orchestration layer to follow.

  const instructions = {
    sprintId,
    tier: 3,
    phase: "orchestrator_ready",
    instructions: [
      `1. Generator (${meta.generatorAgent || "specialist engineer"}) implements against the locked Sprint Contract: ${contractPath}`,
      `2. After implementation, Generator runs self-evaluation against contract criteria.`,
      `3. QA Agent runs Sprint Evaluation: grades each criterion PASS/PARTIAL/FAIL with hard thresholds.`,
      `4. If any FAIL on required criterion → write feedback JSON → return to Generator for fix.`,
      `5. Max ${maxRounds} QA rounds. If still failing after ${maxRounds} rounds → escalate to Supervisor/Human.`,
      `6. If QA Agent ACCEPTs → Verifier runs skeptical post-claim spot-check.`,
      `7. If Verifier passes → run 'npm run harness:gate' for final dirty-worktree sign-off.`,
      `8. On full pass → write scorecard to ${SCORECARDS_DIR}/scorecard-${sprintId}.json`,
    ],
    artifacts: {
      contract: contractPath,
      scorecardTemplate: `${SCORECARDS_DIR}/scorecard-${sprintId}.json`,
    },
  };

  console.log(JSON.stringify(instructions, null, 2));
  process.exit(0);
}

main();
