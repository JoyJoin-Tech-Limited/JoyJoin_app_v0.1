import type { Router } from 'express';
import type { SocialSessionState, SocialIcebreakerPhase, LieDetectivePlayer, LieDetectiveVote, LieDetectiveReveal } from '@shared/socialIcebreaker';
import { z } from 'zod';
import { AUCTION_STARTING_COINS } from '@shared/socialIcebreaker';
import {
  generateXiaoYueComment,
  generateAuctionLots,
  generateLieDetectiveStatements,
  generateLieDetectiveStatementFromTag,
  validateLieDetectiveTag,
  getCuratedWarmupTopics,
  getLieDetectiveMode,
  getDynamicDifficulty,
  buildLieDetectiveV2RecapData,
} from '../socialIcebreakerAIService';
import { buildCachedAIMeta, buildFallbackAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  buildClientState,
  hasAllRosterParticipantsResponded,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  hydrateDerivedState,
  resolveSession,
  isHostAuthorized,
  recapDisplayNameByUserId,
  ensureRecapSnapshot,
  waitForDeferredRecapSnapshot,
  transitionPhase,
  hasWarmupTurnCompleted,
} from './socialIcebreakerHelpers';
import { emitSocialGroupBeat } from '../lib/socialGroupBeats';
import { buildArchetypeContext } from '../lib/contextInjector';
import {
  getSessionWithExpiry,
  getParticipant,
  updateSession,
  listParticipants,
  setLieTruths,
  getLieTruths,
} from '../lib/socialIcebreakerStore';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../lib/featureFlags';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { getBots, simulateBotsForSession, runBotSimulationSafely } from '../services/socialIcebreakerBotService';
import {
  buildCustomLieDetectiveStatements,
  resolveLieDetectiveTargetUserId,
} from '../lib/lieDetectiveSubmission';
import { validateContentSafeAsync, contentViolationResponse } from '../lib/contentSafety';
import { recordViolation } from '../abuseDetection';

