#!/usr/bin/env node
/**
 * select-model-tier.mjs — Dynamic model tier recommendations per role
 *
 * Maps task metadata + harness tier to recommended model tiers for each
 * agent role in the workflow. Prevents over-spending on cheap tasks and
 * under-spending on critical ones.
 *
 * Usage:
 *   node scripts/select-model-tier.mjs \
 *     --tier=<1|2|3> \
 *     --task="<description>" \
 *     [--roles=planner,generator,evaluator]
 *
 * Model tiers (cheapest → most capable):
 *   - mini     : GPT-5.4 mini / Kimi k1.5 mini — fast, cheap, shallow
 *   - standard : GPT-5.4 / Kimi k1.5 — balanced
 *   - max      : o3 / Kimi k1.6 — reasoning, architecture, safety-critical
 */

// ── Role model mapping by harness tier ──────────────────────────────

const TIER_MODEL_MAP = {
  1: {
    // Tier 1: All roles use cheap models — deterministic gate only
    default: { tier: "mini", reason: "Tier 1 — deterministic gate, no reasoning needed" },
    planner: { tier: "mini", reason: "Tier 1 — direct delivery, minimal planning" },
    generator: { tier: "standard", reason: "Tier 1 — single implementer, standard quality" },
    evaluator: { tier: "mini", reason: "Tier 1 — deterministic check (npm run harness:gate)" },
  },
  2: {
    // Tier 2: Planner cheap, Generator standard, Evaluator cheap
    default: { tier: "standard", reason: "Tier 2 — Sprint Contract requires balanced reasoning" },
    planner: { tier: "mini", reason: "Tier 2 — Supervisor routing only, no deep planning" },
    generator: { tier: "standard", reason: "Tier 2 — implementer needs good reasoning for contract adherence" },
    evaluator: { tier: "mini", reason: "Tier 2 — Verifier contract review + QA Agent evaluation, cheap is fine" },
    contractEvaluator: { tier: "mini", reason: "Tier 2 — contract review, pattern matching" },
    sprintEvaluator: { tier: "mini", reason: "Tier 2 — criterion grading, deterministic checks" },
  },
  3: {
    // Tier 3: Full deliberation — max for Planner/Evaluator, standard for Generator
    default: { tier: "max", reason: "Tier 3 — full harness deliberation, safety-critical" },
    planner: { tier: "max", reason: "Tier 3 — HRC needs deep architectural reasoning" },
    generator: { tier: "standard", reason: "Tier 3 — implementer follows contract, standard is sufficient" },
    evaluator: { tier: "max", reason: "Tier 3 — Council needs skeptical deep reasoning" },
    contractEvaluator: { tier: "max", reason: "Tier 3 — contract review must catch architectural flaws" },
    sprintEvaluator: { tier: "standard", reason: "Tier 3 — QA evaluation needs good reasoning but not max" },
  },
};

// ── Task-specific overrides ─────────────────────────────────────────

function getTaskOverrides(taskDesc, tier) {
  const lower = taskDesc.toLowerCase();
  const overrides = {};

  // Payment / auth / security → always max for evaluator
  if (/payment|auth|security|refund|wechat pay|secret|token/i.test(lower)) {
    overrides.evaluator = { tier: "max", reason: "Security-critical task — evaluator upgraded to max" };
    overrides.contractEvaluator = { tier: "max", reason: "Security-critical task — contract evaluator upgraded to max" };
  }

  // Core engine changes → max for planner + evaluator
  if (/matching|personality|archetype|core engine|scoring/i.test(lower)) {
    overrides.planner = { tier: "max", reason: "Core engine task — planner upgraded to max" };
    overrides.generator = { tier: "max", reason: "Core engine task — generator upgraded to max" };
    overrides.evaluator = { tier: "max", reason: "Core engine task — evaluator upgraded to max" };
  }

  // Simple UI / copy → mini for everything
  if (/copy|text|label|color|spacing|padding|margin/i.test(lower) && tier === 2) {
    overrides.generator = { tier: "standard", reason: "UI polish — standard sufficient" };
    overrides.evaluator = { tier: "mini", reason: "UI polish — mini evaluator sufficient" };
  }

  // Bug fix with known root cause → standard for generator
  if (/bug|fix|regression|hotfix/i.test(lower)) {
    overrides.generator = { tier: "standard", reason: "Bug fix — standard reasoning for targeted change" };
  }

  return overrides;
}

function main() {
  const args = process.argv.slice(2);
  let tier = null;
  let taskDesc = "";
  let roles = ["planner", "generator", "evaluator", "contractEvaluator", "sprintEvaluator"];

  for (const arg of args) {
    if (arg.startsWith("--tier=")) tier = parseInt(arg.slice("--tier=".length), 10);
    if (arg.startsWith("--task=")) taskDesc = arg.slice("--task=".length);
    if (arg.startsWith("--roles=")) roles = arg.slice("--roles=".length).split(",").map((r) => r.trim());
  }

  if (!tier || ![1, 2, 3].includes(tier)) {
    console.error("Usage: node scripts/select-model-tier.mjs --tier=<1|2|3> --task=\"<description>\" [--roles=planner,generator,evaluator]");
    process.exit(1);
  }

  const tierMap = TIER_MODEL_MAP[tier] || TIER_MODEL_MAP[2];
  const overrides = getTaskOverrides(taskDesc, tier);

  const recommendations = {};
  for (const role of roles) {
    const base = tierMap[role] || tierMap.default;
    const override = overrides[role];
    recommendations[role] = override || base;
  }

  // Cost estimate (approximate USD per 1M tokens)
  const COST_PER_1M = {
    mini: { input: 0.15, output: 0.60 },
    standard: { input: 2.50, output: 10.00 },
    max: { input: 5.00, output: 20.00 },
  };

  // Rough estimate: 1 turn = ~4K input + ~2K output tokens
  const TOKENS_PER_TURN = { input: 4000, output: 2000 };

  const costEstimate = {};
  for (const [role, rec] of Object.entries(recommendations)) {
    const c = COST_PER_1M[rec.tier];
    costEstimate[role] = {
      perTurn: {
        input: ((TOKENS_PER_TURN.input / 1_000_000) * c.input).toFixed(4),
        output: ((TOKENS_PER_TURN.output / 1_000_000) * c.output).toFixed(4),
        total: (((TOKENS_PER_TURN.input / 1_000_000) * c.input) + ((TOKENS_PER_TURN.output / 1_000_000) * c.output)).toFixed(4),
      },
    };
  }

  console.log(JSON.stringify({
    tier,
    task: taskDesc,
    recommendations,
    costEstimate,
    blendedCostTarget: tier === 1 ? "1.0x (no overhead)" : tier === 2 ? "1.3–1.8x" : "2.5–4.0x",
  }, null, 2));
}

main();
