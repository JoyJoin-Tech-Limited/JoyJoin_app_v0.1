#!/usr/bin/env node
/**
 * generate-sprint-contract.mjs — Auto-generate Sprint Contract from task metadata
 *
 * Reads task-creator output + tier selection + template library to pre-fill
 * a Sprint Contract. Reduces boilerplate writing time from 5–10 min to <1 min.
 *
 * Usage:
 *   node scripts/generate-sprint-contract.mjs \
 *     --task-id=<id> \
 *     --goal="<one sentence>" \
 *     [--tier=<1|2|3>] \
 *     [--files=a.ts,b.ts] \
 *     [--agent=<agent-name>] \
 *     [--workspaces=server,admin-client] \
 *     [--output=<path>]
 *
 * The script auto-detects tier if not provided.
 */

import { execSync } from "child_process";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const SPRINTS_DIR = path.join(process.cwd(), ".git", ".orchestration", "sprints");

// ── Template library ────────────────────────────────────────────────

const PILLAR_TEMPLATES = {
  "new-api-route": {
    reliability: [
      { id: "REL-01", criterion: "All new routes handle 4xx/5xx errors with Zod validation", verification: "npm run test -w @joyjoin/server", threshold: "PASS" },
      { id: "REL-02", criterion: "Idempotency key or duplicate-guard for mutating operations", verification: "Code review + test", threshold: "PASS" },
    ],
    scalability: [
      { id: "SCA-01", criterion: "No N+1 queries in new endpoints", verification: "npm run test -w @joyjoin/server", threshold: "PASS" },
    ],
    security: [
      { id: "SEC-01", criterion: "New admin routes enforce admin middleware", verification: "curl test + code review", threshold: "PASS" },
      { id: "SEC-02", criterion: "Sensitive data not logged in plain text", verification: "grep for console.log + logger review", threshold: "PASS" },
    ],
    observability: [
      { id: "OBS-01", criterion: "New routes log errors via structured logger", verification: "Code review", threshold: "PASS" },
    ],
    maintainability: [
      { id: "MNT-01", criterion: "New route follows domain ownership rules (routes/domains/*.ts)", verification: "File path review", threshold: "PASS" },
      { id: "MNT-02", criterion: "Zod schema defined in packages/shared if consumed by multiple clients", verification: "Import path review", threshold: "PASS" },
    ],
  },
  "ui-component": {
    reliability: [
      { id: "REL-01", criterion: "Component handles empty/boundary states (no data, loading, error)", verification: "Visual inspection / Playwright screenshot", threshold: "PASS" },
    ],
    scalability: [
      { id: "SCA-01", criterion: "No prop drilling >3 levels deep", verification: "Code review", threshold: "PASS" },
    ],
    security: [
      { id: "SEC-01", criterion: "User-generated content is escaped (XSS prevention)", verification: "Code review + test with <script>", threshold: "PASS" },
    ],
    observability: [
      { id: "OBS-01", criterion: "Loading and error states are visually distinct", verification: "Visual inspection", threshold: "PASS" },
    ],
    maintainability: [
      { id: "MNT-01", criterion: "Component follows design-system tokens (spacing, colors, typography)", verification: "Token audit", threshold: "PASS" },
      { id: "MNT-02", criterion: "Props are typed with TypeScript interfaces", verification: "tsc --noEmit", threshold: "PASS" },
    ],
  },
  "migration": {
    reliability: [
      { id: "REL-01", criterion: "Migration is idempotent (safe to run twice)", verification: "Run migration twice locally", threshold: "PASS" },
      { id: "REL-02", criterion: "Rollback path documented or scripted", verification: "Review rollback plan", threshold: "PASS" },
    ],
    scalability: [
      { id: "SCA-01", criterion: "Migration runs in <30s on production-sized dataset", verification: "Time migration on staging clone", threshold: "PASS" },
    ],
    security: [
      { id: "SEC-01", criterion: "No sensitive data exposed in migration output", verification: "Code review", threshold: "PASS" },
    ],
    observability: [],
    maintainability: [
      { id: "MNT-01", criterion: "Migration follows Drizzle naming convention (timestamp_description)", verification: "File name review", threshold: "PASS" },
    ],
  },
  "schema-change": {
    reliability: [
      { id: "REL-01", criterion: "Backward-compatible or coordinated deployment", verification: "Deploy plan review", threshold: "PASS" },
      { id: "REL-02", criterion: "Default values or nullable for new columns", verification: "Schema review", threshold: "PASS" },
    ],
    scalability: [],
    security: [
      { id: "SEC-01", criterion: "No PII added without encryption/at-rest justification", verification: "Schema review", threshold: "PASS" },
    ],
    observability: [],
    maintainability: [
      { id: "MNT-01", criterion: "Zod schema updated in packages/shared/src/schema.ts", verification: "Import path review", threshold: "PASS" },
      { id: "MNT-02", criterion: "TypeScript types regenerated if using codegen", verification: "npm run typecheck", threshold: "PASS" },
    ],
  },
  "cross-workspace": {
    reliability: [
      { id: "REL-01", criterion: "Shared types compile across all workspaces", verification: "npm run typecheck", threshold: "PASS" },
    ],
    scalability: [],
    security: [
      { id: "SEC-01", criterion: "No secrets or env vars leaked in shared code", verification: "grep for API keys / secrets", threshold: "PASS" },
    ],
    observability: [],
    maintainability: [
      { id: "MNT-01", criterion: "Explicit sequencing: shared → server → client", verification: "Contract section review", threshold: "PASS" },
      { id: "MNT-02", criterion: "No cross-app imports (only @joyjoin/shared)", verification: "npm run guardrails", threshold: "PASS" },
    ],
  },
};

