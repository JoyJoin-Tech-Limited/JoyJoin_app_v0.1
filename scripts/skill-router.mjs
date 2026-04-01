#!/usr/bin/env node
/**
 * JoyJoin Skill Router — lightweight rule-based router (v1.0)
 *
 * Accepts an ask/task plus optional context (file paths, symbols) and returns:
 *   - primary skill
 *   - optional secondary skills
 *   - matched signals / reasons
 *   - confidence band (high | medium | low)
 *   - whether clarification is recommended
 *
 * Design principles:
 *   - Simple and explainable: every decision has a named reason
 *   - Observable: structured routing log emitted for every call
 *   - Anti-legacy guard: cross-cutting check before finalising result
 *   - No external dependencies: pure Node.js ESM
 *
 * Usage (programmatic):
 *   import { routeSkill } from './skill-router.mjs';
 *   const result = routeSkill({ ask: 'add a nextStep rule' });
 *   console.log(result);
 *
 * Usage (CLI):
 *   node scripts/skill-router.mjs "add a nextStep rule"
 *   node scripts/skill-router.mjs "add logging to /api/pool/register" --files "apps/server/src/routes/domains/pool.ts"
 */

// ---------------------------------------------------------------------------
// Skill definitions with routing signals
// ---------------------------------------------------------------------------

/** @typedef {{ skill: string, when: string }} RelatedSkill */
/** @typedef {{ skill: string, primary_ownership: string, use_when: string[], do_not_use_when: string[], strong_triggers: string[], owned_files: string[], owned_paths: string[], owned_symbols: string[], related_skills: RelatedSkill[] }} SkillDef */

