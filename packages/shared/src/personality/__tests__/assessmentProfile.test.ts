/**
 * Contract: assessment-profile-resolver (2026-09-10).
 *
 * Locks the behavior-identical extraction of the duplicated
 * `ENABLE_MATCHER_V2 === 'true' ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG`
 * selection into `assessmentProfile.ts`.
 *
 * Invariants:
 *  1. Id resolution is an exact-string comparison: only `'true'` yields
 *     `'extended'`; unset / `'false'` / arbitrary / differently-cased values
 *     all yield `'standard'`.
 *  2. Profile → config mapping returns the canonical object REFERENCES
 *     (`standard` === DEFAULT_ASSESSMENT_CONFIG, `extended` ===
 *     V2_ASSESSMENT_CONFIG) — identity, not a copy.
 *  3. `resolveAssessmentConfig(env)` is behavior-identical to the old inline
 *     ternary for every env value.
 *  4. The module never reads global `process` (shared package is bundled into
 *     the mini-program); callers pass `process.env` explicitly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assessmentConfigForProfile,
  resolveAssessmentConfig,
  resolveAssessmentProfileId,
} from '../assessmentProfile';
import { DEFAULT_ASSESSMENT_CONFIG, V2_ASSESSMENT_CONFIG } from '../types';

describe('resolveAssessmentProfileId', () => {
  it("returns 'standard' when the flag is unset", () => {
    expect(resolveAssessmentProfileId({})).toBe('standard');
    expect(resolveAssessmentProfileId({ ENABLE_MATCHER_V2: undefined })).toBe('standard');
  });

  it("returns 'extended' only for the exact string 'true'", () => {
    expect(resolveAssessmentProfileId({ ENABLE_MATCHER_V2: 'true' })).toBe('extended');
  });

  it("returns 'standard' for 'false', '', arbitrary, and differently-cased values", () => {
    for (const value of ['false', '', 'TRUE', 'True', '1', 'yes', 'true ', ' true', 'on']) {
      expect(resolveAssessmentProfileId({ ENABLE_MATCHER_V2: value })).toBe('standard');
    }
  });
});

describe('assessmentConfigForProfile', () => {
  it('maps standard → DEFAULT_ASSESSMENT_CONFIG by reference', () => {
    expect(assessmentConfigForProfile('standard')).toBe(DEFAULT_ASSESSMENT_CONFIG);
  });

  it('maps extended → V2_ASSESSMENT_CONFIG by reference', () => {
    expect(assessmentConfigForProfile('extended')).toBe(V2_ASSESSMENT_CONFIG);
  });

  it('locks the distinguishing profile semantics', () => {
    expect(DEFAULT_ASSESSMENT_CONFIG.minQuestions).toBe(10);
    expect(DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions).toBe(16);
    expect(DEFAULT_ASSESSMENT_CONFIG.enableTieredThreshold).toBe(false);
    expect(V2_ASSESSMENT_CONFIG.minQuestions).toBe(12);
    expect(V2_ASSESSMENT_CONFIG.hardMaxQuestions).toBe(20);
    expect(V2_ASSESSMENT_CONFIG.enableTieredThreshold).toBe(true);
  });
});

describe('resolveAssessmentConfig (behavior-identical to the legacy ternary)', () => {
  it('returns DEFAULT_ASSESSMENT_CONFIG for unset / false / arbitrary values', () => {
    for (const value of [undefined, 'false', '', 'TRUE', '1', 'yes']) {
      expect(resolveAssessmentConfig({ ENABLE_MATCHER_V2: value })).toBe(
        DEFAULT_ASSESSMENT_CONFIG,
      );
    }
    expect(resolveAssessmentConfig({})).toBe(DEFAULT_ASSESSMENT_CONFIG);
  });

  it("returns V2_ASSESSMENT_CONFIG only when the flag is exactly 'true'", () => {
    expect(resolveAssessmentConfig({ ENABLE_MATCHER_V2: 'true' })).toBe(V2_ASSESSMENT_CONFIG);
  });

  it('is equivalent to assessmentConfigForProfile(resolveAssessmentProfileId(env))', () => {
    for (const env of [
      {},
      { ENABLE_MATCHER_V2: '' },
      { ENABLE_MATCHER_V2: 'false' },
      { ENABLE_MATCHER_V2: 'true' },
      { ENABLE_MATCHER_V2: 'unexpected' },
    ]) {
      expect(resolveAssessmentConfig(env)).toBe(
        assessmentConfigForProfile(resolveAssessmentProfileId(env)),
      );
    }
  });
});

describe('shared-package constraint', () => {
  it('does not reference global process in executable code', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../assessmentProfile.ts', import.meta.url)),
      'utf8',
    );
    // Strip block and line comments so the JSDoc warning about `process` does
    // not count as a reference.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/\bprocess\b/);
  });
});
