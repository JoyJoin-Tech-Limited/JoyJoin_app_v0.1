/**
 * GENERIC_PROFILE_TAGLINE_FALLBACK copy contract — Amendment A2 (AC-22).
 *
 * The fallback is the retreat text for the entry-card insight when the whole
 * pipeline fails: a warm non-recruiting close (「第一局见」direction), never
 * signup copy. All repo consumers import the constant (no hardcoded literal
 * assertions; verified by repo-wide grep during the A2 change).
 */

import { describe, expect, it } from 'vitest';
import { GENERIC_PROFILE_TAGLINE_FALLBACK } from '../ai/onboarding';
import { findReviewBlockedVocab } from '../copy/terms';

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe('GENERIC_PROFILE_TAGLINE_FALLBACK copy (AC-22)', () => {
  it('closes warmly with 第一局见 instead of the old recruiting phrasing', () => {
    expect(GENERIC_PROFILE_TAGLINE_FALLBACK).toContain('第一局见');
    expect(GENERIC_PROFILE_TAGLINE_FALLBACK).not.toContain('期待你的加入');
  });

  it('stays short (≤ 24 chars) — it reserves layout height in a small card', () => {
    expect(GENERIC_PROFILE_TAGLINE_FALLBACK.length).toBeLessThanOrEqual(24);
  });

  it('carries zero review-blocked vocabulary and zero emoji', () => {
    expect(findReviewBlockedVocab(GENERIC_PROFILE_TAGLINE_FALLBACK)).toBeNull();
    expect(GENERIC_PROFILE_TAGLINE_FALLBACK).not.toMatch(EMOJI_RE);
  });
});
