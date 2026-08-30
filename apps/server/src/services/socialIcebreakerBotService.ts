import type {
  SocialSessionState,
  LieDetectiveStatement,
  LieDetectivePlayer,
  LieDetectiveVote,
  LieDetectiveReveal,
  PersonalityDiceChallenge,
  UndercoverWordRound,
  GroupMirrorAnswer,
  MiniScriptVote,
} from '@shared/socialIcebreaker';
import { AUCTION_STARTING_COINS, MINISCRIPT_CEREMONY_MAX_BEAT } from '@shared/socialIcebreaker';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { isSocialIcebreakerTestMode } from '../lib/isSocialIcebreakerTestMode';
import { logger } from '../lib/logger';
import {
  listParticipants,
  setLieTruths,
  getLieTruths,
  getMiniScriptSecrets,
} from '../lib/socialIcebreakerStore';
import {
  generateLieDetectiveStatements,
  getLieDetectiveMode,
} from '../socialIcebreakerAIService';

/**
 * Dedicated server-side bot simulation for single-test Social Icebreaker sessions.
 *
 * - Runs only when both single-test mode and social-icebreaker test mode are active
 *   AND the session explicitly opts in via singleTest.runBots.
 * - Deterministic per session/phase (seeded PRNG).
 * - Bot Lie Detective sets use the approved AI service with its curated fallback.
 * - Idempotent: running twice on the same phase state produces the same result.
 */

export function shouldRunBotSimulation(state: SocialSessionState): boolean {
  return (
    isSingleTestMode() &&
    isSocialIcebreakerTestMode() &&
    state.singleTest?.runBots === true
  );
}

interface BotInfo {
  botId: string;
  userId: string;
  displayName: string;
  archetype: string;
}

export function getBots(state: SocialSessionState): BotInfo[] {
  return (state.singleTest?.botPersonas ?? []).map((p) => ({
    botId: p.botId,
    userId: p.userId,
    displayName: p.displayName,
    archetype: p.archetype,
  }));
}

/**
 * Seed single-test bot attendees into the warmup ready list.
 *
 * Bots are debug-group attendees regardless of whether the bot-simulation
 * harness (runBots) is enabled, so they default to ready on every warmup
 * topic card. Call after any `warmupReadyUserIds` reset. Idempotent.
 */
export function seedSingleTestBotsWarmupReady(state: SocialSessionState): void {
  const bots = getBots(state);
  if (bots.length === 0) return;
  const ready = new Set(state.warmupReadyUserIds ?? []);
  for (const bot of bots) {
    ready.add(bot.userId);
  }
  state.warmupReadyUserIds = [...ready];
}

/**
 * Personality-dice bots are real single-test attendees, so they select a card
 * and default to ready at both gates even when the optional simulation harness
 * is disabled.
 */
export function seedSingleTestBotsPersonalityDiceReady(state: SocialSessionState): void {
  const groups = state.personalityDiceChallengeGroups ?? [];
  if (groups.length === 0) return;
  const bots = getBots(state);
  if (bots.length === 0) return;

  state.diceSelectedOption = state.diceSelectedOption ?? {};
  const selectionReady = new Set(state.diceCompletedBy ?? []);
  const revealReady = new Set(state.diceRevealReadyBy ?? []);
  for (const bot of bots) {
    // Challenge groups may have been generated from the client-safe roster,
    // where bots are identified by opaque botId rather than users.id.
    const group = groups.find(
      (candidate) => candidate.userId === bot.userId || candidate.userId === bot.botId,
    );
    if (!group) continue;
    const challengeUserId = group.userId;
    if (state.diceSelectedOption[challengeUserId] === undefined) {
      const mediumIndex = group.options.findIndex((option) => option.difficulty === 'medium');
      state.diceSelectedOption[challengeUserId] = mediumIndex >= 0 ? mediumIndex : 0;
    }
    selectionReady.add(challengeUserId);
    revealReady.add(challengeUserId);
  }
  state.diceCompletedBy = [...selectionReady];
  state.diceRevealReadyBy = [...revealReady];
}

