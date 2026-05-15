import type { Router } from 'express';
import type { SocialSessionState, SocialIcebreakerPhase, LieDetectivePlayer, LieDetectiveVote, LieDetectiveReveal } from '@shared/socialIcebreaker';
import { z } from 'zod';
import { getNextEligiblePhase, AUCTION_STARTING_COINS } from '@shared/socialIcebreaker';
import {
  generateMicroChallenges,
  generateRecapSummary,
  generateXiaoYueComment,
  generateAuctionLots,
  generateLieDetectiveStatements,
  getLieDetectiveMode,
  getDynamicDifficulty,
  buildLieDetectiveV2RecapData,
} from '../socialIcebreakerAIService';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import { cleanupPhaseStateForNextPhase } from '../socialIcebreakerPhaseConfig';
import {
  buildClientState,
  hasAllRosterParticipantsResponded,
  getMicroChallengeDeadlineMs,
  buildLieDetectiveRecapHighlights,
  buildPersonalityDiceRecapLines,
  buildMiniScriptRecapLine,
  buildAuctionRecapLines,
  buildRecapParticipants,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  hydrateDerivedState,
  loadSessionForAuthGate,
  resolveSession,
  isHostAuthorized,
  recapDisplayNameByUserId,
} from './socialIcebreakerHelpers';
import { filterContent } from '../contentFilter';
import { buildArchetypeContext } from '../lib/contextInjector';
import {
  getSessionWithExpiry,
  getParticipant,
  updateSession,
  listParticipants,
  loadSessionLieTruths,
  setLieTruths,
  getLieTruths,
} from '../lib/socialIcebreakerStore';
import { curateMedals } from '../lib/medalCuration';
import { logger } from '../lib/logger';
import { requireAuthenticatedUserId } from '../lib/requestAuth';

function buildRecapHighlights(state: SocialSessionState, roster?: Array<{ userId: string; displayName: string }>) {
  const highlights: Partial<{
    lieDetectiveV2Stats: { aiWinRate: number; hardestRound: number; fooledEveryone: number };
    personalityDiceHighlights: { completedCount: number; passedCount: number; completionRate: number };
    undercoverWordResult: { caught: boolean; undercoverDisplayName: string };
    microChallengeHighlights: { completedCount: number; totalCount: number; completionRate: number };
    groupMirrorHighlights: { topVotedDisplayName: string; questionText: string; voteCount: number };
  }> = {};

  if (state.lieDetectiveRevealHistory && state.lieDetectiveRevealHistory.length > 0) {
    highlights.lieDetectiveV2Stats = buildLieDetectiveV2RecapData(state.lieDetectiveRevealHistory);
  }

  if (state.diceCompletedBy || state.dicePassedBy) {
    const completedCount = state.diceCompletedBy?.length || 0;
    const passedCount = state.dicePassedBy?.length || 0;
    const totalChallenges = state.personalityDiceChallenges?.length || state.playerCount || 1;
    highlights.personalityDiceHighlights = {
      completedCount,
      passedCount,
      completionRate: Math.round(((completedCount + passedCount) / totalChallenges) * 100),
    };
  }

  if (state.undercoverWordResults) {
    highlights.undercoverWordResult = {
      caught: state.undercoverWordResults.caught,
      undercoverDisplayName: state.undercoverWordResults.undercoverDisplayName,
    };
  }

  if (state.challengeCompletedBy) {
    const completedCount = state.challengeCompletedBy.length;
    const totalCount = state.playerCount || 1;
    highlights.microChallengeHighlights = {
      completedCount,
      totalCount,
      completionRate: Math.round((completedCount / totalCount) * 100),
    };
  }

  const mirrorAnswers = state.groupMirrorVotes || state.groupMirrorAnswers || [];
  if (mirrorAnswers.length > 0) {
    const targetCounts: Record<string, number> = {};
    for (const a of mirrorAnswers) {
      targetCounts[a.targetUserId] = (targetCounts[a.targetUserId] || 0) + 1;
    }
    let topTarget = '';
    let maxCount = 0;
    for (const [uid, count] of Object.entries(targetCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topTarget = uid;
      }
    }
    if (topTarget && maxCount > 0) {
      const questions = state.groupMirrorQuestions || [];
      const targetDisplayName = roster?.find((r) => r.userId === topTarget)?.displayName
        || mirrorAnswers.find((a) => a.userId === topTarget)?.displayName
        || '匿名';
      highlights.groupMirrorHighlights = {
        topVotedDisplayName: targetDisplayName,
        questionText: questions[0]?.questionText || '',
        voteCount: maxCount,
      };
    }
  }

  return highlights;
}

