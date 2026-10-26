/**
 * Xiaoyue Agent M1 — deterministic policy kernel.
 *
 * PURE by contract: no LLM, no DB, no ambient clock, no network, no mutation.
 * The spine decides what is legal; the model (later) may only word a decision
 * that this file already made. Four legal runtime decisions:
 *   observe → ask → execute → stop
 *
 * Hard boundaries:
 * - Active in-app rate is recorded but NEVER triggers an Ask. A table that is
 *   talking happily has low app activity; treating silence as cold-room would
 *   interrupt exactly the good moments.
 * - Only warmup has a real action in M1. micro_challenge is observation-only:
 *   no Ask that would require the host to do the work anyway (no fake loop).
 */

import type {
  PulseCheckResult,
  SocialIcebreakerPhase,
  SocialSessionState,
  XiaoyueAgentAsk,
  XiaoyueAgentReason,
} from '@shared/socialIcebreaker';
import { getXiaoyueAgentAskCopy } from '@shared/copy/icebreakerSession';

const MINUTE_MS = 60_000;

export const XIAOYUE_AGENT_DEFAULT_CONFIG = {
  sameKindCooldownMs: 10 * MINUTE_MS,
  anyAskCooldownMs: 5 * MINUTE_MS,
  maxAsksPerSession: 3,
  maxAsksPerPhase: 1,
  maxAgentLlmCalls: 18,
  maxAgentEstimatedCostYuan: 0.2,
  phaseOverrunRatio: 1.25,
  phaseOverrunSustainMs: 60_000,
  topicStallMs: 180_000,
  topicStallSustainMs: 60_000,
  pulseLowSustainMs: 30_000,
  pulseWindowMs: 5 * MINUTE_MS,
  warmupBudgetMinutes: 20,
  microChallengeBudgetMinutes: 10,
} as const;

export type XiaoyueAgentConfig = typeof XIAOYUE_AGENT_DEFAULT_CONFIG;

export type XiaoyueAgentPersistedDecision =
  | 'ignored'
  | 'expired'
  | 'closed_session'
  | 'action_failed_dismissed';

export interface XiaoyueAgentSignals {
  phase: SocialIcebreakerPhase;
  phaseElapsedMs: number;
  phaseBudgetMs: number;
  phaseOverrun: boolean;
  topicStall: boolean;
  topicStalledMs: number;
  pulseLow: boolean;
  pulsePositive: boolean;
  latestPulseAt?: number;
  activeRate: number;
  activePlayerCount: number;
  playerCount: number;
}

export interface XiaoyueAgentTickInput {
  state: SocialSessionState;
  now: number;
  viewerIsHost: boolean;
  flagEnabled: boolean;
  config?: Partial<XiaoyueAgentConfig>;
}

export type XiaoyueAgentTickDecision =
  | { type: 'none' }
  | { type: 'suppress'; reason: string }
  | { type: 'mark_candidate'; key: string; since: number }
  | { type: 'clear_candidate' }
  | { type: 'expire_ask'; askId: string; reason: 'phase_changed' | 'evidence_stale' }
  | { type: 'auto_disable'; reason: 'ignored_streak' }
  | {
      type: 'create_ask';
      draft: Omit<XiaoyueAgentAsk, 'id' | 'createdAt' | 'status'>;
    };

function resolveConfig(overrides?: Partial<XiaoyueAgentConfig>): XiaoyueAgentConfig {
  return { ...XIAOYUE_AGENT_DEFAULT_CONFIG, ...(overrides ?? {}) } as XiaoyueAgentConfig;
}

function phaseBudgetMs(phase: SocialIcebreakerPhase, state: SocialSessionState, config: XiaoyueAgentConfig): number {
  const planned = state.runPlan?.segments?.find((segment) => segment.phase === phase);
  if (planned && Number.isFinite(planned.allocatedMinutes) && planned.allocatedMinutes > 0) {
    return planned.allocatedMinutes * MINUTE_MS;
  }
  if (phase === 'micro_challenge') return config.microChallengeBudgetMinutes * MINUTE_MS;
  return config.warmupBudgetMinutes * MINUTE_MS;
}

function recentPulses(state: SocialSessionState, now: number, windowMs: number): PulseCheckResult[] {
  return (state.pulseChecks ?? []).filter((pulse) => {
    if (!Number.isFinite(pulse.createdAt as number)) return false;
    const createdAt = pulse.createdAt as number;
    const age = now - createdAt;
    return age >= 0 && age <= windowMs;
  });
}

function latestPulse(pulses: PulseCheckResult[]): PulseCheckResult | undefined {
  let latest: PulseCheckResult | undefined;
  for (const pulse of pulses) {
    if (!latest || (pulse.createdAt as number) >= (latest.createdAt as number)) latest = pulse;
  }
  return latest;
}

