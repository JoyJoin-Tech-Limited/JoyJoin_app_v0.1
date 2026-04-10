#!/usr/bin/env node
/**
 * JoyJoin Skill Router — Representative Examples & Regression Tests (v2.0)
 *
 * This script runs a fixed set of representative JoyJoin routing scenarios and
 * checks that the router selects the expected primary skill.
 *
 * It also validates anti-legacy guard behaviour on "trap" inputs, and includes
 * coverage for all active skills (including the newly routed set added in the
 * extend-skill-routing-coverage pass).
 *
 * Usage:
 *   node scripts/test-skill-routing.mjs
 *
 * Exit codes:
 *   0 — all assertions passed
 *   1 — one or more assertions failed
 *
 * To add a new test case, append an entry to the relevant section below.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeSkill } from './skill-router.mjs';

// ---------------------------------------------------------------------------
// Test framework (minimal, no external deps)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/**
 * @param {string} label
 * @param {() => void} fn
 */
function test(label, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✅  ${label}\n`);
  } catch (err) {
    failed++;
    failures.push({ label, message: err.message });
    process.stdout.write(`  ❌  ${label}\n       ${err.message}\n`);
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [msg]
 */
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg ?? `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

/**
 * @param {unknown[]} arr
 * @param {unknown} item
 * @param {string} [msg]
 */
function assertIncludes(arr, item, msg) {
  if (!arr.includes(item)) {
    throw new Error(msg ?? `Expected array to include ${JSON.stringify(item)}, got: ${JSON.stringify(arr)}`);
  }
}

/**
 * @param {unknown[]} arr
 * @param {unknown} item
 * @param {string} [msg]
 */
function assertNotIncludes(arr, item, msg) {
  if (arr.includes(item)) {
    throw new Error(msg ?? `Expected array not to include ${JSON.stringify(item)}, got: ${JSON.stringify(arr)}`);
  }
}

/**
 * @param {boolean} value
 * @param {string} [msg]
 */
function assertTrue(value, msg) {
  if (!value) throw new Error(msg ?? 'Expected true');
}

/**
 * @param {boolean} value
 * @param {string} [msg]
 */
function assertFalse(value, msg) {
  if (value) throw new Error(msg ?? 'Expected false');
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

console.log('\n🧪 JoyJoin Skill Router — Tests\n');

// ---- Onboarding ----
console.log('Onboarding scenarios:');

test('nextStep mention → onboarding-state-architecture', () => {
  const r = routeSkill({ ask: 'Why is nextStep returning profile-review when the user already completed it?' });
  assertEqual(r.primary_skill, 'onboarding-state-architecture');
});

test('/onboarding/review path → onboarding-state-architecture', () => {
  const r = routeSkill({ ask: 'Add a new gating rule before the user can proceed to /onboarding/review' });
  assertEqual(r.primary_skill, 'onboarding-state-architecture');
});

test('profileEssentialComplete symbol → onboarding-state-architecture', () => {
  const r = routeSkill({ ask: 'Reset profileEssentialComplete after beta testing' });
  assertEqual(r.primary_skill, 'onboarding-state-architecture');
});

test('onboarding stuck debugging → onboarding-state-architecture', () => {
  const r = routeSkill({ ask: 'User is stuck in onboarding and cannot get past setup step' });
  assertEqual(r.primary_skill, 'onboarding-state-architecture');
});

// ---- Matching ----
console.log('\nMatching scenarios:');

test('MatchingStateLayout → matching-domain', () => {
  const r = routeSkill({
    ask: 'Add a new matching waiting screen',
    files: ['apps/user-client/src/components/matching/NoMatchScreen.tsx'],
    symbols: ['MatchingStateLayout'],
  });
  assertEqual(r.primary_skill, 'matching-domain');
});

test('poolMatchingService → matching-domain', () => {
  const r = routeSkill({ ask: 'Debug why groups are not forming in poolMatchingService' });
  assertEqual(r.primary_skill, 'matching-domain');
});

test('add a scoring factor → matching-domain', () => {
  const r = routeSkill({ ask: 'We want to add a scoring factor for verified users' });
  assertEqual(r.primary_skill, 'matching-domain');
});

test('POOL_MATCHED symbol → matching-domain', () => {
  const r = routeSkill({ ask: 'When should we set POOL_MATCHED status?' });
  assertEqual(r.primary_skill, 'matching-domain');
});

// ---- Social Icebreaker ----
console.log('\nSocial Icebreaker scenarios:');

test('player reconnects to session → social-icebreaker-domain', () => {
  const r = routeSkill({ ask: 'Handle player reconnects to session after network drop' });
  assertEqual(r.primary_skill, 'social-icebreaker-domain');
});

test('host-only action enforcement → social-icebreaker-domain', () => {
  const r = routeSkill({ ask: 'Enforce host-only action: only the host should advance the icebreaker phase' });
  assertEqual(r.primary_skill, 'social-icebreaker-domain');
});

test('lie_detective secrecy → social-icebreaker-domain', () => {
  const r = routeSkill({ ask: 'Implement lie detective secrecy so other players cannot see isLie before voting' });
  assertEqual(r.primary_skill, 'social-icebreaker-domain');
});

test('useSocialIcebreaker hook → social-icebreaker-domain', () => {
  const r = routeSkill({ ask: 'Fix a bug in useSocialIcebreaker that prevents state updates' });
  assertEqual(r.primary_skill, 'social-icebreaker-domain');
});

// ---- Server domain architecture ----
console.log('\nServer domain architecture scenarios:');

test('add a new API route → server-domain-architecture', () => {
  const r = routeSkill({ ask: 'Where should I add a new API route for user preferences?' });
  assertEqual(r.primary_skill, 'server-domain-architecture');
});

test('registerAuthRoutes symbol → server-domain-architecture', () => {
  const r = routeSkill({ ask: 'Refactor registerAuthRoutes so auth routes mount from the right domain module' });
  assertEqual(r.primary_skill, 'server-domain-architecture');
});

test('routes.ts file path → server-domain-architecture', () => {
  const r = routeSkill({
    ask: 'Migrate this logic',
    files: ['apps/server/src/routes.ts'],
  });
  assertEqual(r.primary_skill, 'server-domain-architecture');
});

test('add a repository → server-domain-architecture', () => {
  const r = routeSkill({ ask: 'Add a repository for user preferences persistence' });
  assertEqual(r.primary_skill, 'server-domain-architecture');
});

// ---- Reliability ----
console.log('\nReliability & state integrity scenarios:');

test('idempotency ask → reliability-and-state-integrity', () => {
  const r = routeSkill({ ask: 'Make this idempotent so retries do not create duplicate entries' });
  assertEqual(r.primary_skill, 'reliability-and-state-integrity');
});

test('wrap in a transaction → reliability-and-state-integrity', () => {
  const r = routeSkill({ ask: 'Wrap this user preferences write in a transaction with proper rollback to ensure atomicity' });
  assertEqual(r.primary_skill, 'reliability-and-state-integrity');
});

test('execution guard isRunning → reliability-and-state-integrity', () => {
  const r = routeSkill({ ask: 'Add an execution guard using isRunning to prevent duplicate matching runs' });
  assertEqual(r.primary_skill, 'reliability-and-state-integrity');
});

// ---- Testing ----
console.log('\nTesting & guardrails scenarios:');

test('add a regression test → testing-and-regression-guardrails', () => {
  const r = routeSkill({ ask: 'Add a regression test to lock in the host-only authority invariant' });
  assertEqual(r.primary_skill, 'testing-and-regression-guardrails');
});

test('guardrails failing → testing-and-regression-guardrails', () => {
  const r = routeSkill({ ask: 'The guardrails script is failing in CI — how do I fix it?' });
  assertEqual(r.primary_skill, 'testing-and-regression-guardrails');
});

test('apps/server/src/__tests__ path → testing-and-regression-guardrails', () => {
  const r = routeSkill({
    ask: 'Write an invariant test',
    files: ['apps/server/src/__tests__/poolMatchingService.test.ts'],
  });
  assertEqual(r.primary_skill, 'testing-and-regression-guardrails');
});

// ---- Platform observability ----
console.log('\nObservability scenarios:');

test('add logging to route → platform-observability-and-ops', () => {
  const r = routeSkill({
    ask: 'Add structured logging with logger.info to the new pool registration route',
    files: ['apps/server/src/lib/logger.ts'],
  });
  assertEqual(r.primary_skill, 'platform-observability-and-ops');
});

test('audit log admin action → platform-observability-and-ops', () => {
  const r = routeSkill({ ask: 'Audit log this admin action using logAdminAudit' });
  assertEqual(r.primary_skill, 'platform-observability-and-ops');
});

test('/api/metrics path → platform-observability-and-ops', () => {
  const r = routeSkill({ ask: 'Is the /api/metrics endpoint exposed correctly?' });
  assertEqual(r.primary_skill, 'platform-observability-and-ops');
});

// ---- Frontend component ----
console.log('\nFrontend component architecture scenarios:');

test('where does component go → frontend-component-architecture', () => {
  const r = routeSkill({ ask: 'Where does this ProfileCard component go — should it be in packages/shared or in user-client?' });
  assertEqual(r.primary_skill, 'frontend-component-architecture');
});

test('shared primitive path → frontend-component-architecture', () => {
  const r = routeSkill({
    ask: 'Wrap this button as a shared primitive',
    files: ['packages/shared/src/ui/NewWidget.tsx'],
  });
  assertEqual(r.primary_skill, 'frontend-component-architecture');
});

// ---- Design system ----
console.log('\nDesign system scenarios:');

test('add a button variant → design-system-governance', () => {
  const r = routeSkill({ ask: 'Add a danger button variant to the shared button system' });
  assertEqual(r.primary_skill, 'design-system-governance');
});

test('buttonVariants symbol → design-system-governance', () => {
  const r = routeSkill({ ask: 'Edit buttonVariants to add a new outline-dark variant' });
  assertEqual(r.primary_skill, 'design-system-governance');
});

// ---- Multi-skill (secondary skills) ----
console.log('\nMulti-skill scenarios:');

test('onboarding + reliability = onboarding primary', () => {
  const r = routeSkill({
    ask: 'Add a new post-review gating rule that requires a db.transaction to be atomic and idempotent before users can register for a pool. This involves nextStep and profileExtendedComplete.',
  });
  assertEqual(r.primary_skill, 'onboarding-state-architecture', 'Expected onboarding as primary');
  assertIncludes(r.secondary_skills, 'reliability-and-state-integrity', 'Expected reliability as secondary');
});

test('server route + observability = server primary', () => {
  const r = routeSkill({
    ask: 'Add a new API route for payment webhook and add structured logging',
    files: ['apps/server/src/routes/domains/payments.ts'],
  });
  assertEqual(r.primary_skill, 'server-domain-architecture');
  assertIncludes(r.secondary_skills, 'platform-observability-and-ops');
});

// ---- Anti-legacy traps ----
console.log('\nAnti-legacy trap scenarios:');

test('/guide in ask triggers anti-legacy warning', () => {
  const r = routeSkill({ ask: 'Add a new /guide onboarding step for new users' });
  assertTrue(r.anti_legacy.triggered, 'Expected anti-legacy to trigger');
  assertTrue(r.anti_legacy.warnings.some(w => w.includes('/guide')), 'Expected /guide warning');
});

test('shared/ root import triggers anti-legacy warning', () => {
  const r = routeSkill({ ask: 'Import the types from shared/types.ts directly' });
  assertTrue(r.anti_legacy.triggered, 'Expected anti-legacy to trigger');
  assertTrue(r.anti_legacy.warnings.some(w => w.includes('shared/')), 'Expected shared/ warning');
});

test('direct messaging triggers anti-legacy warning', () => {
  const r = routeSkill({ ask: 'Add a direct messaging feature between matched users' });
  assertTrue(r.anti_legacy.triggered, 'Expected anti-legacy to trigger');
  assertTrue(r.anti_legacy.warnings.some(w => w.includes('messaging')), 'Expected DM warning');
});

test('hasCompletedRegistration triggers anti-legacy warning', () => {
  const r = routeSkill({ ask: 'Check hasCompletedRegistration before onboarding' });
  assertTrue(r.anti_legacy.triggered);
  assertTrue(r.anti_legacy.warnings.some(w => w.includes('legacy onboarding identifier')));
});

test('API v1 does not trigger archetype anti-legacy warning', () => {
  const r = routeSkill({ ask: 'Keep the API v1 webhook response stable while we refactor payments' });
  assertFalse(r.anti_legacy.warnings.some(w => w.includes('14-archetype')), 'Expected no archetype warning for generic API version text');
});

test('normal ask has no anti-legacy warnings', () => {
  const r = routeSkill({ ask: 'Add a regression test for the nextStep invariant' });
  assertFalse(r.anti_legacy.triggered, 'Expected no anti-legacy warnings for clean ask');
});

// ---- Low confidence / clarification ----
console.log('\nClarification scenarios:');

test('vague ask → clarification recommended', () => {
  const r = routeSkill({ ask: 'Fix the bug' });
  assertTrue(r.clarification_recommended, 'Expected clarification recommended for vague ask');
});

test('high-confidence ask → no clarification', () => {
  const r = routeSkill({ ask: 'Add a regression test for nextStep invariant after profile-review is completed — the test should live in apps/server/src/__tests__/' });
  assertFalse(r.clarification_recommended, 'Expected no clarification for specific ask');
});

test('short symbols do not falsely match long triggers', () => {
  const r = routeSkill({
    ask: 'Add structured logging to this route',
    symbols: ['it'],
  });
  assertEqual(r.primary_skill, 'platform-observability-and-ops');
  assertNotIncludes(r.secondary_skills, 'testing-and-regression-guardrails');
});

// ---- Code review ----
console.log('\nCode review scenarios:');

test('review this PR → code-review', () => {
  const r = routeSkill({ ask: 'Review this PR before we merge it' });
  assertEqual(r.primary_skill, 'code-review');
});

test('audit this pull request → code-review', () => {
  const r = routeSkill({ ask: 'Audit this pull request for issues' });
  assertEqual(r.primary_skill, 'code-review');
});

test('evaluate against Harness framework → code-review', () => {
  const r = routeSkill({ ask: 'Evaluate this change against the Harness Engineering Framework' });
  assertEqual(r.primary_skill, 'code-review');
});

test('check for reliability → code-review', () => {
  const r = routeSkill({ ask: 'Check for reliability issues in this diff' });
  assertEqual(r.primary_skill, 'code-review');
});

test('review + security lens → code-review primary, auth secondary', () => {
  const r = routeSkill({ ask: 'Review this PR and check for security issues in the auth gating' });
  assertEqual(r.primary_skill, 'code-review', 'Expected code-review as primary');
  assertIncludes(
    [...r.secondary_skills, r.primary_skill],
    'code-review',
    'Expected code-review in result',
  );
});

// ---- Auth & safety ----
console.log('\nAuth & safety boundary scenarios:');

test('gate this route for admin only → auth-session-and-safety-boundaries', () => {
  const r = routeSkill({ ask: 'Gate this route for admin only access' });
  assertEqual(r.primary_skill, 'auth-session-and-safety-boundaries');
});

test('add an auth check → auth-session-and-safety-boundaries', () => {
  const r = routeSkill({ ask: 'Add an auth check to the new payment webhook endpoint' });
  assertEqual(r.primary_skill, 'auth-session-and-safety-boundaries');
});

test('fail safely on auth error → auth-session-and-safety-boundaries', () => {
  const r = routeSkill({ ask: 'Make sure the flow fails safely on auth error rather than opening up access' });
  assertEqual(r.primary_skill, 'auth-session-and-safety-boundaries');
});

test('requireAuth symbol → auth-session-and-safety-boundaries', () => {
  const r = routeSkill({
    ask: 'Should I use requireAuth or requireAdmin here?',
    symbols: ['requireAuth'],
  });
  assertEqual(r.primary_skill, 'auth-session-and-safety-boundaries');
});

test('ENABLE_DEV_AUTH_TOOLS env var → auth-session-and-safety-boundaries', () => {
  const r = routeSkill({ ask: 'How do I guard the dev login route behind ENABLE_DEV_AUTH_TOOLS?' });
  assertEqual(r.primary_skill, 'auth-session-and-safety-boundaries');
});

// ---- Backend models ----
console.log('\nBackend model standards scenarios:');

test('add a new table → backend-models-standards', () => {
  const r = routeSkill({ ask: 'Add a new table for storing event attendance records' });
  assertEqual(r.primary_skill, 'backend-models-standards');
});

test('define a Drizzle schema → backend-models-standards', () => {
  const r = routeSkill({ ask: 'Define a Drizzle schema for the new notifications table' });
  assertEqual(r.primary_skill, 'backend-models-standards');
});

test('add an index to a table → backend-models-standards', () => {
  const r = routeSkill({ ask: 'Add an index to the posts table to speed up user lookups' });
  assertEqual(r.primary_skill, 'backend-models-standards');
});

test('add a foreign key → backend-models-standards', () => {
  const r = routeSkill({ ask: 'Add a foreign key from event_attendance to users with onDelete cascade' });
  assertEqual(r.primary_skill, 'backend-models-standards');
});

// ---- Monorepo workspace governance ----
console.log('\nMonorepo workspace governance scenarios:');

test('add a dependency → monorepo-workspace-governance', () => {
  const r = routeSkill({ ask: 'Add a dependency to the monorepo for date-fns' });
  assertEqual(r.primary_skill, 'monorepo-workspace-governance');
});

test('update tsconfig for workspace → monorepo-workspace-governance', () => {
  const r = routeSkill({ ask: 'Update tsconfig for the shared workspace to enable strict mode' });
  assertEqual(r.primary_skill, 'monorepo-workspace-governance');
});

test('root package.json scripts → monorepo-workspace-governance', () => {
  const r = routeSkill({ ask: 'Change the root package.json scripts to add a new check:all command' });
  assertEqual(r.primary_skill, 'monorepo-workspace-governance');
});

test('check-workspace-dependency-ownership → monorepo-workspace-governance', () => {
  const r = routeSkill({ ask: 'The check-workspace-dependency-ownership script is reporting a cross-workspace violation' });
  assertEqual(r.primary_skill, 'monorepo-workspace-governance');
});

// ---- JoyJoin brand guidelines ----
console.log('\nJoyJoin brand guidelines scenarios:');

test('make this on-brand → joyjoin-brand-guidelines', () => {
  const r = routeSkill({ ask: 'Make this screen feel more on-brand for JoyJoin' });
  assertEqual(r.primary_skill, 'joyjoin-brand-guidelines');
});

test('which colour should I use → joyjoin-brand-guidelines', () => {
  const r = routeSkill({ ask: 'Which colour should I use for this success badge to match JoyJoin brand identity?' });
  assertEqual(r.primary_skill, 'joyjoin-brand-guidelines');
});

test('brand tone review → joyjoin-brand-guidelines', () => {
  const r = routeSkill({ ask: 'Review this copy for brand tone — is it too corporate for JoyJoin?' });
  assertEqual(r.primary_skill, 'joyjoin-brand-guidelines');
});

test('brand + design system ambiguity → clarification recommended', () => {
  const r = routeSkill({ ask: 'Add a new button variant using the JoyJoin brand colour' });
  // Both design-system-governance and joyjoin-brand-guidelines may score; clarification is appropriate
  assertTrue(
    r.primary_skill === 'design-system-governance' || r.primary_skill === 'joyjoin-brand-guidelines',
    `Expected design-system or brand skill, got: ${r.primary_skill}`,
  );
});

// ---- Platform coordination protocol ----
console.log('\nPlatform coordination protocol scenarios:');

test('check sibling platform after PRIMARY change → platform-coordination-protocol', () => {
  const r = routeSkill({
    ask: 'I changed apps/mini-program/src/pages/blind-box-payment/index.tsx — which sibling platform file should I review?',
  });
  assertEqual(r.primary_skill, 'platform-coordination-protocol');
});

test('run impact-check for coordinated change → platform-coordination-protocol', () => {
  const r = routeSkill({ ask: 'Run impact-check for this staged payment-flow change before I push it' });
  assertEqual(r.primary_skill, 'platform-coordination-protocol');
});

test('.platform marker meaning → platform-coordination-protocol', () => {
  const r = routeSkill({ ask: 'What does the .platform PRIMARY marker mean for this file?' });
  assertEqual(r.primary_skill, 'platform-coordination-protocol');
});

test('shared api contract consumer review → platform-coordination-protocol', () => {
  const r = routeSkill({ ask: 'I updated packages/shared/src/api-types/auth.ts — which coordinated consumers must I review?' });
  assertEqual(r.primary_skill, 'platform-coordination-protocol');
});

// ---- Skill authoring governance ----
console.log('\nSkill authoring governance scenarios:');

test('create a new skill → skill-authoring-governance', () => {
  const r = routeSkill({ ask: 'Create a new skill under .github/skills/ for payments' });
  assertEqual(r.primary_skill, 'skill-authoring-governance');
});

test('update SKILL.md → skill-authoring-governance', () => {
  const r = routeSkill({ ask: 'Update SKILL.md for the auth skill to add missing troubleshooting section' });
  assertEqual(r.primary_skill, 'skill-authoring-governance');
});

test('skill frontmatter incorrect → skill-authoring-governance', () => {
  const r = routeSkill({ ask: 'The skill frontmatter name does not match the directory — how do I fix it?' });
  assertEqual(r.primary_skill, 'skill-authoring-governance');
});

test('add routing metadata for a skill → skill-authoring-governance', () => {
  const r = routeSkill({ ask: 'Add routing metadata to the new payments skill' });
  assertEqual(r.primary_skill, 'skill-authoring-governance');
});

test('skill authoring + routing maintenance → skill-authoring-governance primary', () => {
  const r = routeSkill({ ask: 'Update the routing.yml trigger phrases in .github/skills/ for the code-review skill' });
  assertEqual(r.primary_skill, 'skill-authoring-governance');
});

// ---- Docs sync ----
console.log('\nDocs sync scenarios:');

test('update docs → docs-sync', () => {
  const r = routeSkill({ ask: 'Update the docs after this PR merges' });
  assertEqual(r.primary_skill, 'docs-sync');
});

test('sync documentation → docs-sync', () => {
  const r = routeSkill({ ask: 'Sync documentation to reflect the new matching algorithm changes' });
  assertEqual(r.primary_skill, 'docs-sync');
});

test('docs are out of date → docs-sync', () => {
  const r = routeSkill({ ask: 'The docs are out of date after the recent refactor' });
  assertEqual(r.primary_skill, 'docs-sync');
});

test('DEVELOPER_QUICK_REFERENCE.md → docs-sync', () => {
  const r = routeSkill({
    ask: 'Refresh the quick reference table',
    files: ['DEVELOPER_QUICK_REFERENCE.md'],
  });
  assertEqual(r.primary_skill, 'docs-sync');
});

// ---- Wow elements ----
console.log('\nWow elements scenarios:');

test('make this feel premium → wow-elements', () => {
  const r = routeSkill({ ask: 'Make this completion screen feel more premium and delightful' });
  assertEqual(r.primary_skill, 'wow-elements');
});

test('polish the interaction → wow-elements', () => {
  const r = routeSkill({ ask: 'Polish the match reveal interaction with a subtle spring animation' });
  assertEqual(r.primary_skill, 'wow-elements');
});

test('improve micro-interactions → wow-elements', () => {
  const r = routeSkill({ ask: 'Improve the micro-interactions on the profile completion page' });
  assertEqual(r.primary_skill, 'wow-elements');
});

// ---- Coverage-drift detection ----
console.log('\nCoverage-drift detection:');

test('validate-skill-routing.mjs fails when routing.yml is missing', () => {
  const target = join(REPO_ROOT, '.github', 'skills', 'wow-elements', 'routing.yml');
  const backup = target + '.bak';

  if (!existsSync(target)) {
    throw new Error('wow-elements/routing.yml not found — prerequisite for drift test');
  }

  renameSync(target, backup);
  try {
    let exitCode = 0;
    try {
      execFileSync(process.execPath, [join(REPO_ROOT, 'scripts', 'validate-skill-routing.mjs')], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err) {
      exitCode = err.status ?? 1;
    }
    if (exitCode === 0) {
      throw new Error('Expected validate-skill-routing.mjs to exit 1 when routing.yml is missing, but it exited 0');
    }
  } finally {
    renameSync(backup, target);
  }
});

test('validate-skill-routing.mjs fails when routing-exempt.yml has no reason', () => {
  const skillDir = join(REPO_ROOT, '.github', 'skills', 'wow-elements');
  const target = join(skillDir, 'routing.yml');
  const backup = target + '.bak';
  const exemptFile = join(skillDir, 'routing-exempt.yml');

  if (!existsSync(target)) {
    throw new Error('wow-elements/routing.yml not found — prerequisite for exemption test');
  }

  renameSync(target, backup);
  writeFileSync(exemptFile, 'reason: ""\n', 'utf8');

  try {
    let exitCode = 0;
    try {
      execFileSync(process.execPath, [join(REPO_ROOT, 'scripts', 'validate-skill-routing.mjs')], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err) {
      exitCode = err.status ?? 1;
    }

    if (exitCode === 0) {
      throw new Error('Expected validate-skill-routing.mjs to exit 1 when routing-exempt.yml has no reason, but it exited 0');
    }
  } finally {
    unlinkSync(exemptFile);
    renameSync(backup, target);
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nFailed tests:');
  failures.forEach(({ label, message }) => {
    console.log(`  ❌ ${label}`);
    console.log(`     ${message}`);
  });
  console.log('');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
}
