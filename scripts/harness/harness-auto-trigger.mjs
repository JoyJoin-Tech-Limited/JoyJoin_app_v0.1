#!/usr/bin/env node
/**
 * harness-auto-trigger.mjs — Session-level auto-detection for harness tier
 *
 * Reads user prompt + proposed file changes and auto-injects harness metadata
 * into the conversation without requiring manual script execution.
 *
 * Usage (by agent / orchestration hook):
 *   node scripts/harness/harness-auto-trigger.mjs \
 *     --prompt="add a new API route for refunds" \
 *     --proposed-files=apps/server/src/routes/domains/refunds.ts
 *
 * Output: JSON with tier, contractRequired, triggerWords, recommendedNextStep
 */

import { execSync } from "child_process";

// ── Trigger word taxonomy ───────────────────────────────────────────

const TIER_3_TRIGGERS = [
  // Core engine
  /\bmatching\s+(engine|algorithm|score|v2|v3)\b/i,
  /\bpersonality\s+(system|assessment|test|scoring)\b/i,
  /\barchetype\s+(chemistry|assignment|matcher)\b/i,
  /\bcore\s+engine\b/i,
  // Auth
  /\bauth\s+(rewrite|refactor|overhaul|migration)\b/i,
  /\bsession\s+(middleware|store|rotation)\b/i,
  /\btoken\s+(rotation|refresh|validation)\b/i,
  // Payment
  /\bpayment\s+(flow|v3|v4|migration|rewrite)\b/i,
  /\bwechat\s+pay\b/i,
  /\brefund\s+(flow|logic|engine)\b/i,
  /\bevent\s+pack\s+(credit|entitlement)\b/i,
  // Major refactor
  /\bmajor\s+refactor\b/i,
  /\bre(structur|architect)\b/i,
  /\bmicroservice\b/i,
  /\bsharding\b/i,
];

const TIER_2_TRIGGERS = [
  // New things
  /\b(add|create|implement|build)\s+(a\s+)?new\s+(route|endpoint|api|page|component|screen|feature)\b/i,
  /\bnew\s+(route|endpoint|api|page|component|migration|schema)\b/i,
  // Changes
  /\bschema\s+(change|update|migration)\b/i,
  /\bmigration\b/i,
  /\bui\s+flow\b/i,
  /\bstate\s+machine\b/i,
  /\bwebsocket\b/i,
  /\bcross[-\s]?workspace\b/i,
  /\bapi\s+contract\b/i,
  /\b(admin|finance|payment)\s+(dashboard|page|report)\b/i,
  // File patterns (checked separately)
];

const TIER_1_INDICATORS = [
  /\bfix\s+(a\s+)?(typo|spelling|copy|text|label)\b/i,
  /\bupdate\s+(copy|text|label|color|spacing|font)\b/i,
  /\badjust\s+(padding|margin|spacing|color)\b/i,
  /\bremove\s+(console\.log|debug|unused)\b/i,
  /\brename\s+(a\s+)?(variable|function)\b/i,
  /\bone[-\s]?line?\s+fix\b/i,
  /\bquick\s+fix\b/i,
  /\bsmall\s+(change|tweak|adjustment)\b/i,
];

// ── File pattern auto-detection ─────────────────────────────────────

const TIER_3_FILES = [
  /packages\/shared\/src\/personality\//,
  /packages\/shared\/src\/poolMatchingService/,
  /apps\/server\/src\/poolMatchingService/,
  /apps\/server\/src\/personalityMatchingV2/,
  /apps\/server\/src\/archetypeChemistry/,
  /apps\/server\/src\/wechatAuth/,
  /apps\/server\/src\/routes\/domains\/(auth|demo)\.ts/,
  /apps\/server\/src\/middleware\//,
  /apps\/server\/src\/routes\/domains\/(payments|blindBoxEvents)\.ts/,
  /apps\/server\/src\/payment-entitlement\//,
  /packages\/shared\/src\/schema\.ts/,
];

