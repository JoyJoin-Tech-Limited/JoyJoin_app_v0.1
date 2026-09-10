/**
 * Assessment Profile Resolver — single source of truth for selecting the
 * adaptive-assessment **session profile**.
 *
 * ---------------------------------------------------------------------------
 * THE THREE-WAY "V2" NAMING TRAP (read before renaming anything)
 * ---------------------------------------------------------------------------
 * Three distinct concepts share the "V2" name, and only ONE of them is actually
 * about the matcher:
 *
 *   1. `MatcherV2` (`matcherV2.ts`, `useV2Matcher: true`) — the archetype
 *      assignment **algorithm**. It is ALWAYS active in both profiles; nothing
 *      here selects or disables it.
 *   2. `ENABLE_MATCHER_V2` (env var) — a **MISNOMER**. It does NOT toggle the
 *      matcher; it only selects the assessment session profile. When
 *      `ENABLE_MATCHER_V2 === 'true'` the older, longer `extended` profile is
 *      used; otherwise the `standard` profile applies.
 *   3. `V2_ASSESSMENT_CONFIG` — the older, longer session profile
 *      (12–20 questions, tiered thresholds on). It sits OUTSIDE the
 *      V4-validated envelope and should only be enabled behind a measured A/B.
 *
 * `standard` maps to `DEFAULT_ASSESSMENT_CONFIG` (10–16 questions, tiered
 * thresholds OFF) — the V4-validated **production** profile. `extended` maps to
 * `V2_ASSESSMENT_CONFIG` (12–20 questions, tiered on).
 *
 * ---------------------------------------------------------------------------
 * DEFERRED FOLLOW-UP (do NOT do this inside the resolver — high blast radius)
 * ---------------------------------------------------------------------------
 * Renaming `ENABLE_MATCHER_V2` → e.g. `ASSESSMENT_PROFILE`, and renaming the
 * `V2_ASSESSMENT_CONFIG` / `DEFAULT_ASSESSMENT_CONFIG` constants, is a separate
 * staged migration: the env var is referenced by deploy workflows, docs,
 * PRODUCT_REQUIREMENTS, and ~40 debug scripts. Keep the legacy names until that
 * migration lands.
 *
 * ---------------------------------------------------------------------------
 * SHARED-PACKAGE CONSTRAINT
 * ---------------------------------------------------------------------------
 * This module MUST NOT read global `process` — the shared package is bundled
 * into the WeChat mini-program, where `process` may be undefined. Callers pass
 * their environment (`process.env`) explicitly.
 */

import {
  DEFAULT_ASSESSMENT_CONFIG,
  V2_ASSESSMENT_CONFIG,
  type AssessmentConfig,
} from './types';

/** Identifier for an adaptive-assessment session profile. */
export type AssessmentProfileId = 'standard' | 'extended';

/**
 * Resolve the active session-profile id from an env bag.
 *
 * `'extended'` iff `env.ENABLE_MATCHER_V2 === 'true'` (the legacy, misnamed
 * flag), otherwise `'standard'` (the V4-validated production profile). The
 * comparison is exact-string, matching the historical inline ternary, so unset
 * / `'false'` / arbitrary values all resolve to `'standard'`.
 */
export function resolveAssessmentProfileId(
  env: Record<string, string | undefined>,
): AssessmentProfileId {
  return env.ENABLE_MATCHER_V2 === 'true' ? 'extended' : 'standard';
}

/**
 * Map a profile id to its immutable session config object. Returns the same
 * canonical object reference for a given id on every call.
 */
export function assessmentConfigForProfile(id: AssessmentProfileId): AssessmentConfig {
  return id === 'extended' ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
}

/**
 * Resolve the active session config directly from an env bag. Equivalent to
 * `assessmentConfigForProfile(resolveAssessmentProfileId(env))`; returns the
 * canonical config object (same reference) for a given env value.
 */
export function resolveAssessmentConfig(
  env: Record<string, string | undefined>,
): AssessmentConfig {
  return assessmentConfigForProfile(resolveAssessmentProfileId(env));
}
