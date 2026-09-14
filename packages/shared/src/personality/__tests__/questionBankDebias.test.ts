/**
 * P5b question-bank debias lock (2026-09-14).
 *
 * The V4 bank was positively keyed: uniform-random answering drifted trait
 * means up to +16 points and inflated the high-A/C/E archetypes (spider
 * 23.6%, koala 20.6% at n=2000). The debias re-centered every question×trait
 * so option loadings sum to ZERO across each question's options — under
 * uniform-random answering every question then contributes zero expected
 * trait drift regardless of the adaptive selection path.
 *
 * This test is the deterministic half of the lock (no sampling): it fails if
 * a future hand-edit re-keys any servable question. The dynamic half (drift
 * and archetype-distribution guards over 300 seeded random sessions) lives in
 * scripts/simulate/gate-random-drift.ts, wired into `npm run simulate:gate`.
 *
 * Ipsative items are exempt: they ship dark behind enableIpsativeItems and
 * carry a deliberately structured debit design (see questionsV4Ipsative.ts).
 */
import { describe, expect, it } from 'vitest';
import { questionsV4 } from '../questionsV4';
import { TraitKey } from '../types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

describe('P5b question-bank debias lock', () => {
  const servable = questionsV4.filter((q) => q.questionType !== 'ipsative');

  it('every servable question×trait has zero-sum option loadings', () => {
    const violations: string[] = [];
    for (const q of servable) {
      for (const trait of ALL_TRAITS) {
        const sum = q.options.reduce((s, o) => s + (o.traitScores?.[trait] ?? 0), 0);
        if (sum !== 0) violations.push(`${q.id}/${trait} sum=${sum}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('loadings stay within the bank range [-6, +6]', () => {
    const violations: string[] = [];
    for (const q of servable) {
      for (const o of q.options) {
        for (const trait of ALL_TRAITS) {
          const v = o.traitScores?.[trait] ?? 0;
          if (Math.abs(v) > 6) violations.push(`${q.id}/${o.value}/${trait}=${v}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no servable measurement question has collapsed to all-zero loadings on its primary traits', () => {
    // Re-centering must not destroy discrimination: each measurement question
    // keeps a non-zero spread on at least one of its declared primary traits.
    // Exempt by design: attention checks (Q69: validity, not measurement) and
    // the meta-consistency item (Q168: zero-loading self-report vs estimate,
    // see questionsV4Attractor.ts header).
    const violations: string[] = [];
    for (const q of servable) {
      if (q.isAttentionCheck || q.id === 'Q168') continue;
      const keepsSignal = (q.primaryTraits as TraitKey[]).some((trait) =>
        q.options.some((o) => (o.traitScores?.[trait] ?? 0) !== 0)
      );
      if (!keepsSignal) violations.push(q.id);
    }
    expect(violations).toEqual([]);
  });

  it('ipsative exemption set is exactly the flag-gated ipsative bank', () => {
    const ipsative = questionsV4.filter((q) => q.questionType === 'ipsative');
    expect(ipsative.length).toBe(12);
    expect(ipsative.every((q) => q.options.length === 2)).toBe(true);
  });
});
