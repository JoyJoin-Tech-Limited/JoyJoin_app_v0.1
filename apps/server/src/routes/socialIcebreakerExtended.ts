import type { Router } from 'express';
import type { SocialSessionState, SocialIcebreakerPhase, LieDetectivePlayer, LieDetectiveVote, LieDetectiveReveal } from '@shared/socialIcebreaker';
import { z } from 'zod';
import { AUCTION_STARTING_COINS } from '@shared/socialIcebreaker';
import { getNextEligiblePhase } from '../socialIcebreakerPhaseConfig';
import {
  generateMicroChallenges,
  generateXiaoYueComment,
  generateAuctionLots,
  generateLieDetectiveStatements,
  getLieDetectiveMode,
  getDynamicDifficulty,
  buildLieDetectiveV2RecapData,
} from '../socialIcebreakerAIService';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import { cleanupPhaseStateForNextPhase } from '../socialIcebreakerPhaseConfig';
import { isCustomMode } from '../services/customModeService';
import {
  buildClientState,
  hasAllRosterParticipantsResponded,
  getMicroChallengeDeadlineMs,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  hydrateDerivedState,
  resolveSession,
  isHostAuthorized,
  recapDisplayNameByUserId,
  generateSpeedFriendingPairs,
  ensureRecapSnapshot,
} from './socialIcebreakerHelpers';
import { buildArchetypeContext } from '../lib/contextInjector';
import {
  getSessionWithExpiry,
  getParticipant,
  updateSession,
  listParticipants,
  setLieTruths,
  getLieTruths,
  savePhaseMetric,
} from '../lib/socialIcebreakerStore';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../lib/featureFlags';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { generatePhaseSelectionId } from '../services/customModeService';
import { simulateBotsForSession, runBotSimulationSafely } from '../services/socialIcebreakerBotService';

