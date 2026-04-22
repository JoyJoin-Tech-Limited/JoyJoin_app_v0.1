#!/usr/bin/env node
/**
 * Patterns that are NEVER HRC-eligible even if they match a pattern below.
 */
const EXCLUDED_PREFIXES = [
  /^\.github\/skills\//,
  /^\.github\/agents\//,
  /^docs\//,
  /^scripts\//,
  /README\.md$/,
  /routing\.yml$/,
];

/**
 * Harness Lane Requirement Validator
 *
 * Checks whether files in the current changeset touch HRC-eligible surfaces
 * without a corresponding Harness transcript in `.git/.orchestration/harness/`.
 *
 * This is an *advisory* check — it produces warnings, not blocking errors.
 * It is intended for CI or pre-push hooks to catch lane drift.
 *
 * Usage:
 *   node scripts/validate-harness-lane-requirement.mjs
 *
 * Exit codes:
 *   0 — no HRC-eligible files changed, or Harness transcript present
 *   1 — HRC-eligible files changed without Harness transcript (advisory warning)
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const HARNESS_DIR = join(REPO_ROOT, '.git', '.orchestration', 'harness');

/**
 * File patterns that should trigger HRC deliberation.
 * These map to Gate 1 of the lane-selection-governance skill.
 */
const HRC_ELIGIBLE_PATTERNS = [
  // Auth / session / trust boundaries
  /routes\/domains\/auth/,
  /routes\/domains\/admin/,
  /adminAuth/,
  /phoneAuth/,
  /wechatAuth/,
  /requestAuth/,
  /session.*store|connect-pg-simple/,

  // Payments / entitlements
  /routes\/domains\/payments/,
  /paymentsRepo/,
  /wechatPay/,
  /eventCreditsRepo/,

  // Matching engine / personality authority
  /poolMatchingService/,
  /matching-domain/,
  /MatcherV2/,
  /assessmentV4/,
  /personality-system/,
  /archetype assignment/,

  // State machines with partial-failure risk
  /routes\/socialIcebreaker/,
  /socialIcebreakerStore/,
  /socialIcebreakerSweep/,
  /icebreakerAccess/,
  /onboarding.*state|onboarding-state/,
  /registration.*session/,

  // DB migrations + schema changes with backfill risk
  /migrations\//,
  /schema\.ts.*backfill|backfill.*schema/,

  // Real-time infrastructure
  /wsService/,
  /websocket-realtime/,
  /WebSocket.*broadcast|broadcast.*WebSocket/,
];

/**
 * Get the list of changed files against HEAD.
 */
function getChangedFiles() {
  try {
    const stdout = execSync('git diff --name-only HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return stdout
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if any file in the list matches an HRC-eligible pattern.
 */
function findHRCEligibleFiles(files) {
  return files.filter((file) => {
    if (EXCLUDED_PREFIXES.some((p) => p.test(file))) return false;
    return HRC_ELIGIBLE_PATTERNS.some((pattern) => pattern.test(file));
  });
}

/**
 * Check if a Harness transcript exists for a recent session.
 * We look for any `.json` file in the harness directory.
 */
function hasRecentHarnessTranscript() {
  if (!existsSync(HARNESS_DIR)) return false;
  try {
    const entries = readdirSync(HARNESS_DIR);
    return entries.some((e) => e.endsWith('.json'));
  } catch {
    return false;
  }
}

function main() {
  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) {
    console.log('[validate-harness-lane] No changed files detected. Skipping.');
    process.exit(0);
  }

  const hrcFiles = findHRCEligibleFiles(changedFiles);
  if (hrcFiles.length === 0) {
    console.log('[validate-harness-lane] No HRC-eligible files changed. OK.');
    process.exit(0);
  }

  const hasHarness = hasRecentHarnessTranscript();

  console.log('[validate-harness-lane] ⚠️  Advisory warning');
  console.log(
    `[validate-harness-lane] The following ${hrcFiles.length} file(s) touch HRC-eligible surfaces:`,
  );
  for (const f of hrcFiles) {
    console.log(`  - ${f}`);
  }

  if (hasHarness) {
    console.log(
      '[validate-harness-lane] Harness transcript found in .git/.orchestration/harness/. OK.',
    );
    process.exit(0);
  }

  console.log(
    '[validate-harness-lane] No Harness transcript found in .git/.orchestration/harness/.',
  );
  console.log(
    '[validate-harness-lane] If this change required HRC deliberation, run the Harness Runtime Controller before merging.',
  );
  console.log(
    '[validate-harness-lane] If HRC is not required, document the exception in the PR description.',
  );
  console.log(
    '[validate-harness-lane] Reference: .github/skills/lane-selection-governance/SKILL.md',
  );

  // Advisory only — do not block CI. Return 0 so it can be promoted to blocking later.
  process.exit(0);
}

main();
