import { describe, it, expect } from 'vitest';
import {
  computePulseSignals,
  generateXiaoyueAdaptiveSuggestion,
} from '../xiaoyueAdaptiveEngine';
import type { SocialSessionState } from '@shared/socialIcebreaker';

function makeBaseState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  const now = Date.now();
  return {
    socialSessionId: 'test-session',
    icebreakerSessionId: 'ice-test',
    currentPhase: 'warmup',
    hostUserId: 'host1',
    hostDisplayName: 'Host',
    playerCount: 4,
    activePlayerCount: 4,
    phaseStartedAt: now - 3 * 60 * 1000, // 3 minutes ago
    sessionStartedAt: now - 5 * 60 * 1000,
    completedPhases: [],
    warmupReadyUserIds: [],
    pulseChecks: [],
    ...overrides,
  } as SocialSessionState;
}

describe('computePulseSignals', () => {
  it('computes basic signals for a fresh session', () => {
    const state = makeBaseState();
    const signals = computePulseSignals(state);

    expect(signals.phaseElapsedMinutes).toBeGreaterThanOrEqual(2.9);
    expect(signals.phaseElapsedMinutes).toBeLessThanOrEqual(3.1);
    expect(signals.activeRate).toBe(1);
    expect(signals.completionRate).toBe(0);
    expect(signals.avgVibe).toBe(0);
    expect(signals.playerCount).toBe(4);
    expect(signals.pulseCheckCount).toBe(0);
  });

  it('computes completion rate for warmup based on readyUserIds', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      warmupReadyUserIds: ['u1', 'u2', 'u3'],
      playerCount: 4,
    });
    const signals = computePulseSignals(state);
    expect(signals.completionRate).toBe(0.75);
  });

  it('computes completion rate for micro_challenge', () => {
    const state = makeBaseState({
      currentPhase: 'micro_challenge',
      challengeCompletedBy: ['u1'],
      playerCount: 4,
    });
    const signals = computePulseSignals(state);
    expect(signals.completionRate).toBe(0.25);
  });

  it('computes average vibe from pulse checks', () => {
    const state = makeBaseState({
      pulseChecks: [
        { userId: 'u1', vibe: 1 },
        { userId: 'u2', vibe: 2 },
        { userId: 'u3', vibe: 3 },
      ],
    });
    const signals = computePulseSignals(state);
    expect(signals.avgVibe).toBe(2);
    expect(signals.pulseCheckCount).toBe(3);
  });

  it('handles zero player count gracefully', () => {
    const state = makeBaseState({ playerCount: 0, activePlayerCount: 0 });
    const signals = computePulseSignals(state);
    expect(signals.playerCount).toBe(1); // clamped to 1
    expect(signals.activeRate).toBe(0);
  });
});

describe('generateXiaoyueAdaptiveSuggestion', () => {
  it('suggests advance_ready when most players are done', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      warmupReadyUserIds: ['u1', 'u2', 'u3', 'u4'],
      playerCount: 4,
      phaseStartedAt: Date.now() - 5 * 60 * 1000,
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('advance_ready');
    expect(suggestion.message.length).toBeGreaterThan(0);
    expect(suggestion.actionableHint.length).toBeGreaterThan(0);
    expect(suggestion.basedOnSignals.completionRate).toBe(1);
    expect(suggestion.generatedAt).toBeDefined();
  });

  it('suggests rescue_quiet when completion is very low after 4+ minutes', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      warmupReadyUserIds: [],
      playerCount: 4,
      phaseStartedAt: Date.now() - 6 * 60 * 1000,
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('rescue_quiet');
  });

  it('suggests energy_boost when active rate is low after 5+ minutes', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      activePlayerCount: 1,
      playerCount: 4,
      phaseStartedAt: Date.now() - 7 * 60 * 1000,
      warmupReadyUserIds: ['u1'],
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('energy_boost');
  });

  it('suggests go_deeper when vibe is high and completion is good', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      pulseChecks: [
        { userId: 'u1', vibe: 3 },
        { userId: 'u2', vibe: 3 },
        { userId: 'u3', vibe: 2 },
      ],
      warmupReadyUserIds: ['u1', 'u2'],
      playerCount: 4,
      phaseStartedAt: Date.now() - 5 * 60 * 1000,
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('go_deeper');
  });

  it('suggests keep_light when vibe is low', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      pulseChecks: [
        { userId: 'u1', vibe: 1 },
        { userId: 'u2', vibe: 1 },
      ],
      warmupReadyUserIds: ['u1'],
      playerCount: 4,
      phaseStartedAt: Date.now() - 5 * 60 * 1000,
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('keep_light');
  });

  it('suggests speed_up when phase is dragging', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      warmupReadyUserIds: ['u1', 'u2'],
      playerCount: 4,
      phaseStartedAt: Date.now() - 17 * 60 * 1000, // 17 min, timeout is 20
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('speed_up');
  });

  it('suggests slow_down when phase is very short and completion is low', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      warmupReadyUserIds: [],
      playerCount: 4,
      phaseStartedAt: Date.now() - 30 * 1000, // 30 seconds
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('slow_down');
  });

  it('defaults to keep_going when signals are neutral', () => {
    const state = makeBaseState({
      currentPhase: 'warmup',
      warmupReadyUserIds: ['u1', 'u2'],
      playerCount: 4,
      phaseStartedAt: Date.now() - 5 * 60 * 1000,
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('keep_going');
  });

  it('returns keep_going during recap phase', () => {
    const state = makeBaseState({
      currentPhase: 'recap',
      phaseStartedAt: Date.now() - 2 * 60 * 1000,
    });
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.type).toBe('keep_going');
  });

  it('includes basedOnSignals in the suggestion', () => {
    const state = makeBaseState();
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    expect(suggestion.basedOnSignals).toBeDefined();
    expect(typeof suggestion.basedOnSignals.phaseElapsedMinutes).toBe('number');
    expect(typeof suggestion.basedOnSignals.activeRate).toBe('number');
    expect(typeof suggestion.basedOnSignals.completionRate).toBe('number');
    expect(typeof suggestion.basedOnSignals.avgVibe).toBe('number');
    expect(typeof suggestion.basedOnSignals.playerCount).toBe('number');
    expect(typeof suggestion.basedOnSignals.pulseCheckCount).toBe('number');
  });
});
