import { describe, expect, it } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import {
  DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
  getNextEligiblePhase,
} from '@shared/socialIcebreaker';
import {
  cleanupPhaseStateForNextPhase,
  getServerEnabledPhases,
} from '../socialIcebreakerPhaseConfig';

describe('social icebreaker phase configuration', () => {
  it('enables personality dice by default on the server', () => {
    expect(getServerEnabledPhases({} as NodeJS.ProcessEnv)).toEqual(
      DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
    );
  });

  it('adds optional auction and mini script phases via server flags', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_AUCTION: 'true',
        SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'auction',
      'personality_dice',
      'mini_script',
    ]);
  });

  it('enables mini script via legacy SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([...DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES, 'mini_script']);
  });

  it('can disable personality dice without dropping later flagged phases', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE: 'false',
        SOCIAL_ICEBREAKER_ENABLE_AUCTION: 'true',
        SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'auction',
      'mini_script',
    ]);
  });

  it('skips ineligible phases and continues to the next enabled phase', () => {
    const result = getNextEligiblePhase(
      'micro_challenge',
      DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      2,
    );
    expect(result).toBe('personality_dice');
  });

  it('respects run plans when state is passed', () => {
    const state: SocialSessionState = {
      socialSessionId: 'social_test',
      icebreakerSessionId: 'test',
      currentPhase: 'warmup',
      hostUserId: 'host',
      hostDisplayName: 'Host',
      playerCount: 4,
      phaseStartedAt: Date.now(),
      sessionStartedAt: Date.now(),
      completedPhases: [],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      runPlan: {
        version: 2,
        segments: [
          { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1 },
          { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2 },
          { phase: 'mini_script', allocatedMinutes: 25, energyWeight: 3 },
          { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
        ],
        totalMinutes: 46,
        compiledAt: new Date().toISOString(),
        compilerId: 'test',
      },
    };
    // With a run plan, lie_detective is skipped because it's not in the plan
    const result = getNextEligiblePhase('micro_challenge', state);
    expect(result).toBe('mini_script');
  });

  it('skips phases in run plan that need more players', () => {
    const state: SocialSessionState = {
      socialSessionId: 'social_test',
      icebreakerSessionId: 'test',
      currentPhase: 'warmup',
      hostUserId: 'host',
      hostDisplayName: 'Host',
      playerCount: 2, // less than mini_script minPlayers (4)
      phaseStartedAt: Date.now(),
      sessionStartedAt: Date.now(),
      completedPhases: [],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      runPlan: {
        version: 2,
        segments: [
          { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1 },
          { phase: 'mini_script', allocatedMinutes: 25, energyWeight: 3 },
          { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
        ],
        totalMinutes: 38,
        compiledAt: new Date().toISOString(),
        compilerId: 'test',
      },
    };
    const result = getNextEligiblePhase('warmup', state);
    expect(result).toBe('recap'); // mini_script skipped due to player count
  });

  it('cleans transient phase state while preserving recap inputs', () => {
    const state: SocialSessionState = {
      socialSessionId: 'social_test',
      icebreakerSessionId: 'test',
      currentPhase: 'lie_detective',
      hostUserId: 'host-1',
      hostDisplayName: 'Host',
      playerCount: 4,
      phaseStartedAt: 1,
      sessionStartedAt: 1,
      completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      warmupTopics: [{ id: 't1', question: 'Q1', mood: 'funny', emoji: '😂' }],
      challengeCompletedBy: ['host-1'],
      lieDetectivePlayers: [
        {
          userId: 'host-1',
          displayName: 'Host',
          statements: [{ index: 1, text: 'Statement 1' }],
        },
      ],
      currentLieDetectivePlayerIndex: 0,
      votes: [
        { voterId: 'host-1', targetUserId: 'host-2', guessedStatementIndex: 1 },
      ],
      personalityDiceChallenges: [
        {
          userId: 'host-1',
          displayName: 'Host',
          dominantTrait: 'E',
          challengeTitle: 'Title',
          challengeBody: 'Body',
          challengeEmoji: '🎲',
          difficulty: 'easy',
        },
      ],
      currentDicePlayerIndex: 0,
      diceCompletedBy: ['host-1'],
    };

    cleanupPhaseStateForNextPhase(state, 'lie_detective');

    expect(state.lieDetectivePlayers).toEqual([
      {
        userId: 'host-1',
        displayName: 'Host',
        statements: [],
      },
    ]);
    expect(state.currentLieDetectivePlayerIndex).toBeUndefined();
    expect(state.votes).toBeUndefined();

    cleanupPhaseStateForNextPhase(state, 'personality_dice');

    expect(state.personalityDiceChallenges).toBeUndefined();
    expect(state.currentDicePlayerIndex).toBeUndefined();
    expect(state.diceCompletedBy).toBeUndefined();
    expect(state.warmupTopics).toEqual([{ id: 't1', question: 'Q1', mood: 'funny', emoji: '😂' }]);
    expect(state.challengeCompletedBy).toEqual(['host-1']);

    (state as { miniScriptFramework?: unknown }).miniScriptFramework = { schemaVersion: 1 };
    state.miniScriptFrameworkGeneratedAt = 1;
    state.miniScriptFrameworkGeneratedByUserId = 'host-1';
    cleanupPhaseStateForNextPhase(state, 'mini_script');
    expect(state.miniScriptFramework).toBeUndefined();
    expect(state.miniScriptFrameworkGeneratedAt).toBeUndefined();
    expect(state.miniScriptFrameworkGeneratedByUserId).toBeUndefined();

    state.auctionLots = [{ id: 'a', title: 'Lot' }];
    state.auctionBalances = { u1: 10 };
    state.auctionHighBid = { userId: 'u1', amount: 5 };
    state.auctionRecapLines = ['line'];
    state.auctionAllLotsClosed = true;
    cleanupPhaseStateForNextPhase(state, 'auction');
    expect(state.auctionLots).toBeUndefined();
    expect(state.auctionBalances).toBeUndefined();
    expect(state.auctionHighBid).toBeUndefined();
    expect(state.auctionRecapLines).toBeUndefined();
    expect(state.auctionAllLotsClosed).toBeUndefined();
  });
});
