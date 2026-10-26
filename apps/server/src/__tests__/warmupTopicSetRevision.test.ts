import { describe, expect, it } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import {
  commitWholeTopicSet,
  markTopicAdvanced,
  stampPrecompiledTopicSet,
} from '../lib/warmupTopicSetRevision';

const NOW = 1_800_000_000_000;

const meta: AIResponseMeta = {
  generatedAt: new Date(NOW).toISOString(),
  fromCache: false,
  provider: null,
  fallbackUsed: true,
};

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_revision',
    icebreakerSessionId: 'revision',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: NOW,
    sessionStartedAt: NOW,
    completedPhases: [],
    warmupTopics: [{ id: 't1', question: 'Q1', mood: 'relaxed', emoji: '' }],
    warmupTopicSetRevision: 1,
    warmupTopicSetUpdatedAt: NOW,
    warmupTopicAdvancedAt: NOW,
    warmupTopicSetProvenance: 'precompile',
    ...overrides,
  };
}

describe('warmup topic set revision — AC-04 single source of truth', () => {
  it('keeps revision 1 for precompilation of the first deck', () => {
    const state = makeState({ warmupTopicSetRevision: undefined });
    stampPrecompiledTopicSet(state, NOW + 1_000);
    expect(state.warmupTopicSetRevision).toBe(1);
    expect(state.warmupTopicSetUpdatedAt).toBe(NOW + 1_000);
    expect(state.warmupTopicSetProvenance).toBe('precompile');
  });

  it('increments old + 1 and resets index on a whole-deck replacement', () => {
    const state = makeState({ currentTopicIndex: 2 });
    commitWholeTopicSet(state, {
      topics: [{ id: 'new', question: 'New', mood: 'relaxed', emoji: '' }],
      meta,
      provenance: 'agent',
      now: NOW + 5_000,
    });
    expect(state.warmupTopicSetRevision).toBe(2);
    expect(state.warmupTopicSetUpdatedAt).toBe(NOW + 5_000);
    expect(state.warmupTopicAdvancedAt).toBe(NOW + 5_000);
    expect(state.warmupTopicSetProvenance).toBe('agent');
    expect(state.currentTopicIndex).toBe(0);
    expect(state.warmupTopicsStatus).toBe('ready');
  });

  it('treats legacy sessions as revision 0 → first host replacement becomes 1', () => {
    const state = makeState({ warmupTopicSetRevision: undefined });
    commitWholeTopicSet(state, {
      topics: [{ id: 'new', question: 'New', mood: 'relaxed', emoji: '' }],
      meta,
      provenance: 'host_manual',
      now: NOW,
    });
    expect(state.warmupTopicSetRevision).toBe(1);
  });

  it('advancing to the next card does not bump revision or updatedAt', () => {
    const state = makeState({ currentTopicIndex: 0 });
    markTopicAdvanced(state, NOW + 9_000);
    expect(state.warmupTopicSetRevision).toBe(1);
    expect(state.warmupTopicSetUpdatedAt).toBe(NOW);
    expect(state.warmupTopicAdvancedAt).toBe(NOW + 9_000);
  });
});
