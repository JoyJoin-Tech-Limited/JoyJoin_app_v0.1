import { describe, expect, it } from 'vitest';
import type {
  SocialIcebreakerPhase,
  SocialSessionState,
  XiaoyueAgentAsk,
  XiaoyueAgentReason,
  XiaoyueAgentState,
} from '@shared/socialIcebreaker';
import fixture from './fixtures/xiaoyueAgentGoldenSessions.json';
import {
  applyXiaoyueAgentAskDecision,
  decideAgentTick,
} from '../lib/xiaoyueAgentPolicy';

const BASE_NOW = 1_800_000_000_000;
const TWENTY_MINUTES_SECONDS = 1_200;

type ScenarioCategory = 'stuck' | 'control' | 'boundary';
type ReplayDecision = 'ignored' | 'expired' | 'closed_session' | 'action_failed_dismissed';

interface ReplayEvent {
  t: number;
  type: string;
  payload?: Record<string, unknown>;
}

interface GoldenScenario {
  id: string;
  category: ScenarioCategory;
  healthyQuiet: boolean;
  durationSeconds: number;
  initialState: Record<string, unknown>;
  events: ReplayEvent[];
  expected: {
    ask: 'never' | { byT: number; reason: XiaoyueAgentReason };
    maxAsks: number;
    finalAskStatus?: XiaoyueAgentAsk['status'];
    finalIgnoredStreak?: number;
    finalProactiveDisabled?: boolean;
    minimumCooldownMs?: number;
    expectNoKindCooldown?: boolean;
    finalPhase?: SocialIcebreakerPhase;
  };
}

interface ReplayResult {
  scenario: GoldenScenario;
  finalState: SocialSessionState;
  asks: Array<{ t: number; reason: XiaoyueAgentReason }>;
  lastDecisionAt?: number;
}

const scenarios = fixture.scenarios as unknown as GoldenScenario[];

const RELATIVE_TIMESTAMP_KEYS = new Set([
  'phaseStartedAt',
  'sessionStartedAt',
  'warmupTopicSetUpdatedAt',
  'warmupTopicAdvancedAt',
  'warmupTopicsGeneratingAt',
  'createdAt',
  'decisionAt',
  'startedAt',
  'finishedAt',
  'lastAskAt',
  'since',
]);

/** Fixture timestamps are readable relative seconds; production policy always
 * receives absolute epoch milliseconds through its injected `now`. */
function materializeRelativeTimes(value: unknown, key?: string, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => materializeRelativeTimes(entry, key, parentKey));
  }
  if (typeof value === 'number' && (RELATIVE_TIMESTAMP_KEYS.has(key ?? '') || parentKey === 'cooldownUntilByKind')) {
    return BASE_NOW + value * 1_000;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        materializeRelativeTimes(childValue, childKey, key),
      ]),
    );
  }
  return value;
}

function defaultPolicy(): XiaoyueAgentState['policy'] {
  return {
    proactiveDisabled: false,
    ignoredStreak: 0,
    cooldownUntilByKind: {},
    askCount: 0,
    askCountByPhase: {},
  };
}

function ensureAgent(state: SocialSessionState): XiaoyueAgentState {
  return state.xiaoyueAgent ?? {
    policy: defaultPolicy(),
    agentLlmCallCount: 0,
    agentEstimatedCostYuan: 0,
  };
}