export function registerExtendedRoutes(router: Router): void {
  const WARMUP_TURN_DURATION_SECONDS = 30;

  function hasWarmupTurnCompleted(state: SocialSessionState): boolean {
    return !!state.warmupTurnUserId && (state.warmupReadyUserIds || []).includes(state.warmupTurnUserId);
  }

  function isWarmupTurnExpired(state: SocialSessionState): boolean {
    const turnStartedAt = state.warmupTurnStartedAt;
    if (!turnStartedAt) return false;
    const durationSeconds = state.warmupTurnDurationSeconds ?? WARMUP_TURN_DURATION_SECONDS;
    return Date.now() - turnStartedAt >= durationSeconds * 1000;
  }

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/advance
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/advance', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;
  const { currentPhase } = req.body as { currentPhase: SocialIcebreakerPhase };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!currentPhase) {
    return res.status(400).json({ error: 'currentPhase is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can advance phases' });
  }

  // Fill any missing bot submissions before evaluating advance guards so that
  // single-test sessions with runBots can progress with only one real user.
  await simulateBotsForSession(socialSessionId, state).catch((err) => {
    logger.warn('[SocialIcebreaker] Bot simulation failed during advance', {
      socialSessionId,
      phase: state.currentPhase,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  if (state.currentPhase !== currentPhase) {
    return res.status(400).json({ error: 'Phase mismatch' });
  }

  if (currentPhase === 'phase_selection') {
    return res.status(400).json({ error: 'Use select-phase or end-session while in phase_selection' });
  }

  if (currentPhase === 'warmup') {
    const everyoneReady = hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount);
    if (!everyoneReady && !hasWarmupTurnCompleted(state) && !isWarmupTurnExpired(state)) {
      return res.status(400).json({ error: 'Current speaker must finish or the timer must expire before advancing warmup' });
    }

    if ((state.warmupTopics || []).length === 0) {
      return res.status(400).json({ error: 'Topic cards must be generated before advancing' });
    }

    incrementCommonGround(state);
  }

  if (currentPhase === 'micro_challenge') {
    const challengeDeadlineMs = getMicroChallengeDeadlineMs(state);
    const everyoneCompleted = hasAllRosterParticipantsResponded(state.challengeCompletedBy, state.playerCount);
    const timerExpired = challengeDeadlineMs !== null && Date.now() >= challengeDeadlineMs;

    if (!everyoneCompleted && !timerExpired) {
      return res.status(400).json({ error: 'Wait for everyone to finish or for the timer to expire' });
    }
  }

  if (currentPhase === 'lie_detective') {
    const generatedPlayers = state.lieDetectivePlayers || [];
    const currentPlayer = getCurrentLieDetectivePlayer(state);

    if (generatedPlayers.length < state.playerCount) {
      return res.status(400).json({ error: 'All participants must generate statements before leaving lie_detective' });
    }

    if (!currentPlayer || state.currentLieDetectivePlayerIndex !== generatedPlayers.length - 1) {
      return res.status(400).json({ error: 'Finish every lie-detective turn before advancing' });
    }

    const reveal = state.currentLieDetectiveReveal;
    if (!reveal || reveal.targetUserId !== currentPlayer.userId) {
      return res.status(400).json({ error: 'The current lie-detective turn must be revealed before advancing' });
    }

    if (!hasAllRosterParticipantsResponded(state.lieDetectiveCompletedUserIds, state.playerCount)) {
      return res.status(400).json({ error: 'Every lie-detective turn must be completed before advancing' });
    }

    // Build V2 recap data when leaving lie_detective
    const mode = getLieDetectiveMode(state.lieDetectiveMode);
    if (mode === 'v2' && state.lieDetectiveRevealHistory && state.lieDetectiveRevealHistory.length > 0) {
      state.recapData = state.recapData || {
        topicsDiscussed: [],
        challengesCompleted: 0,
        funMoments: [],
      };
      state.recapData.lieDetective = buildLieDetectiveV2RecapData(state.lieDetectiveRevealHistory);
    }
  }

  if (currentPhase === 'auction') {
    if (!state.auctionAllLotsClosed) {
      return res.status(400).json({
        error: 'Host must close every auction lot (use close-lot) before advancing out of auction',
      });
    }
  }

  if (currentPhase === 'mini_script') {
    // Must have framework
    if (!state.miniScriptFramework) {
      return res.status(400).json({
        error: 'MINI_SCRIPT_NOT_GENERATED',
        message: '剧本尚未生成，请先配置风格与题材并生成剧本',
      });
    }
    // Must have assigned roles
    if (!state.miniScriptRoleAssignments || Object.keys(state.miniScriptRoleAssignments).length < state.playerCount) {
      return res.status(400).json({ error: 'Roles not assigned' });
    }
    // Must have revealed all acts
    const totalActs = state.miniScriptFramework.act_flow.length;
    if ((state.miniScriptCurrentAct ?? 0) < totalActs) {
      return res.status(400).json({ error: 'Not all acts revealed' });
    }
    // Must have solution revealed
    if (!state.miniScriptSolutionRevealed) {
      return res.status(400).json({ error: 'Solution not revealed' });
    }
  }

  if (currentPhase === 'undercover_word') {
    if (!state.undercoverWordPair) {
      return res.status(400).json({ error: 'Word pair not generated' });
    }
    if (!state.undercoverWordRevealed) {
      return res.status(400).json({ error: 'Undercover word must be revealed before advancing' });
    }
  }

  if (currentPhase === 'group_mirror') {
    if (!state.groupMirrorQuestions || state.groupMirrorQuestions.length === 0) {
      return res.status(400).json({ error: 'Group mirror questions not generated' });
    }
    if (!state.groupMirrorRevealed) {
      return res.status(400).json({ error: 'Group mirror results must be revealed before advancing' });
    }
  }

  if (currentPhase === 'speed_friending') {
    if (!state.speedFriendingAllRoundsComplete) {
      return res.status(400).json({
        error: 'All speed friending rounds must be completed before advancing',
      });
    }
  }

  const effectiveNextPhase = getNextEligiblePhase(currentPhase, state);

  // Close out the current phase bookkeeping before any transition logic
  if (!state.completedPhases.includes(currentPhase)) {
    state.completedPhases = [...(state.completedPhases || []), currentPhase];
  }

  // Compute and persist phase dwell time for Q2 pilot instrumentation
  const phaseStartedAt = state.phaseStartedAt ? new Date(state.phaseStartedAt).getTime() : Date.now();
  const dwellTimeMs = Date.now() - phaseStartedAt;
  savePhaseMetric(socialSessionId, currentPhase, {
    dwellTimeMs,
    startedAt: new Date(phaseStartedAt),
    endedAt: new Date(),
    participantCount: state.playerCount,
  }).catch((err) => {
    logger.warn('[PhaseMetrics] save failed', { socialSessionId, phase: currentPhase, error: err instanceof Error ? err.message : String(err) });
  });

  cleanupPhaseStateForNextPhase(state, currentPhase);

  if (effectiveNextPhase === 'phase_selection') {
    state.phaseSelectionId = generatePhaseSelectionId();
  }

  // Bonus gate: if advancing to mini_script for the first time, pause for host decision.
  // In custom mode the host already explicitly selected mini_script from the picker,
  // so skip the redundant bonus gate.
  if (
    effectiveNextPhase === 'mini_script' &&
    !isCustomMode(state) &&
    !state.bonusGateOffered &&
    !state.bonusGateAccepted &&
    !state.bonusGateDeclined
  ) {
    state.bonusGateOffered = true;
    // Fire-and-forget background framework pre-generation
    if (!state.bonusGateFrameworkPreloading) {
      state.bonusGateFrameworkPreloading = true;
      // Background pre-generation is optional; actual generation is triggered on accept
    }
    await updateSession(socialSessionId, state);
    return res.json({ state: buildClientState(state) });
  }

  state.currentPhase = effectiveNextPhase;
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  if (effectiveNextPhase === 'warmup') {
    state.warmupReadyUserIds = [];
  }
  if (effectiveNextPhase === 'speed_friending') {
    const roster = await listParticipants(socialSessionId);
    const playerIds = roster.map((p) => p.userId);
    const displayNames = new Map(roster.map((p) => [p.userId, p.displayName]));
    const rounds = generateSpeedFriendingPairs(playerIds, displayNames);
    state.speedFriendingPairs = rounds.flat();
    state.speedFriendingTotalRounds = rounds.length;
    state.speedFriendingCurrentRound = 0;
    state.speedFriendingAllRoundsComplete = false;
    state.speedFriendingRoundStartedAt = Date.now();
  }
  await updateSession(socialSessionId, state);

  if (effectiveNextPhase === 'recap') {
    await ensureRecapSnapshot(state, socialSessionId);
  }

  let content: any = null;
  let meta: AIResponseMeta | undefined;
  if (effectiveNextPhase === 'micro_challenge') {
    try {
      const challengeResult = await generateMicroChallenges({
        eventType: state.eventType || '活动',
        participantCount: state.playerCount,
        seed: socialSessionId,
      });
      state.currentChallenge = challengeResult.data[0];
      state.currentChallengeMeta = challengeResult.meta;
      state.challengeCompletedBy = [];
      await updateSession(socialSessionId, state);
      content = { challenge: state.currentChallenge };
      meta = challengeResult.meta;
    } catch {
      // fallback silently handled in AI service
    }
  }

  // Fetch participant roster with profiles for personalised 悦仔 commentary
  let xyParticipants: Array<{ displayName: string; archetype?: string | null; profile?: import('@shared/socialIcebreaker').SocialSessionParticipantProfile | null }> | undefined;
  try {
    const roster = await listParticipants(socialSessionId);
    if (roster.length > 0) {
      xyParticipants = roster.map(p => ({
        displayName: p.displayName,
        archetype: p.archetype ?? null,
        profile: p.profile ?? undefined,
      }));
    }
  } catch {
    // Non-critical — comment generation works without participant context
  }

  const xyResult = await generateXiaoYueComment({
    phase: effectiveNextPhase,
    event: 'phase_start',
    playerCount: state.playerCount,
    participants: xyParticipants,
  }).catch(
    (): { data: string; meta: AIResponseMeta } => ({
      data: '',
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: false,
      },
    }),
  );

  return res.json({
    nextPhase: effectiveNextPhase,
    content,
    xiaoYueComment: xyResult.data,
    xiaoYueCommentMeta: xyResult.meta,
    meta,
    state: await buildClientState(state, userId),
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { displayName, archetype, interests } = req.body as {
    displayName: string;
    archetype?: string;
    interests?: string[];
  };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!displayName) {
    return res.status(400).json({ error: 'displayName is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — statement generation is only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  if (!(await getParticipant(socialSessionId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  try {
    const mode = getLieDetectiveMode(state.lieDetectiveMode);
    const difficulty = getDynamicDifficulty(state.lieDetectiveRevealHistory);

    const generateParams: Parameters<typeof generateLieDetectiveStatements>[0] = {
      userId,
      displayName,
      archetype,
      interests,
      mode,
      difficulty,
    };

    // In V2 mode, read tags from session state
    if (mode === 'v2') {
      const tags = state.lieDetectiveV2Tags?.[userId];
      if (!tags) {
        return res.status(400).json({ error: 'Tags not submitted. Please submit tags first.' });
      }
      generateParams.tags = tags;
    }

    const statementResult = await generateLieDetectiveStatements(generateParams);

    // Persist server-only truth data (isLie + V2 is_ai/source_tag) in the separate lie-truths table.
    await setLieTruths(socialSessionId, userId, statementResult.data);

    // Store sanitized statements (no isLie / is_ai / source_tag) in public session state.
    const players: LieDetectivePlayer[] = state.lieDetectivePlayers || [];
    const existingPlayer = players.findIndex((p: LieDetectivePlayer) => p.userId === userId);
    const sanitizedStatements = statementResult.data.map(s => ({ index: s.index, text: s.text }));

    if (existingPlayer >= 0) {
      players[existingPlayer].statements = sanitizedStatements;
    } else {
      players.push({ userId, displayName, statements: sanitizedStatements });
    }

    state.lieDetectivePlayers = players;
    if (state.currentLieDetectivePlayerIndex === undefined) {
      state.currentLieDetectivePlayerIndex = 0;
    }
    state.lieDetectiveCompletedUserIds = state.lieDetectiveCompletedUserIds || [];
    state.currentLieDetectiveReveal = undefined;
    state.votes = state.votes || [];
    await updateSession(socialSessionId, state);

    return res.json({ statements: sanitizedStatements, meta: statementResult.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] lie-detective/generate error:', { error });
    return res.status(500).json({ error: 'Failed to generate statements' });
  }
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/vote
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const voterId: string = req.session?.userId;
  const { targetUserId, guessedStatementIndex } = req.body as {
    targetUserId: string;
    guessedStatementIndex: number;
  };

  if (!voterId || !targetUserId || guessedStatementIndex === undefined || guessedStatementIndex === null) {
    return res.status(400).json({ error: 'Authentication, targetUserId, and guessedStatementIndex are required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — votes are only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  await runBotSimulationSafely(socialSessionId, state, 'lie-detective-vote');

  if (voterId === targetUserId) {
    return res.status(400).json({ error: 'Players cannot vote on their own statements' });
  }

  const currentPlayer = getCurrentLieDetectivePlayer(state);
  if (!currentPlayer || currentPlayer.userId !== targetUserId) {
    return res.status(400).json({ error: 'Votes are only allowed for the active lie-detective player' });
  }

  if ((state.lieDetectivePlayers || []).length < state.playerCount) {
    return res.status(400).json({ error: 'All participants must generate statements before voting begins' });
  }

  if (state.currentLieDetectiveReveal?.targetUserId === targetUserId) {
    return res.json({
      votes: (state.votes || []).filter((v: LieDetectiveVote) => v.targetUserId === targetUserId),
      isRevealed: true,
      lieIndex: state.currentLieDetectiveReveal.lieIndex,
      reveal: state.currentLieDetectiveReveal,
    });
  }

  const votes: LieDetectiveVote[] = state.votes || [];
  const existingVoteIdx = votes.findIndex(
    (v: LieDetectiveVote) => v.voterId === voterId && v.targetUserId === targetUserId,
  );
  if (existingVoteIdx >= 0) {
    votes[existingVoteIdx].guessedStatementIndex = guessedStatementIndex;
  } else {
    votes.push({ voterId, targetUserId, guessedStatementIndex });
  }
  state.votes = votes;
  await updateSession(socialSessionId, state);

  const otherPlayerCount = Math.max(0, state.playerCount - 1);
  const votesForTarget = votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId).length;
  const isRevealed = votesForTarget >= otherPlayerCount && otherPlayerCount > 0;

  let lieIndex: number | undefined;
  let reveal: LieDetectiveReveal | undefined;

  // Compute per-statement vote counts for V2 recap / reveal
  const voteCounts: Record<number, number> = {};
  for (const v of votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId)) {
    voteCounts[v.guessedStatementIndex] = (voteCounts[v.guessedStatementIndex] || 0) + 1;
  }

  if (isRevealed) {
    // Fetch server-only truth from the separate table (never from stateJson).
    const playerStatements = await getLieTruths(socialSessionId, targetUserId);
    lieIndex = playerStatements?.find(s => s.isLie)?.index;
    if (lieIndex !== undefined) {
      const correctVoteCount = votes
        .filter((v: LieDetectiveVote) => v.targetUserId === targetUserId && v.guessedStatementIndex === lieIndex)
        .length;
      reveal = {
        targetUserId,
        lieIndex,
        voteCount: votesForTarget,
        correctVoteCount,
        revealedAt: Date.now(),
        aiStatementIndex: lieIndex,
        voteCounts,
      };
      state.currentLieDetectiveReveal = reveal;
      const completedUserIds = new Set(state.lieDetectiveCompletedUserIds || []);
      completedUserIds.add(targetUserId);
      state.lieDetectiveCompletedUserIds = [...completedUserIds];

      // V2: track reveal history for dynamic difficulty
      const mode = getLieDetectiveMode(state.lieDetectiveMode);
      if (mode === 'v2') {
        const correctRate = otherPlayerCount > 0 ? correctVoteCount / otherPlayerCount : 0;
        const history = state.lieDetectiveRevealHistory || [];
        const round = history.length + 1;
        history.push({ round, correctRate });
        state.lieDetectiveRevealHistory = history;
        state.lieDetectiveDynamicDifficulty = getDynamicDifficulty(history);
      }

      await updateSession(socialSessionId, state);
    }
  }

  return res.json({
    votes: votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId),
    isRevealed,
    lieIndex,
    reveal,
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/auction/generate-lots
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/generate-lots', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate auction lots' });
  }

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  if ((state.auctionLots || []).length > 0) {
    const cachedMeta =
      state.auctionLotsMeta ??
      buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-auction-lots-v1');
    return res.json({
      lots: state.auctionLots,
      meta: cachedMeta,
      balances: state.auctionBalances,
      currentLotIndex: state.auctionCurrentLotIndex ?? 0,
      state: await buildClientState(state, userId),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const archetypeCtx = buildArchetypeContext(roster);
    const lotResult = await generateAuctionLots({
      participantCount: Math.max(state.playerCount, roster.length || 1),
      eventType: state.eventType,
      sessionContext: archetypeCtx.mixText ? { mixText: archetypeCtx.mixText } : undefined,
    });
    const balances: Record<string, number> = {};
    for (const p of roster) {
      balances[p.userId] = AUCTION_STARTING_COINS;
    }
    if (!balances[state.hostUserId]) {
      balances[state.hostUserId] = AUCTION_STARTING_COINS;
    }

    state.auctionLots = lotResult.data;
    state.auctionLotsMeta = lotResult.meta;
    state.auctionBalances = balances;
    state.auctionCurrentLotIndex = 0;
    state.auctionHighBid = null;
    state.auctionAllLotsClosed = false;
    state.auctionRecapLines = [];
    state.auctionLotStartedAt = Date.now();
    state.auctionBidHistory = [];
    await updateSession(socialSessionId, state);

    return res.json({
      lots: lotResult.data,
      meta: lotResult.meta,
      balances: state.auctionBalances,
      currentLotIndex: 0,
      state: await buildClientState(state, userId),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] auction/generate-lots error:', { error });
    return res.status(500).json({ error: 'Failed to generate auction lots' });
  }
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/auction/bid
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/bid', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  const bidSchema = z.object({ amount: z.number().int().positive() });
  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid bid data', details: parsed.error.format() });
  }
  const { amount } = parsed.data;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  const lots = state.auctionLots || [];
  if (lots.length === 0) {
    return res.status(400).json({ error: 'Auction lots have not been generated yet' });
  }

  if (state.auctionAllLotsClosed) {
    return res.status(400).json({ error: 'Auction is complete' });
  }

  const balances = { ...(state.auctionBalances || {}) };
  const available = balances[userId] ?? 0;
  const high = state.auctionHighBid;

  if (high && amount <= high.amount) {
    return res.status(400).json({ error: 'Bid must be higher than the current high bid' });
  }

  if (amount > available) {
    return res.status(400).json({ error: 'Insufficient virtual coins for this bid' });
  }

  const previousHighBidder = high?.userId ?? null;

  if (high) {
    balances[high.userId] = (balances[high.userId] ?? 0) + high.amount;
  }

  balances[userId] = available - amount;
  state.auctionBalances = balances;
  state.auctionHighBid = { userId, amount };

  // Persist bid to history (D5)
  const bidHistory = [...(state.auctionBidHistory || [])];
  const currentLotIndex = state.auctionCurrentLotIndex ?? 0;
  bidHistory.push({ userId, amount, at: Date.now(), lotIndex: currentLotIndex });
  state.auctionBidHistory = bidHistory.slice(0, 200); // cap at 200 entries

  await updateSession(socialSessionId, state);

  return res.json({
    highBid: state.auctionHighBid,
    balances: state.auctionBalances,
    previousHighBidder,
    state: await buildClientState(state, userId),
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/auction/close-lot
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/close-lot', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can close an auction lot' });
  }

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  const lots = state.auctionLots || [];
  const idx = state.auctionCurrentLotIndex ?? 0;
  if (lots.length === 0 || idx >= lots.length) {
    return res.status(400).json({ error: 'No active auction lot' });
  }

  if (state.auctionAllLotsClosed) {
    return res.status(400).json({ error: 'All auction lots are already closed' });
  }

  const lot = lots[idx];
  const high = state.auctionHighBid;
  const roster = await listParticipants(socialSessionId);
  const nameOf = (uid: string) =>
    recapDisplayNameByUserId(roster, state, uid);

  const lines = [...(state.auctionRecapLines || [])];
  if (high) {
    lines.push(`${lot.title}由${nameOf(high.userId)}以${high.amount}虚拟币拍下`);
  } else {
    lines.push(`${lot.title}流拍（无人出价）`);
  }

  state.auctionRecapLines = lines.slice(0, 16);
  state.auctionHighBid = null;

  if (idx >= lots.length - 1) {
    state.auctionAllLotsClosed = true;
    state.auctionLotStartedAt = undefined;
  } else {
    state.auctionCurrentLotIndex = idx + 1;
    state.auctionLotStartedAt = Date.now();
  }

  await updateSession(socialSessionId, state);

  return res.json({
    currentLotIndex: state.auctionCurrentLotIndex ?? 0,
    allLotsClosed: state.auctionAllLotsClosed ?? false,
    recapLines: state.auctionRecapLines,
    state: await buildClientState(state, userId),
  });
});
// GET /api/social-icebreaker/:socialSessionId/quip-battle/results
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/quip-battle/results', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  // Authorize before resolveSession: resolveSession runs processAutoAdvance and may persist.
  const { state: preAuthState, expired: preExpired } = await getSessionWithExpiry(socialSessionId);
  if (!preAuthState) {
    if (preExpired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    return res.status(404).json({ error: 'Social session not found' });
  }
  const prelim = hydrateDerivedState({ ...preAuthState });
  if (!(await isHostAuthorized(prelim, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can reveal quip battle results' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  if (state.quipBattleRevealed && Array.isArray(state.quipBattleResults) && state.quipBattleResults.length > 0) {
    return res.json({
      results: state.quipBattleResults,
      allVoted: hasAllRosterParticipantsResponded(state.quipBattleVotedUserIds, state.playerCount),
    });
  }

  const prompts = state.quipBattlePrompts || [];
  if (prompts.length === 0) {
    return res.status(400).json({ error: 'Quip battle prompts not generated' });
  }

  if (!hasAllRosterParticipantsResponded(state.quipBattleSubmittedUserIds, state.playerCount)) {
    return res.status(400).json({ error: 'All participants must submit answers before revealing results' });
  }

  if (!hasAllRosterParticipantsResponded(state.quipBattleVotedUserIds, state.playerCount)) {
    return res.status(400).json({ error: 'All participants must vote before revealing results' });
  }

  const answers = state.quipBattleAnswers || [];
  const votes = state.quipBattleVotes || [];

  // Compute results per prompt
  const results = prompts.map((prompt: any) => {
    const promptAnswers = answers.filter((a: any) => a.promptId === prompt.id);
    const promptVotes = votes.filter((v: any) => v.promptId === prompt.id);

    // Count votes per answer
    const voteCounts: Record<string, number> = {};
    for (const v of promptVotes) {
      voteCounts[v.answerId] = (voteCounts[v.answerId] || 0) + 1;
    }

    // Find winner
    let winnerUserId = '';
    let winnerDisplayName = '';
    let maxVotes = 0;
    for (const [answerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        const answer = promptAnswers.find((a: any) => `${a.userId}::${a.promptId}` === answerId);
        winnerUserId = answer?.userId || '';
        winnerDisplayName = answer?.displayName || '';
      }
    }

    return {
      promptId: prompt.id,
      promptText: prompt.promptText,
      answers: promptAnswers,
      winnerUserId,
      winnerDisplayName,
      voteCount: maxVotes,
    };
  });

  state.quipBattleResults = results;
  state.quipBattleRevealed = true;
  await updateSession(socialSessionId, state);

  return res.json({
    results,
    allVoted: hasAllRosterParticipantsResponded(state.quipBattleVotedUserIds, state.playerCount),
  });
});
// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/recap
// ---------------------------------------------------------------------------
router.get('/:socialSessionId/recap', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const { state: preAuthState, expired: preExpired } = await getSessionWithExpiry(socialSessionId);
  if (!preAuthState) {
    if (preExpired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    return res.status(404).json({ error: 'Social session not found' });
  }
  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!state.recapSnapshot) {
    await ensureRecapSnapshot(state, socialSessionId);
  }

  const snapshot = state.recapSnapshot;
  if (!snapshot) {
    return res.status(500).json({ error: 'Failed to generate recap' });
  }

  return res.json({
    summary: snapshot.recapSummary,
    meta: snapshot.meta,
    medals: snapshot.medals,
    lieDetectiveV2Stats: snapshot.lieDetectiveV2Stats,
    personalityDiceHighlights: snapshot.personalityDiceHighlights,
    undercoverWordResult: snapshot.undercoverWordResult,
    microChallengeHighlights: snapshot.microChallengeHighlights,
    groupMirrorHighlights: snapshot.groupMirrorHighlights,
    state: await buildClientState(state),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/force-end
// Admin / kill-switch only: immediately end the session regardless of phase.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/force-end', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can force-end a session' });
  }

  const flagEnabled = await getFeatureFlag('socialIcebreakerClientForceEnd', false);
  if (!flagEnabled) {
    return res.status(503).json({ error: 'Force-end is not enabled', code: 'FORCE_END_DISABLED' });
  }

  state.currentPhase = 'ended' as SocialIcebreakerPhase;
  await updateSession(socialSessionId, state);

  logger.info('[SocialIcebreaker] Session force-ended by host', { socialSessionId, userId });
  return res.json({ ended: true, phase: 'ended' });
});
}