function detectTemplate(goal, files) {
  const lower = goal.toLowerCase();
  const fileStr = files.join(" ").toLowerCase();

  if (lower.includes("migration") || fileStr.includes("migrations/")) return "migration";
  if (lower.includes("schema") || fileStr.includes("schema.ts")) return "schema-change";
  if (lower.includes("route") || lower.includes("endpoint") || lower.includes("api") || fileStr.includes("routes/")) return "new-api-route";
  if (lower.includes("component") || lower.includes("page") || lower.includes("ui") || fileStr.includes("pages/") || fileStr.includes("components/")) return "ui-component";
  if ((fileStr.includes("packages/") && fileStr.includes("apps/")) || lower.includes("cross-workspace")) return "cross-workspace";

  // Default: try to infer from file patterns
  if (fileStr.includes("apps/server/")) return "new-api-route";
  if (fileStr.includes("apps/mini-program/") || fileStr.includes("apps/user-client/") || fileStr.includes("apps/admin-client/")) return "ui-component";

  return "new-api-route"; // safest default
}

function generateId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `sprint_${date}_${rand}`;
}

function detectTier(files, goal) {
  try {
    const filesArg = files.length > 0 ? `--files=${files.join(",")}` : "";
    const output = execSync(
      `node scripts/select-harness-tier.mjs ${filesArg} --task-meta='{"task":"${goal}"}'`,
      { encoding: "utf-8", cwd: process.cwd() }
    );
    return JSON.parse(output);
  } catch {
    return { tier: 2, reason: "Auto-detection failed — defaulting to Tier 2" };
  }
}