export function registerExtendedRoutes(router: Router): void {

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/advance
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/advance', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;
  const { currentPhase, force } = req.body as { currentPhase: SocialIcebreakerPhase; force?: boolean };

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

  // `force` is the stall-nudge escape hatch: the host explicitly skips
  // stragglers. Per-phase completion guards are bypassed; structural checks
  // (auth, phase match) above always apply.
  const skipGuards = force === true;
  if (skipGuards) {
    logger.info('[SocialIcebreaker] Force advance requested (stall nudge)', {
      socialSessionId,
      phase: currentPhase,
      userId,
    });
  }

  if (currentPhase === 'warmup') {
    if ((state.warmupTopics || []).length === 0) {
      const healingMood = state.selectedMood ?? 'relaxed';
      state.selectedMood = healingMood;
      state.warmupTopics = getCuratedWarmupTopics(healingMood, state.vibe);
      state.warmupTopicsMeta = buildFallbackAIMeta('advance_route_missing_topics', 'social-warmup-topics-advance-heal');
      state.currentTopicIndex = state.currentTopicIndex ?? 0;
      await updateSession(socialSessionId, state).catch((err) => {
        logger.warn('[SocialIcebreaker] Warmup topic self-heal save failed during advance', {
          socialSessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    if (!skipGuards) {
      const everyoneReady = hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount);
      if (!everyoneReady && !hasWarmupTurnCompleted(state)) {
        return res.status(400).json({ error: 'Current speaker must finish before advancing warmup' });
      }

      if ((state.warmupTopics || []).length === 0) {
        return res.status(400).json({ error: 'Topic cards must be generated before advancing' });
      }
    }

    incrementCommonGround(state);
  }

  if (!skipGuards && currentPhase === 'micro_challenge') {
    const everyoneCompleted = hasAllRosterParticipantsResponded(state.challengeCompletedBy, state.playerCount);

    if (!everyoneCompleted) {
      return res.status(400).json({ error: 'Wait for everyone to finish' });
    }
  }

  if (!skipGuards && currentPhase === 'personality_dice') {
    const revealReady = hasAllRosterParticipantsResponded(state.diceRevealReadyBy, state.playerCount);
    if (!state.diceRevealOrder?.length || !revealReady) {
      return res.status(409).json({ error: 'Wait for everyone to prepare for the next game' });
    }
  }

  if (currentPhase === 'lie_detective') {
    if (!skipGuards) {
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

  if (!skipGuards && currentPhase === 'auction') {
    if (!state.auctionAllLotsClosed) {
      return res.status(400).json({
        error: 'Host must close every auction lot (use close-lot) before advancing out of auction',
      });
    }
  }

  if (!skipGuards && currentPhase === 'mini_script') {
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

  if (!skipGuards && currentPhase === 'undercover_word') {
    if (!state.undercoverWordPair) {
      return res.status(400).json({ error: 'Word pair not generated' });
    }
    if (!state.undercoverWordRevealed) {
      return res.status(400).json({ error: 'Undercover word must be revealed before advancing' });
    }
  }

  if (!skipGuards && currentPhase === 'group_mirror') {
    if (!state.groupMirrorQuestions || state.groupMirrorQuestions.length === 0) {
      return res.status(400).json({ error: 'Group mirror questions not generated' });
    }
    if (!state.groupMirrorRevealed) {
      return res.status(400).json({ error: 'Group mirror results must be revealed before advancing' });
    }
  }

  if (!skipGuards && currentPhase === 'speed_friending') {
    if (!state.speedFriendingAllRoundsComplete) {
      return res.status(400).json({
        error: 'All speed friending rounds must be completed before advancing',
      });
    }
  }

  const result = await transitionPhase({
    state,
    socialSessionId,
    trigger: 'host_tap',
  });

  if (result.pausedAtBonusGate) {
    return res.json({ state: await buildClientState(state, userId) });
  }

  const effectiveNextPhase = result.nextPhase;

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
    content: result.challenge ? { challenge: result.challenge } : null,
    xiaoYueComment: xyResult.data,
    xiaoYueCommentMeta: xyResult.meta,
    meta: result.challengeMeta,
    state: await buildClientState(state, userId),
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/early-end
// Host escape hatch: jump the whole table to recap from any playable phase.
// The skipped phase is NOT counted as played so recap framing stays honest.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/early-end', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can end the session early' });
  }

  const blockedPhases: SocialIcebreakerPhase[] = ['warmup', 'recap', 'phase_selection'];
  if (blockedPhases.includes(state.currentPhase) || (state.currentPhase as string) === 'ended') {
    return res.status(400).json({
      error: 'Session cannot be ended early from the current phase',
      code: 'EARLY_END_PHASE_BLOCKED',
    });
  }

  // Resolve a pending bonus gate cleanly so mid-vote players land in recap
  // without a ghost gate overlay.
  if (state.bonusGateOffered && !state.bonusGateAccepted && !state.bonusGateDeclined) {
    state.bonusGateDeclined = true;
    state.bonusGatePlayerSentiment = undefined;
  }

  state.endedEarlyAt = new Date().toISOString();
  state.interruptedAtPhase = state.currentPhase;

  await transitionPhase({
    state,
    socialSessionId,
    trigger: 'early_end_jump',
    targetPhase: 'recap',
    countCurrentPhaseCompleted: false,
    skipBonusGate: true,
    deferRecapSnapshot: true,
  });

  logger.info('[SocialIcebreaker] Session ended early by host', { socialSessionId, userId });
  return res.json({ state: await buildClientState(state, userId) });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/stall-nudge/dismiss
// Host dismisses the stall nudge; stall automation stays silent for this phase.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/stall-nudge/dismiss', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can dismiss the stall nudge' });
  }

  state.stallNudgeAt = undefined;
  state.stallSuppressedForPhase = state.currentPhase;
  await updateSession(socialSessionId, state);

  return res.json({ state: await buildClientState(state, userId) });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { displayName, archetype, interests, statements: customStatementTexts, lieIndex } = req.body as {
    displayName: string;
    archetype?: string;
    interests?: string[];
    statements?: string[];
    lieIndex?: number;
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
    const isCustomSubmission = customStatementTexts !== undefined || lieIndex !== undefined;
    let statementResult: Awaited<ReturnType<typeof generateLieDetectiveStatements>>;
    if (isCustomSubmission) {
      let customStatements;
      try {
        customStatements = buildCustomLieDetectiveStatements(customStatementTexts, lieIndex);
      } catch (error) {
        logger.warn('[SocialIcebreaker] custom lie-detective statements rejected', {
          socialSessionId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(400).json({
          error: error instanceof Error ? error.message : 'Invalid custom statements',
        });
      }

      for (const statement of customStatements) {
        const safetyResult = await validateContentSafeAsync(statement.text, 'lieDetectiveStatement', { userId });
        if (!safetyResult.safe && safetyResult.violation) {
          await recordViolation(userId, safetyResult.violation.type, safetyResult.violation.severity);
          return res.status(400).json(contentViolationResponse(safetyResult.violation).body);
        }
      }

      statementResult = {
        data: customStatements,
        meta: {
          generatedAt: new Date().toISOString(),
          fromCache: false,
          provider: null,
          fallbackUsed: false,
          promptVersion: 'social-lie-detective-user-v1',
        },
      };
    } else {
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

      if (mode === 'v2') {
        const tags = state.lieDetectiveV2Tags?.[userId];
        if (!tags) {
          return res.status(400).json({ error: 'Tags not submitted. Please submit tags first.' });
        }
        generateParams.tags = tags;
      }

      statementResult = await generateLieDetectiveStatements(generateParams);
    }

    // Persist server-only truth data (isLie + V2 is_ai/source_tag) in the separate lie-truths table.
    await setLieTruths(socialSessionId, userId, statementResult.data);

    // Store sanitized statements (no isLie / is_ai / source_tag) in public session state.
    const players: LieDetectivePlayer[] = state.lieDetectivePlayers || [];
    const existingPlayer = players.findIndex((p: LieDetectivePlayer) => p.userId === userId);
    const sanitizedStatements = statementResult.data.map(s => ({ index: s.index, text: s.text }));

    if (existingPlayer >= 0) {
      players[existingPlayer].statements = sanitizedStatements;
    } else {
      const botUserIds = new Set(getBots(state).map((bot) => bot.userId));
      const player = { userId, displayName, statements: sanitizedStatements };
      if (botUserIds.size > 0 && !botUserIds.has(userId)) {
        // Custom single-test mode eagerly prepares bots. Keep the real tester
        // first without changing the established bot-ready lifecycle.
        players.unshift(player);
      } else {
        players.push(player);
      }
    }

    state.lieDetectivePlayers = players;
    state.lieDetectiveStatementsMeta = isCustomSubmission ? undefined : statementResult.meta;
    if (state.currentLieDetectivePlayerIndex === undefined) {
      state.currentLieDetectivePlayerIndex = 0;
    }
    state.lieDetectiveCompletedUserIds = state.lieDetectiveCompletedUserIds || [];
    state.currentLieDetectiveReveal = undefined;
    state.votes = state.votes || [];
    await updateSession(socialSessionId, state);

    // Single-test mode: bots cannot call this route themselves, so fill their
    // statements now or the phase stalls at "waiting for all statements".
    await runBotSimulationSafely(socialSessionId, state, 'lie-detective-generate');
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
  const { targetUserId: clientTargetUserId, guessedStatementIndex } = req.body as {
    targetUserId: string;
    guessedStatementIndex: number;
  };

  if (!voterId || !clientTargetUserId || guessedStatementIndex === undefined || guessedStatementIndex === null) {
    return res.status(400).json({ error: 'Authentication, targetUserId, and guessedStatementIndex are required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — votes are only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  await runBotSimulationSafely(socialSessionId, state, 'lie-detective-vote');
  const targetUserId = resolveLieDetectiveTargetUserId(
    clientTargetUserId,
    state.singleTest?.botPersonas,
  );

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
    const publicVotes = (state.votes || [])
      .filter((v: LieDetectiveVote) => v.targetUserId === targetUserId)
      .map((vote: LieDetectiveVote) => ({ ...vote, targetUserId: clientTargetUserId }));
    return res.json({
      votes: publicVotes,
      isRevealed: true,
      lieIndex: state.currentLieDetectiveReveal.lieIndex,
      reveal: {
        ...state.currentLieDetectiveReveal,
        targetUserId: clientTargetUserId,
      },
      state: await buildClientState(state, voterId),
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
      // S6: group reveal beat (state-free; poll remains state truth).
      void emitSocialGroupBeat(state.icebreakerSessionId, 'reveal');
    }
  }

  const publicTargetUserId = clientTargetUserId;
  const publicVotes = votes
    .filter((v: LieDetectiveVote) => v.targetUserId === targetUserId)
    .map((vote) => ({ ...vote, targetUserId: publicTargetUserId }));
  const publicReveal = reveal ? { ...reveal, targetUserId: publicTargetUserId } : reveal;

  return res.json({
    votes: publicVotes,
    isRevealed,
    lieIndex,
    reveal: publicReveal,
    state: await buildClientState(state, voterId),
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
  const spendable = available + (high?.userId === userId ? high.amount : 0);

  if (high && amount <= high.amount) {
    return res.status(400).json({ error: 'Bid must be higher than the current high bid' });
  }

  if (amount > spendable) {
    return res.status(400).json({ error: 'Insufficient virtual coins for this bid' });
  }

  const previousHighBidder = high?.userId ?? null;

  if (high) {
    balances[high.userId] = (balances[high.userId] ?? 0) + high.amount;
  }

  balances[userId] = spendable - amount;
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
  } else {
    state.auctionCurrentLotIndex = idx + 1;
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
  // S6: group reveal beat (state-free; poll remains state truth).
  void emitSocialGroupBeat(state.icebreakerSessionId, 'reveal');

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

  let state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await waitForDeferredRecapSnapshot(socialSessionId);
  state = await resolveSession(socialSessionId, res);
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
    state: await buildClientState(state, userId),
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
router.post('/:socialSessionId/lie-detective/generate-from-tag', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const { socialSessionId } = req.params;
  const state = await resolveSession(socialSessionId, res);
  if (!state) return;
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }
  if (!(await getParticipant(socialSessionId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const validation = validateLieDetectiveTag(req.body?.tag);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const result = await generateLieDetectiveStatementFromTag({
    tag: validation.tag,
    displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : '玩家',
  });
  return res.json({ text: result.data.text, meta: result.meta });
});
}
