import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState, SingleTestState } from '@shared/socialIcebreaker';
import {
  shouldRunBotSimulation,
  simulateBotsForSession,
  createSeededRandom,
  getBots,
  seedSingleTestBotsMiniScriptReady,
  seedSingleTestBotsPersonalityDiceReady,
} from '../services/socialIcebreakerBotService';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { isSocialIcebreakerTestMode } from '../lib/isSocialIcebreakerTestMode';
import { generateLieDetectiveStatements } from '../socialIcebreakerAIService';

vi.mock('../lib/isSingleTestMode');
vi.mock('../lib/isSocialIcebreakerTestMode');
vi.mock('../socialIcebreakerAIService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../socialIcebreakerAIService')>();
  return {
    ...actual,
    generateLieDetectiveStatements: vi.fn(async ({ displayName }: { displayName: string }) => ({
      data: [
        { index: 1, text: `${displayName} 的真实经历一`, isLie: false },
        { index: 2, text: `${displayName} 的虚构经历`, isLie: true },
        { index: 3, text: `${displayName} 的真实经历二`, isLie: false },
      ],
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: 'deepseek',
        fallbackUsed: false,
        promptVersion: 'social-lie-detective-v1',
      },
    })),
  };
});

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'test',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: 1_000_000,
    sessionStartedAt: 1_000_000,
    completedPhases: [],
    ...overrides,
  } as SocialSessionState;
}

function makeSingleTestState(runBots: boolean): SingleTestState {
  return {
    version: 2,
    groupId: 'group-test',
    isTestModeSkip: true,
    runBots,
    bots: [
      { botId: 'bot-1', displayName: 'Bot 1', archetype: '社牛柯基' },
      { botId: 'bot-2', displayName: 'Bot 2', archetype: '小太阳鸡' },
      { botId: 'bot-3', displayName: 'Bot 3', archetype: '机灵海豚' },
      { botId: 'bot-4', displayName: 'Bot 4', archetype: '树洞考拉' },
      { botId: 'bot-5', displayName: 'Bot 5', archetype: '脑洞章鱼' },
    ],
    botPersonas: [
      { botId: 'bot-1', userId: 'bot-user-1', displayName: 'Bot 1', archetype: '社牛柯基' },
      { botId: 'bot-2', userId: 'bot-user-2', displayName: 'Bot 2', archetype: '小太阳鸡' },
      { botId: 'bot-3', userId: 'bot-user-3', displayName: 'Bot 3', archetype: '机灵海豚' },
      { botId: 'bot-4', userId: 'bot-user-4', displayName: 'Bot 4', archetype: '树洞考拉' },
      { botId: 'bot-5', userId: 'bot-user-5', displayName: 'Bot 5', archetype: '脑洞章鱼' },
    ],
  };
}

vi.mock('../lib/socialIcebreakerStore', () => ({
  listParticipants: vi.fn(async () => [
    { userId: 'host-user', displayName: 'Host', archetype: '社牛柯基' },
    { userId: 'bot-user-1', displayName: 'Bot 1', archetype: '社牛柯基' },
    { userId: 'bot-user-2', displayName: 'Bot 2', archetype: '小太阳鸡' },
    { userId: 'bot-user-3', displayName: 'Bot 3', archetype: '机灵海豚' },
    { userId: 'bot-user-4', displayName: 'Bot 4', archetype: '树洞考拉' },
    { userId: 'bot-user-5', displayName: 'Bot 5', archetype: '脑洞章鱼' },
  ]),
  setLieTruths: vi.fn(async () => {}),
  getLieTruths: vi.fn(async (userId: string) => {
    // Return deterministic truths for any user: index 2 is the lie.
    return [
      { index: 1, text: 'truth one', isLie: false },
      { index: 2, text: 'lie two', isLie: true },
      { index: 3, text: 'truth three', isLie: false },
    ];
  }),
  getMiniScriptSecrets: vi.fn(async () => null),
}));