function generateContract({ taskId, goal, tier, agent, workspaces, files }) {
  const templateKey = detectTemplate(goal, files);
  const template = PILLAR_TEMPLATES[templateKey] || PILLAR_TEMPLATES["new-api-route"];
  const sprintId = generateId();
  const now = new Date().toISOString();

  // Build pillar sections
  const pillars = ["reliability", "scalability", "security", "observability", "maintainability"];
  const pillarSections = pillars
    .filter((p) => template[p] && template[p].length > 0)
    .map((p) => {
      const title = p.charAt(0).toUpperCase() + p.slice(1);
      const rows = template[p]
        .map(
          (c) => `| ${c.id} | ${c.criterion} | ${c.verification} | ${c.threshold} |`
        )
        .join("\n");
      return `### ${title}\n| ID | Criterion | Verification | Threshold |\n|----|-----------|--------------|-----------|\n${rows}`;
    })
    .join("\n\n");

  // Build sequencing note for cross-workspace
  const sequencing =
    workspaces && workspaces.length > 1
      ? "\n## 7. Cross-Workspace Sequencing\n\n**Order:**\n1. `packages/shared` — types, schemas, constants\n2. `apps/server` — API routes, services, repositories\n3. " + workspaces.filter((w) => w !== "shared" && w !== "server").map((w) => "`apps/" + w + "`").join(" → ") + "\n\n**Rule:** Do not begin downstream workspace work until upstream contracts compile (npm run typecheck).\n"
      : "";

  const body = `---
{
  "sprintId": "${sprintId}",
  "taskId": "${taskId}",
  "generatorAgent": "${agent || "(assign in orchestration)"}",
  "contractEvaluator": "Verifier",
  "sprintEvaluator": "QA Agent",
  "status": "draft",
  "tier": ${tier},
  "createdAt": "${now}",
  "acceptedAt": null,
  "maxEvaluatorIterations": 3,
  "goal": "${goal.replace(/"/g, '\\"')}"
}
---

# Sprint Contract: ${taskId}

## 1. Goal
${goal}

## 2. Acceptance Criteria (testable)

| ID | Criterion | Verification Method | Threshold |
|----|-----------|---------------------|-----------|
| AC-01 | [Define first acceptance criterion per sprint goal] | [Command / test / MCP check] | PASS |
| AC-02 | [Define second acceptance criterion per sprint goal] | [Command / test / MCP check] | PASS |

## 3. Harness Pillar Criteria

${pillarSections}

## 4. Out-of-Scope
- [What this sprint explicitly does NOT do]

## 5. Affected Workspaces
${workspaces && workspaces.length > 0 ? workspaces.map((w) => `- \`${w}\``).join("\n") : "- [List workspaces]"}

## 6. Verification Method Summary
[How will the Evaluator verify this contract after implementation?]
${sequencing}
## 8. Negotiation Log
- **[${now}]** Implementer proposed: [initial draft — auto-generated from template]
`;

  return { sprintId, body, templateKey };
}

function main() {
  const args = process.argv.slice(2);
  let taskId = null;
  let goal = null;
  let tier = null;
  let files = [];
  let agent = null;
  let workspaces = [];
  let outputPath = null;

  for (const arg of args) {
    if (arg.startsWith("--task-id=")) taskId = arg.slice("--task-id=".length);
    if (arg.startsWith("--goal=")) goal = arg.slice("--goal=".length);
    if (arg.startsWith("--tier=")) tier = parseInt(arg.slice("--tier=".length), 10);
    if (arg.startsWith("--files=")) files = arg.slice("--files=".length).split(",").map((f) => f.trim()).filter(Boolean);
    if (arg.startsWith("--agent=")) agent = arg.slice("--agent=".length);
    if (arg.startsWith("--workspaces=")) workspaces = arg.slice("--workspaces=".length).split(",").map((w) => w.trim()).filter(Boolean);
    if (arg.startsWith("--output=")) outputPath = arg.slice("--output=".length);
  }

  if (!taskId || !goal) {
    console.error("Usage: node scripts/generate-sprint-contract.mjs --task-id=<id> --goal=\"<one sentence>\" [--tier=<n>] [--files=a.ts,b.ts] [--agent=<name>] [--workspaces=server,admin-client]");
    process.exit(1);
  }

  const tierResult = tier ? { tier, reason: "Explicit override" } : detectTier(files, goal);

  const { sprintId, body, templateKey } = generateContract({
    taskId,
    goal,
    tier: tierResult.tier,
    agent,
    workspaces,
    files,
  });

  if (!existsSync(SPRINTS_DIR)) {
    mkdirSync(SPRINTS_DIR, { recursive: true });
  }

  const finalPath = outputPath || path.join(SPRINTS_DIR, `sprint-contract.${taskId}.md`);
  writeFileSync(finalPath, body, "utf-8");

  console.log(JSON.stringify({
    ok: true,
    sprintId,
    taskId,
    tier: tierResult.tier,
    template: templateKey,
    path: finalPath,
    tierReason: tierResult.reason,
    message: `Sprint Contract generated at ${finalPath}`,
  }, null, 2));
}

main();
