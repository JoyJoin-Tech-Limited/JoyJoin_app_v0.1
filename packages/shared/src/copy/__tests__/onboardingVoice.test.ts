import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_VOICE_STEP_IDS,
  ONBOARDING_VOICE_TABLES,
  getOnboardingVoiceLine,
} from '../onboardingVoice';
import { findReviewBlockedVocab } from '../terms';
import { ARCHETYPE_CANONICAL_ORDER } from '../../personality/archetypeNames';

const ALL_ARCHETYPE_IDS = [...ARCHETYPE_CANONICAL_ORDER];

describe('onboarding archetype voice matrix', () => {
  it('covers all 12 archetypes × 14 steps in Tier A', () => {
    expect(ALL_ARCHETYPE_IDS).toHaveLength(12);
    for (const archetype of ALL_ARCHETYPE_IDS) {
      const voiceMap = ONBOARDING_VOICE_TABLES.tierA[archetype];
      expect(voiceMap, `missing Tier A map for ${archetype}`).toBeDefined();
      for (const stepId of ONBOARDING_VOICE_STEP_IDS) {
        const line = voiceMap?.[stepId];
        expect(line, `missing Tier A line for ${archetype} × ${stepId}`).toBeTruthy();
      }
    }
  });

  it('every referenced key has a Tier B fallback line', () => {
    for (const stepId of ONBOARDING_VOICE_STEP_IDS) {
      expect(ONBOARDING_VOICE_TABLES.tierB[stepId]).toBeTruthy();
    }
  });

  it('resolves Tier A for known archetypes and Tier B for unknown ones', () => {
    expect(getOnboardingVoiceLine('essential-displayName', 'corgi')).toBe(
      ONBOARDING_VOICE_TABLES.tierA.corgi['essential-displayName'],
    );
    expect(getOnboardingVoiceLine('essential-displayName', 'not-an-archetype')).toBe(
      ONBOARDING_VOICE_TABLES.tierB['essential-displayName'],
    );
    expect(getOnboardingVoiceLine('essential-displayName', null)).toBe(
      ONBOARDING_VOICE_TABLES.tierB['essential-displayName'],
    );
    expect(getOnboardingVoiceLine('essential-displayName', '')).toBe(
      ONBOARDING_VOICE_TABLES.tierB['essential-displayName'],
    );
  });

  it('contains no raw emoji in any line (brand zero-emoji rule)', () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const stepId of ONBOARDING_VOICE_STEP_IDS) {
      expect(ONBOARDING_VOICE_TABLES.tierB[stepId]).not.toMatch(emojiPattern);
    }
    for (const archetype of Object.keys(ONBOARDING_VOICE_TABLES.tierA)) {
      for (const stepId of ONBOARDING_VOICE_STEP_IDS) {
        expect(ONBOARDING_VOICE_TABLES.tierA[archetype][stepId]).not.toMatch(emojiPattern);
      }
    }
  });

  it('discover-arrival Tier A lines are non-empty, distinct, and differ from Tier B', () => {
    const tierB = ONBOARDING_VOICE_TABLES.tierB['discover-arrival'];
    const lines = ALL_ARCHETYPE_IDS.map(
      (archetype) => ONBOARDING_VOICE_TABLES.tierA[archetype]?.['discover-arrival'],
    );
    for (const line of lines) {
      expect(line).toBeTruthy();
      expect(line).not.toBe(tierB);
    }
    expect(new Set(lines).size).toBe(ALL_ARCHETYPE_IDS.length);
  });

  // ── Amendment A1 (AC-17): profile-review coach bubble is preamble-style ──
  // The reveal belongs to the insight card; the bubble must only point at it
  // (「想指给你看」 family), never pre-reveal a verdict, and never promise
  // matching behaviour.

  const LEGACY_VERDICT_PHRASES = [
    '去点燃第一桌',
    '发光吧',
    '去遇见值得夸的人',
    '去挖你的第一场宝藏局',
    '去你的第一局',
    '去织你的第一张网',
    '去一个让你舒服的地方',
    '去制造第一场惊喜',
    '去观察你的第一局',
    '稳稳地走进你的第一局',
    '优雅地溜进你的第一局',
    '帮你筛合适的局',
  ];

  it('profile-review lines are preamble-style: point at the card, defer the reveal', () => {
    const lines = [
      ONBOARDING_VOICE_TABLES.tierB['profile-review'],
      ...ALL_ARCHETYPE_IDS.map(
        (archetype) => ONBOARDING_VOICE_TABLES.tierA[archetype]['profile-review'],
      ),
    ];
    expect(lines).toHaveLength(13);
    for (const line of lines) {
      expect(line, `line lacks the preamble marker: ${line}`).toContain('想指给你看');
      expect(line, `line promises matching behaviour: ${line}`).not.toContain('帮你筛');
      for (const phrase of LEGACY_VERDICT_PHRASES) {
        expect(line, `line still carries verdict phrase "${phrase}": ${line}`).not.toContain(phrase);
      }
    }
  });

  it('profile-review Tier A lines stay distinct per archetype (voice matrix preserved)', () => {
    const lines = ALL_ARCHETYPE_IDS.map(
      (archetype) => ONBOARDING_VOICE_TABLES.tierA[archetype]['profile-review'],
    );
    expect(new Set(lines).size).toBe(ALL_ARCHETYPE_IDS.length);
    for (const line of lines) {
      expect(line).not.toBe(ONBOARDING_VOICE_TABLES.tierB['profile-review']);
    }
  });

  it('profile-review lines carry zero review-blocked vocabulary', () => {
    const lines = [
      ONBOARDING_VOICE_TABLES.tierB['profile-review'],
      ...ALL_ARCHETYPE_IDS.map(
        (archetype) => ONBOARDING_VOICE_TABLES.tierA[archetype]['profile-review'],
      ),
    ];
    for (const line of lines) {
      expect(findReviewBlockedVocab(line), `blocked vocab in "${line}"`).toBeNull();
    }
  });

  it('resolver keeps the same signature and returns the new preamble line', () => {
    expect(getOnboardingVoiceLine('profile-review', 'fox')).toContain('想指给你看');
    expect(getOnboardingVoiceLine('profile-review', 'not-an-archetype')).toBe(
      ONBOARDING_VOICE_TABLES.tierB['profile-review'],
    );
  });
});