/** @type {SkillDef[]} */
export const SKILL_DEFINITIONS = [
  {
    skill: 'frontend-component-architecture',
    primary_ownership:
      'UI component placement across packages/shared/src/ui/ and thin app-local wrappers in apps/*/src/components/ui/.',
    use_when: [
      'user asks where a ui component should live',
      'creating moving or reviewing a shared or app-local ui component',
      'deciding whether a component should be in packages/shared or an app workspace',
      'adding composition patterns loading states or semantic html structure',
      'wrapping a shared primitive in an app-local component',
    ],
    do_not_use_when: [
      'task is purely about css tokens or color variables',
      'task is about backend api placement',
      'task is about onboarding step routing',
    ],
    strong_triggers: [
      'packages/shared/src/ui',
      'apps/user-client/src/components',
      'apps/admin-client/src/components',
      'where does this component go',
      'should this be shared',
      'shared primitive',
      'wrap the shared button',
      'is this semantically correct',
      'add a loading state',
      'asChild',
      'composition pattern',
    ],
    owned_files: ['packages/shared/src/ui/', 'apps/user-client/src/components/', 'apps/admin-client/src/components/'],
    owned_paths: [],
    owned_symbols: ['Button', 'buttonVariants', 'asChild', 'SharedCard', 'Avatar'],
    related_skills: [
      { skill: 'design-system-governance', when: 'component uses tokens or has accessibility requirements' },
      { skill: 'testing-and-regression-guardrails', when: 'changing shared component invariants' },
    ],
  },
  {
    skill: 'design-system-governance',
    primary_ownership:
      'CSS design tokens, CVA button variants, accessibility standards, documented visual exceptions.',
    use_when: [
      'adding or changing a button variant',
      'introducing a new colour or token',
      'migrating a raw element to the shared button',
      'documenting a visual exception',
      'checking component usage for token compliance',
      'adding or reviewing css custom properties',
    ],
    do_not_use_when: [
      'task is about component placement',
      'task is about brand narrative or logo usage',
      'task is about backend logic',
    ],
    strong_triggers: [
      'buttonVariants',
      'CVA',
      '--btn-primary-gradient',
      '--btn-shadow-primary',
      '--ring',
      '--background',
      '--foreground',
      'tailwind.config',
      'index.css',
      'token',
      '44px touch target',
      'wcag',
      'visual exception',
      'add a button variant',
      'button variant',
      'use a new colour',
      'check this for token usage',
    ],
    owned_files: [
      'packages/shared/src/ui/buttonVariants.ts',
      'apps/user-client/src/index.css',
      'apps/admin-client/src/index.css',
      'docs/button-design.md',
    ],
    owned_paths: [],
    owned_symbols: ['buttonVariants', 'cva', 'VariantProps', 'cn'],
    related_skills: [
      { skill: 'frontend-component-architecture', when: 'token change affects shared UI primitive placement' },
      { skill: 'joyjoin-brand-guidelines', when: 'introducing a new colour that must align with brand identity' },
    ],
  },
  {
    skill: 'onboarding-state-architecture',
    primary_ownership:
      'Server-driven nextStep model, active onboarding routing authority, profile completion gating, and legacy onboarding quarantine.',
    use_when: [
      'user asks about onboarding flow nextstep or setup/extended/review routing',
      'user changes auth-driven navigation or profile completion gating',
      'user adds or changes an onboarding completion flag',
      'user is debugging why a user is stuck in onboarding',
      'user changes authenticatedrouter or onboarding step progression',
    ],
    do_not_use_when: [
      'task is about admin login permissions only',
      'task is purely about generic ui styling',
      'task is about matching or icebreaker state',
    ],
    strong_triggers: [
      'nextStep',
      '/onboarding/setup',
      '/onboarding/extended',
      '/onboarding/review',
      'profileEssentialComplete',
      'profileExtendedComplete',
      'hasSeenProfileReview',
      'useAuth',
      'useOnboardingOrchestrator',
      'AuthenticatedRouter',
      'essential-data',
      'extended-data',
      'profile-review',
      'personality-test',
      'onboarding step',
      'user is stuck in onboarding',
      'add a new onboarding step',
      'why is nextstep wrong',
      'onboarding routing loop',
      'modify completion flags',
    ],
    owned_files: [
      'apps/user-client/src/features/onboarding/',
      'apps/user-client/src/hooks/useAuth.ts',
      'apps/user-client/src/hooks/useOnboardingRoute.ts',
      'apps/user-client/src/hooks/useOnboardingProgress.ts',
      'apps/user-client/src/App.tsx',
      'apps/server/src/routes/domains/auth.ts',
    ],
    owned_paths: ['/onboarding/setup', '/onboarding/extended', '/onboarding/review', '/personality-test'],
    owned_symbols: [
      'nextStep',
      'useOnboardingOrchestrator',
      'AuthenticatedRouter',
      'profileEssentialComplete',
      'profileExtendedComplete',
      'hasSeenProfileReview',
    ],
    related_skills: [
      { skill: 'reliability-and-state-integrity', when: 'onboarding change involves retries or re-entry guards' },
      { skill: 'testing-and-regression-guardrails', when: 'adding regression tests for onboarding step invariants' },
      { skill: 'auth-session-and-safety-boundaries', when: 'onboarding gating involves auth session validation' },
    ],
  },
  {
    skill: 'server-domain-architecture',
    primary_ownership:
      'routes.ts as composition root, routes/domains/* for domain handlers, repositories/* for persistence, storage.ts as legacy facade.',
    use_when: [
      'adding a new api route or express handler',
      'deciding where a new server service or helper belongs',
      'migrating logic from storage.ts to a domain or repository layer',
      'adding a new repository file for persistence',
      'routes.ts is getting too large',
    ],
    do_not_use_when: [
      'task is purely about onboarding state transitions',
      'task is about auth session gating rules only',
      'task is about transaction patterns only',
    ],
    strong_triggers: [
      'routes.ts',
      'routes/domains',
      'repositories',
      'storage.ts',
      'Express route',
      'API handler',
      'add a new api route',
      'where does this service go',
      'migrate logic from storage.ts',
      'add a repository',
      'routes.ts is getting too large',
      'domain router',
    ],
    owned_files: [
      'apps/server/src/routes.ts',
      'apps/server/src/routes/domains/',
      'apps/server/src/repositories/',
      'apps/server/src/storage.ts',
      'apps/server/src/lib/',
      'apps/server/src/middleware/',
    ],
    owned_paths: ['/api/'],
    owned_symbols: [
      'db.transaction',
      'registerRoutes',
      'storage',
      'createAuthDomainRouter',
      'createOnboardingDomainRouter',
      'createAdminDomainRouter',
      'createIcebreakerDomainRouter',
    ],
    related_skills: [
      { skill: 'reliability-and-state-integrity', when: 'route handler involves multi-step writes or idempotency' },
      { skill: 'auth-session-and-safety-boundaries', when: 'route requires auth gating or role checks' },
      { skill: 'platform-observability-and-ops', when: 'adding logging or metrics to a new route' },
    ],
  },
  {
    skill: 'reliability-and-state-integrity',
    primary_ownership:
      'Transactions, idempotency guards, execution guards, recovery/re-entry semantics, expiry handling, and critical writes vs side effects.',
    use_when: [
      'implementing a multi-step write that must be atomic',
      'adding retry or idempotency logic',
      'handling re-entry or duplicate execution',
      'managing expiry or timeout for stateful operations',
      'separating critical writes from side effects',
      'pool matching execution or payment processing',
    ],
    do_not_use_when: [
      'task is purely about route placement',
      'task is purely about ui state management',
      'task is about test writing only',
    ],
    strong_triggers: [
      'db.transaction',
      'idempotent',
      'idempotency',
      'retry',
      're-entry',
      'execution guard',
      'isRunning',
      'lockedAt',
      'check-then-insert',
      'UNIQUE constraint',
      'expiry',
      'make this idempotent',
      'wrap in a transaction',
      'handle retry safely',
      'side effect after commit',
      'atomic',
    ],
    owned_files: [
      'apps/server/src/poolMatchingService.ts',
      'apps/server/src/poolRealtimeMatchingService.ts',
    ],
    owned_paths: [],
    owned_symbols: ['db.transaction', 'isRunning', 'lockedAt', 'poolMatchingService', 'poolRealtimeMatchingService'],
    related_skills: [
      { skill: 'server-domain-architecture', when: 'determining where reliable logic should live in domain structure' },
      { skill: 'testing-and-regression-guardrails', when: 'adding invariant tests for transaction boundaries' },
    ],
  },
  {
    skill: 'testing-and-regression-guardrails',
    primary_ownership: 'Regression tests, invariant tests, structural tests, CI guardrail scripts, and test placement by workspace.',
    use_when: [
      'adding a regression test for a recently changed feature',
      'locking in an architectural boundary with an invariant test',
      'guardrails script is failing in ci',
      'deciding which workspace a test belongs in',
      'writing structural tests',
    ],
    do_not_use_when: [
      'task is purely about implementing the feature',
      'task is about ci pipeline configuration unrelated to test files',
    ],
    strong_triggers: [
      'regression test',
      'invariant test',
      'invariant',
      'guardrails',
      'check-guardrails',
      'structural test',
      'ci check',
      'add a regression test',
      'lock in this boundary',
      'write an invariant test',
      'which workspace does this test belong in',
      'vitest',
      'apps/server/src/__tests__',
      'apps/user-client/src/features/onboarding/active/__tests__',
    ],
    owned_files: [
      'apps/server/src/__tests__/',
      'apps/user-client/src/features/onboarding/active/__tests__/',
      'apps/user-client/src/hooks/__tests__/',
      'scripts/check-guardrails.mjs',
    ],
    owned_paths: [],
    owned_symbols: ['it', 'describe', 'expect', 'vi.mock', 'beforeEach'],
    related_skills: [
      { skill: 'server-domain-architecture', when: 'test covers route placement or domain ownership boundaries' },
      { skill: 'onboarding-state-architecture', when: 'test covers nextStep invariants' },
      { skill: 'matching-domain', when: 'test covers scoring signal boundaries' },
    ],
  },
  {
    skill: 'platform-observability-and-ops',
    primary_ownership:
      'Structured logging, request IDs, Prometheus metrics, health/readiness endpoints, alert rules, and audit logging.',
    use_when: [
      'adding structured logging to a new server route or service',
      'instrumenting a prometheus metric or counter',
      'adding or reviewing a health or readiness endpoint',
      'writing an audit log for an admin or sensitive action',
      'adding alerting rules or slo monitoring',
      'reviewing observability readiness of new backend code',
    ],
    do_not_use_when: [
      'task is purely about route structure',
      'task is about frontend error handling',
      'task is about test writing only',
    ],
    strong_triggers: [
      'logger',
      'logger.info',
      'logger.error',
      'logger.child',
      'request_id',
      'req.requestId',
      'logAdminAudit',
      'logAITrace',
      'Prometheus',
      'metrics',
      '/api/health',
      '/api/readyz',
      '/api/metrics',
      'audit log',
      'structured logging',
      'add logging to this route',
      'instrument a metric',
      'health vs readiness check',
      'audit log an admin action',
      'requestId middleware',
    ],
    owned_files: [
      'apps/server/src/lib/logger.ts',
      'apps/server/src/middleware/requestId.ts',
      'apps/server/src/middleware/metrics.ts',
      'apps/server/src/lib/adminAuditLogger.ts',
      'apps/server/src/lib/aiTraceLogger.ts',
      'docs/observability.md',
    ],
    owned_paths: ['/api/health', '/api/readyz', '/api/metrics'],
    owned_symbols: ['logger', 'logAdminAudit', 'logAITrace', 'requestId', 'metricsMiddleware'],
    related_skills: [
      { skill: 'server-domain-architecture', when: 'new route needs both structural placement and observability' },
      { skill: 'testing-and-regression-guardrails', when: 'adding synthetic monitoring or health-check tests' },
    ],
  },
  {
    skill: 'matching-domain',
    primary_ownership:
      'Deterministic pair scoring across 6 weighted dimensions, signal boundary invariant, and separation of scoring from AI explanation.',
    use_when: [
      'modifying pool matching scoring dimensions or weights',
      'debugging why groups or pairs are not forming',
      'adding or changing a match explanation feature',
      'working on chemistry score interest score or group overall score',
      'working on pool registration or pool matching execution',
    ],
    do_not_use_when: [
      'task is purely about onboarding completion',
      'task is about icebreaker sessions',
      'task is purely about ui layout not tied to matching results',
    ],
    strong_triggers: [
      'poolMatchingService',
      'archetypeChemistry',
      'matchExplanationService',
      'matchingThresholds',
      'POOL_MATCHED',
      'pairScore',
      'groupOverallScore',
      'chemistry score',
      'interest score',
      'social affinity',
      'background diversity',
      'preference score',
      'language score',
      'add a scoring factor',
      'modify match weights',
      'why are groups not forming',
      'debug low match scores',
      'add match explanation',
      'MatchingStateLayout',
      'pool registration',
    ],
    owned_files: [
      'apps/server/src/poolMatchingService.ts',
      'apps/server/src/poolRealtimeMatchingService.ts',
      'apps/user-client/src/components/matching/',
      'docs/MATCHING_ALGORITHM_REFERENCE.md',
    ],
    owned_paths: ['/api/pool/', '/api/matching/'],
    owned_symbols: [
      'poolMatchingService',
      'archetypeChemistry',
      'matchExplanationService',
      'calculatePairScore',
      'groupOverallScore',
      'MatchingStateLayout',
      'POOL_MATCHED',
    ],
    related_skills: [
      { skill: 'reliability-and-state-integrity', when: 'matching execution involves idempotency or transaction guards' },
      { skill: 'testing-and-regression-guardrails', when: 'adding signal boundary invariant tests or scoring regression tests' },
    ],
  },
  {
    skill: 'social-icebreaker-domain',
    primary_ownership:
      'Session lifecycle phases, host/player authority boundaries, persistence/rejoin semantics, and lie-detective secrecy.',
    use_when: [
      'working on icebreaker session phase transitions',
      'enforcing host-only or player-only actions',
      'handling player reconnects or session rejoin',
      'implementing lie-detective secrecy boundaries',
      'adding or changing icebreaker ai content generation',
      'debugging icebreaker session state',
    ],
    do_not_use_when: [
      'task is about pool matching',
      'task is about onboarding gating',
      'task is purely about generic ui layout not tied to icebreaker state',
    ],
    strong_triggers: [
      'socialIcebreaker',
      'useSocialIcebreaker',
      '/icebreaker/:sessionId',
      'warmup',
      'micro_challenge',
      'lie_detective',
      'recap',
      'host authority',
      'player advance',
      'session rejoin',
      'roster',
      'active presence',
      'isLie',
      'lie detective secrecy',
      'player reconnects to session',
      'enforce host-only action',
      'advance icebreaker phase',
      'session lifecycle',
      'icebreaker host',
    ],
    owned_files: [
      'apps/server/src/routes/socialIcebreaker.ts',
      'apps/server/src/lib/socialIcebreakerStore.ts',
      'apps/user-client/src/pages/IcebreakerSessionPage.tsx',
      'docs/icebreaker-system.md',
    ],
    owned_paths: ['/api/icebreaker/', '/icebreaker/'],
    owned_symbols: [
      'useSocialIcebreaker',
      'socialIcebreakerStore',
      'advancePhase',
      'IcebreakerPhase',
      'warmup',
      'micro_challenge',
      'lie_detective',
      'recap',
      'isLie',
    ],
    related_skills: [
      { skill: 'reliability-and-state-integrity', when: 'session state transitions require transaction guards' },
      { skill: 'testing-and-regression-guardrails', when: 'adding invariant tests for host/player authority' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Anti-legacy guard
// ---------------------------------------------------------------------------

/**
 * Legacy patterns that must never appear in active-flow recommendations.
 * If any of these are detected in the ask, a canonical warning is added.
 */
export const LEGACY_PATTERNS = [
  { pattern: /\/guide\b/i, label: '/guide page (deprecated; active onboarding uses /onboarding/setup|extended|review)' },
  { pattern: /\bshared\/(?!src)/i, label: 'shared/ root import (use packages/shared/src/ instead)' },
  { pattern: /\bdirect.?messag/i, label: 'direct messaging (removed; use /connections)' },
  { pattern: /\b(圈子|chats)\b/i, label: '/chats or 圈子 surface (replaced by /connections)' },
  { pattern: /\b(hasCompletedRegistration|needsRegistration|registration_sessions|interestsTop)\b/i, label: 'legacy onboarding identifier' },
  { pattern: /\b(会员|VIP会员)\b/i, label: '会员/VIP会员 copy (replaced by 权益)' },
  { pattern: /14.archetype|v1|v2.*archetype|火花塞|探索者|故事家/i, label: '14-archetype V1/V2 system (replaced by 12-archetype V4)' },
  { pattern: /createDemoDataForUser/i, label: 'createDemoDataForUser (must be gated on NODE_ENV !== production)' },
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const STRONG_TRIGGER_SCORE = 10;
const USE_WHEN_SCORE = 3;
const OWNED_FILE_SCORE = 12;
const OWNED_PATH_SCORE = 6;
const OWNED_SYMBOL_SCORE = 7;

/**
 * Normalise text to lowercase for matching.
 * @param {string} text
 * @returns {string}
 */
function normalise(text) {
  return text.toLowerCase();
}

/**
 * Check if a trigger appears in the normalised text.
 * @param {string} trigger
 * @param {string} normText
 * @returns {boolean}
 */
function triggerMatches(trigger, normText) {
  return normText.includes(normalise(trigger));
}

/**
 * Score a single skill against the given inputs.
 *
 * @param {SkillDef} skill
 * @param {string} normAsk  — normalised ask text
 * @param {string[]} normFiles — normalised file paths
 * @param {string[]} normSymbols — normalised symbol names
 * @returns {{ score: number, signals: string[] }}
 */
function scoreSkill(skill, normAsk, normFiles, normSymbols) {
  let score = 0;
  const signals = [];

  // Strong triggers (highest weight)
  for (const trigger of skill.strong_triggers) {
    const normTrigger = normalise(trigger);
    if (normAsk.includes(normTrigger)) {
      score += STRONG_TRIGGER_SCORE;
      signals.push(`strong_trigger:ask:"${trigger}"`);
    }
    for (const f of normFiles) {
      if (f.includes(normTrigger)) {
        score += STRONG_TRIGGER_SCORE;
        signals.push(`strong_trigger:file:"${trigger}"`);
        break;
      }
    }
    for (const s of normSymbols) {
      if (s.includes(normTrigger) || normTrigger.includes(s)) {
        score += STRONG_TRIGGER_SCORE;
        signals.push(`strong_trigger:symbol:"${trigger}"`);
        break;
      }
    }
  }

  // use_when phrases
  for (const phrase of skill.use_when) {
    const normPhrase = normalise(phrase);
    // Check partial word overlap (3+ consecutive words matching)
    const phraseWords = normPhrase.split(/\s+/).filter(w => w.length > 3);
    const matchCount = phraseWords.filter(w => normAsk.includes(w)).length;
    if (matchCount >= Math.max(2, Math.floor(phraseWords.length * 0.5))) {
      score += USE_WHEN_SCORE;
      signals.push(`use_when:"${phrase}"`);
    }
  }

  // Owned file patterns
  for (const pattern of skill.owned_files) {
    const normPattern = normalise(pattern);
    for (const f of normFiles) {
      if (f.startsWith(normPattern) || f.includes(normPattern.replace('/**', '').replace('/*', ''))) {
        score += OWNED_FILE_SCORE;
        signals.push(`owned_file:"${f}"`);
        break;
      }
    }
    if (normAsk.includes(normPattern.replace('/**', '').replace('/*', ''))) {
      score += OWNED_FILE_SCORE / 2;
      signals.push(`owned_file_in_ask:"${pattern}"`);
    }
  }

  // Owned paths
  for (const path of skill.owned_paths) {
    const normPath = normalise(path);
    if (normAsk.includes(normPath) || normFiles.some(f => f.includes(normPath.replace(/\/$/, '')))) {
      score += OWNED_PATH_SCORE;
      signals.push(`owned_path:"${path}"`);
    }
  }

  // Owned symbols
  for (const sym of skill.owned_symbols) {
    const normSym = normalise(sym);
    if (normAsk.includes(normSym) || normSymbols.some(s => normalise(s).includes(normSym))) {
      score += OWNED_SYMBOL_SCORE;
      signals.push(`owned_symbol:"${sym}"`);
    }
  }

  // Apply negative: do_not_use_when reduces score
  for (const exclusion of skill.do_not_use_when) {
    const normEx = normalise(exclusion);
    const exWords = normEx.split(/\s+/).filter(w => w.length > 3);
    const matchCount = exWords.filter(w => normAsk.includes(w)).length;
    if (matchCount >= Math.max(2, Math.floor(exWords.length * 0.6))) {
      score -= 5;
      signals.push(`do_not_use_when:"${exclusion}" (penalty -5)`);
    }
  }

  return { score: Math.max(0, score), signals };
}

// ---------------------------------------------------------------------------
// Confidence band
// ---------------------------------------------------------------------------

/**
 * @param {number} topScore
 * @param {number} secondScore
 * @returns {'high' | 'medium' | 'low'}
 */
function confidenceBand(topScore, secondScore) {
  if (topScore === 0) return 'low';
  const gap = topScore - secondScore;
  if (topScore >= 20 && gap >= 10) return 'high';
  if (topScore >= 10) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Anti-legacy check
// ---------------------------------------------------------------------------

/**
 * @param {string} ask
 * @returns {{ triggered: boolean, warnings: string[] }}
 */
function antiLegacyCheck(ask) {
  const warnings = [];
  for (const { pattern, label } of LEGACY_PATTERNS) {
    if (pattern.test(ask)) {
      warnings.push(`LEGACY PATTERN DETECTED: ${label}`);
    }
  }
  return { triggered: warnings.length > 0, warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {{ ask: string, files?: string[], symbols?: string[], emitLog?: boolean }} RouteInput
 *
 * @typedef {{
 *   primary_skill: string | null,
 *   secondary_skills: string[],
 *   matched_signals: string[],
 *   confidence: 'high' | 'medium' | 'low',
 *   clarification_recommended: boolean,
 *   anti_legacy: { triggered: boolean, warnings: string[] },
 *   scores: Array<{ skill: string, score: number, signals: string[] }>,
 *   routing_log: object,
 * }} RouteResult
 */

/**
 * Route an ask to the most appropriate JoyJoin skill(s).
 *
 * @param {RouteInput} input
 * @returns {RouteResult}
 */
export function routeSkill({ ask, files = [], symbols = [], emitLog = false }) {
  const normAsk = normalise(ask);
  const normFiles = files.map(normalise);
  const normSymbols = symbols.map(normalise);

  // Score all skills
  const scores = SKILL_DEFINITIONS.map(skill => {
    const { score, signals } = scoreSkill(skill, normAsk, normFiles, normSymbols);
    return { skill: skill.skill, score, signals };
  }).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const second = scores[1];

  // Primary skill (only if score > 0)
  const primary_skill = top.score > 0 ? top.skill : null;

  // Secondary skill: include if score is meaningful and not far below primary
  const secondary_skills = [];
  if (second && second.score > 0 && second.score >= top.score * 0.4 && top.skill !== second.skill) {
    secondary_skills.push(second.skill);
  }

  // Confidence
  const confidence = confidenceBand(top.score, second?.score ?? 0);

  // Clarification recommended when low confidence or very close scores
  const clarification_recommended =
    confidence === 'low' ||
    (second && second.score > 0 && top.score > 0 && top.score - second.score < 5);

  // Matched signals (primary + secondary combined, deduplicated)
  const matched_signals = [
    ...top.signals,
    ...(secondary_skills.length > 0 ? second.signals : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // Anti-legacy guard
  const anti_legacy = antiLegacyCheck(ask);

  // Build routing log
  const routing_log = {
    ask,
    files,
    symbols,
    primary_skill,
    secondary_skills,
    confidence,
    clarification_recommended,
    anti_legacy,
    top_scores: scores.slice(0, 4).map(s => ({ skill: s.skill, score: s.score })),
    matched_signals,
    timestamp: new Date().toISOString(),
  };

  if (emitLog) {
    process.stdout.write(JSON.stringify(routing_log, null, 2) + '\n');
  }

  return {
    primary_skill,
    secondary_skills,
    matched_signals,
    confidence,
    clarification_recommended,
    anti_legacy,
    scores,
    routing_log,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith('skill-router.mjs')) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/skill-router.mjs "<ask>" [--files "path1,path2"] [--symbols "Sym1,Sym2"]');
    process.exit(1);
  }

  const ask = args[0];
  let files = [];
  let symbols = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--files' && args[i + 1]) {
      files = args[++i].split(',').map(s => s.trim());
    } else if (args[i] === '--symbols' && args[i + 1]) {
      symbols = args[++i].split(',').map(s => s.trim());
    }
  }

  const result = routeSkill({ ask, files, symbols, emitLog: false });

  console.log('\n🎯 JoyJoin Skill Router\n');
  console.log(`Ask: "${ask}"`);
  if (files.length) console.log(`Files: ${files.join(', ')}`);
  if (symbols.length) console.log(`Symbols: ${symbols.join(', ')}`);
  console.log('');
  console.log(`Primary skill:  ${result.primary_skill ?? '(none — clarification needed)'}`);
  if (result.secondary_skills.length) {
    console.log(`Secondary:      ${result.secondary_skills.join(', ')}`);
  }
  console.log(`Confidence:     ${result.confidence}`);
  console.log(`Clarification:  ${result.clarification_recommended ? 'recommended' : 'not needed'}`);
  if (result.matched_signals.length) {
    console.log(`\nMatched signals (top 8):`);
    result.matched_signals.slice(0, 8).forEach(s => console.log(`  • ${s}`));
  }
  if (result.anti_legacy.triggered) {
    console.log('\n⚠️  Anti-legacy warnings:');
    result.anti_legacy.warnings.forEach(w => console.log(`  ⚠  ${w}`));
  }
  console.log('\nTop scores:');
  result.scores.slice(0, 5).forEach(s => console.log(`  ${s.skill.padEnd(42)} ${s.score}`));
  console.log('');
}
