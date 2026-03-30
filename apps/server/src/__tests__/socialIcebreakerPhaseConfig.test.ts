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

  it('adds optional auction and mini script beta phases via server flags', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_AUCTION: 'true',
        SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'auction',
      'personality_dice',
      'mini_script_beta',
    ]);
  });

  it('can disable personality dice without dropping later flagged phases', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE: 'false',
        SOCIAL_ICEBREAKER_ENABLE_AUCTION: 'true',
        SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'auction',
      'mini_script_beta',
    ]);
  });

  it('skips ineligible phases and continues to the next enabled phase', () => {
    expect(
      getNextEligiblePhase('micro_challenge', DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES, 2),
    ).toBe('personality_dice');
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
  });
});
