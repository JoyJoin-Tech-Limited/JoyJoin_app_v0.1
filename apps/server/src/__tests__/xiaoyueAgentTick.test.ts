import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  XIAOYUE_AGENT_LEGAL_DECISIONS,
  type SocialSessionState,
  type XiaoyueAgentAsk,
  type XiaoyueAgentState,
} from '@shared/socialIcebreaker';
import {
  getXiaoyueAgentAskCopy,
  XIAOYUE_AGENT_ASK_COPY_BY_REASON,
} from '@shared/copy/icebreakerSession';
import {
  XIAOYUE_AGENT_DEFAULT_CONFIG,
  applyXiaoyueAgentAskDecision,
  canUseAgentLlm,
  decideAgentTick,
  deriveAgentSignals,
} from '../lib/xiaoyueAgentPolicy';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

function makeAgent(overrides: Partial<XiaoyueAgentState> = {}): XiaoyueAgentState {
  return {
    policy: {
      proactiveDisabled: false,
      ignoredStreak: 0,
      cooldownUntilByKind: {},
      askCount: 0,
      askCountByPhase: {},
      ...(overrides.policy ?? {}),
    },
    agentLlmCallCount: 0,
    agentEstimatedCostYuan: 0,
    ...overrides,
  };
}

function makeAsk(overrides: Partial<XiaoyueAgentAsk> = {}): XiaoyueAgentAsk {
  return {
    id: 'ask_test',
    kind: 'warmup_rotate_topics',
    phase: 'warmup',
    reason: 'topic_stall',
    createdAt: NOW - 10_000,
    baseTopicSetRevision: 1,
    copy: getXiaoyueAgentAskCopy('topic_stall'),
    meta: {
      generatedAt: new Date(NOW - 10_000).toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: true,
      aigc: { aiGenerated: false },
    },
    status: 'pending',
    ...overrides,
  };
}

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_policy',
    icebreakerSessionId: 'policy',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    activePlayerCount: 6,
    phaseStartedAt: NOW - 5 * MIN,
    sessionStartedAt: NOW - 5 * MIN,
    completedPhases: [],
    warmupTopics: [
      { id: 't1', question: 'Q1', mood: 'relaxed', emoji: '' },
      { id: 't2', question: 'Q2', mood: 'relaxed', emoji: '' },
    ],
    warmupTopicsStatus: 'ready',
    currentTopicIndex: 0,
    warmupReadyUserIds: [],
    warmupTopicSetRevision: 1,
    warmupTopicSetUpdatedAt: NOW - 30_000,
    warmupTopicAdvancedAt: NOW - 30_000,
    warmupTopicSetProvenance: 'precompile',
    runPlan: {
      version: 2,
      segments: [
        { phase: 'warmup', allocatedMinutes: 20, energyWeight: 1 },
        { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
      ],
      totalMinutes: 30,
      compiledAt: new Date(NOW - 5 * MIN).toISOString(),
      compilerId: 'policy-test',
    },
    ...overrides,
  };
}

function makeTopicStallState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return makeState({
    warmupTopicAdvancedAt: NOW - 180_000,
    ...overrides,
  });
}

function tick(state: SocialSessionState, now = NOW) {
  return decideAgentTick({ state, now, viewerIsHost: true, flagEnabled: true });
}

