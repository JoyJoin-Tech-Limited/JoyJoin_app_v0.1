import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialSessionState, XiaoyueAgentState } from '@shared/socialIcebreaker';

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: vi.fn(),
  listParticipants: vi.fn().mockResolvedValue([]),
  updateSession: vi.fn(),
  loadSessionLieTruths: vi.fn().mockResolvedValue(new Map()),
  savePhaseMetric: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(async (_key: string, fallback = false) => fallback),
}));

import { buildClientState, sanitizeStateForClient } from '../routes/socialIcebreakerHelpers';
import { listParticipants } from '../lib/socialIcebreakerStore';

const NOW = 1_800_000_000_000;

function makeAgent(): XiaoyueAgentState {
  return {
    ask: {
      id: 'ask_sensitive',
      kind: 'warmup_rotate_topics',
      phase: 'warmup',
      reason: 'topic_stall',
      createdAt: NOW,
      baseTopicSetRevision: 4,
      copy: {
        kicker: '悦仔想确认一下',
        question: '这组先聊到这里吗？换一组新话题就好。',
        hint: '你确认后，全桌一起换新',
        cta: '换一组话题卡',
      },
      meta: {
        generatedAt: new Date(NOW).toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: true,
        aigc: { aiGenerated: false },
      },
      status: 'pending',
      action: {
        idempotencyKey: 'host-only-idempotency-key',
        startedAt: NOW + 1_000,
      },
    },
    policy: {
      proactiveDisabled: false,
      ignoredStreak: 1,
      cooldownUntilByKind: { warmup_rotate_topics: NOW + 600_000 },
      lastAskAt: NOW,
      askCount: 1,
      askCountByPhase: { warmup: 1 },
    },
    candidate: { key: 'warmup:topic_stall', since: NOW - 60_000 },
    lastAction: {
      askId: 'ask_previous',
      idempotencyKey: 'host-only-previous-key',
      status: 'executing',
      startedAt: NOW - 2_000,
    },
    agentLlmCallCount: 17,
    agentEstimatedCostYuan: 0.199,
  };
}

function makeState(agent: XiaoyueAgentState | undefined = makeAgent()): SocialSessionState {
  return {
    socialSessionId: 'social_sanitizer',
    icebreakerSessionId: 'sanitizer',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    activePlayerCount: 4,
    phaseStartedAt: NOW - 300_000,
    sessionStartedAt: NOW - 300_000,
    completedPhases: [],
    warmupTopics: [{ id: 't1', question: 'Q1', mood: 'relaxed', emoji: '' }],
    warmupTopicSetRevision: 4,
    warmupTopicSetUpdatedAt: NOW - 20_000,
    warmupTopicAdvancedAt: NOW - 10_000,
    warmupTopicSetProvenance: 'host_manual',
    servedTopicKeys: ['id:t1', 'q:Q1', 'q:Historical server-only question'],
    xiaoyueAgent: agent,
  };
}

function expectRevisionFields(state: SocialSessionState) {
  expect(state).toMatchObject({
    warmupTopicSetRevision: 4,
    warmupTopicSetUpdatedAt: NOW - 20_000,
    warmupTopicAdvancedAt: NOW - 10_000,
    warmupTopicSetProvenance: 'host_manual',
  });
}

describe('sanitizeStateForClient — Xiaoyue Agent host boundary (AC-03/SEC-01)', () => {
  beforeEach(() => {
    vi.mocked(listParticipants).mockResolvedValue([]);
  });

  it('host receives the bounded pending/executing/result DTO and numeric cost state', () => {
    const host = sanitizeStateForClient(makeState(), 'host');

    expectRevisionFields(host);
    expect(host.xiaoyueAgent?.ask).toMatchObject({
      id: 'ask_sensitive',
      status: 'pending',
      action: { idempotencyKey: 'host-only-idempotency-key' },
    });
    expect(host.xiaoyueAgent?.lastAction).toMatchObject({ status: 'executing' });
    expect(host.xiaoyueAgent?.agentLlmCallCount).toBe(17);
    expect(host.xiaoyueAgent?.agentEstimatedCostYuan).toBe(0.199);
  });

  it.each(['participant', undefined])('non-host %s receives no xiaoyueAgent object or nested sensitive fields', (requester) => {
    const original = makeState();
    const participant = sanitizeStateForClient(original, requester);

    expectRevisionFields(participant);
    expect(participant).not.toHaveProperty('xiaoyueAgent');
    const wire = JSON.stringify(participant);
    for (const sensitive of [
      'ask_sensitive',
      'host-only-idempotency-key',
      'host-only-previous-key',
      'agentLlmCallCount',
      'agentEstimatedCostYuan',
      'cooldownUntilByKind',
      'ignoredStreak',
      'idempotencyKey',
    ]) {
      expect(wire).not.toContain(sensitive);
    }
    // The sanitizer is a projection, not a destructive scrub of server state.
    expect(original.xiaoyueAgent?.ask?.id).toBe('ask_sensitive');
  });

  it.each(['host', 'participant', undefined])('servedTopicKeys stay server-only for %s', (requester) => {
    const original = makeState();
    const projected = sanitizeStateForClient(original, requester);

    expect(projected).not.toHaveProperty('servedTopicKeys');
    expect(JSON.stringify(projected)).not.toContain('Historical server-only question');
    expect(original.servedTopicKeys).toContain('q:Historical server-only question');
  });

  it('legacy state with no agent or revision metadata remains safe and backward compatible', () => {
    const legacy = makeState(undefined);
    legacy.warmupTopicSetRevision = undefined;
    legacy.warmupTopicSetUpdatedAt = undefined;
    legacy.warmupTopicAdvancedAt = undefined;
    legacy.warmupTopicSetProvenance = undefined;

    const participant = sanitizeStateForClient(legacy, 'participant');
    const host = sanitizeStateForClient(legacy, 'host');
    expect(participant).not.toHaveProperty('xiaoyueAgent');
    expect(host).not.toHaveProperty('xiaoyueAgent');
    expect(participant.warmupTopicSetRevision).toBeUndefined();
    expect(participant.warmupTopicAdvancedAt).toBeUndefined();
  });

  it('buildClientState applies the same host/participant boundary while preserving revision transitions', async () => {
    const state = makeState();
    const [host, participant] = await Promise.all([
      buildClientState(state, 'host'),
      buildClientState(state, 'participant'),
    ]);

    expect(host.xiaoyueAgent?.ask?.status).toBe('pending');
    expect(host.xiaoyueAgent?.agentEstimatedCostYuan).toBe(0.199);
    expect(host).not.toHaveProperty('servedTopicKeys');
    expect(participant).not.toHaveProperty('xiaoyueAgent');
    expect(participant).not.toHaveProperty('servedTopicKeys');
    expectRevisionFields(participant);
    expect(JSON.stringify(participant)).not.toContain('agentLlmCallCount');
  });
});