const TIER_2_FILES = [
  /apps\/server\/src\/routes\//,
  /apps\/server\/migrations\//,
  /packages\/shared\/src\//,
  /apps\/server\/src\/ai\//,
  /apps\/server\/src\/.*[Ii]cebreaker/,
  /apps\/server\/src\/socialIcebreaker/,
  /apps\/mini-program\/src\/pages\//,
  /apps\/admin-client\/src\/pages\//,
  /apps\/admin-client\/src\/components\//,
];

// ── Main detection ──────────────────────────────────────────────────

function detectTier(prompt, proposedFiles = []) {
  const lower = prompt.toLowerCase();

  // Check Tier 1 indicators first (strong signal for small stuff)
  const tier1Match = TIER_1_INDICATORS.some((re) => re.test(prompt));
  if (tier1Match && proposedFiles.length <= 2) {
    return { tier: 1, reason: "Small fix / tweak indicated by trigger words", triggers: ["small-change-indicator"], contractRequired: false };
  }

  // Check Tier 3 triggers
  const tier3WordMatch = TIER_3_TRIGGERS.find((re) => re.test(prompt));
  const tier3FileMatch = proposedFiles.some((f) => TIER_3_FILES.some((re) => re.test(f)));

  if (tier3WordMatch || tier3FileMatch) {
    return {
      tier: 3,
      reason: "Core engine, payment, auth, or major refactor detected",
      triggers: tier3WordMatch ? ["keyword:" + tier3WordMatch.source.slice(0, 40)] : ["core-file-match"],
      contractRequired: true,
    };
  }

  // Check Tier 2 triggers
  const tier2WordMatch = TIER_2_TRIGGERS.find((re) => re.test(prompt));
  const tier2FileMatch = proposedFiles.some((f) => TIER_2_FILES.some((re) => re.test(f)));

  if (tier2WordMatch || tier2FileMatch) {
    return {
      tier: 2,
      reason: "New route, multi-file, UI flow, migration, or stateful operation detected",
      triggers: tier2WordMatch ? ["keyword:" + tier2WordMatch.source.slice(0, 40)] : ["file-pattern-match"],
      contractRequired: true,
    };
  }

  // Default: Tier 1
  return {
    tier: 1,
    reason: "No Tier 2/3 triggers detected — defaulting to Tier 1",
    triggers: [],
    contractRequired: false,
  };
}

function extractTriggerWords(prompt) {
  const words = [];

  const allPatterns = [
    ...TIER_3_TRIGGERS.map((re) => ({ re, tier: 3 })),
    ...TIER_2_TRIGGERS.map((re) => ({ re, tier: 2 })),
    ...TIER_1_INDICATORS.map((re) => ({ re, tier: 1 })),
  ];

  for (const { re, tier } of allPatterns) {
    const match = prompt.match(re);
    if (match) {
      words.push({ word: match[0], tier });
    }
  }

  return words;
}

function main() {
  const args = process.argv.slice(2);
  let prompt = "";
  let proposedFiles = [];

  for (const arg of args) {
    if (arg.startsWith("--prompt=")) prompt = arg.slice("--prompt=".length);
    if (arg.startsWith("--proposed-files=")) {
      proposedFiles = arg.slice("--proposed-files=".length).split(",").map((f) => f.trim()).filter(Boolean);
    }
  }

  if (!prompt) {
    // If no prompt, read from stdin
    try {
      prompt = require("fs").readFileSync(0, "utf-8").trim();
    } catch {
      console.error("Usage: node scripts/harness/harness-auto-trigger.mjs --prompt=\"<user prompt>\" [--proposed-files=a.ts,b.ts]");
      process.exit(1);
    }
  }

  const result = detectTier(prompt, proposedFiles);
  const triggerWords = extractTriggerWords(prompt);

  const output = {
    ...result,
    triggerWords: triggerWords.map((t) => t.word),
    triggerDetails: triggerWords,
    proposedFiles,
    recommendedNextStep: result.tier === 1
      ? "Direct delivery — proceed with implementation, run harness:gate after"
      : result.tier === 2
        ? "Sprint Contract required — run generate-sprint-contract.mjs or hand off to Verifier"
        : "Full Harness Lane — schedule HRC deliberation before implementation",
    action: result.contractRequired ? "PAUSE_FOR_CONTRACT" : "PROCEED",
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(result.tier === 1 ? 0 : result.tier === 2 ? 1 : 2);
}

main();