export function deriveAgentSignals(
  state: SocialSessionState,
  now: number,
  configOverrides?: Partial<XiaoyueAgentConfig>,
): XiaoyueAgentSignals {
  const config = resolveConfig(configOverrides);
  const budgetMs = phaseBudgetMs(state.currentPhase, state, config);
  const phaseElapsedMs = Math.max(0, now - state.phaseStartedAt);
  const topicAnchor = state.warmupTopicAdvancedAt ?? state.phaseStartedAt;
  const topicStalledMs = Math.max(0, now - topicAnchor);

  const recent = recentPulses(state, now, config.pulseWindowMs);
  const latest = latestPulse(recent);
  const averageVibe = recent.length
    ? recent.reduce((sum, pulse) => sum + pulse.vibe, 0) / recent.length
    : undefined;
  const pulseLow = Boolean(
    latest && (latest.vibe === 1 || (averageVibe !== undefined && averageVibe <= 1.5)),
  );
  const pulsePositive = latest?.vibe === 3;

  const playerCount = Math.max(0, state.playerCount ?? 0);
  const activePlayerCount = Math.max(0, state.activePlayerCount ?? 0);
  const activeRate = playerCount > 0 ? activePlayerCount / playerCount : 0;

  return {
    phase: state.currentPhase,
    phaseElapsedMs,
    phaseBudgetMs: budgetMs,
    phaseOverrun: phaseElapsedMs >= budgetMs * config.phaseOverrunRatio,
    topicStall: state.currentPhase === 'warmup' && topicStalledMs >= config.topicStallMs,
    topicStalledMs,
    pulseLow,
    pulsePositive,
    latestPulseAt: latest?.createdAt as number | undefined,
    activeRate,
    activePlayerCount,
    playerCount,
  };
}

const OBSERVED_PHASES: ReadonlySet<SocialIcebreakerPhase> = new Set<SocialIcebreakerPhase>([
  'warmup',
  'micro_challenge',
]);

function isOpenAskStatus(status: XiaoyueAgentAsk['status']): boolean {
  return status === 'pending' || status === 'accepted' || status === 'executing';
}

function pendingAskExpiry(
  state: SocialSessionState,
  ask: XiaoyueAgentAsk,
): 'phase_changed' | 'evidence_stale' | null {
  if (ask.status !== 'pending') return null;
  if (ask.phase !== state.currentPhase) return 'phase_changed';
  if (ask.kind === 'warmup_rotate_topics') {
    const revision = state.warmupTopicSetRevision ?? 0;
    if (revision !== ask.baseTopicSetRevision) return 'evidence_stale';
  }
  return null;
}

/** Candidate for the highest-priority active signal (pulse > overrun > stall). */
function activeCandidate(
  signals: XiaoyueAgentSignals,
  config: XiaoyueAgentConfig,
): { key: string; reason: XiaoyueAgentReason; requiredMs: number } | null {
  if (signals.phase !== 'warmup') return null;
  if (signals.pulseLow) {
    return { key: 'warmup:pulse_low', reason: 'pulse_low', requiredMs: config.pulseLowSustainMs };
  }
  if (signals.phaseOverrun) {
    return {
      key: 'warmup:phase_overrun',
      reason: 'phase_overrun',
      requiredMs: config.phaseOverrunSustainMs,
    };
  }
  if (signals.topicStall) {
    return {
      key: 'warmup:topic_stall',
      reason: 'topic_stall',
      requiredMs: config.topicStallSustainMs,
    };
  }
  return null;
}