describe('socialIcebreakerBotService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isSingleTestMode).mockReturnValue(true);
    vi.mocked(isSocialIcebreakerTestMode).mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('shouldRunBotSimulation', () => {
    it('returns true when both gates and runBots are true', () => {
      const state = makeState({ singleTest: makeSingleTestState(true) });
      expect(shouldRunBotSimulation(state)).toBe(true);
    });

    it('returns false when single-test mode is disabled', () => {
      vi.mocked(isSingleTestMode).mockReturnValue(false);
      const state = makeState({ singleTest: makeSingleTestState(true) });
      expect(shouldRunBotSimulation(state)).toBe(false);
    });

    it('returns false when social icebreaker test mode is disabled', () => {
      vi.mocked(isSocialIcebreakerTestMode).mockReturnValue(false);
      const state = makeState({ singleTest: makeSingleTestState(true) });
      expect(shouldRunBotSimulation(state)).toBe(false);
    });

    it('returns false when runBots is false', () => {
      const state = makeState({ singleTest: makeSingleTestState(false) });
      expect(shouldRunBotSimulation(state)).toBe(false);
    });
  });

  describe('getBots', () => {
    it('returns bot personas from singleTest state', () => {
      const state = makeState({ singleTest: makeSingleTestState(true) });
      const bots = getBots(state);
      expect(bots).toHaveLength(5);
      expect(bots[0].userId).toBe('bot-user-1');
    });
  });

  it('seeds personality-dice bot choices and both ready gates even when bot simulation is disabled', () => {
    const state = makeState({
      currentPhase: 'personality_dice',
      singleTest: makeSingleTestState(false),
      personalityDiceChooseModeEnabled: true,
      personalityDiceChallengeGroups: makeSingleTestState(false).botPersonas.map((bot) => ({
        userId: bot.userId,
        displayName: bot.displayName,
        dominantTrait: 'A',
        options: (['easy', 'medium', 'hard'] as const).map((difficulty) => ({
          userId: bot.userId,
          displayName: bot.displayName,
          dominantTrait: 'A',
          challengeTitle: difficulty,
          challengeBody: difficulty,
          challengeEmoji: '✨',
          difficulty,
        })),
      })),
    });

    seedSingleTestBotsPersonalityDiceReady(state);

    expect(Object.keys(state.diceSelectedOption ?? {})).toHaveLength(5);
    expect(state.diceCompletedBy).toEqual(expect.arrayContaining([
      'bot-user-1', 'bot-user-2', 'bot-user-3', 'bot-user-4', 'bot-user-5',
    ]));
    expect(state.diceRevealReadyBy).toEqual(expect.arrayContaining([
      'bot-user-1', 'bot-user-2', 'bot-user-3', 'bot-user-4', 'bot-user-5',
    ]));
  });

  it('seeds ready state when generated groups contain client-safe bot IDs', () => {
    const singleTest = makeSingleTestState(false);
    const state = makeState({
      currentPhase: 'personality_dice',
      singleTest,
      personalityDiceChooseModeEnabled: true,
      personalityDiceChallengeGroups: singleTest.botPersonas.map((bot) => ({
        userId: bot.botId,
        displayName: bot.displayName,
        dominantTrait: 'A',
        options: (['easy', 'medium', 'hard'] as const).map((difficulty) => ({
          userId: bot.botId,
          displayName: bot.displayName,
          dominantTrait: 'A',
          challengeTitle: difficulty,
          challengeBody: difficulty,
          challengeEmoji: '🎲',
          difficulty,
        })),
      })),
    });

    seedSingleTestBotsPersonalityDiceReady(state);

    const clientBotIds = singleTest.botPersonas.map((bot) => bot.botId);
    expect(Object.keys(state.diceSelectedOption ?? {})).toEqual(expect.arrayContaining(clientBotIds));
    expect(state.diceCompletedBy).toEqual(expect.arrayContaining(clientBotIds));
    expect(state.diceRevealReadyBy).toEqual(expect.arrayContaining(clientBotIds));
  });

  it('defaults assigned mini-script bots to ready without enabling bot simulation', () => {
    const state = makeState({
      currentPhase: 'mini_script',
      singleTest: makeSingleTestState(false),
      miniScriptRoleAssignments: {
        'host-user': 0,
        'bot-user-1': 1,
        'bot-user-2': 2,
        'bot-user-3': 3,
        'bot-user-4': 4,
        'bot-user-5': 5,
      },
      miniScriptPlayerReady: { 'host-user': true },
    });

    seedSingleTestBotsMiniScriptReady(state);

    expect(state.miniScriptPlayerReady).toEqual({
      'host-user': true,
      'bot-user-1': true,
      'bot-user-2': true,
      'bot-user-3': true,
      'bot-user-4': true,
      'bot-user-5': true,
    });
  });

  describe('createSeededRandom', () => {
    it('produces the same sequence for the same seed', () => {
      const rng1 = createSeededRandom('seed-a');
      const rng2 = createSeededRandom('seed-a');
      const values1 = [rng1(), rng1(), rng1()];
      const values2 = [rng2(), rng2(), rng2()];
      expect(values1).toEqual(values2);
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = createSeededRandom('seed-a');
      const rng2 = createSeededRandom('seed-b');
      expect(rng1()).not.toBe(rng2());
    });
  });

  describe('simulateBotsForSession', () => {
    it('is a no-op when runBots is false', async () => {
      const state = makeState({ singleTest: makeSingleTestState(false) });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(false);
      expect(state.warmupReadyUserIds).toBeUndefined();
    });

    it('marks all bots as ready in warmup', async () => {
      const state = makeState({
        currentPhase: 'warmup',
        singleTest: makeSingleTestState(true),
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.warmupReadyUserIds).toContain('bot-user-1');
      expect(state.warmupReadyUserIds).toContain('bot-user-5');
      expect(state.warmupReadyUserIds).toHaveLength(5);
    });

    it('marks all bots as completed in micro_challenge', async () => {
      const state = makeState({
        currentPhase: 'micro_challenge',
        singleTest: makeSingleTestState(true),
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.challengeCompletedBy).toHaveLength(5);
    });

    it('generates statements and votes for bots in lie_detective', async () => {
      const state = makeState({
        currentPhase: 'lie_detective',
        singleTest: makeSingleTestState(true),
        lieDetectivePlayers: [
          { userId: 'host-user', displayName: 'Host', statements: [] },
        ],
        lieDetectiveCompletedUserIds: [],
        currentLieDetectivePlayerIndex: 0,
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      // All bots have statements
      const botPlayers = state.lieDetectivePlayers?.filter((p) =>
        p.userId.startsWith('bot-user-'),
      );
      expect(botPlayers).toHaveLength(5);
      expect(generateLieDetectiveStatements).toHaveBeenCalledTimes(5);
      expect(generateLieDetectiveStatements).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Bot 1', mode: 'v1' }),
      );
      // All bots voted for the current player
      const votes = state.votes ?? [];
      const botVotes = votes.filter((v) => v.voterId.startsWith('bot-user-'));
      expect(botVotes.length).toBeGreaterThanOrEqual(5);
      // Reveal is triggered because all non-current players voted
      expect(state.currentLieDetectiveReveal).toBeDefined();
      expect(state.lieDetectiveCompletedUserIds).toContain('host-user');
    });

    it('fills V2 tags in lie_detective when mode is v2', async () => {
      const state = makeState({
        currentPhase: 'lie_detective',
        singleTest: makeSingleTestState(true),
        lieDetectiveMode: 'v2',
        lieDetectivePlayers: [],
        lieDetectiveV2Tags: {},
      });
      await simulateBotsForSession('social_test', state);
      expect(state.lieDetectiveV2Tags).toBeDefined();
      expect(state.lieDetectiveV2Tags?.['bot-user-1']).toHaveLength(2);
    });

    it('falls back per bot when the approved AI generator rejects', async () => {
      vi.mocked(generateLieDetectiveStatements).mockRejectedValueOnce(
        new Error('provider unavailable before fallback'),
      );
      const state = makeState({
        currentPhase: 'lie_detective',
        singleTest: makeSingleTestState(true),
        lieDetectivePlayers: [
          { userId: 'host-user', displayName: 'Host', statements: [] },
        ],
        currentLieDetectivePlayerIndex: 0,
      });

      await expect(simulateBotsForSession('social_test', state)).resolves.toBe(true);

      const botOne = state.lieDetectivePlayers?.find((player) => player.userId === 'bot-user-1');
      expect(botOne?.statements).toHaveLength(3);
    });

    it('places a deterministic bid in auction', async () => {
      const state = makeState({
        currentPhase: 'auction',
        singleTest: makeSingleTestState(true),
        auctionLots: [{ id: 'lot-1', title: 'Lot 1' }],
        auctionBalances: { 'host-user': 100 },
        auctionCurrentLotIndex: 0,
        auctionHighBid: null,
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.auctionHighBid).not.toBeNull();
      expect(state.auctionBidHistory).toHaveLength(1);
    });

    it('selects and readies personality-dice bots from the session mode even when the env flag is off', async () => {
      const previousChooseMode = process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED;
      process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = 'false';
      try {
        const state = makeState({
        currentPhase: 'personality_dice',
        singleTest: makeSingleTestState(true),
        personalityDiceChooseModeEnabled: true,
        personalityDiceChallengeGroups: [
          {
            userId: 'bot-user-1',
            displayName: 'Bot 1',
            archetype: '社牛柯基',
            dominantTrait: 'A',
        options: [
          { userId: 'bot-user-1', displayName: 'Bot 1', challengeTitle: 'Easy', challengeBody: 'body', challengeEmoji: '✨', difficulty: 'easy', dominantTrait: 'A' },
          { userId: 'bot-user-1', displayName: 'Bot 1', challengeTitle: 'Medium', challengeBody: 'body', challengeEmoji: '✨', difficulty: 'medium', dominantTrait: 'A' },
          { userId: 'bot-user-1', displayName: 'Bot 1', challengeTitle: 'Hard', challengeBody: 'body', challengeEmoji: '✨', difficulty: 'hard', dominantTrait: 'A' },
        ],
          },
        ],
      });
        const changed = await simulateBotsForSession('social_test', state);
        expect(changed).toBe(true);
        expect(state.diceSelectedOption?.['bot-user-1']).toBeDefined();
        expect(state.diceCompletedBy).toContain('bot-user-1');
      } finally {
        process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED = previousChooseMode;
      }
    });

    it('submits answers and votes for bots in quip_battle', async () => {
      const state = makeState({
        currentPhase: 'quip_battle',
        singleTest: makeSingleTestState(true),
        quipBattlePrompts: [
          { id: 'p1', promptText: 'Why is pizza round?', category: 'fun' },
        ],
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.quipBattleSubmittedUserIds).toContain('bot-user-1');
      expect(state.quipBattleVotedUserIds).toContain('bot-user-1');
      expect(state.quipBattleAnswers?.length).toBeGreaterThanOrEqual(5);
      expect(state.quipBattleVotes?.length).toBeGreaterThanOrEqual(5);
    });

    it('submits descriptions and votes for bots in undercover_word', async () => {
      const state = makeState({
        currentPhase: 'undercover_word',
        singleTest: makeSingleTestState(true),
        undercoverWordPair: { civilianWord: '手机', undercoverWord: '平板', category: '物品' },
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.undercoverWordRounds?.[0].descriptions.length).toBeGreaterThanOrEqual(5);
      expect(state.undercoverWordVotedUserIds).toContain('bot-user-1');
    });

    it('submits answers for bots in group_mirror', async () => {
      const state = makeState({
        currentPhase: 'group_mirror',
        singleTest: makeSingleTestState(true),
        groupMirrorQuestions: [{ id: 'q1', questionText: 'Who is most likely?', category: 'perception' }],
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.groupMirrorSubmittedUserIds).toContain('bot-user-1');
      expect(state.groupMirrorAnswers?.length).toBeGreaterThanOrEqual(5);
    });

    it('marks bots ready and votes in mini_script', async () => {
      const state = makeState({
        currentPhase: 'mini_script',
        singleTest: makeSingleTestState(true),
        miniScriptRoleAssignments: {
          'host-user': 0,
          'bot-user-1': 1,
          'bot-user-2': 2,
          'bot-user-3': 3,
          'bot-user-4': 4,
          'bot-user-5': 5,
        },
      });
      const changed = await simulateBotsForSession('social_test', state);
      expect(changed).toBe(true);
      expect(state.miniScriptPlayerReady?.['bot-user-1']).toBe(true);
      expect(state.miniScriptVotes?.length).toBeGreaterThanOrEqual(5);
    });

    it('is idempotent: running twice does not duplicate state', async () => {
      const state = makeState({
        currentPhase: 'warmup',
        singleTest: makeSingleTestState(true),
      });
      await simulateBotsForSession('social_test', state);
      const first = JSON.stringify(state);
      await simulateBotsForSession('social_test', state);
      const second = JSON.stringify(state);
      expect(first).toBe(second);
    });
  });
});
