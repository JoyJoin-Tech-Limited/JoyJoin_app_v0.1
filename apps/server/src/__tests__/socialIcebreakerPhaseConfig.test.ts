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
    // lie_detective requires 3 players, so with 2 players it skips to personality_dice
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
    expect(state.dicePassedBy).toBeUndefined();
    expect(state.warmupTopics).toEqual([{ id: 't1', question: 'Q1', mood: 'funny', emoji: '😂' }]);
    expect(state.challengeCompletedBy).toEqual(['host-1']);

    (state as { miniScriptFramework?: unknown }).miniScriptFramework = { schemaVersion: 1 };
    state.miniScriptFrameworkGeneratedAt = 1;
    state.miniScriptFrameworkGeneratedByUserId = 'host-1';
    state.miniScriptRoleAssignments = { 'host-1': 0 };
    state.miniScriptPlayerRuntimeViews = {
      'host-1': { slotIndex: 0, roleLabel: '角色', sinHook: '钩子', alibi: '证明', secretAgenda: '秘密' },
    };
    state.miniScriptVotes = [{ userId: 'host-1', who: 'A', what: 'B', why: 'C', votedAt: 1 }];
    state.miniScriptSolutionRevealed = true;
    state.miniScriptRevealedSolution = { who: 'A', what: 'B', why: 'C' };
    cleanupPhaseStateForNextPhase(state, 'mini_script');
    expect(state.miniScriptFramework).toBeUndefined();
    expect(state.miniScriptFrameworkGeneratedAt).toBeUndefined();
    expect(state.miniScriptFrameworkGeneratedByUserId).toBeUndefined();
    expect(state.miniScriptRoleAssignments).toBeUndefined();
    expect(state.miniScriptPlayerRuntimeViews).toBeUndefined();
    expect(state.miniScriptVotes).toBeUndefined();
    expect(state.miniScriptSolutionRevealed).toBeUndefined();
    expect(state.miniScriptRevealedSolution).toBeUndefined();

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

  it('C1: re-entering mini_script produces a clean V2 sub-phase machine (snapshot preserved)', () => {
    const state: SocialSessionState = {
      socialSessionId: 'social_v2_reentry',
      icebreakerSessionId: 'test',
      currentPhase: 'mini_script',
      hostUserId: 'host-1',
      hostDisplayName: 'Host',
      playerCount: 4,
      phaseStartedAt: 1,
      sessionStartedAt: 1,
      completedPhases: ['mini_script'],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      // Flag snapshot from the first run — must SURVIVE cleanup.
      miniScriptV2Enabled: true,
      // Full V2 end-state from the previous run.
      miniScriptCurrentAct: 3,
      miniScriptVoteOpenedAt: 100,
      miniScriptRevealedResolutionSummary: '真相大白。',
      miniScriptVoteRound: 2,
      miniScriptMotiveVoteOpenedAt: 200,
      miniScriptPresentedEvidence: [
        {
          evidenceId: 'e1',
          targetRoleSlot: 2,
          presentedBy: 'host-1',
          actNo: 1,
          presentedAt: 1,
          reactionText: '反应文本',
        },
      ],
      miniScriptRevealedPlayerResults: [{ userId: 'host-1', round1Correct: true, round2Correct: false }],
      miniScriptCeremonyBeat: 2,
      miniScriptSolutionRevealed: true,
      miniScriptVotes: [{ userId: 'host-1', voteRound: 2, motiveChoice: 0, votedAt: 1 }],
    };

    cleanupPhaseStateForNextPhase(state, 'mini_script');

    // Sub-phase machine is clean: presenting is allowed again (the
    // WRONG_SUB_PHASE guard keys on miniScriptVoteOpenedAt)…
    expect(state.miniScriptVoteOpenedAt).toBeUndefined();
    // …no stale vote round or motive round survives…
    expect(state.miniScriptVoteRound).toBeUndefined();
    expect(state.miniScriptMotiveVoteOpenedAt).toBeUndefined();
    // …presented evidence / revealed artifacts are gone…
    expect(state.miniScriptPresentedEvidence).toBeUndefined();
    expect(state.miniScriptRevealedResolutionSummary).toBeUndefined();
    expect(state.miniScriptRevealedPlayerResults).toBeUndefined();
    // …the ceremony beat is reset…
    expect(state.miniScriptCeremonyBeat).toBeUndefined();
    expect(state.miniScriptSolutionRevealed).toBeUndefined();
    expect(state.miniScriptCurrentAct).toBeUndefined();
    expect(state.miniScriptVotes).toBeUndefined();
    // …and the flag snapshot taken at first phase entry is preserved
    // (transitionPhase only sets it when undefined).
    expect(state.miniScriptV2Enabled).toBe(true);
  });

  it('custom mode routes warmup and real phases back to phase_selection', () => {
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
      eventTier: 'custom',
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
    };
    expect(getNextEligiblePhase('warmup', state)).toBe('phase_selection');
    state.currentPhase = 'phase_selection';
    expect(getNextEligiblePhase('phase_selection', state)).toBe('recap');
    state.currentPhase = 'micro_challenge';
    expect(getNextEligiblePhase('micro_challenge', state)).toBe('phase_selection');
  });

  it('does not include group_mirror, undercover_word, or quip_battle by default', () => {
    const result = getServerEnabledPhases({} as NodeJS.ProcessEnv);
    expect(result).not.toContain('group_mirror');
    expect(result).not.toContain('undercover_word');
    expect(result).not.toContain('quip_battle');
  });

  it('includes group_mirror when SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR is true', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'personality_dice',
      'group_mirror',
    ]);
  });

  it('includes undercover_word when SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD is true', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'personality_dice',
      'undercover_word',
    ]);
  });

  it('includes quip_battle when SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE is true', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'personality_dice',
      'quip_battle',
    ]);
  });

  it('includes all three new phases in canonical order when all flags are true', () => {
    expect(
      getServerEnabledPhases({
        SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR: 'true',
        SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD: 'true',
        SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE: 'true',
        SOCIAL_ICEBREAKER_ENABLE_AUCTION: 'true',
        SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT: 'true',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'auction',
      'quip_battle',
      'personality_dice',
      'group_mirror',
      'undercover_word',
      'mini_script',
    ]);
  });

  it('cleans group_mirror transient state', () => {
    const state = {
      socialSessionId: 'social_test',
      icebreakerSessionId: 'test',
      currentPhase: 'group_mirror',
      hostUserId: 'host',
      hostDisplayName: 'Host',
      playerCount: 4,
      phaseStartedAt: 1,
      sessionStartedAt: 1,
      completedPhases: [],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      groupMirrorQuestions: [{ id: 'q1', questionText: 'Q1', category: 'perception' }],
      groupMirrorQuestionsMeta: { generatedAt: '2024-01-01T00:00:00Z', provider: null, fromCache: false, fallbackUsed: false },
      groupMirrorAnswers: [{ questionId: 'q1', targetUserId: 'u1', reasonText: 'R1' }],
      groupMirrorVotes: [{ questionId: 'q1', targetUserId: 'u1', reasonText: 'R1' }],
      groupMirrorSubmittedUserIds: ['u1'],
      groupMirrorRevealed: true,
      groupMirrorResults: [{ questionId: 'q1', consensusTargetUserId: 'u1', voteCount: 2 }],
    } as unknown as SocialSessionState;

    cleanupPhaseStateForNextPhase(state, 'group_mirror');

    expect(state.groupMirrorQuestions).toBeUndefined();
    expect(state.groupMirrorQuestionsMeta).toBeUndefined();
    expect(state.groupMirrorAnswers).toBeUndefined();
    expect(state.groupMirrorVotes).toBeUndefined();
    expect(state.groupMirrorSubmittedUserIds).toBeUndefined();
    expect(state.groupMirrorRevealed).toBeUndefined();
    expect(state.groupMirrorResults).toBeUndefined();
  });

  it('cleans undercover_word transient state', () => {
    const state = {
      socialSessionId: 'social_test',
      icebreakerSessionId: 'test',
      currentPhase: 'undercover_word',
      hostUserId: 'host',
      hostDisplayName: 'Host',
      playerCount: 4,
      phaseStartedAt: 1,
      sessionStartedAt: 1,
      completedPhases: [],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      undercoverWordPair: { civilianWord: 'apple', undercoverWord: 'orange', category: 'fruit' },
      undercoverWordPairMeta: { generatedAt: '2024-01-01T00:00:00Z', provider: null, fromCache: false, fallbackUsed: false },
      undercoverUserId: 'u1',
      undercoverWordRounds: [{ roundNumber: 1, descriptions: [] }],
      undercoverWordCurrentRound: 1,
      undercoverWordVotes: [{ voterId: 'u2', targetUserId: 'u1' }],
      undercoverWordVotedUserIds: ['u2'],
      undercoverWordRevealed: true,
      undercoverWordResults: { undercoverUserId: 'u1', undercoverDisplayName: 'U1', civilianWord: 'apple', undercoverWord: 'orange', voteCounts: {}, caught: true },
    } as SocialSessionState;

    cleanupPhaseStateForNextPhase(state, 'undercover_word');

    expect(state.undercoverWordPair).toBeUndefined();
    expect(state.undercoverWordPairMeta).toBeUndefined();
    expect(state.undercoverUserId).toBeUndefined();
    expect(state.undercoverWordRounds).toBeUndefined();
    expect(state.undercoverWordCurrentRound).toBeUndefined();
    expect(state.undercoverWordVotes).toBeUndefined();
    expect(state.undercoverWordVotedUserIds).toBeUndefined();
    expect(state.undercoverWordRevealed).toBeUndefined();
    expect(state.undercoverWordResults).toBeUndefined();
  });

  it('cleans quip_battle transient state', () => {
    const state = {
      socialSessionId: 'social_test',
      icebreakerSessionId: 'test',
      currentPhase: 'quip_battle',
      hostUserId: 'host',
      hostDisplayName: 'Host',
      playerCount: 4,
      phaseStartedAt: 1,
      sessionStartedAt: 1,
      completedPhases: [],
      enabledPhases: DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
      quipBattlePrompts: [{ id: 'p1', promptText: 'P1', category: 'cat' }],
      quipBattlePromptsMeta: { generatedAt: '2024-01-01T00:00:00Z', provider: null, fromCache: false, fallbackUsed: false },
      quipBattleAnswers: [{ userId: 'u1', displayName: 'U1', promptId: 'p1', answerText: 'A1' }],
      quipBattleSubmittedUserIds: ['u1'],
      quipBattleVotes: [{ voterId: 'u2', answerId: 'a1', promptId: 'p1' }],
      quipBattleVotedUserIds: ['u2'],
      quipBattleRevealed: true,
      quipBattleResults: [{ promptId: 'p1', promptText: 'P1', answers: [], winnerUserId: 'u1', winnerDisplayName: 'U1', voteCount: 2 }],
    } as SocialSessionState;

    cleanupPhaseStateForNextPhase(state, 'quip_battle');

    expect(state.quipBattlePrompts).toBeUndefined();
    expect(state.quipBattlePromptsMeta).toBeUndefined();
    expect(state.quipBattleAnswers).toBeUndefined();
    expect(state.quipBattleSubmittedUserIds).toBeUndefined();
    expect(state.quipBattleVotes).toBeUndefined();
    expect(state.quipBattleVotedUserIds).toBeUndefined();
    expect(state.quipBattleRevealed).toBeUndefined();
    expect(state.quipBattleResults).toBeUndefined();
  });
});