describe('xiaoyueAgentPolicy — bounded deterministic authority', () => {
  it('exposes exactly the four legal runtime decisions', () => {
    expect(XIAOYUE_AGENT_LEGAL_DECISIONS).toEqual(['observe', 'ask', 'execute', 'stop']);
  });

  it('is pure, deterministic, and does not mutate the session or advance/name anyone', () => {
    const state = makeTopicStallState();
    const before = structuredClone(state);
    const first = tick(state);
    const second = tick(state);

    expect(first).toEqual(second);
    expect(state).toEqual(before);
    expect(JSON.stringify(first)).not.toContain('advance');
    expect(JSON.stringify(first)).not.toContain('hostDisplayName');
  });

  it('contains no LLM, DB, ambient-clock, or network access', () => {
    const source = readFileSync(new URL('../lib/xiaoyueAgentPolicy.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/chat\.completions|\bdb\.|Date\.now\(|\bfetch\s*\(/);
  });

  it('flag off is a zero-behaviour suppress, even with strong signals and a stale Ask', () => {
    const state = makeTopicStallState({
      currentPhase: 'micro_challenge',
      xiaoyueAgent: makeAgent({ ask: makeAsk() }),
    });
    const before = structuredClone(state);

    expect(decideAgentTick({ state, now: NOW, viewerIsHost: true, flagEnabled: false }))
      .toEqual({ type: 'suppress', reason: 'flag_off' });
    expect(state).toEqual(before);
  });

  it('participant polls never calculate or mutate candidates', () => {
    const state = makeTopicStallState();
    expect(decideAgentTick({ state, now: NOW, viewerIsHost: false, flagEnabled: true }))
      .toEqual({ type: 'suppress', reason: 'not_host' });
    expect(state.xiaoyueAgent).toBeUndefined();
  });

  it('rejects closed and unobserved phases', () => {
    expect(tick(makeTopicStallState({ currentPhase: 'lie_detective' })))
      .toEqual({ type: 'suppress', reason: 'phase_not_observed' });
    expect(tick(makeTopicStallState({ currentPhase: 'recap' })))
      .toEqual({ type: 'suppress', reason: 'session_closed' });
    expect(tick(makeTopicStallState({ expiresAt: new Date(NOW - 1).toISOString() })))
      .toEqual({ type: 'suppress', reason: 'session_closed' });
  });

  it('micro_challenge derives observation signals but never emits an actionable Ask', () => {
    const state = makeState({
      currentPhase: 'micro_challenge',
      phaseStartedAt: NOW - 17 * MIN,
      activePlayerCount: 0,
      challengeCompletedBy: [],
      pulseChecks: [{ userId: 'host', vibe: 1, createdAt: NOW - 1_000 }],
    });

    const signals = deriveAgentSignals(state, NOW);
    expect(signals.phaseOverrun).toBe(true);
    expect(signals.pulseLow).toBe(true);
    expect(signals.activeRate).toBe(0);
    expect(tick(state)).toEqual({ type: 'suppress', reason: 'observation_only_phase' });
  });

  it('activeRate dropping to zero alone never marks a candidate or creates an Ask', () => {
    const state = makeState({ activePlayerCount: 0 });
    const later = makeState({
      activePlayerCount: 0,
      phaseStartedAt: NOW + 20 * MIN - 5 * MIN,
      sessionStartedAt: NOW + 20 * MIN - 5 * MIN,
      warmupTopicAdvancedAt: NOW + 20 * MIN - 30_000,
      warmupTopicSetUpdatedAt: NOW + 20 * MIN - 30_000,
    });

    expect(tick(state)).toEqual({ type: 'none' });
    expect(tick(later, NOW + 20 * MIN)).toEqual({ type: 'none' });
  });

  it('uses the run-plan budget and requires a 60s sustained phase-overrun window', () => {
    const state = makeState({ phaseStartedAt: NOW - 25 * MIN });
    const first = tick(state);
    expect(first).toMatchObject({ type: 'mark_candidate', since: NOW });
    if (first.type !== 'mark_candidate') throw new Error('expected candidate');

    state.xiaoyueAgent = makeAgent({ candidate: { key: first.key, since: first.since } });
    expect(tick(state, NOW + 59_999)).toEqual({ type: 'none' });
    const created = tick(state, NOW + 60_000);
    expect(created).toMatchObject({ type: 'create_ask', draft: { reason: 'phase_overrun', phase: 'warmup' } });
  });

  it('does not trigger phase_overrun below the 1.25 budget ratio', () => {
    const state = makeState({ phaseStartedAt: NOW - (25 * MIN - 1) });
    expect(deriveAgentSignals(state, NOW).phaseOverrun).toBe(false);
    expect(tick(state)).toEqual({ type: 'none' });
  });

  it('topic stagnation uses advancedAt and requires a separate sustained observation window', () => {
    const state = makeTopicStallState();
    const first = tick(state);
    expect(first).toMatchObject({ type: 'mark_candidate', since: NOW });
    if (first.type !== 'mark_candidate') throw new Error('expected candidate');

    state.xiaoyueAgent = makeAgent({ candidate: { key: first.key, since: NOW } });
    expect(tick(state, NOW + 59_999)).toEqual({ type: 'none' });
    expect(tick(state, NOW + 60_000)).toMatchObject({
      type: 'create_ask',
      draft: {
        kind: 'warmup_rotate_topics',
        reason: 'topic_stall',
        baseTopicSetRevision: 1,
      },
    });
  });

  it('legacy sessions fall back to phaseStartedAt and revision zero without throwing', () => {
    const state = makeState({
      phaseStartedAt: NOW - 180_000,
      warmupTopicSetRevision: undefined,
      warmupTopicSetUpdatedAt: undefined,
      warmupTopicAdvancedAt: undefined,
      warmupTopicSetProvenance: undefined,
    });
    const first = tick(state);
    expect(first).toMatchObject({ type: 'mark_candidate' });
    if (first.type !== 'mark_candidate') throw new Error('expected candidate');
    state.xiaoyueAgent = makeAgent({ candidate: { key: first.key, since: NOW } });
    expect(tick(state, NOW + 60_000)).toMatchObject({
      type: 'create_ask',
      draft: { baseTopicSetRevision: 0 },
    });
  });

  it('a topic advance clears the old candidate instead of reusing its observation window', () => {
    const state = makeTopicStallState();
    const first = tick(state);
    if (first.type !== 'mark_candidate') throw new Error('expected candidate');
    state.xiaoyueAgent = makeAgent({ candidate: { key: first.key, since: NOW - 120_000 } });
    state.warmupTopicAdvancedAt = NOW;

    expect(tick(state)).toEqual({ type: 'clear_candidate' });
  });

  it('pulse_low requires recent low self-report evidence and only a 30s window', () => {
    const state = makeState({
      pulseChecks: [{ userId: 'host', vibe: 1, createdAt: NOW - 1_000 }],
    });
    const first = tick(state);
    expect(first).toMatchObject({ type: 'mark_candidate', since: NOW });
    if (first.type !== 'mark_candidate') throw new Error('expected candidate');
    state.xiaoyueAgent = makeAgent({ candidate: { key: first.key, since: NOW } });

    expect(tick(state, NOW + 29_999)).toEqual({ type: 'none' });
    expect(tick(state, NOW + 30_000)).toMatchObject({
      type: 'create_ask',
      draft: { reason: 'pulse_low' },
    });
  });

  it('supports the recent average-vibe signal and ignores stale/legacy untimed pulses', () => {
    const averageLow = makeState({
      pulseChecks: [
        { userId: 'host', vibe: 1, createdAt: NOW - 2_000 },
        { userId: 'p2', vibe: 2, createdAt: NOW - 1_000 },
      ],
    });
    expect(deriveAgentSignals(averageLow, NOW).pulseLow).toBe(true);

    const stale = makeState({
      pulseChecks: [{ userId: 'host', vibe: 1, createdAt: NOW - 5 * MIN - 1 }],
    });
    const legacy = makeState({ pulseChecks: [{ userId: 'host', vibe: 1 }] });
    expect(tick(stale)).toEqual({ type: 'none' });
    expect(tick(legacy)).toEqual({ type: 'none' });
  });

  it('pending and accepted Ask states dedupe without an 8s timeout', () => {
    const pending = makeTopicStallState({ xiaoyueAgent: makeAgent({ ask: makeAsk() }) });
    expect(tick(pending, NOW + 8_000)).toEqual({ type: 'suppress', reason: 'pending_ask' });
    expect(tick(pending, NOW + 60_000)).toEqual({ type: 'suppress', reason: 'pending_ask' });

    const accepted = makeTopicStallState({
      xiaoyueAgent: makeAgent({ ask: makeAsk({ status: 'accepted' }) }),
    });
    expect(tick(accepted)).toEqual({ type: 'suppress', reason: 'pending_ask' });
  });

  it('expires a pending Ask on phase change without ignore or cooldown side effects', () => {
    const state = makeState({
      currentPhase: 'micro_challenge',
      xiaoyueAgent: makeAgent({ ask: makeAsk() }),
    });
    expect(tick(state)).toEqual({ type: 'expire_ask', askId: 'ask_test', reason: 'phase_changed' });
    expect(state.xiaoyueAgent?.policy.ignoredStreak).toBe(0);
    expect(state.xiaoyueAgent?.policy.cooldownUntilByKind).toEqual({});
  });

  it('expires a pending Ask when its topic revision evidence is stale', () => {
    const state = makeTopicStallState({
      warmupTopicSetRevision: 2,
      xiaoyueAgent: makeAgent({ ask: makeAsk() }),
    });
    expect(tick(state)).toEqual({ type: 'expire_ask', askId: 'ask_test', reason: 'evidence_stale' });
  });

  it('expires a pulse Ask after a positive pulse invalidates its evidence', () => {
    const state = makeState({
      pulseChecks: [{ userId: 'host', vibe: 3, createdAt: NOW }],
      xiaoyueAgent: makeAgent({
        ask: makeAsk({ reason: 'pulse_low', copy: getXiaoyueAgentAskCopy('pulse_low') }),
      }),
    });
    expect(tick(state)).toEqual({ type: 'expire_ask', askId: 'ask_test', reason: 'evidence_stale' });
  });

  it('enforces proactive closure, any-Ask cooldown, and same-kind cooldown boundaries', () => {
    expect(tick(makeTopicStallState({
      xiaoyueAgent: makeAgent({
        policy: {
          proactiveDisabled: true,
          ignoredStreak: 0,
          cooldownUntilByKind: {},
          askCount: 0,
          askCountByPhase: {},
        },
      }),
    }))).toEqual({ type: 'suppress', reason: 'proactive_disabled' });

    expect(tick(makeTopicStallState({
      xiaoyueAgent: makeAgent({
        policy: {
          proactiveDisabled: false,
          ignoredStreak: 0,
          cooldownUntilByKind: {},
          lastAskAt: NOW - 5 * MIN + 1,
          askCount: 0,
          askCountByPhase: {},
        },
      }),
    }))).toEqual({ type: 'suppress', reason: 'any_ask_cooldown' });

    expect(tick(makeTopicStallState({
      xiaoyueAgent: makeAgent({
        policy: {
          proactiveDisabled: false,
          ignoredStreak: 0,
          cooldownUntilByKind: { warmup_rotate_topics: NOW + 1 },
          askCount: 0,
          askCountByPhase: {},
        },
      }),
    }))).toEqual({ type: 'suppress', reason: 'kind_cooldown' });
  });

  it('auto-disables a legacy consecutive-ignore streak before creating another Ask', () => {
    const state = makeTopicStallState({
      xiaoyueAgent: makeAgent({
        policy: {
          proactiveDisabled: false,
          ignoredStreak: 2,
          cooldownUntilByKind: {},
          askCount: 0,
          askCountByPhase: {},
        },
      }),
    });
    expect(tick(state)).toEqual({ type: 'auto_disable', reason: 'ignored_streak' });
  });

  it('enforces per-session and per-phase Ask caps and topic generation suppression', () => {
    const sessionCap = makeAgent({
      policy: {
        proactiveDisabled: false,
        ignoredStreak: 0,
        cooldownUntilByKind: {},
        askCount: 3,
        askCountByPhase: {},
      },
    });
    expect(tick(makeTopicStallState({ xiaoyueAgent: sessionCap })))
      .toEqual({ type: 'suppress', reason: 'session_ask_cap' });

    const phaseCap = makeAgent({
      policy: {
        proactiveDisabled: false,
        ignoredStreak: 0,
        cooldownUntilByKind: {},
        askCount: 1,
        askCountByPhase: { warmup: 1 },
      },
    });
    expect(tick(makeTopicStallState({ xiaoyueAgent: phaseCap })))
      .toEqual({ type: 'suppress', reason: 'phase_ask_cap' });

    expect(tick(makeTopicStallState({ warmupTopicsStatus: 'generating' })))
      .toEqual({ type: 'suppress', reason: 'topics_generating' });
  });

  it('gates new proactive work at call/cost caps and performs conservative pre-call budget checks', () => {
    expect(tick(makeTopicStallState({
      xiaoyueAgent: makeAgent({ agentLlmCallCount: 18 }),
    }))).toEqual({ type: 'suppress', reason: 'llm_call_cap' });
    expect(tick(makeTopicStallState({
      xiaoyueAgent: makeAgent({ agentEstimatedCostYuan: 0.2 }),
    }))).toEqual({ type: 'suppress', reason: 'cost_budget_cap' });

    const at17 = makeTopicStallState({
      xiaoyueAgent: makeAgent({ agentLlmCallCount: 17, agentEstimatedCostYuan: 0.19 }),
    });
    expect(canUseAgentLlm(at17, 0.01)).toBe(true);
    expect(canUseAgentLlm(at17, 0.0104)).toBe(false);
    at17.xiaoyueAgent!.agentLlmCallCount = 18;
    expect(canUseAgentLlm(at17, 0)).toBe(false);

    const nearCostCap = makeTopicStallState({
      xiaoyueAgent: makeAgent({ agentEstimatedCostYuan: 0.199 }),
    });
    expect(canUseAgentLlm(nearCostCap, 0.001)).toBe(true);
    expect(canUseAgentLlm(nearCostCap, 0.0104)).toBe(false);
  });

  it('default thresholds include a 10 minute same-kind cooldown and hard cost limits', () => {
    expect(XIAOYUE_AGENT_DEFAULT_CONFIG.sameKindCooldownMs).toBeGreaterThanOrEqual(10 * MIN);
    expect(XIAOYUE_AGENT_DEFAULT_CONFIG.maxAgentLlmCalls).toBe(18);
    expect(XIAOYUE_AGENT_DEFAULT_CONFIG.maxAgentEstimatedCostYuan).toBe(0.2);
  });
});

describe('xiaoyueAgentPolicy — persisted decision semantics', () => {
  it('ignored increments the streak and sets exactly a 10 minute cooldown', () => {
    const state = makeTopicStallState({ xiaoyueAgent: makeAgent({ ask: makeAsk() }) });
    const next = applyXiaoyueAgentAskDecision(state, 'ignored', NOW);

    expect(next.xiaoyueAgent?.ask?.status).toBe('ignored');
    expect(next.xiaoyueAgent?.ask?.decisionAt).toBe(NOW);
    expect(next.xiaoyueAgent?.policy.ignoredStreak).toBe(1);
    expect(next.xiaoyueAgent?.policy.cooldownUntilByKind.warmup_rotate_topics).toBe(NOW + 10 * MIN);
    expect(next.xiaoyueAgent?.policy.proactiveDisabled).toBe(false);
    expect(state.xiaoyueAgent?.ask?.status).toBe('pending');
  });

  it('a second consecutive ignore closes proactive suggestions for this session', () => {
    const state = makeTopicStallState({
      xiaoyueAgent: makeAgent({
        ask: makeAsk(),
        policy: {
          proactiveDisabled: false,
          ignoredStreak: 1,
          cooldownUntilByKind: {},
          askCount: 1,
          askCountByPhase: { warmup: 1 },
        },
      }),
    });
    const next = applyXiaoyueAgentAskDecision(state, 'ignored', NOW);
    expect(next.xiaoyueAgent?.policy.ignoredStreak).toBe(2);
    expect(next.xiaoyueAgent?.policy.proactiveDisabled).toBe(true);
  });

  it('expired and action_failed_dismissed are not negative feedback and never cool down', () => {
    for (const decision of ['expired', 'action_failed_dismissed'] as const) {
      const state = makeTopicStallState({ xiaoyueAgent: makeAgent({ ask: makeAsk() }) });
      const next = applyXiaoyueAgentAskDecision(state, decision, NOW);
      expect(next.xiaoyueAgent?.ask?.status).toBe(decision);
      expect(next.xiaoyueAgent?.policy.ignoredStreak).toBe(0);
      expect(next.xiaoyueAgent?.policy.cooldownUntilByKind).toEqual({});
      expect(next.xiaoyueAgent?.policy.proactiveDisabled).toBe(false);
    }
  });

  it('closed_session disables proactive suggestions without fabricating an ignore', () => {
    const state = makeTopicStallState({ xiaoyueAgent: makeAgent({ ask: makeAsk() }) });
    const next = applyXiaoyueAgentAskDecision(state, 'closed_session', NOW);
    expect(next.xiaoyueAgent?.ask?.status).toBe('closed_session');
    expect(next.xiaoyueAgent?.policy.proactiveDisabled).toBe(true);
    expect(next.xiaoyueAgent?.policy.ignoredStreak).toBe(0);
    expect(next.xiaoyueAgent?.policy.cooldownUntilByKind).toEqual({});
  });
});

describe('Xiaoyue curated Ask copy', () => {
  it('has exactly the four UI-approved templates and no runtime LLM wording', () => {
    expect(Object.keys(XIAOYUE_AGENT_ASK_COPY_BY_REASON)).toEqual([
      'default',
      'phase_overrun',
      'topic_stall',
      'pulse_low',
    ]);
    expect(Object.values(XIAOYUE_AGENT_ASK_COPY_BY_REASON).map((copy) => copy.question)).toEqual([
      '这组话题不太好接吗？可以换一组。',
      '想换个话题继续吗？我可以换一组。',
      '这组先聊到这里吗？换一组新话题就好。',
      '刚才感觉不太顺，要换一组话题吗？',
    ]);
    expect(getXiaoyueAgentAskCopy('phase_overrun').kicker).toBe('悦仔想确认一下');
    expect(getXiaoyueAgentAskCopy('default').hint).toBe('你确认后，全桌一起换新');
    expect(getXiaoyueAgentAskCopy('default').cta).toBe('换一组话题卡');
  });

  it('contains no surveillance, cold-room claims, forbidden visible AI wording, or emoji', () => {
    const visible = Object.values(XIAOYUE_AGENT_ASK_COPY_BY_REASON)
      .flatMap((copy) => Object.values(copy))
      .join('\n');
    expect(visible).not.toMatch(/检测到冷场|大家参与度下降|我观察到没人说话|智能分析|AI|算法判断|实时监控|匹配|社交|灵魂|撮合/);
    expect(visible).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('create_ask uses deterministic curated metadata with the AIGC label fail-closed', () => {
    const state = makeTopicStallState();
    const first = tick(state);
    if (first.type !== 'mark_candidate') throw new Error('expected candidate');
    state.xiaoyueAgent = makeAgent({ candidate: { key: first.key, since: NOW } });
    const decision = tick(state, NOW + 60_000);
    if (decision.type !== 'create_ask') throw new Error('expected create_ask');

    expect(decision.draft.meta).toEqual({
      generatedAt: new Date(NOW + 60_000).toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: true,
      promptVersion: 'social-xiaoyue-agent-ask-curated-v1',
      aigc: { aiGenerated: false },
    });
  });
});