export function decideAgentTick(input: XiaoyueAgentTickInput): XiaoyueAgentTickDecision {
  const { state, now, viewerIsHost, flagEnabled } = input;
  const config = resolveConfig(input.config);

  // 1. Kill switch and role gate come first: flag-off is byte-identical legacy
  //    behaviour, and participants never compute candidates.
  if (!flagEnabled) return { type: 'suppress', reason: 'flag_off' };
  if (!viewerIsHost) return { type: 'suppress', reason: 'not_host' };

  // 2. Closed sessions.
  const expiresAtMs = state.expiresAt ? Date.parse(state.expiresAt) : NaN;
  if (state.currentPhase === 'recap' || (Number.isFinite(expiresAtMs) && expiresAtMs < now)) {
    return { type: 'suppress', reason: 'session_closed' };
  }
  if (!OBSERVED_PHASES.has(state.currentPhase)) {
    return { type: 'suppress', reason: 'phase_not_observed' };
  }

  const agent = state.xiaoyueAgent;
  const ask = agent?.ask;

  // 3. Pending Ask maintenance: phase change and stale topic evidence expire
  //    WITHOUT penalty (expired ≠ ignored).
  if (ask) {
    const expiry = pendingAskExpiry(state, ask);
    if (expiry) return { type: 'expire_ask', askId: ask.id, reason: expiry };
    if (ask.status === 'pending' && ask.reason === 'pulse_low') {
      const signals = deriveAgentSignals(state, now, input.config);
      if (signals.pulsePositive) {
        return { type: 'expire_ask', askId: ask.id, reason: 'evidence_stale' };
      }
    }
    if (isOpenAskStatus(ask.status)) return { type: 'suppress', reason: 'pending_ask' };
  }

  // 4. micro_challenge is observation-only in M1: no second real action exists,
  //    so an Ask would promise a loop we cannot close.
  if (state.currentPhase !== 'warmup') {
    return { type: 'suppress', reason: 'observation_only_phase' };
  }

  const policy = agent?.policy;
  if (policy?.proactiveDisabled) return { type: 'suppress', reason: 'proactive_disabled' };
  if ((policy?.ignoredStreak ?? 0) >= 2) return { type: 'auto_disable', reason: 'ignored_streak' };

  if (policy?.lastAskAt !== undefined && now - policy.lastAskAt < config.anyAskCooldownMs) {
    return { type: 'suppress', reason: 'any_ask_cooldown' };
  }

  const kindCooldownUntil = policy?.cooldownUntilByKind?.warmup_rotate_topics;
  if (kindCooldownUntil !== undefined && now < kindCooldownUntil) {
    return { type: 'suppress', reason: 'kind_cooldown' };
  }

  if ((policy?.askCount ?? 0) >= config.maxAsksPerSession) {
    return { type: 'suppress', reason: 'session_ask_cap' };
  }
  if ((policy?.askCountByPhase?.warmup ?? 0) >= config.maxAsksPerPhase) {
    return { type: 'suppress', reason: 'phase_ask_cap' };
  }
  if (state.warmupTopicsStatus === 'generating') {
    return { type: 'suppress', reason: 'topics_generating' };
  }
  if ((agent?.agentLlmCallCount ?? 0) >= config.maxAgentLlmCalls) {
    return { type: 'suppress', reason: 'llm_call_cap' };
  }
  if ((agent?.agentEstimatedCostYuan ?? 0) >= config.maxAgentEstimatedCostYuan) {
    return { type: 'suppress', reason: 'cost_budget_cap' };
  }

  const signals = deriveAgentSignals(state, now, input.config);
  const active = activeCandidate(signals, config);
  const candidate = agent?.candidate;

  if (!active) {
    return candidate ? { type: 'clear_candidate' } : { type: 'none' };
  }

  if (!candidate || candidate.key !== active.key) {
    return { type: 'mark_candidate', key: active.key, since: now };
  }

  if (now - candidate.since < active.requiredMs) return { type: 'none' };

  return {
    type: 'create_ask',
    draft: {
      kind: 'warmup_rotate_topics',
      phase: 'warmup',
      reason: active.reason,
      baseTopicSetRevision: state.warmupTopicSetRevision ?? 0,
      copy: getXiaoyueAgentAskCopy(active.reason),
      meta: {
        generatedAt: new Date(now).toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: true,
        promptVersion: 'social-xiaoyue-agent-ask-curated-v1',
        aigc: { aiGenerated: false },
      },
    },
  };
}

/**
 * Conservative pre-call budget check (R2 AC-15). Callers MUST run this before
 * any agent LLM call: if the next conservative estimate would exceed either
 * cap, the action degrades to curated-only with zero LLM calls.
 */
export function canUseAgentLlm(
  state: SocialSessionState,
  nextEstimateYuan: number,
  configOverrides?: Partial<XiaoyueAgentConfig>,
): boolean {
  const config = resolveConfig(configOverrides);
  const agent = state.xiaoyueAgent;
  const calls = agent?.agentLlmCallCount ?? 0;
  const cost = agent?.agentEstimatedCostYuan ?? 0;
  if (calls >= config.maxAgentLlmCalls) return false;
  const estimate = Number.isFinite(nextEstimateYuan) ? Math.max(0, nextEstimateYuan) : Infinity;
  // Floating point tolerance: exactly at the cap is allowed, above is not.
  return cost + estimate <= config.maxAgentEstimatedCostYuan + Number.EPSILON * 100;
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Persist a decision on the current Ask. Pure: returns the next session state
 * and never touches the input. `ignored` is the ONLY negative-feedback path;
 * `expired` and `action_failed_dismissed` must not cool down or disable.
 */
export function applyXiaoyueAgentAskDecision(
  state: SocialSessionState,
  decision: XiaoyueAgentPersistedDecision,
  now: number,
  configOverrides?: Partial<XiaoyueAgentConfig>,
): SocialSessionState {
  const config = resolveConfig(configOverrides);
  const next = cloneState(state);
  const agent = next.xiaoyueAgent;
  if (!agent?.ask) return next;

  const ask = agent.ask;
  ask.decisionAt = now;

  switch (decision) {
    case 'ignored': {
      ask.status = 'ignored';
      agent.policy.ignoredStreak = (agent.policy.ignoredStreak ?? 0) + 1;
      agent.policy.cooldownUntilByKind = {
        ...agent.policy.cooldownUntilByKind,
        [ask.kind]: now + config.sameKindCooldownMs,
      };
      if (agent.policy.ignoredStreak >= 2) agent.policy.proactiveDisabled = true;
      break;
    }
    case 'closed_session': {
      ask.status = 'closed_session';
      agent.policy.proactiveDisabled = true;
      break;
    }
    case 'expired':
    case 'action_failed_dismissed': {
      ask.status = decision;
      break;
    }
  }

  return next;
}
