#!/usr/bin/env node
/**
 * JoyJoin Skill Router — Representative Examples & Regression Tests (v1.0)
 *
 * This script runs a fixed set of representative JoyJoin routing scenarios and
 * checks that the router selects the expected primary skill.
 *
 * It also validates anti-legacy guard behaviour on "trap" inputs.
 *
 * Usage:
 *   node scripts/test-skill-routing.mjs
 *
 * Exit codes:
 *   0 — all assertions passed
 *   1 — one or more assertions failed
 *
 * To add a new test case, append an entry to CASES below.
 */

import { routeSkill } from './skill-router.mjs';

// ---------------------------------------------------------------------------
// Test framework (minimal, no external deps)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

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
    throw new Error(msg ?? `Expected array NOT to include ${JSON.stringify(item)}`);
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
  const r = routeSkill({ ask: 'Add structured logging to the new pool registration route' });
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
