import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_VOICE_STEP_IDS,
  ONBOARDING_VOICE_TABLES,
  getOnboardingVoiceLine,
} from '../onboardingVoice';
import { ARCHETYPE_CANONICAL_ORDER } from '../../personality/archetypeNames';

const ALL_ARCHETYPE_IDS = [...ARCHETYPE_CANONICAL_ORDER];

describe('onboarding archetype voice matrix', () => {
  it('covers all 12 archetypes × 13 steps in Tier A', () => {
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
});
