#!/usr/bin/env node
/**
 * harness-contract-gate.mjs — Contract enforcement gate
 *
 * Prevents file edits on tasks that require a Sprint Contract but don't have
 * an accepted one. Run before implementation begins.
 *
 * Usage:
 *   node scripts/harness/harness-contract-gate.mjs --task-id=<id> [--tier=<1|2|3>]
 *
 *   --task-id  The task identifier (used to locate the contract file)
 *   --tier     Override tier detection (if known)
 *
 * Exit codes:
 *   0 = OK — no contract needed, or contract is accepted
 *   1 = BLOCKED — contract required but not found or not accepted
 *   2 = WARNING — contract found but status unclear
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const SPRINTS_DIR = path.join(process.cwd(), ".git", ".orchestration", "sprints");

function findContractForTask(taskId) {
  if (!existsSync(SPRINTS_DIR)) {
    return null;
  }

  const files = readdirSync(SPRINTS_DIR).filter((f) =>
    f.startsWith("sprint-contract.") && f.endsWith(".md")
  );

  // Exact match: sprint-contract.{taskId}.md
  const exact = files.find((f) => f === `sprint-contract.${taskId}.md`);
  if (exact) {
    return path.join(SPRINTS_DIR, exact);
  }

  // Fuzzy match: any file containing the taskId
  const fuzzy = files.find((f) => f.includes(taskId));
  if (fuzzy) {
    return path.join(SPRINTS_DIR, fuzzy);
  }

  return null;
}

function parseContract(contractPath) {
  const raw = readFileSync(contractPath, "utf-8");
  const frontmatterMatch = raw.match(/^---\n(\{[\s\S]*?\})\n---/);
  if (frontmatterMatch) {
    try {
      return JSON.parse(frontmatterMatch[1]);
    } catch {
      return {};
    }
  }
  return {};
}

function detectTier(taskId) {
  try {
    // Try to auto-detect tier using select-harness-tier
    const output = execSync(
      `node scripts/select-harness-tier.mjs --task-meta='{"task":"${taskId}"}'`,
      { encoding: "utf-8", cwd: process.cwd() }
    );
    const result = JSON.parse(output);
    return result.tier;
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  let taskId = null;
  let tierOverride = null;

  for (const arg of args) {
    if (arg.startsWith("--task-id=")) taskId = arg.slice("--task-id=".length);
    if (arg.startsWith("--tier=")) tierOverride = parseInt(arg.slice("--tier=".length), 10);
  }

  if (!taskId) {
    // If no task-id, check if there's ANY active unaccepted contract
    if (!existsSync(SPRINTS_DIR)) {
      console.log(JSON.stringify({ ok: true, reason: "No sprints directory" }, null, 2));
      process.exit(0);
    }

    const files = readdirSync(SPRINTS_DIR).filter((f) =>
      f.startsWith("sprint-contract.") && f.endsWith(".md")
    );

    const unaccepted = [];
    for (const f of files) {
      const meta = parseContract(path.join(SPRINTS_DIR, f));
      if (meta.status && meta.status !== "accepted") {
        unaccepted.push({ file: f, status: meta.status, goal: meta.goal });
      }
    }

    if (unaccepted.length > 0) {
      console.log(JSON.stringify({
        ok: false,
        reason: "Unaccepted contracts found",
        blockedContracts: unaccepted,
      }, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify({ ok: true, reason: "All contracts accepted or no contracts" }, null, 2));
    process.exit(0);
  }

  // Check if contract already exists first (contract metadata trumps auto-detection)
  const contractPath = findContractForTask(taskId);
  let tier = tierOverride;

  if (contractPath) {
    const meta = parseContract(contractPath);
    tier = tierOverride || meta.tier || detectTier(taskId) || 1;
  } else {
    tier = tierOverride || detectTier(taskId) || 1;
  }

  // Tier 1: no contract needed
  if (tier === 1) {
    console.log(JSON.stringify({
      ok: true,
      taskId,
      tier,
      reason: "Tier 1 — no Sprint Contract required",
    }, null, 2));
    process.exit(0);
  }

  // Tier 2/3: contract required

  if (!contractPath) {
    console.log(JSON.stringify({
      ok: false,
      taskId,
      tier,
      reason: `Tier ${tier} requires a Sprint Contract, but none found for task '${taskId}'`,
      hint: `Create contract at .git/.orchestration/sprints/sprint-contract.${taskId}.md`,
    }, null, 2));
    process.exit(1);
  }

  const meta = parseContract(contractPath);
  const status = meta.status;

  if (status === "accepted") {
    console.log(JSON.stringify({
      ok: true,
      taskId,
      tier,
      contractPath,
      status,
      reason: "Contract accepted — implementation may proceed",
    }, null, 2));
    process.exit(0);
  }

  if (status === "proposed" || status === "draft") {
    console.log(JSON.stringify({
      ok: false,
      taskId,
      tier,
      contractPath,
      status,
      reason: `Contract exists but status is '${status}' — must be 'accepted' before implementation`,
      hint: "Hand off to Verifier for contract review and acceptance",
    }, null, 2));
    process.exit(1);
  }

  // Unknown status
  console.log(JSON.stringify({
    ok: false,
    taskId,
    tier,
    contractPath,
    status: status || "(unknown)",
    reason: `Contract status unclear: '${status || "unknown"}'`,
    hint: "Check contract frontmatter for valid status field",
  }, null, 2));
  process.exit(2);
}

main();
