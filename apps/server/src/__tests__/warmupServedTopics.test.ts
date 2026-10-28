import { describe, expect, it } from 'vitest';
import type { SocialSessionState, SocialTopic } from '@shared/socialIcebreaker';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import {
  commitWholeTopicSet,
  markTopicAdvanced,
} from '../lib/warmupTopicSetRevision';

const NOW = 1_800_000_000_000;

const meta: AIResponseMeta = {
  generatedAt: new Date(NOW).toISOString(),
  fromCache: false,
  provider: null,
  fallbackUsed: true,
};

function topic(id: string, question: string): SocialTopic {
  return { id, question, mood: 'relaxed', emoji: '' };
}

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_served',
    icebreakerSessionId: 'served',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: NOW,
    sessionStartedAt: NOW,
    completedPhases: [],
    warmupTopics: [topic('old', 'Old question')],
    warmupTopicSetRevision: 1,
    ...overrides,
  };
}

function replaceDeck(
  state: SocialSessionState,
  topics: SocialTopic[],
  curatedFallbackCandidates: SocialTopic[] = [],
) {
  return commitWholeTopicSet(state, {
    topics,
    curatedFallbackCandidates,
    meta,
    provenance: 'host_manual',
    now: NOW + state.warmupTopicSetRevision!,
  });
}

function restart<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('durable within-session served warmup topics', () => {
  it('derives a legacy current deck and filters exact and normalized ID/question duplicates', () => {
    const state = makeState({
      warmupTopics: [{ ...topic('Legacy-ID', '  Same   Question？ '), safety: undefined }],
      servedTopicKeys: undefined,
    });

    const result = replaceDeck(state, [
      topic('legacy-id', 'Different question with a duplicate normalized ID'),
      topic('another-id', 'same question?'),
      topic('fresh', 'A genuinely fresh question'),
    ], [
      topic('fallback-a', 'Fallback A'),
      topic('fallback-b', 'Fallback B'),
    ]);

    expect(result.dedupeRelaxed).toBe(false);
    expect(state.warmupTopics?.map((entry) => entry.id)).toEqual([
      'fresh',
      'fallback-a',
      'fallback-b',
    ]);
    expect(state.servedTopicKeys).toContain('id:Legacy-ID');
    expect(state.servedTopicKeys).toContain('q:  Same   Question？ ');
    expect(state.servedTopicKeys).toContain('id:fresh');
  });

  it('keeps served history across retry, rejoin and process restart without adding it on card advance', () => {
    const initial = makeState();
    replaceDeck(initial, [topic('a', 'Question A'), topic('b', 'Question B')]);
    const servedAfterFirstCommit = [...initial.servedTopicKeys!];

    // All cards in an atomically committed deck are served, not only cards that
    // were reached or discussed. Ordinary next-card advance is not a new serve.
    expect(servedAfterFirstCommit).toEqual(expect.arrayContaining(['id:a', 'id:b']));
    markTopicAdvanced(initial, NOW + 5_000);
    expect(initial.servedTopicKeys).toEqual(servedAfterFirstCommit);

    const restarted = restart(initial);
    const retry = replaceDeck(restarted, [
      topic('a', 'Question A'),
      topic('b', 'Question B'),
    ], [
      topic('c', 'Question C'),
      topic('d', 'Question D'),
    ]);

    expect(retry.dedupeRelaxed).toBe(false);
    expect(restarted.warmupTopics?.map((entry) => entry.id)).toEqual(['c', 'd']);
    expect(restarted.servedTopicKeys).toEqual(expect.arrayContaining(servedAfterFirstCommit));

    const rejoined = restart(restarted);
    const exhaustedRetry = replaceDeck(rejoined, [
      topic('a', 'Question A'),
      topic('b', 'Question B'),
    ], [
      topic('c', 'Question C'),
      topic('d', 'Question D'),
    ]);
    expect(exhaustedRetry.dedupeRelaxed).toBe(true);
    expect(rejoined.warmupTopics?.map((entry) => entry.id)).toEqual(['a', 'b']);

    const repeatedExhaustion = restart(rejoined);
    const repeatedResult = replaceDeck(repeatedExhaustion, [
      topic('a', 'Question A'),
      topic('b', 'Question B'),
    ], [
      topic('c', 'Question C'),
      topic('d', 'Question D'),
    ]);
    expect(repeatedResult.dedupeRelaxed).toBe(true);
    expect(repeatedExhaustion.warmupTopics).toEqual(rejoined.warmupTopics);
  });

  it('applies the same served filter to curated fallback fill candidates', () => {
    const state = makeState({ warmupTopics: [topic('old', 'Repeat Me')] });
    const result = replaceDeck(state, [topic('old', 'A different question')], [
      topic('new-id', ' repeat   me？ '),
      topic('fresh-fallback', 'Fresh fallback'),
    ]);

    expect(result.dedupeRelaxed).toBe(false);
    expect(state.warmupTopics).toHaveLength(1);
    expect(state.warmupTopics?.[0].id).toBe('fresh-fallback');
  });

  it('relaxes deterministically on exhaustion, never serves an empty deck, and does not duplicate served keys', () => {
    const state = makeState({ warmupTopics: [topic('old', 'Only Question')] });
    const candidates = [topic('OLD', ' only   question？ ')];
    const first = replaceDeck(state, candidates, [topic('old', 'Only Question')]);
    const servedLength = state.servedTopicKeys?.length;

    expect(first.dedupeRelaxed).toBe(true);
    expect(state.warmupTopics).toHaveLength(1);
    expect(state.warmupTopics?.[0].question).toBe(' only   question？ ');

    const secondState = restart(state);
    const second = replaceDeck(secondState, candidates, [topic('old', 'Only Question')]);
    expect(second.dedupeRelaxed).toBe(true);
    expect(secondState.warmupTopics).toEqual(state.warmupTopics);
    expect(secondState.servedTopicKeys?.length).toBe(servedLength);
  });

  it('bounds served keys at 240 with deterministic oldest-first eviction while preserving the committed deck', () => {
    const historicalKeys = Array.from({ length: 240 }, (_, index) => `legacy-${index}`);
    const state = makeState({ servedTopicKeys: historicalKeys });

    replaceDeck(state, [topic('new-current', 'Current Question')]);

    expect(state.servedTopicKeys).toHaveLength(240);
    expect(state.servedTopicKeys).not.toContain('legacy-0');
    expect(state.servedTopicKeys).toContain('legacy-239');
    expect(state.servedTopicKeys).toEqual(expect.arrayContaining([
      'id:new-current',
      'q:Current Question',
    ]));
  });

  it('does not share served memory between sessions', () => {
    const firstSession = makeState();
    const secondSession = makeState({ socialSessionId: 'social_other' });
    const candidates = [topic('same', 'Same Question')];

    replaceDeck(firstSession, candidates);
    const secondResult = replaceDeck(secondSession, candidates);

    expect(secondResult.dedupeRelaxed).toBe(false);
    expect(secondSession.warmupTopics?.[0].id).toBe('same');
  });
});
