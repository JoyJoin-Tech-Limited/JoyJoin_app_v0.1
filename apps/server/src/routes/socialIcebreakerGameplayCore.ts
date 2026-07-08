import { Router } from 'express';
import { z } from 'zod';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  LieDetectivePlayer,
  LieDetectiveVote,
  LieDetectiveReveal,
  PersonalityDiceChallenge,
  PersonalityDiceChallengeGroup,
} from '@shared/socialIcebreaker';
import {
  getNextEligiblePhase,
  AUCTION_STARTING_COINS,
} from '@shared/socialIcebreaker';
import { getArchetypeHSL } from '@shared/archetypeColors';
import {
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generatePersonalityDiceChallenges,
  generatePersonalityDiceChallengeGroups,
  generateQuipBattlePrompts,
  validateLieDetectiveV2Tags,
  getLieDetectiveMode,
  getDynamicDifficulty,
} from '../socialIcebreakerAIService';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
} from '../socialIcebreakerPhaseConfig';
import {
  getSession,
  updateSession,
  listParticipants,
  getParticipant,
  setLieTruths,
  getLieTruths,
  loadSessionLieTruths,
  getPreGenerationResult,
  invalidatePreGenerationForSession,
} from '../lib/socialIcebreakerStore';
import { logger } from '../lib/logger';
import { validateContentSafe, contentViolationResponse } from '../lib/contentSafety';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import {
  buildClientState,
  hydrateDerivedState,
  hasAllRosterParticipantsResponded,
  getMicroChallengeDeadlineMs,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  resolveSession,
  isHostAuthorized,
} from './socialIcebreakerHelpers';
import { shouldSkipOnDemandGeneration } from '../jobs/preGenerationQueue';
import { recordVoteOptimistically } from '../lib/optimisticSync';
import { runBotSimulationSafely } from '../services/socialIcebreakerBotService';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/micro-challenge/complete
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/micro-challenge/complete', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { operationId } = req.body as { operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'micro-challenge-complete');

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro_challenge phase' });
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'micro_challenge',
        vote: { userId },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.challengeCompletedBy?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');
        const completed = new Set(currentState.challengeCompletedBy || []);
        completed.add(userId);
        currentState.challengeCompletedBy = [...completed];
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({
      completedBy: freshState?.challengeCompletedBy || [],
      allCompleted: hasAllRosterParticipantsResponded(freshState?.challengeCompletedBy, freshState?.playerCount ?? 0),
      operationId,
    });
  }

  const completed = new Set(state.challengeCompletedBy || []);
  completed.add(userId);
  state.challengeCompletedBy = [...completed];
  await updateSession(socialSessionId, state);

  return res.json({
    completedBy: state.challengeCompletedBy,
    completedCount: state.challengeCompletedBy.length,
    allCompleted: hasAllRosterParticipantsResponded(state.challengeCompletedBy, state.playerCount),
    state: await buildClientState(state, userId),
    operationId: null,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/micro-challenge/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/micro-challenge/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate a micro challenge' });
  }

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro challenge phase' });
  }

  if (state.currentChallenge) {
    return res.json({
      challenge: state.currentChallenge,
      meta: state.currentChallengeMeta,
      state: await buildClientState(state, userId),
    });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'micro_challenge');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'micro_challenge');
      if (result) {
        const preGenChallenges = result.contentJson as unknown as Array<Record<string, unknown>>;
        const challenge = preGenChallenges[0] || { id: 'c_pre', title: 'Pre-gen Challenge', description: 'do it', durationSeconds: 120, completionCTA: '完成' };
        state.currentChallenge = challenge as any;
        state.currentChallengeMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-micro-challenges-v2');
        await updateSession(socialSessionId, state);
        logger.info('Micro challenge served from pre-generation', { socialSessionId });
        return res.json({ challenge: state.currentChallenge, meta: state.currentChallengeMeta, state: await buildClientState(state, userId) });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Micro challenge pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Challenge is being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for micro challenge, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  const roster = await listParticipants(socialSessionId);
  const result = await generateMicroChallenges({
    participantCount: roster.length || state.playerCount || 1,
    eventType: state.eventType || '活动',
    roster: roster.map((p) => ({ archetype: p.archetype })),
  });

  state.currentChallenge = result.data[0];
  state.currentChallengeMeta = result.meta;
  await updateSession(socialSessionId, state);

  // Bots complete the freshly generated challenge.
  await runBotSimulationSafely(socialSessionId, state, 'micro-challenge-generate');
  await updateSession(socialSessionId, state);

  return res.json({
    challenge: state.currentChallenge,
    meta: result.meta,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/submit-tags
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/submit-tags', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { tags } = req.body as { tags?: string[] };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  const mode = getLieDetectiveMode(state.lieDetectiveMode);
  if (mode !== 'v2') {
    return res.status(400).json({ error: 'Tag submission is only available in V2 mode' });
  }

  const validation = validateLieDetectiveV2Tags(tags);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Store tags in session state
  state.lieDetectiveV2Tags = state.lieDetectiveV2Tags || {};
  state.lieDetectiveV2Tags[userId] = validation.tags;

  // Fill missing bot tags so the real user can proceed with statement generation.
  await runBotSimulationSafely(socialSessionId, state, 'lie-detective-submit-tags');

  // If all players have submitted tags, optionally trigger statement generation
  const roster = await listParticipants(socialSessionId);
  const allSubmitted = roster.every((p) => state.lieDetectiveV2Tags?.[p.userId]);

  await updateSession(socialSessionId, state);

  return res.json({
    submitted: true,
    tags: validation.tags,
    allPlayersSubmitted: allSubmitted,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/next-player
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/next-player', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'lie-detective-next-player');

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can advance to the next player' });
  }

  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie detective phase' });
  }

  const players = state.lieDetectivePlayers || [];
  const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
  const nextIndex = currentIndex + 1;

  if (nextIndex >= players.length) {
    return res.status(400).json({ error: 'All players have been revealed' });
  }

  state.currentLieDetectivePlayerIndex = nextIndex;
  state.currentLieDetectiveReveal = undefined;
  await updateSession(socialSessionId, state);

  return res.json({
    currentLieDetectivePlayerIndex: nextIndex,
    currentPlayer: players[nextIndex],
    state: await buildClientState(state, userId),
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/personality-dice/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/personality-dice/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { participants } = req.body as {
    participants: Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>;
  };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate dice challenges' });
  }

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  const chooseModeEnabled = (process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED ?? 'true').toLowerCase() === 'true';

  // ── Choose-Mode branch ──
  if (chooseModeEnabled) {
    // Idempotent retry: if groups already exist, return them instead of regenerating
    if ((state.personalityDiceChallengeGroups || []).length > 0) {
      const cachedMeta = state.personalityDiceChallengesMeta
        ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-personality-dice-v4');
      const enrichedGroups = state.personalityDiceChallengeGroups!.map((g) => ({
        ...g,
        archetypeColor: getArchetypeHSL(g.archetype),
        options: g.options.map((o) => ({ ...o, archetypeColor: getArchetypeHSL(o.archetype) })),
      }));
      return res.json({ groups: enrichedGroups, meta: cachedMeta });
    }

    // Pre-generation freshness: check if async pre-gen is available or in-flight
    try {
      const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'personality_dice');
      if (preGenStatus.skip && preGenStatus.reason === 'available') {
        const result = await getPreGenerationResult(socialSessionId, 'personality_dice');
        if (result) {
          const preGenGroups = (result.contentJson as unknown as PersonalityDiceChallengeGroup[]).map((g) => ({
            ...g,
            archetypeColor: getArchetypeHSL(g.archetype),
            options: g.options.map((o) => ({ ...o, archetypeColor: getArchetypeHSL(o.archetype) })),
          }));
          state.personalityDiceChallengeGroups = preGenGroups;
          state.personalityDiceChallengesMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-personality-dice-v4');
          state.diceSelectedOption = {};
          state.currentDicePlayerIndex = 0;
          state.diceCompletedBy = [];
          state.dicePassedBy = [];
          await updateSession(socialSessionId, state);
          logger.info('Personality dice groups served from pre-generation', { socialSessionId });
          return res.json({ groups: preGenGroups, meta: state.personalityDiceChallengesMeta });
        }
      }
      if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
        logger.info('Personality dice pre-generation in-flight, returning 202', { socialSessionId });
        return res.status(202).json({
          status: 'generating',
          message: 'Dares are being prepared, please retry shortly',
        });
      }
    } catch (preGenErr) {
      logger.warn('Pre-generation check failed for personality dice, falling back to on-demand', {
        socialSessionId,
        error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
      });
    }

    try {
      const groupResult = await generatePersonalityDiceChallengeGroups({ participants: participants || [] });
      const enrichedGroups = groupResult.data.map((g) => ({
        ...g,
        archetypeColor: getArchetypeHSL(g.archetype),
        options: g.options.map((o) => ({ ...o, archetypeColor: getArchetypeHSL(o.archetype) })),
      }));
      state.personalityDiceChallengeGroups = enrichedGroups;
      state.personalityDiceChallengesMeta = groupResult.meta;
      state.diceSelectedOption = {};
      state.currentDicePlayerIndex = 0;
      state.diceCompletedBy = [];
      state.dicePassedBy = [];
      await updateSession(socialSessionId, state);

      // Bots choose their dares.
      await runBotSimulationSafely(socialSessionId, state, 'personality-dice-generate');
      await updateSession(socialSessionId, state);

      return res.json({ groups: enrichedGroups, meta: groupResult.meta });
    } catch (error) {
      logger.error('[SocialIcebreaker] personality-dice/generate (choose-mode) error:', { error });
      return res.status(500).json({ error: 'Failed to generate dice challenge groups' });
    }
  }

  // ── Legacy branch (flag OFF) ──
  // Idempotent retry: if challenges already exist, return them instead of regenerating
  if ((state.personalityDiceChallenges || []).length > 0) {
    const cachedMeta = state.personalityDiceChallengesMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-personality-dice-v1');
    const enrichedChallenges = state.personalityDiceChallenges!.map((c) => ({
      ...c,
      archetypeColor: getArchetypeHSL(c.archetype),
    }));
    return res.json({ challenges: enrichedChallenges, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'personality_dice');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'personality_dice');
      if (result) {
        const preGenChallenges = (result.contentJson as unknown as Array<Record<string, unknown>>).map((c) => ({
          ...c,
          archetypeColor: getArchetypeHSL(c.archetype as string | undefined),
        }));
        state.personalityDiceChallenges = preGenChallenges as any;
        state.personalityDiceChallengesMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-personality-dice-v1');
        state.currentDicePlayerIndex = 0;
        state.diceCompletedBy = [];
        state.dicePassedBy = [];
        await updateSession(socialSessionId, state);
        logger.info('Personality dice served from pre-generation', { socialSessionId });
        return res.json({ challenges: preGenChallenges, meta: state.personalityDiceChallengesMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Personality dice pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Challenges are being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for personality dice, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const challengeResult = await generatePersonalityDiceChallenges({ participants: participants || [] });
    const enrichedChallenges = challengeResult.data.map((c) => ({
      ...c,
      archetypeColor: getArchetypeHSL(c.archetype),
    }));
    state.personalityDiceChallenges = enrichedChallenges;
    state.personalityDiceChallengesMeta = challengeResult.meta;
    state.currentDicePlayerIndex = 0;
    state.diceCompletedBy = [];
    state.dicePassedBy = [];
    await updateSession(socialSessionId, state);

    // Bots complete their challenges.
    await runBotSimulationSafely(socialSessionId, state, 'personality-dice-generate');
    await updateSession(socialSessionId, state);

    return res.json({ challenges: enrichedChallenges, meta: challengeResult.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] personality-dice/generate error:', { error });
    return res.status(500).json({ error: 'Failed to generate dice challenges' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/personality-dice/choose
// Choose-Your-Prompt variant: player picks 1 of 3 dares.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/personality-dice/choose', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { userId: targetUserId, optionIndex, operationId } = req.body as {
    userId: string;
    optionIndex: number;
    operationId?: string;
  };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex > 2) {
    return res.status(400).json({ error: 'optionIndex must be 0, 1, or 2' });
  }

  const chooseModeEnabled = (process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED ?? 'true').toLowerCase() === 'true';
  if (!chooseModeEnabled) {
    return res.status(400).json({ error: 'Choose-Your-Prompt mode is not enabled' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'personality-dice-choose');

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  const groups = state.personalityDiceChallengeGroups;
  if (!groups || groups.length === 0) {
    return res.status(400).json({ error: 'No challenge groups generated yet' });
  }

  // Find the group for this user
  const group = groups.find((g) => g.userId === targetUserId);
  if (!group) {
    return res.status(400).json({ error: 'No challenge group found for this user' });
  }

  const selectedOption: PersonalityDiceChallenge = group.options[optionIndex];
  if (!selectedOption) {
    return res.status(400).json({ error: 'Invalid option index for this group' });
  }

  const alreadyChosen = state.diceSelectedOption?.[targetUserId] !== undefined;
  if (alreadyChosen && !operationId) {
    return res.status(409).json({
      error: 'Already chosen',
      chosenOptionIndex: state.diceSelectedOption![targetUserId],
      selectedOption: { ...group.options[state.diceSelectedOption![targetUserId]], archetypeColor: getArchetypeHSL(group.options[state.diceSelectedOption![targetUserId]].archetype) },
    });
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'personality_dice_choose',
        vote: { userId: targetUserId, optionIndex },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return currentState.diceSelectedOption?.[targetUserId] === undefined;
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        if (currentState.diceSelectedOption?.[targetUserId] !== undefined) return;

        currentState.diceSelectedOption = { ...(currentState.diceSelectedOption || {}), [targetUserId]: optionIndex };

        const diceCompletedBy = currentState.diceCompletedBy || [];
        if (!diceCompletedBy.includes(targetUserId)) {
          diceCompletedBy.push(targetUserId);
          currentState.diceCompletedBy = diceCompletedBy;
        }

        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    const freshSelectedOption: PersonalityDiceChallenge = {
      ...group.options[optionIndex],
      archetypeColor: getArchetypeHSL(group.options[optionIndex].archetype),
    };
    const freshDiceCompletedBy = freshState?.diceCompletedBy || [];
    const freshDicePassedBy = freshState?.dicePassedBy || [];
    const allResponded = (freshDiceCompletedBy.length + freshDicePassedBy.length) >= groups.length;
    return res.json({
      selectedOption: freshSelectedOption,
      meta: freshState?.personalityDiceChallengesMeta ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-personality-dice-v4'),
      diceCompletedBy: freshDiceCompletedBy,
      dicePassedBy: freshDicePassedBy,
      allChosen: freshDiceCompletedBy.length >= groups.length,
      allCompleted: allResponded,
      operationId,
    });
  }

  // Non-optimistic path
  state.diceSelectedOption = { ...(state.diceSelectedOption || {}), [targetUserId]: optionIndex };

  const diceCompletedBy = state.diceCompletedBy || [];
  if (!diceCompletedBy.includes(targetUserId)) {
    diceCompletedBy.push(targetUserId);
    state.diceCompletedBy = diceCompletedBy;
  }

  await updateSession(socialSessionId, state);

  const responseSelectedOption: PersonalityDiceChallenge = {
    ...group.options[optionIndex],
    archetypeColor: getArchetypeHSL(group.options[optionIndex].archetype),
  };

  const allResponded = (diceCompletedBy.length + (state.dicePassedBy?.length ?? 0)) >= groups.length;

  return res.json({
    selectedOption: responseSelectedOption,
    meta: state.personalityDiceChallengesMeta ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-personality-dice-v4'),
    diceCompletedBy,
    dicePassedBy: state.dicePassedBy || [],
    allChosen: diceCompletedBy.length >= groups.length,
    allCompleted: allResponded,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/personality-dice/complete
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/personality-dice/complete', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { pass, operationId } = req.body as { pass?: boolean; operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'personality-dice-complete');

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  const chooseModeEnabled = (process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED ?? 'true').toLowerCase() === 'true';

  // ── Choose-Mode branch: if user already chose, no-op ──
  if (chooseModeEnabled && state.personalityDiceChallengeGroups) {
    const alreadyChosen = state.diceSelectedOption?.[userId] !== undefined;
    if (alreadyChosen) {
      const group = state.personalityDiceChallengeGroups.find((g) => g.userId === userId);
      const optionIdx = state.diceSelectedOption![userId];
      const chosenOption: PersonalityDiceChallenge | undefined = group?.options?.[optionIdx];
      return res.json({
        alreadyChosen: true,
        diceCompletedBy: state.diceCompletedBy || [],
        dicePassedBy: state.dicePassedBy || [],
        selectedOption: chosenOption
          ? { ...chosenOption, archetypeColor: getArchetypeHSL(chosenOption.archetype) }
          : null,
        allCompleted: ((state.diceCompletedBy || []).length + (state.dicePassedBy || []).length) >= (state.personalityDiceChallengeGroups?.length ?? 0),
      });
    }
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'personality_dice',
        vote: { userId, pass },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.diceCompletedBy?.includes(userId) && !currentState.dicePassedBy?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const diceCompletedBy = currentState.diceCompletedBy || [];
        const dicePassedBy = currentState.dicePassedBy || [];

        if (pass === true) {
          if (!dicePassedBy.includes(userId)) {
            dicePassedBy.push(userId);
            currentState.dicePassedBy = dicePassedBy;
          }
        } else {
          if (!diceCompletedBy.includes(userId)) {
            diceCompletedBy.push(userId);
            currentState.diceCompletedBy = diceCompletedBy;
          }
        }

        const challenges = currentState.personalityDiceChallenges || [];
        const groups = currentState.personalityDiceChallengeGroups || [];
        const totalPlayers = groups.length > 0 ? groups.length : challenges.length;
        const currentIdx = currentState.currentDicePlayerIndex ?? 0;
        if (groups.length > 0) {
          currentState.currentDicePlayerIndex = Math.min(currentIdx + 1, totalPlayers - 1);
        } else if (challenges[currentIdx]?.userId === userId) {
          currentState.currentDicePlayerIndex = Math.min(currentIdx + 1, totalPlayers - 1);
        }

        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    // Re-fetch fresh state after optimistic mutation
    const freshState = await getSession(socialSessionId);
    const totalPlayers = (freshState?.personalityDiceChallengeGroups?.length ?? 0) > 0
      ? freshState!.personalityDiceChallengeGroups!.length
      : (freshState?.personalityDiceChallenges || []).length;
    const allResponded = totalPlayers > 0 &&
      ((freshState?.diceCompletedBy || []).length + (freshState?.dicePassedBy || []).length) >= totalPlayers;

    return res.json({
      diceCompletedBy: freshState?.diceCompletedBy || [],
      dicePassedBy: freshState?.dicePassedBy || [],
      currentDicePlayerIndex: freshState?.currentDicePlayerIndex,
      allCompleted: allResponded,
      operationId,
    });
  }

  // Fallback: non-optimistic path (backward compatible)
  const diceCompletedBy = state.diceCompletedBy || [];
  const dicePassedBy = state.dicePassedBy || [];

  if (pass === true) {
    if (!dicePassedBy.includes(userId)) {
      dicePassedBy.push(userId);
      state.dicePassedBy = dicePassedBy;
    }
  } else {
    if (!diceCompletedBy.includes(userId)) {
      diceCompletedBy.push(userId);
      state.diceCompletedBy = diceCompletedBy;
    }
  }

  const challenges = state.personalityDiceChallenges || [];
  const groups = state.personalityDiceChallengeGroups || [];
  const totalPlayers = groups.length > 0 ? groups.length : challenges.length;
  const currentIdx = state.currentDicePlayerIndex ?? 0;
  if (groups.length > 0) {
    state.currentDicePlayerIndex = Math.min(currentIdx + 1, totalPlayers - 1);
  } else if (challenges[currentIdx]?.userId === userId) {
    state.currentDicePlayerIndex = Math.min(currentIdx + 1, totalPlayers - 1);
  }

  await updateSession(socialSessionId, state);

  const allResponded = totalPlayers > 0 && (diceCompletedBy.length + dicePassedBy.length) >= totalPlayers;

  return res.json({
    diceCompletedBy,
    dicePassedBy,
    currentDicePlayerIndex: state.currentDicePlayerIndex,
    allCompleted: allResponded,
    operationId: null,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/generate
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate quip battle prompts' });
  }

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  // Idempotent retry: if prompts already exist, return them instead of regenerating
  if ((state.quipBattlePrompts || []).length > 0) {
    const cachedMeta = state.quipBattlePromptsMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-quip-battle-v1');
    return res.json({ prompts: state.quipBattlePrompts, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'quip_battle');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'quip_battle');
      if (result) {
        const prompts = (result.contentJson as unknown as Array<Record<string, unknown>>).map((p, i) => ({
          id: (p.id as string) || `qb_${i + 1}`,
          promptText: (p.promptText as string) || '',
          category: (p.category as string) || 'fun',
        }));
        state.quipBattlePrompts = prompts;
        state.quipBattlePromptsMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-quip-battle-v1');
        await updateSession(socialSessionId, state);
        logger.info('Quip battle served from pre-generation', { socialSessionId });
        return res.json({ prompts: state.quipBattlePrompts, meta: state.quipBattlePromptsMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Quip battle pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Prompts are being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for quip battle, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  const roster = await listParticipants(socialSessionId);
  const participantList = roster.map((p) => ({
    displayName: p.displayName,
    archetype: p.archetype,
  }));

  try {
    const result = await generateQuipBattlePrompts({
      eventType: state.eventType || '活动',
      participantCount: roster.length,
      participants: participantList,
      roster,
    });

    state.quipBattlePrompts = result.data;
    state.quipBattlePromptsMeta = result.meta;
    await updateSession(socialSessionId, state);

    // Bots submit answers and votes for the generated prompts.
    await runBotSimulationSafely(socialSessionId, state, 'quip-battle-generate');
    await updateSession(socialSessionId, state);

    return res.json({ prompts: result.data, meta: result.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] generateQuipBattlePrompts error:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate quip battle prompts' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/submit
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/submit', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { answers, operationId } = req.body as { answers: Array<{ promptId: string; answerText: string }>; operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers array required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'quip-battle-submit');

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  const participant = await getParticipant(socialSessionId, userId);
  const displayName = participant?.displayName || '匿名';

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'quip_battle',
        vote: { userId, answers },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.quipBattleSubmittedUserIds?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const existingAnswers = currentState.quipBattleAnswers || [];
        const newAnswers = answers.map((a) => {
          const text = (a.answerText || '').slice(0, 100);
          const safetyResult = validateContentSafe(text, 'answerText');
          if (!safetyResult.safe && safetyResult.violation?.severity === 'severe') {
            throw new Error(`Content violation: ${safetyResult.violation.message || 'inappropriate content'}`);
          }
          return {
            userId,
            displayName,
            promptId: a.promptId,
            answerText: text,
          };
        });
        currentState.quipBattleAnswers = [...existingAnswers, ...newAnswers];

        const submittedUserIds = currentState.quipBattleSubmittedUserIds || [];
        if (!submittedUserIds.includes(userId)) {
          submittedUserIds.push(userId);
          currentState.quipBattleSubmittedUserIds = submittedUserIds;
        }
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({
      submitted: true,
      totalAnswers: freshState?.quipBattleAnswers?.length ?? 0,
      operationId,
    });
  }

  for (const a of answers) {
    const text = (a.answerText || '').slice(0, 100);
    const safetyResult = validateContentSafe(text, 'answerText');
    if (!safetyResult.safe && safetyResult.violation?.severity === 'severe') {
      return res.status(400).json(contentViolationResponse(safetyResult.violation!).body);
    }
  }

  const existingAnswers = state.quipBattleAnswers || [];
  const newAnswers = answers.map((a) => ({
    userId,
    displayName,
    promptId: a.promptId,
    answerText: (a.answerText || '').slice(0, 100),
  }));

  state.quipBattleAnswers = [...existingAnswers, ...newAnswers];

  const submittedUserIds = state.quipBattleSubmittedUserIds || [];
  if (!submittedUserIds.includes(userId)) {
    submittedUserIds.push(userId);
    state.quipBattleSubmittedUserIds = submittedUserIds;
  }

  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, totalAnswers: state.quipBattleAnswers.length, operationId: null });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/vote
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { votes, operationId } = req.body as { votes: Array<{ answerId: string; promptId: string }>; operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!votes || !Array.isArray(votes)) {
    return res.status(400).json({ error: 'votes array required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'quip-battle-vote');

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  // Validate answerIds against existing answers
  const validAnswerIds = new Set(
    (state.quipBattleAnswers || []).map((a: any) => `${a.userId}::${a.promptId}`)
  );
  for (const v of votes) {
    if (!validAnswerIds.has(v.answerId)) {
      return res.status(400).json({ error: `Invalid answerId: ${v.answerId}` });
    }
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'quip_battle',
        vote: { voterId: userId, votes },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.quipBattleVotedUserIds?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const existingVotes = currentState.quipBattleVotes || [];
        const newVotes = votes.map((v) => ({
          voterId: userId,
          answerId: v.answerId,
          promptId: v.promptId,
        }));

        // Filter out duplicate votes by same voter for same prompt
        const voteKey = (v: any) => `${v.voterId}::${v.promptId}`;
        const voteMap = new Map<string, any>();
        for (const v of [...existingVotes, ...newVotes]) {
          voteMap.set(voteKey(v), v);
        }
        currentState.quipBattleVotes = Array.from(voteMap.values());

        const votedUserIds = currentState.quipBattleVotedUserIds || [];
        if (!votedUserIds.includes(userId)) {
          votedUserIds.push(userId);
          currentState.quipBattleVotedUserIds = votedUserIds;
        }
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({
      voted: true,
      totalVotes: freshState?.quipBattleVotes?.length ?? 0,
      operationId,
    });
  }

  const existingVotes = state.quipBattleVotes || [];
  const newVotes = votes.map((v) => ({
    voterId: userId,
    answerId: v.answerId,
    promptId: v.promptId,
  }));

  // Filter out duplicate votes by same voter for same prompt
  const voteKey = (v: any) => `${v.voterId}::${v.promptId}`;
  const voteMap = new Map<string, any>();
  for (const v of [...existingVotes, ...newVotes]) {
    voteMap.set(voteKey(v), v);
  }
  state.quipBattleVotes = Array.from(voteMap.values());

  const votedUserIds = state.quipBattleVotedUserIds || [];
  if (!votedUserIds.includes(userId)) {
    votedUserIds.push(userId);
    state.quipBattleVotedUserIds = votedUserIds;
  }

  await updateSession(socialSessionId, state);

  return res.json({ voted: true, totalVotes: state.quipBattleVotes.length, operationId: null });
});

export default router;