export function registerExtendedRoutes(router: Router): void {
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

  const prelimAdvance = await loadSessionForAuthGate(socialSessionId, res);
  if (!prelimAdvance) return;

  if (!(await isHostAuthorized(prelimAdvance, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can advance phases' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== currentPhase) {
    return res.status(400).json({ error: 'Phase mismatch' });
  }

  if (currentPhase === 'warmup') {
    if (!hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount)) {
      return res.status(400).json({ error: 'All participants must be ready before advancing warmup' });
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

  const effectiveNextPhase = getNextEligiblePhase(currentPhase, state);

  if (!state.completedPhases.includes(currentPhase)) {
    state.completedPhases = [...(state.completedPhases || []), currentPhase];
  }

  cleanupPhaseStateForNextPhase(state, currentPhase);
  state.currentPhase = effectiveNextPhase;
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  if (effectiveNextPhase === 'warmup') {
    state.warmupReadyUserIds = [];
  }
  await updateSession(socialSessionId, state);

  if (effectiveNextPhase === 'recap') {
    if (!state.recapSnapshot) {
      try {
        const roster = await listParticipants(socialSessionId);
        const medals = curateMedals(state, roster);

        const durationMinutes = Math.round(
          (Date.now() - (state.sessionStartedAt || state.phaseStartedAt || Date.now())) / 60000
        );
        const sessionLieMap = await loadSessionLieTruths(socialSessionId);
        const lieHighlights = buildLieDetectiveRecapHighlights(state, roster, sessionLieMap);
        const personalityDiceRecapLines = buildPersonalityDiceRecapLines(state);
        const miniScriptRecapLine = buildMiniScriptRecapLine(state);
        const auctionRecapLines = buildAuctionRecapLines(state);

        const summaryResult = await generateRecapSummary({
          participants: buildRecapParticipants(roster, state),
          topicsDiscussed: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).map(t => t.question),
          challengesCompleted: state.challengeCompletedBy?.length || 0,
          commonGroundCount: state.commonGroundCount || 0,
          lieDetectiveHighlights: lieHighlights.length ? lieHighlights : undefined,
          personalityDiceRecapLines: personalityDiceRecapLines.length ? personalityDiceRecapLines : undefined,
          miniScriptRecapLine,
          auctionRecapLines: auctionRecapLines.length ? auctionRecapLines : undefined,
          durationMinutes,
        });

        state.recapSnapshot = {
          recapSummary: summaryResult.data,
          medals,
          meta: summaryResult.meta,
          ...buildRecapHighlights(state, roster),
        };
        await updateSession(socialSessionId, state);
      } catch (error) {
        logger.error('[SocialIcebreaker] Failed to generate recap snapshot:', { error: String(error) });
        // Continue without snapshot — GET /recap and GET /moment-card will fall back
      }
    }
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

  const prelimLieGen = await loadSessionForAuthGate(socialSessionId, res);
  if (!prelimLieGen) return;

  if (!(await getParticipant(socialSessionId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — statement generation is only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
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

  const prelimLieVote = await loadSessionForAuthGate(socialSessionId, res);
  if (!prelimLieVote) return;

  if (!(await getParticipant(socialSessionId, voterId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — votes are only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

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

  const prelimAuctionGen = await loadSessionForAuthGate(socialSessionId, res);
  if (!prelimAuctionGen) return;

  if (!(await isHostAuthorized(prelimAuctionGen, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate auction lots' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

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

  const prelimAuctionBid = await loadSessionForAuthGate(socialSessionId, res);
  if (!prelimAuctionBid) return;

  if (!(await getParticipant(socialSessionId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
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

  const prelimAuctionClose = await loadSessionForAuthGate(socialSessionId, res);
  if (!prelimAuctionClose) return;

  if (!(await isHostAuthorized(prelimAuctionClose, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can close an auction lot' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

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

  if (state.recapSnapshot) {
    const roster = await listParticipants(socialSessionId);
    return res.json({
      summary: state.recapSnapshot.recapSummary,
      meta: state.recapSnapshot.meta,
      medals: state.recapSnapshot.medals,
      lieDetectiveV2Stats: state.recapSnapshot.lieDetectiveV2Stats,
      personalityDiceHighlights: state.recapSnapshot.personalityDiceHighlights,
      undercoverWordResult: state.recapSnapshot.undercoverWordResult,
      microChallengeHighlights: state.recapSnapshot.microChallengeHighlights,
      groupMirrorHighlights: state.recapSnapshot.groupMirrorHighlights,
      state: await buildClientState(state),
    });
  }

  const durationMinutes = Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000);

  interface Medal {
    emoji: string;
    title: string;
    recipientDisplayName: string;
    description: string;
  }
  const medals: Medal[] = [];

  // Fetch lie truths from the separate server-only table for medal computation.
  const sessionLieMap = await loadSessionLieTruths(socialSessionId);

  // 🕵️ 最佳侦探: most correct lie guesses
  if (sessionLieMap.size > 0 && (state.votes || []).length > 0) {
    const correctByVoter: Record<string, number> = {};
    for (const vote of state.votes || []) {
      const playerStmts = sessionLieMap.get(vote.targetUserId);
      const lieStmt = playerStmts?.find(s => s.isLie);
      if (lieStmt && vote.guessedStatementIndex === lieStmt.index) {
        correctByVoter[vote.voterId] = (correctByVoter[vote.voterId] || 0) + 1;
      }
    }
    const topVoter = Object.entries(correctByVoter).sort((a, b) => b[1] - a[1])[0];
    if (topVoter && topVoter[1] > 0) {
      const allPlayers = [
        ...(state.lieDetectivePlayers || []),
        { userId: state.hostUserId, displayName: state.hostDisplayName },
      ];
      const recipient = allPlayers.find(p => p.userId === topVoter[0]);
      if (recipient) {
        medals.push({
          emoji: '🕵️',
          title: '最佳侦探',
          recipientDisplayName: recipient.displayName,
          description: `猜对了 ${topVoter[1]} 个谎言`,
        });
      }
    }
  }

  // ⚡ 挑战先锋: first person in challengeCompletedBy
  if (state.challengeCompletedBy && state.challengeCompletedBy.length > 0) {
    const firstUserId = state.challengeCompletedBy[0];
    const allPlayersForChallenge = [
      ...(state.lieDetectivePlayers || []),
      { userId: state.hostUserId, displayName: state.hostDisplayName },
    ];
    const recipient = allPlayersForChallenge.find(p => p.userId === firstUserId);
    if (recipient) {
      medals.push({
        emoji: '⚡',
        title: '挑战先锋',
        recipientDisplayName: recipient.displayName,
        description: '第一个完成挑战',
      });
    }
  }

  // 💬 话题王
  const MIN_TOPICS_FOR_MEDAL = 3;
  if ((state.currentTopicIndex ?? 0) >= MIN_TOPICS_FOR_MEDAL - 1) {
    medals.push({
      emoji: '💬',
      title: '话题王',
      recipientDisplayName: state.hostDisplayName,
      description: '带领大家聊了多个精彩话题',
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const lieHighlights = buildLieDetectiveRecapHighlights(state, roster, sessionLieMap);
    const personalityDiceRecapLines = buildPersonalityDiceRecapLines(state);
    const miniScriptRecapLine = buildMiniScriptRecapLine(state);
    const auctionRecapLines = buildAuctionRecapLines(state);

    const summaryResult = await generateRecapSummary({
      participants: buildRecapParticipants(roster, state),
      topicsDiscussed: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).map(t => t.question),
      challengesCompleted: state.challengeCompletedBy?.length || 0,
      commonGroundCount: state.commonGroundCount || 0,
      lieDetectiveHighlights: lieHighlights.length ? lieHighlights : undefined,
      personalityDiceRecapLines: personalityDiceRecapLines.length ? personalityDiceRecapLines : undefined,
      miniScriptRecapLine,
      auctionRecapLines: auctionRecapLines.length ? auctionRecapLines : undefined,
      durationMinutes,
    });

    const highlights = buildRecapHighlights(state, roster);
    return res.json({
      summary: summaryResult.data,
      meta: summaryResult.meta,
      medals,
      lieDetectiveV2Stats: highlights.lieDetectiveV2Stats,
      personalityDiceHighlights: highlights.personalityDiceHighlights,
      undercoverWordResult: highlights.undercoverWordResult,
      microChallengeHighlights: highlights.microChallengeHighlights,
      groupMirrorHighlights: highlights.groupMirrorHighlights,
      state: await buildClientState(state),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] Failed to generate recap:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate recap' });
  }
});
}