/**
 * Assigned mini-script bots are attendees, not pending human devices. Mark
 * them ready as soon as roles exist, independently of the optional bot-vote
 * simulation harness. Idempotent and safe for non-single-test sessions.
 */
export function seedSingleTestBotsMiniScriptReady(state: SocialSessionState): void {
  const assignments = state.miniScriptRoleAssignments ?? {};
  const bots = getBots(state);
  if (bots.length === 0 || Object.keys(assignments).length === 0) return;

  const ready = { ...(state.miniScriptPlayerReady ?? {}) };
  for (const bot of bots) {
    if (assignments[bot.userId] !== undefined) {
      ready[bot.userId] = true;
    }
  }
  state.miniScriptPlayerReady = ready;
}

/** Deterministic seeded PRNG. Returns floats in [0, 1). */
function createSeededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function uniqueAdd<T>(arr: T[] | undefined, value: T): T[] {
  const set = new Set(arr ?? []);
  set.add(value);
  return [...set];
}

function botSeed(socialSessionId: string, state: SocialSessionState): string {
  return `${socialSessionId}:${state.currentPhase}:${state.phaseStartedAt ?? 0}`;
}

const BOT_LIE_DETECTIVE_STATEMENTS: LieDetectiveStatement[][] = [
  [
    { index: 1, text: '我曾在凌晨三点一个人爬过一座山，就是觉得想去了', isLie: false },
    { index: 2, text: '我会说五种语言，虽然都不是很流利', isLie: true },
    { index: 3, text: '我的第一份工作是在便利店上夜班', isLie: false },
  ],
  [
    { index: 1, text: '我上过电视，虽然只有一个背影镜头', isLie: true },
    { index: 2, text: '我养过一只龟，养了整整十年，比有些恋爱还长', isLie: false },
    { index: 3, text: '我大学时是系里长跑第一名，虽然系里只有三个男生', isLie: false },
  ],
  [
    { index: 1, text: '我在飞机上遇到过一位演员，还聊了两句', isLie: false },
    { index: 2, text: '我曾经做过一段时间职业厨师，主要是切配', isLie: true },
    { index: 3, text: '我第一次坐飞机是二十五岁以后，之前一直坐高铁', isLie: false },
  ],
  [
    { index: 1, text: '我高中时组过乐队，担任贝斯手', isLie: false },
    { index: 2, text: '我曾经徒步穿越过沙漠，花了整整七天', isLie: true },
    { index: 3, text: '我的咖啡耐受度很低，下午三点后不敢喝', isLie: false },
  ],
  [
    { index: 1, text: '我会做提拉米苏，而且水平能拿得出手', isLie: false },
    { index: 2, text: '我曾经在北极圈追过极光，冻得直哆嗦', isLie: true },
    { index: 3, text: '我手机里有超过一万张照片，但从不整理', isLie: false },
  ],
];

const BOT_UNDERCOVER_DESCRIPTIONS = [
  '是一种很常见的东西，每天都在用',
  '摸起来手感挺舒服的，而且很有用',
  '这个东西家里一般都有不止一个',
  '颜色可以有很多种，但功能都差不多',
  '如果出门忘记带，会有一点不方便',
];

const BOT_QUIP_ANSWERS = [
  '因为它太真实了，根本没法反驳',
  '因为它把尴尬变成了艺术',
  '因为它让我想起了某个朋友',
  '因为它听起来离谱，但细想很合理',
  '因为它精准地戳中了笑点',
];

const BOT_GROUP_MIRROR_REASONS = [
  '感觉TA最符合这个问题描述',
  '从刚才互动里看出来的',
  '直觉告诉我是TA',
  'TA的气质和这个很搭',
  '这个问题简直就是为TA量身定做',
];

const BOT_TAGS_POOL = [
  ['潜水', '火锅'],
  ['脱口秀', '露营'],
  ['咖啡', '爬山'],
  ['摄影', '旅行'],
  ['烘焙', '猫'],
  ['跑步', '电影'],
  ['画画', '音乐'],
  ['游戏', '美食'],
];