function makeInitialState(scenario: GoldenScenario): SocialSessionState {
  const overrides = materializeRelativeTimes(scenario.initialState) as Partial<SocialSessionState>;
  const state: SocialSessionState = {
    socialSessionId: `social_${scenario.id}`,
    icebreakerSessionId: scenario.id,
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    activePlayerCount: 6,
    phaseStartedAt: BASE_NOW,
    sessionStartedAt: BASE_NOW,
    completedPhases: [],
    warmupTopics: [
      { id: 'golden-1', question: 'Q1', mood: 'relaxed', emoji: '' },
      { id: 'golden-2', question: 'Q2', mood: 'relaxed', emoji: '' },
      { id: 'golden-3', question: 'Q3', mood: 'relaxed', emoji: '' },
      { id: 'golden-4', question: 'Q4', mood: 'relaxed', emoji: '' },
    ],
    warmupTopicsStatus: 'ready',
    currentTopicIndex: 0,
    warmupReadyUserIds: [],
    warmupTopicSetRevision: 1,
    warmupTopicSetUpdatedAt: BASE_NOW,
    warmupTopicAdvancedAt: BASE_NOW,
    warmupTopicSetProvenance: 'precompile',
    runPlan: {
      version: 2,
      segments: [
        { phase: 'warmup', allocatedMinutes: 20, energyWeight: 1 },
        { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
      ],
      totalMinutes: 30,
      compiledAt: '2026-10-26T00:00:00.000Z',
      compilerId: 'golden-replay',
    },
    ...overrides,
  };

  if (overrides.xiaoyueAgent) {
    state.xiaoyueAgent = {
      ...overrides.xiaoyueAgent,
      policy: {
        ...defaultPolicy(),
        ...overrides.xiaoyueAgent.policy,
        cooldownUntilByKind: {
          ...overrides.xiaoyueAgent.policy?.cooldownUntilByKind,
        },
      },
    };
  }
  return state;
}

function applyEvent(state: SocialSessionState, event: ReplayEvent, now: number): SocialSessionState {
  const payload = event.payload ?? {};
  switch (event.type) {
    case 'network_retry':
      return state;
    case 'rejoin':
      return state;
    case 'active_rate':
      state.activePlayerCount = payload.activePlayerCount as number;
      return state;
    case 'ready':
      state.warmupReadyUserIds = [...(payload.userIds as string[])];
      return state;
    case 'complete':
      state.challengeCompletedBy = [...(payload.userIds as string[])];
      return state;
    case 'pulse': {
      const userId = payload.userId as string;
      const vibe = payload.vibe as 1 | 2 | 3;
      const pulses = [...(state.pulseChecks ?? [])];
      const index = pulses.findIndex((pulse) => pulse.userId === userId);
      const next = { userId, vibe, createdAt: now };
      if (index >= 0) pulses[index] = next;
      else pulses.push(next);
      state.pulseChecks = pulses;
      return state;
    }
    case 'topic_advanced':
      state.currentTopicIndex = (state.currentTopicIndex ?? 0) + 1;
      state.warmupTopicAdvancedAt = now;
      state.warmupReadyUserIds = [];
      return state;
    case 'topics_ready':
      state.warmupTopicsStatus = 'ready';
      state.warmupTopicsGeneratingAt = undefined;
      state.warmupTopicAdvancedAt = now;
      return state;
    case 'phase_changed':
      state.currentPhase = payload.phase as SocialIcebreakerPhase;
      state.phaseStartedAt = now;
      state.pulseChecks = [];
      return state;
    case 'ask_decision':
      return applyXiaoyueAgentAskDecision(state, payload.decision as ReplayDecision, now);
    default:
      throw new Error(`Unknown golden event type ${event.type} in ${state.socialSessionId}`);
  }
}

function replay(scenario: GoldenScenario): ReplayResult {
  let state = makeInitialState(scenario);
  let viewerIsHost = true;
  let flagEnabled = true;
  let lastDecisionAt: number | undefined;
  const asks: ReplayResult['asks'] = [];
  const eventsByTime = new Map<number, ReplayEvent[]>();
  for (const event of scenario.events) {
    eventsByTime.set(event.t, [...(eventsByTime.get(event.t) ?? []), event]);
  }

  for (let t = 0; t <= scenario.durationSeconds; t += fixture.tickIntervalSeconds) {
    const now = BASE_NOW + t * 1_000;
    for (const event of eventsByTime.get(t) ?? []) {
      if (event.type === 'rejoin') {
        viewerIsHost = event.payload?.viewerIsHost !== false;
        continue;
      }
      if (event.type === 'flag') {
        flagEnabled = event.payload?.enabled === true;
        continue;
      }
      if (event.type === 'ask_decision') lastDecisionAt = t;
      state = applyEvent(state, event, now);
    }

    const decision = decideAgentTick({ state, now, viewerIsHost, flagEnabled });
    switch (decision.type) {
      case 'none':
      case 'suppress':
        break;
      case 'mark_candidate': {
        const agent = ensureAgent(state);
        state.xiaoyueAgent = {
          ...agent,
          candidate: { key: decision.key, since: decision.since },
        };
        break;
      }
      case 'clear_candidate': {
        if (state.xiaoyueAgent) {
          const { candidate: _candidate, ...agent } = state.xiaoyueAgent;
          state.xiaoyueAgent = agent;
        }
        break;
      }
      case 'expire_ask':
        state = applyXiaoyueAgentAskDecision(state, 'expired', now);
        break;
      case 'auto_disable': {
        const agent = ensureAgent(state);
        state.xiaoyueAgent = {
          ...agent,
          policy: { ...agent.policy, proactiveDisabled: true },
        };
        break;
      }
      case 'create_ask': {
        const agent = ensureAgent(state);
        const askNumber = agent.policy.askCount + 1;
        const ask: XiaoyueAgentAsk = {
          ...decision.draft,
          id: `ask_${scenario.id}_${askNumber}`,
          createdAt: now,
          status: 'pending',
        };
        state.xiaoyueAgent = {
          ...agent,
          ask,
          candidate: undefined,
          policy: {
            ...agent.policy,
            lastAskAt: now,
            askCount: askNumber,
            askCountByPhase: {
              ...agent.policy.askCountByPhase,
              [ask.phase]: (agent.policy.askCountByPhase[ask.phase] ?? 0) + 1,
            },
          },
        };
        asks.push({ t, reason: ask.reason });
        break;
      }
    }
  }

  return { scenario, finalState: state, asks, lastDecisionAt };
}

const results = scenarios.map(replay);
const resultById = new Map(results.map((result) => [result.scenario.id, result]));

describe('xiaoyueAgentGoldenReplay — 20 deterministic timelines (AC-01/AC-02)', () => {
  it('locks the 8 positive + 8 control (4 healthy quiet) + 4 boundary composition', () => {
    expect(scenarios).toHaveLength(20);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(20);
    expect(new Set(scenarios.map((scenario) => JSON.stringify(scenario.initialState))).size).toBe(20);
    expect(scenarios.filter((scenario) => scenario.category === 'stuck')).toHaveLength(8);
    expect(scenarios.filter((scenario) => scenario.category === 'control')).toHaveLength(8);
    expect(scenarios.filter((scenario) => scenario.category === 'boundary')).toHaveLength(4);
    expect(scenarios.filter((scenario) => scenario.healthyQuiet).length).toBeGreaterThanOrEqual(4);
  });

  it('aggregates stuck-scene recall at >=90% with the expected reason and deadline', () => {
    const stuck = results.filter((result) => result.scenario.category === 'stuck');
    const recalled = stuck.filter((result) => {
      const expected = result.scenario.expected.ask;
      const first = result.asks[0];
      return expected !== 'never' && first && first.t <= expected.byT && first.reason === expected.reason;
    });
    const recall = recalled.length / stuck.length;

    expect({ recalled: recalled.length, total: stuck.length, recall }).toEqual({
      recalled: 8,
      total: 8,
      recall: 1,
    });
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps healthy-quiet erroneous Asks at <=1 per 20 minutes and activeRate drops at zero', () => {
    const healthy = results.filter((result) => result.scenario.healthyQuiet);
    const errorRates = healthy.map((result) => ({
      id: result.scenario.id,
      asksPer20Minutes: result.asks.length * TWENTY_MINUTES_SECONDS / result.scenario.durationSeconds,
    }));

    expect(errorRates).toHaveLength(4);
    for (const metric of errorRates) {
      expect(metric.asksPer20Minutes, metric.id).toBeLessThanOrEqual(1);
    }
    expect(resultById.get('control_01_healthy_quiet_active_rate_drop_only')?.asks).toHaveLength(0);
    expect(resultById.get('control_02_healthy_quiet_zero_presence_with_steady_cards')?.asks).toHaveLength(0);
  });

  it('honours every fixture expected Ask count, including micro_challenge and cost-cap controls', () => {
    for (const result of results) {
      expect(result.asks, result.scenario.id).toHaveLength(result.scenario.expected.maxAsks);
      if (result.scenario.expected.ask === 'never') {
        expect(result.asks, result.scenario.id).toHaveLength(0);
      }
    }
    expect(resultById.get('control_05_micro_challenge_overrun_is_observation_only')?.asks).toHaveLength(0);
    expect(resultById.get('control_08_cost_cap_stops_new_proactive_work')?.asks).toHaveLength(0);
  });

  it('proves ignored cooldown is >=10min and closed/expired/failure-dismissed stay distinct', () => {
    const ignored = resultById.get('stuck_05_pulse_has_priority_over_overrun_then_ignored')!;
    expect(ignored.finalState.xiaoyueAgent?.ask?.status).toBe('ignored');
    const ignoredCooldown = ignored.finalState.xiaoyueAgent?.policy.cooldownUntilByKind.warmup_rotate_topics;
    expect(ignoredCooldown).toBeDefined();
    expect(ignoredCooldown! - (BASE_NOW + ignored.lastDecisionAt! * 1_000))
      .toBeGreaterThanOrEqual(10 * 60_000);

    const failed = resultById.get('boundary_01_weak_network_failure_dismiss_is_not_ignore')!;
    expect(failed.finalState.xiaoyueAgent?.ask?.status).toBe('action_failed_dismissed');
    expect(failed.finalState.xiaoyueAgent?.policy.ignoredStreak).toBe(0);
    expect(failed.finalState.xiaoyueAgent?.policy.cooldownUntilByKind).toEqual({});

    const expired = resultById.get('boundary_03_phase_change_expires_pending_without_penalty')!;
    expect(expired.finalState.xiaoyueAgent?.ask?.status).toBe('expired');
    expect(expired.finalState.xiaoyueAgent?.policy.ignoredStreak).toBe(0);
    expect(expired.finalState.xiaoyueAgent?.policy.cooldownUntilByKind).toEqual({});

    const closed = resultById.get('boundary_04_single_test_close_never_auto_advances')!;
    expect(closed.finalState.xiaoyueAgent?.ask?.status).toBe('closed_session');
    expect(closed.finalState.xiaoyueAgent?.policy.proactiveDisabled).toBe(true);
    expect(closed.finalState.xiaoyueAgent?.policy.ignoredStreak).toBe(0);
    expect(closed.finalState.xiaoyueAgent?.policy.cooldownUntilByKind).toEqual({});
  });

  it('weak-network/rejoin paths never duplicate Ask and never auto-advance a phase', () => {
    expect(resultById.get('boundary_01_weak_network_failure_dismiss_is_not_ignore')?.asks).toHaveLength(1);
    const rejoined = resultById.get('boundary_02_rejoin_pending_never_duplicates_or_times_out')!;
    expect(rejoined.asks).toHaveLength(1);
    expect(rejoined.finalState.xiaoyueAgent?.ask?.status).toBe('pending');

    for (const result of results) {
      if (result.scenario.expected.finalPhase) {
        expect(result.finalState.currentPhase, result.scenario.id).toBe(result.scenario.expected.finalPhase);
      }
      if (result.scenario.expected.finalAskStatus) {
        expect(result.finalState.xiaoyueAgent?.ask?.status, result.scenario.id)
          .toBe(result.scenario.expected.finalAskStatus);
      }
      if (result.scenario.expected.finalIgnoredStreak !== undefined) {
        expect(result.finalState.xiaoyueAgent?.policy.ignoredStreak, result.scenario.id)
          .toBe(result.scenario.expected.finalIgnoredStreak);
      }
      if (result.scenario.expected.finalProactiveDisabled !== undefined) {
        expect(result.finalState.xiaoyueAgent?.policy.proactiveDisabled, result.scenario.id)
          .toBe(result.scenario.expected.finalProactiveDisabled);
      }
      if (result.scenario.expected.expectNoKindCooldown) {
        expect(result.finalState.xiaoyueAgent?.policy.cooldownUntilByKind, result.scenario.id)
          .toEqual({});
      }
    }
  });
});