export async function runBotSimulationSafely(
  socialSessionId: string,
  state: SocialSessionState,
  context?: string,
): Promise<void> {
  try {
    await simulateBotsForSession(socialSessionId, state);
  } catch (err) {
    logger.warn('[SocialIcebreaker] Bot simulation failed', {
      socialSessionId,
      phase: state.currentPhase,
      context: context ?? 'handler',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Fill missing bot submissions for the current phase.
 * Returns true if the state was mutated.
 */
export async function simulateBotsForSession(
  socialSessionId: string,
  state: SocialSessionState,
): Promise<boolean> {
  if (!shouldRunBotSimulation(state)) {
    return false;
  }

  const bots = getBots(state);
  if (bots.length === 0) return false;

  logger.info('social_icebreaker_bot_simulation_start', {
    socialSessionId,
    phase: state.currentPhase,
    runBots: state.singleTest?.runBots,
    socialIcebreakerTestMode: isSocialIcebreakerTestMode(),
    botCount: bots.length,
  });

  const rng = createSeededRandom(botSeed(socialSessionId, state));
  const original = JSON.stringify(state);

  switch (state.currentPhase) {
    case 'warmup':
      simulateWarmupBots(state, bots);
      break;
    case 'micro_challenge':
      simulateMicroChallengeBots(state, bots);
      break;
    case 'lie_detective':
      await simulateLieDetectiveBots(state, bots, rng, socialSessionId);
      break;
    case 'auction':
      simulateAuctionBots(state, bots, rng);
      break;
    case 'personality_dice':
      simulatePersonalityDiceBots(state, bots, rng);
      break;
    case 'quip_battle':
      simulateQuipBattleBots(state, bots, rng);
      break;
    case 'undercover_word':
      simulateUndercoverWordBots(state, bots, rng);
      break;
    case 'group_mirror':
      simulateGroupMirrorBots(state, bots, rng);
      break;
    case 'speed_friending':
      // Speed friending is fully host-driven; bots have no individual submissions.
      break;
    case 'mini_script':
      simulateMiniScriptBots(state, bots, rng);
      await simulateMiniScriptBotEvidencePresentation(socialSessionId, state, bots);
      break;
    default:
      break;
  }

  const changed = JSON.stringify(state) !== original;
  if (changed) {
    logger.info('social_icebreaker_bot_simulation_applied', {
      socialSessionId,
      phase: state.currentPhase,
      botCount: bots.length,
    });
  } else {
    logger.info('social_icebreaker_bot_simulation_noop', {
      socialSessionId,
      phase: state.currentPhase,
    });
  }
  return changed;
}

function simulateWarmupBots(
  state: SocialSessionState,
  bots: BotInfo[],
): void {
  const ready = new Set(state.warmupReadyUserIds ?? []);
  for (const bot of bots) {
    ready.add(bot.userId);
  }
  state.warmupReadyUserIds = [...ready];
}

function simulateMicroChallengeBots(
  state: SocialSessionState,
  bots: BotInfo[],
): void {
  const completed = new Set(state.challengeCompletedBy ?? []);
  for (const bot of bots) {
    completed.add(bot.userId);
  }
  state.challengeCompletedBy = [...completed];
}

async function simulateLieDetectiveBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
  socialSessionId: string,
): Promise<void> {
  const players = state.lieDetectivePlayers ?? [];
  const botUserIds = new Set(bots.map((b) => b.userId));
  const participants = await listParticipants(socialSessionId);

  // 1. Ensure every bot has generated statements. Generate missing sets in
  // parallel so one degraded provider does not multiply the phase wait by the
  // number of test bots.
  const missingBots = bots.filter((bot) => {
    const existing = players.find((p) => p.userId === bot.userId);
    return !existing?.statements?.length;
  });
  const generatedBotSets = await Promise.all(
    missingBots.map(async (bot) => {
      try {
        return {
          bot,
          statements: (await generateLieDetectiveStatements({
            userId: bot.userId,
            displayName: bot.displayName,
            archetype: bot.archetype,
            mode: 'v1',
          })).data,
        };
      } catch (error) {
        logger.warn('[SocialIcebreaker] Bot lie-detective generation fell back', {
          socialSessionId,
          botId: bot.botId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          bot,
          statements: pick(rng, BOT_LIE_DETECTIVE_STATEMENTS).map((statement) => ({
            ...statement,
          })),
        };
      }
    }),
  );

  for (const { bot, statements: generatedStatements } of generatedBotSets) {
    const existing = players.find((p) => p.userId === bot.userId);
    const statements = generatedStatements.length === 3
      ? generatedStatements
      : pick(rng, BOT_LIE_DETECTIVE_STATEMENTS).map((s) => ({ ...s }));
    const sanitized = statements.map((s) => ({ index: s.index, text: s.text }));

    if (existing) {
      existing.statements = sanitized;
    } else {
      players.push({
        userId: bot.userId,
        displayName: bot.displayName,
        statements: sanitized,
      });
    }
    await setLieTruths(socialSessionId, bot.userId, statements);
  }
  state.lieDetectivePlayers = players;

  // V2: ensure tags exist for every bot so the phase flow is consistent.
  const mode = getLieDetectiveMode(state.lieDetectiveMode);
  if (mode === 'v2') {
    state.lieDetectiveV2Tags = state.lieDetectiveV2Tags ?? {};
    for (const bot of bots) {
      if (!state.lieDetectiveV2Tags[bot.userId]) {
        const tags = pick(rng, BOT_TAGS_POOL);
        state.lieDetectiveV2Tags[bot.userId] = tags as [string, string];
      }
    }
  }

  // 2. Vote for the current player if not yet revealed.
  const currentPlayerIndex = state.currentLieDetectivePlayerIndex ?? 0;
  const currentPlayer = players[currentPlayerIndex];
  if (!currentPlayer) return;

  if (state.currentLieDetectiveReveal?.targetUserId === currentPlayer.userId) {
    // Already revealed for this player; nothing to do.
    return;
  }

  const votes: LieDetectiveVote[] = state.votes ?? [];
  const otherPlayerIds = participants
    .map((p) => p.userId)
    .filter((id) => id !== currentPlayer.userId);

  for (const bot of bots) {
    if (bot.userId === currentPlayer.userId) continue;
    const alreadyVoted = votes.some(
      (v) => v.voterId === bot.userId && v.targetUserId === currentPlayer.userId,
    );
    if (!alreadyVoted) {
      // Pick a deterministic statement index (1, 2, or 3).
      const guessedIndex = 1 + Math.floor(rng() * 3);
      votes.push({
        voterId: bot.userId,
        targetUserId: currentPlayer.userId,
        guessedStatementIndex: guessedIndex,
      });
    }
  }
  state.votes = votes;

  // 3. If all other players have voted, trigger reveal.
  const votesForTarget = votes.filter(
    (v) => v.targetUserId === currentPlayer.userId,
  ).length;
  const otherPlayerCount = Math.max(0, otherPlayerIds.length);
  if (votesForTarget >= otherPlayerCount && otherPlayerCount > 0) {
    const playerStatements = await getLieTruths(socialSessionId, currentPlayer.userId);
    const lieStatement = playerStatements?.find((s) => s.isLie);
    if (lieStatement) {
      const voteCounts: Record<number, number> = {};
      for (const v of votes.filter((v) => v.targetUserId === currentPlayer.userId)) {
        voteCounts[v.guessedStatementIndex] =
          (voteCounts[v.guessedStatementIndex] ?? 0) + 1;
      }
      const correctVoteCount = votes.filter(
        (v) =>
          v.targetUserId === currentPlayer.userId &&
          v.guessedStatementIndex === lieStatement.index,
      ).length;
      const reveal: LieDetectiveReveal = {
        targetUserId: currentPlayer.userId,
        lieIndex: lieStatement.index,
        voteCount: votesForTarget,
        correctVoteCount,
        revealedAt: Date.now(),
        aiStatementIndex: lieStatement.is_ai ? lieStatement.index : undefined,
        voteCounts,
      };
      state.currentLieDetectiveReveal = reveal;
      state.lieDetectiveCompletedUserIds = uniqueAdd(
        state.lieDetectiveCompletedUserIds,
        currentPlayer.userId,
      );

      if (mode === 'v2') {
        const correctRate = otherPlayerCount > 0 ? correctVoteCount / otherPlayerCount : 0;
        const history = state.lieDetectiveRevealHistory ?? [];
        const round = history.length + 1;
        history.push({ round, correctRate });
        state.lieDetectiveRevealHistory = history;
      }
    }
  }
}

function simulateAuctionBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
): void {
  const lots = state.auctionLots ?? [];
  if (lots.length === 0) return;
  if (state.auctionAllLotsClosed) return;

  const balances = { ...(state.auctionBalances ?? {}) };
  // Seed every bot with starting balance if missing.
  for (const bot of bots) {
    if (balances[bot.userId] === undefined) {
      balances[bot.userId] = AUCTION_STARTING_COINS;
    }
  }

  const currentLotIndex = state.auctionCurrentLotIndex ?? 0;
  const high = state.auctionHighBid;
  if (!high) {
    // First bot places a low deterministic bid.
    const bidder = bots[0];
    if (bidder && balances[bidder.userId] >= 10) {
      balances[bidder.userId] -= 10;
      state.auctionBalances = balances;
      state.auctionHighBid = { userId: bidder.userId, amount: 10 };
      state.auctionBidHistory = [
        ...(state.auctionBidHistory ?? []),
        { userId: bidder.userId, amount: 10, at: Date.now(), lotIndex: currentLotIndex },
      ].slice(0, 200);
    }
  }
}

function simulatePersonalityDiceBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
): void {
  const chooseModeEnabled =
    state.personalityDiceChooseModeEnabled ??
    (process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED ?? 'true').toLowerCase() === 'true';

  if (chooseModeEnabled && state.personalityDiceChallengeGroups) {
    seedSingleTestBotsPersonalityDiceReady(state);
    return;
  }

  // Legacy mode: mark each bot as completed on their challenge.
  const completed = new Set(state.diceCompletedBy ?? []);
  const passed = new Set(state.dicePassedBy ?? []);
  for (const bot of bots) {
    completed.add(bot.userId);
  }
  state.diceCompletedBy = [...completed];
  state.dicePassedBy = [...passed];
}

function simulateQuipBattleBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
): void {
  const prompts = state.quipBattlePrompts ?? [];
  if (prompts.length === 0) return;

  const submittedUserIds = new Set(state.quipBattleSubmittedUserIds ?? []);
  const answers = [...(state.quipBattleAnswers ?? [])];
  const votedUserIds = new Set(state.quipBattleVotedUserIds ?? []);
  const votes = [...(state.quipBattleVotes ?? [])];

  for (const bot of bots) {
    if (!submittedUserIds.has(bot.userId)) {
      for (const prompt of prompts) {
        answers.push({
          userId: bot.userId,
          displayName: bot.displayName,
          promptId: prompt.id,
          answerText: pick(rng, BOT_QUIP_ANSWERS).slice(0, 100),
        });
      }
      submittedUserIds.add(bot.userId);
    }
  }
  state.quipBattleAnswers = answers;
  state.quipBattleSubmittedUserIds = [...submittedUserIds];

  // Each bot votes once per prompt.
  const validAnswerIds = new Set(
    answers.map((a) => `${a.userId}::${a.promptId}`),
  );
  for (const bot of bots) {
    if (!votedUserIds.has(bot.userId)) {
      for (const prompt of prompts) {
        // Pick a deterministic answer for this prompt from any other player.
        const candidates = answers.filter((a) => a.promptId === prompt.id && a.userId !== bot.userId);
        if (candidates.length > 0) {
          const target = pick(rng, candidates);
          votes.push({
            voterId: bot.userId,
            answerId: `${target.userId}::${target.promptId}`,
            promptId: prompt.id,
          });
        }
      }
      votedUserIds.add(bot.userId);
    }
  }
  state.quipBattleVotes = votes;
  state.quipBattleVotedUserIds = [...votedUserIds];
}

function simulateUndercoverWordBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
): void {
  const pair = state.undercoverWordPair;
  if (!pair) return;

  const currentRound = state.undercoverWordCurrentRound ?? 0;
  const rounds = [...(state.undercoverWordRounds ?? [])];
  const round = rounds[currentRound] ?? { roundNumber: currentRound + 1, descriptions: [] };

  for (const bot of bots) {
    const existing = round.descriptions.find((d) => d.userId === bot.userId);
    if (!existing) {
      round.descriptions.push({
        userId: bot.userId,
        displayName: bot.displayName,
        text: pick(rng, BOT_UNDERCOVER_DESCRIPTIONS),
      });
    }
  }
  rounds[currentRound] = round;
  state.undercoverWordRounds = rounds;

  // Voting: each bot votes for a deterministic player that is not themselves.
  const votes = [...(state.undercoverWordVotes ?? [])];
  const votedUserIds = new Set(state.undercoverWordVotedUserIds ?? []);
  const allPlayerIds = [
    ...(state.singleTest?.botPersonas?.map((p) => p.userId) ?? []),
    state.hostUserId,
  ].filter(Boolean);
  for (const bot of bots) {
    if (!votedUserIds.has(bot.userId)) {
      const candidates = allPlayerIds.filter((id) => id !== bot.userId);
      const target = candidates[Math.floor(rng() * candidates.length)];
      if (target) {
        votes.push({ voterId: bot.userId, targetUserId: target });
        votedUserIds.add(bot.userId);
      }
    }
  }
  state.undercoverWordVotes = votes;
  state.undercoverWordVotedUserIds = [...votedUserIds];
}

function simulateGroupMirrorBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
): void {
  const questions = state.groupMirrorQuestions ?? [];
  if (questions.length === 0) return;

  const allPlayerIds = [
    state.hostUserId,
    ...(state.singleTest?.botPersonas?.map((p) => p.userId) ?? []),
  ].filter(Boolean);
  const submittedUserIds = new Set(state.groupMirrorSubmittedUserIds ?? []);
  const answers = [...(state.groupMirrorAnswers ?? [])];
  const answerMap = new Map<string, GroupMirrorAnswer>();
  for (const a of answers) {
    answerMap.set(`${a.userId}::${a.questionId}`, a);
  }

  for (const bot of bots) {
    if (!submittedUserIds.has(bot.userId)) {
      for (const q of questions) {
        const targets = allPlayerIds.filter((id) => id !== bot.userId);
        const targetUserId = targets[Math.floor(rng() * targets.length)] ?? state.hostUserId;
        const answer: GroupMirrorAnswer = {
          userId: bot.userId,
          displayName: bot.displayName,
          questionId: q.id,
          targetUserId,
          reasonText: pick(rng, BOT_GROUP_MIRROR_REASONS),
        };
        answerMap.set(`${bot.userId}::${q.id}`, answer);
      }
      submittedUserIds.add(bot.userId);
    }
  }
  state.groupMirrorAnswers = Array.from(answerMap.values());
  state.groupMirrorSubmittedUserIds = [...submittedUserIds];
}

function simulateMiniScriptBots(
  state: SocialSessionState,
  bots: BotInfo[],
  rng: () => number,
): void {
  const readyMap = { ...(state.miniScriptPlayerReady ?? {}) };
  const votes = [...(state.miniScriptVotes ?? [])];
  const roleAssignments = state.miniScriptRoleAssignments ?? {};
  // Fall back to playerCount when no framework is loaded so the seeded
  // suspect slot is always in a plausible range.
  const characterCount = state.miniScriptFramework?.characters?.length ?? state.playerCount ?? 0;
  const motiveOptions = state.miniScriptFramework?.motiveOptions ?? [];
  const round2Open =
    (state.miniScriptVoteRound ?? 1) === 2 &&
    state.miniScriptMotiveVoteOpenedAt !== undefined;

  for (const bot of bots) {
    if (roleAssignments[bot.userId] === undefined) continue;
    readyMap[bot.userId] = true;

    // Round 1 (suspect): structured ballot, suspectRoleSlot via seeded rng
    // (contract AC-07 — bots walk the same structured path as humans).
    const hasRound1 = votes.some((v) => v.userId === bot.userId && (v.voteRound ?? 1) === 1);
    if (!hasRound1 && characterCount > 0) {
      const vote: MiniScriptVote = {
        userId: bot.userId,
        voteRound: 1,
        suspectRoleSlot: 1 + Math.floor(rng() * characterCount),
        votedAt: Date.now(),
      };
      votes.push(vote);
    }

    // Round 2 (motive): cast once the host has opened it. open-motive-vote
    // hooks runBotSimulationSafely so a single-test round1→round2→reveal
    // chain terminates without human input.
    const hasRound2 = votes.some((v) => v.userId === bot.userId && v.voteRound === 2);
    if (round2Open && !hasRound2 && motiveOptions.length > 0) {
      const vote: MiniScriptVote = {
        userId: bot.userId,
        voteRound: 2,
        motiveChoice: Math.floor(rng() * motiveOptions.length),
        votedAt: Date.now(),
      };
      votes.push(vote);
    }
  }
  state.miniScriptPlayerReady = readyMap;
  state.miniScriptVotes = votes;

  // V2 P3 (Q14): the truth ceremony's culprit/honor beats are host-paced via
  // miniScriptCeremonyBeat. In single-test bot sessions the table must never
  // stall waiting for a human host to tap through the ceremony — once the
  // solution is revealed, each simulation run walks one beat forward (the
  // reveal-solution hook fires the first, the phase /advance hook fires the
  // rest), so the automated round1→round2→reveal→ceremony chain terminates.
  if (state.miniScriptSolutionRevealed === true && state.miniScriptV2Enabled === true) {
    const beat = state.miniScriptCeremonyBeat ?? 0;
    if (beat < MINISCRIPT_CEREMONY_MAX_BEAT) {
      state.miniScriptCeremonyBeat = beat + 1;
    }
  }
}

/**
 * V2 P2 (optional, contract AC-07): bots present current-act evidence while
 * the session is still in the act sub-stage. Each assigned bot presents at
 * most one new (evidenceId, targetRoleSlot) combo per run, within the same
 * per-act budget humans have. Reaction text comes from the secrets store —
 * exactly like the human present-evidence route. Idempotent: a second run
 * finds every combo already presented and changes nothing.
 */
async function simulateMiniScriptBotEvidencePresentation(
  socialSessionId: string,
  state: SocialSessionState,
  bots: BotInfo[],
): Promise<void> {
  if (state.miniScriptV2Enabled !== true) return;
  if (state.miniScriptVoteOpenedAt !== undefined) return; // vote sub-stage: no presenting
  const currentAct = state.miniScriptCurrentAct ?? 0;
  if (currentAct < 1) return;

  const framework = state.miniScriptFramework;
  const roleAssignments = state.miniScriptRoleAssignments ?? {};
  const characters = framework?.characters ?? [];
  if (!framework || characters.length === 0 || Object.keys(roleAssignments).length === 0) return;

  const actEvidence = (framework.act_flow ?? [])
    .filter((act) => act.actNumber <= currentAct)
    .flatMap((act) => act.evidence ?? []);
  if (actEvidence.length === 0) return;

  const secrets = await getMiniScriptSecrets(socialSessionId);
  const reactions = secrets?.evidenceReactions ?? {};

  const presented = [...(state.miniScriptPresentedEvidence ?? [])];
  const characterCount = characters.length;

  for (const bot of bots) {
    const botSlot = roleAssignments[bot.userId];
    if (botSlot === undefined) continue;
    const myActPresents = presented.filter(
      (entry) => entry.presentedBy === bot.userId && entry.actNo === currentAct,
    ).length;
    if (myActPresents >= 2) continue; // same budget as humans

    // Deterministic target: the next role slot after the bot's own.
    const targetRoleSlot = (botSlot % characterCount) + 1;
    const candidate = actEvidence.find(
      (item) =>
        reactions[item.id]?.[String(targetRoleSlot)] &&
        !presented.some(
          (entry) => entry.evidenceId === item.id && entry.targetRoleSlot === targetRoleSlot,
        ),
    );
    if (!candidate) continue;

    presented.push({
      evidenceId: candidate.id,
      targetRoleSlot,
      presentedBy: bot.userId,
      actNo: currentAct,
      presentedAt: Date.now(),
      reactionText: reactions[candidate.id][String(targetRoleSlot)],
    });
  }

  state.miniScriptPresentedEvidence = presented;
}

/** Re-export for consumers that need to test the PRNG in isolation. */
export { createSeededRandom };
