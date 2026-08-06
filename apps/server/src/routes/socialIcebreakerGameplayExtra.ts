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
  PHASE_CONFIG,
} from '@shared/socialIcebreaker';
import { getArchetypeHSL } from '@shared/archetypeColors';
import type { UndercoverWordPair } from '@shared/undercoverWord';
import {
  generateUndercoverWordPair,
  generateGroupMirrorQuestions,
  generateMomentHighlights,
} from '../socialIcebreakerAIService';
import type { MomentHighlightsPanel } from '@shared/socialIcebreaker';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
} from '../socialIcebreakerPhaseConfig';
import { socialIcebreakerAiFeedbackRepo } from '../repositories/socialIcebreakerAiFeedbackRepo';
import { submitSocialIcebreakerAiFeedbackSchema } from '@shared/schema';
import {
  getSession,
  getSessionWithExpiry,
  updateSession,
  listParticipants,
  getParticipant,
  loadSessionLieTruths,
  getPhaseRatings,
  logMomentCardInteraction,
  getMomentCardStats,
  getPreGenerationResult,
} from '../lib/socialIcebreakerStore';
import { getSocialIcebreakerAccess } from '../lib/socialIcebreakerAccess';
import { buildMomentCardPayload } from '../lib/momentCardPayload';
import { renderMomentCardToPng } from '../lib/momentCardRenderer';
import { curateMedals } from '../lib/medalCuration';
import { logger } from '../lib/logger';
import { validateContentSafeAsync, contentViolationResponse } from '../lib/contentSafety';
import { recordViolation } from '../abuseDetection';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { momentCardLimiter } from '../rateLimiter';
import { shouldSkipOnDemandGeneration } from '../jobs/preGenerationQueue';
import { recordVoteOptimistically } from '../lib/optimisticSync';
import { runBotSimulationSafely } from '../services/socialIcebreakerBotService';
import {
  sanitizeStateForClient,
  buildClientState,
  hydrateDerivedState,
  getUniqueUserCount,
  hasAllRosterParticipantsResponded,
  recapDisplayNameByUserId,
  buildLieDetectiveRecapHighlights,
  buildPersonalityDiceRecapLines,
  buildMiniScriptRecapLine,
  buildAuctionRecapLines,
  buildRecapParticipants,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  resolveSession,
  isHostAuthorized,
  generateSpeedFriendingPairs,
  ensureRecapSnapshot,
} from './socialIcebreakerHelpers';

const router = Router();

function buildMomentEvidence(
  state: SocialSessionState,
  roster: Array<{ userId: string; displayName: string }>,
): string[] {
  const nameOf = (userId: string) =>
    roster.find((participant) => participant.userId === userId)?.displayName ?? '某位成员';
  const participation = new Map<string, number>();
  const add = (userId: string | undefined) => {
    if (userId) participation.set(userId, (participation.get(userId) ?? 0) + 1);
  };
  state.challengeCompletedBy?.forEach(add);
  state.diceCompletedBy?.forEach(add);
  state.quipBattleAnswers?.forEach((answer) => add(answer.userId));
  state.groupMirrorAnswers?.forEach((answer) => add(answer.userId));
  state.auctionBidHistory?.forEach((bid) => add(bid.userId));
  const evidence: string[] = [...participation.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([userId, count]) => `${nameOf(userId)}留下了${count}次可记录的参与动作`);

  const selected = new Map<string, number>();
  state.groupMirrorAnswers?.forEach((answer) =>
    selected.set(answer.targetUserId, (selected.get(answer.targetUserId) ?? 0) + 1));
  state.votes?.forEach((vote) =>
    selected.set(vote.targetUserId, (selected.get(vote.targetUserId) ?? 0) + 1));
  [...selected.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([userId, count]) => evidence.push(`${nameOf(userId)}在投票或成员选择中被选中${count}次`));

  state.auctionRecapLines?.slice(0, 4).forEach((line) => evidence.push(`拍卖：${line}`));
  state.groupMirrorResults?.slice(0, 4).forEach((result) =>
    evidence.push(`群像镜像“${result.questionText}”：${result.topTargetDisplayName}获得${result.voteCount}票`));
  const snapshot = state.recapSnapshot;
  snapshot?.medals?.slice(0, 6).forEach((medal) =>
    evidence.push(`奖项“${medal.title}”：${medal.recipientDisplayName}，依据为${medal.description}`));
  if (snapshot?.groupMirrorHighlights) {
    evidence.push(
      `群像镜像“${snapshot.groupMirrorHighlights.questionText}”：`
      + `${snapshot.groupMirrorHighlights.topVotedDisplayName}获得${snapshot.groupMirrorHighlights.voteCount}票`,
    );
  }
  if (snapshot?.microChallengeHighlights) {
    evidence.push(
      `微挑战由${snapshot.microChallengeHighlights.completedCount}/`
      + `${snapshot.microChallengeHighlights.totalCount}位成员完成`,
    );
  }
  if (snapshot?.personalityDiceHighlights) {
    evidence.push(
      `人格骰子完成率${Math.round(snapshot.personalityDiceHighlights.completionRate * 100)}%`,
    );
  }
  state.recapSnapshot?.recapSummary?.moments?.slice(0, 4).forEach((moment) =>
    evidence.push(`已生成回顾：${moment}`));
  return evidence.slice(0, 30);
}

function buildFallbackMomentPanel(
  state: SocialSessionState,
  evidence: string[],
): MomentHighlightsPanel {
  const interrupted = state.endedEarlyAt && state.interruptedAtPhase;
  const usable = evidence.length > 0 ? evidence : ['本局已完成的互动记录较少，暂时没有足够数据点名成员'];
  const aspects = ['participation', 'popularity', 'collaboration', 'memorable'] as const;
  const labels = ['积极参与', '成员印象', '一起完成', '今晚记忆'];
  return {
    headline: interrupted ? '中途收尾，也留下了这些高光' : '悦仔看见的今晚高光',
    overview: interrupted
      ? `这局在“${PHASE_CONFIG[state.interruptedAtPhase!]?.name ?? state.interruptedAtPhase}”中途收尾。以下内容只根据已经发生的互动整理，未完成的玩法不会被算作成绩。`
      : '以下内容只根据本局已经发生的互动整理。悦仔会记录参与、成员选择和共同完成的片段，不给安静的成员贴标签。',
    highlights: aspects.map((aspect, index) => ({
      aspect,
      title: labels[index],
      evidence: usable[index % usable.length],
      narrative: index < usable.length
        ? `从记录来看，${usable[index]}。这是这一桌已经真实发生的片段，也让大家更容易记住彼此。`
        : '这一维度暂时没有足够记录，悦仔选择留白，不用猜测代替真实互动。',
    })),
    closingLine: '高光不只属于最热闹的人，也属于每一次认真回应和接住彼此。',
  };
}

router.get('/:socialSessionId/moment-card', momentCardLimiter, async (req: any, res) => {
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

  const roster = await listParticipants(socialSessionId);

  const evidence = buildMomentEvidence(state, roster);
  const result = await generateMomentHighlights({
    playerCount: Math.max(state.playerCount, roster.length),
    completedPhases: state.completedPhases,
    interruptedAtPhase: state.interruptedAtPhase,
    evidence,
    fallback: buildFallbackMomentPanel(state, evidence),
  });

  return res.json({ panel: result.data, meta: result.meta });
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/moment-card.png
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/moment-card.png', momentCardLimiter, async (req: any, res) => {
  const { socialSessionId } = req.params;
  const reqLogger = logger.child({ request_id: req.requestId });

  try {
    const enabled = (process.env.SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      return res.status(503).json({ error: 'SERVER_RENDER_DISABLED', message: 'Moment card server render is not enabled' });
    }

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

    const roster = await listParticipants(socialSessionId);
    const recapSummary = state.recapSnapshot?.recapSummary;
    const medals = state.recapSnapshot?.medals ?? [];
    const payload = buildMomentCardPayload(state, roster, recapSummary, medals);

    const pngBuffer = await renderMomentCardToPng(payload);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(pngBuffer);
  } catch (error) {
    logger.error('[MomentCardRenderer] Failed to render PNG', {
      request_id: req.requestId,
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'RENDER_FAILED', message: 'Failed to render moment card' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/ai-feedback
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/ai-feedback', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = submitSocialIcebreakerAiFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId } = req.params;
  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  try {
    await socialIcebreakerAiFeedbackRepo.upsertFeedback({
      socialSessionId,
      submittedBy: userId,
      phase: parsed.data.phase,
      promptVersion: parsed.data.promptVersion,
      aiCorrelationId: parsed.data.aiCorrelationId,
      rating: parsed.data.rating,
    });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('[SocialIcebreaker] ai-feedback error:', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// ---------------------------------------------------------------------------
// Undercover Word routes
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/undercover-word/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate word pairs' });
  }

  if (state.currentPhase !== 'undercover_word') {
    return res.status(400).json({ error: 'Not in undercover_word phase' });
  }

  if (state.undercoverWordPair) {
    return res.status(400).json({ error: 'Word pair already generated' });
  }

  try {
    // Pre-generation freshness: check if async pre-gen is available or in-flight
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'undercover_word');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'undercover_word');
      if (result) {
        const pair = result.contentJson as unknown as UndercoverWordPair;
        const roster = await listParticipants(socialSessionId);
        const undercoverIdx = Math.floor(Math.random() * roster.length);
        const undercoverUserId = roster[undercoverIdx]?.userId;

        state.undercoverWordPair = pair;
        state.undercoverWordPairMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-undercover-word-v1');
        state.undercoverUserId = undercoverUserId;
        state.undercoverWordRounds = [];
        state.undercoverWordCurrentRound = 0;
        state.undercoverWordVotes = [];
        state.undercoverWordVotedUserIds = [];
        state.undercoverWordRevealed = false;
        state.undercoverWordResults = undefined;
        await updateSession(socialSessionId, state);

        logger.info('Undercover word served from pre-generation', { socialSessionId });
        return res.json({ pair, undercoverAssigned: !!undercoverUserId });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Undercover word pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({ status: 'generating', message: '词对准备中，请稍后重试' });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for undercover word, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const result = await generateUndercoverWordPair({
      eventType: state.eventType || '活动',
      participantCount: state.playerCount || 4,
      roster,
    });

    // Randomly assign undercover
    const undercoverIdx = Math.floor(Math.random() * roster.length);
    const undercoverUserId = roster[undercoverIdx]?.userId;

    state.undercoverWordPair = result.data;
    state.undercoverWordPairMeta = result.meta;
    state.undercoverUserId = undercoverUserId;
    state.undercoverWordRounds = [];
    state.undercoverWordCurrentRound = 0;
    state.undercoverWordVotes = [];
    state.undercoverWordVotedUserIds = [];
    state.undercoverWordRevealed = false;
    state.undercoverWordResults = undefined;
    await updateSession(socialSessionId, state);

    // Bots submit descriptions for the first round.
    await runBotSimulationSafely(socialSessionId, state, 'undercover-word-generate');
    await updateSession(socialSessionId, state);

    return res.json({ pair: result.data, undercoverAssigned: !!undercoverUserId });
  } catch (error) {
    logger.error('[SocialIcebreaker] generateUndercoverWordPair error:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate undercover word pair' });
  }
});

router.post('/:socialSessionId/undercover-word/describe', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { text, operationId } = req.body as { text: string; operationId?: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Description required' });

  // Content-moderation gate (S5): validate BEFORE the description is written
  // to session state (either the optimistic path or the direct path below).
  const safety = await validateContentSafeAsync(text, 'undercoverDescribe', { userId });
  if (!safety.safe && safety.violation) {
    await recordViolation(userId, safety.violation.type, safety.violation.severity);
    return res.status(400).json(contentViolationResponse(safety.violation).body);
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'undercover-word-describe');

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'undercover_word',
        vote: { userId, text: text.trim().slice(0, 100) },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        const currentRound = currentState.undercoverWordCurrentRound ?? 0;
        const rounds = currentState.undercoverWordRounds || [];
        const round = rounds[currentRound] || { roundNumber: currentRound + 1, descriptions: [] };
        const existing = round.descriptions.find((d: any) => d.userId === userId);
        // Allow if no existing description for this user in this round
        return !existing;
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const currentRound = currentState.undercoverWordCurrentRound ?? 0;
        const rounds = currentState.undercoverWordRounds || [];
        const round = rounds[currentRound] || { roundNumber: currentRound + 1, descriptions: [] };

        round.descriptions.push({
          userId,
          displayName: (await getParticipant(socialSessionId, userId))?.displayName || '匿名',
          text: text.trim().slice(0, 100),
        });

        rounds[currentRound] = round;
        currentState.undercoverWordRounds = rounds;
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    // Re-fetch fresh state after optimistic mutation
    const freshState = await getSession(socialSessionId);
    const currentRound = freshState?.undercoverWordCurrentRound ?? 0;
    return res.json({ submitted: true, round: currentRound + 1, operationId });
  }

  const currentRound = state.undercoverWordCurrentRound ?? 0;
  const rounds = state.undercoverWordRounds || [];
  const round = rounds[currentRound] || { roundNumber: currentRound + 1, descriptions: [] };

  // Prevent duplicate descriptions from same user in same round
  const existing = round.descriptions.find((d: any) => d.userId === userId);
  if (existing) {
    existing.text = text.trim().slice(0, 100);
  } else {
    round.descriptions.push({ userId, displayName: (await getParticipant(socialSessionId, userId))?.displayName || '匿名', text: text.trim().slice(0, 100) });
  }

  rounds[currentRound] = round;
  state.undercoverWordRounds = rounds;
  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, round: currentRound + 1, operationId: null });
});

router.post('/:socialSessionId/undercover-word/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { targetUserId, operationId } = req.body as { targetUserId: string; operationId?: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'undercover-word-vote');

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'undercover_word',
        vote: { voterId: userId, targetUserId },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        const votes = currentState.undercoverWordVotes || [];
        const existingIdx = votes.findIndex((v: any) => v.voterId === userId);
        // Allow if user hasn't voted yet (new vote) or is changing their vote
        return true;
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const votes = currentState.undercoverWordVotes || [];
        const existingIdx = votes.findIndex((v: any) => v.voterId === userId);
        if (existingIdx >= 0) {
          votes[existingIdx] = { voterId: userId, targetUserId };
        } else {
          votes.push({ voterId: userId, targetUserId });
        }

        currentState.undercoverWordVotes = votes;
        const votedUserIds = currentState.undercoverWordVotedUserIds || [];
        if (!votedUserIds.includes(userId)) votedUserIds.push(userId);
        currentState.undercoverWordVotedUserIds = votedUserIds;
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    // Re-fetch fresh state after optimistic mutation
    const freshState = await getSession(socialSessionId);
    const votes = freshState?.undercoverWordVotes || [];
    return res.json({ voted: true, totalVotes: votes.length, operationId });
  }

  const votes = state.undercoverWordVotes || [];
  const existingIdx = votes.findIndex((v: any) => v.voterId === userId);
  if (existingIdx >= 0) {
    votes[existingIdx] = { voterId: userId, targetUserId };
  } else {
    votes.push({ voterId: userId, targetUserId });
  }

  state.undercoverWordVotes = votes;
  const votedUserIds = state.undercoverWordVotedUserIds || [];
  if (!votedUserIds.includes(userId)) votedUserIds.push(userId);
  state.undercoverWordVotedUserIds = votedUserIds;
  await updateSession(socialSessionId, state);

  return res.json({ voted: true, totalVotes: votes.length, operationId: null });
});

router.post('/:socialSessionId/undercover-word/reveal', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'undercover-word-reveal');

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only host can reveal' });
  }

  const votes = state.undercoverWordVotes || [];
  const voteCounts: Record<string, number> = {};
  for (const v of votes) {
    voteCounts[v.targetUserId] = (voteCounts[v.targetUserId] || 0) + 1;
  }

  let maxVotes = 0;
  let topTarget = '';
  for (const [uid, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      topTarget = uid;
    }
  }

  const pair = state.undercoverWordPair;
  const undercoverUserId = state.undercoverUserId || '';

  const result: typeof state.undercoverWordResults = {
    undercoverUserId,
    undercoverDisplayName: (await getParticipant(socialSessionId, undercoverUserId))?.displayName || '匿名',
    civilianWord: pair?.civilianWord || '',
    undercoverWord: pair?.undercoverWord || '',
    voteCounts,
    caught: topTarget === undercoverUserId,
  };

  state.undercoverWordResults = result;
  state.undercoverWordRevealed = true;
  await updateSession(socialSessionId, state);

  return res.json({ revealed: true, result });
});

router.post('/:socialSessionId/undercover-word/next-round', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only host can advance rounds' });
  }

  if (state.currentPhase !== 'undercover_word') {
    return res.status(400).json({ error: 'Not in undercover_word phase' });
  }

  const currentRound = state.undercoverWordCurrentRound ?? 0;
  state.undercoverWordCurrentRound = currentRound + 1;
  await updateSession(socialSessionId, state);

  return res.json({
    currentRound: state.undercoverWordCurrentRound,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// Group Mirror routes
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/group-mirror/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate group mirror questions' });
  }

  if (state.currentPhase !== 'group_mirror') {
    return res.status(400).json({ error: 'Not in group_mirror phase' });
  }

  // Idempotent retry: if questions already exist, return them instead of regenerating
  if ((state.groupMirrorQuestions || []).length > 0) {
    const cachedMeta = state.groupMirrorQuestionsMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-group-mirror-v1');
    return res.json({ questions: state.groupMirrorQuestions, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'group_mirror');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'group_mirror');
      if (result) {
        const questions = result.contentJson as unknown as Array<Record<string, unknown>>;
        state.groupMirrorQuestions = questions as any;
        state.groupMirrorQuestionsMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-group-mirror-v1');
        state.groupMirrorAnswers = [];
        state.groupMirrorVotes = [];
        state.groupMirrorSubmittedUserIds = [];
        state.groupMirrorRevealed = false;
        state.groupMirrorResults = undefined;
        await updateSession(socialSessionId, state);
        logger.info('Group mirror served from pre-generation', { socialSessionId });
        return res.json({ questions: state.groupMirrorQuestions, meta: state.groupMirrorQuestionsMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Group mirror pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Questions are being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for group mirror, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const result = await generateGroupMirrorQuestions({
      eventType: state.eventType || '活动',
      participantCount: roster.length,
      participantNames: roster.map((p) => p.displayName).filter(Boolean) as string[],
      roster,
    });

    state.groupMirrorQuestions = result.data;
    state.groupMirrorQuestionsMeta = result.meta;
    state.groupMirrorAnswers = [];
    state.groupMirrorVotes = [];
    state.groupMirrorSubmittedUserIds = [];
    state.groupMirrorRevealed = false;
    state.groupMirrorResults = undefined;
    await updateSession(socialSessionId, state);

    // Bots submit their group mirror answers.
    await runBotSimulationSafely(socialSessionId, state, 'group-mirror-generate');
    await updateSession(socialSessionId, state);

    return res.json({ questions: result.data, meta: result.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] generateGroupMirrorQuestions error:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate group mirror questions' });
  }
});

router.post('/:socialSessionId/group-mirror/submit', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { answers, operationId } = req.body as { answers: Array<{ questionId: string; targetUserId: string; reasonText?: string }>; operationId?: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: 'answers array required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'group-mirror-submit');

  if (state.currentPhase !== 'group_mirror') {
    return res.status(400).json({ error: 'Not in group_mirror phase' });
  }

  const participant = await getParticipant(socialSessionId, userId);
  const displayName = participant?.displayName || '匿名';

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'group_mirror',
        vote: { userId, answers },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.groupMirrorSubmittedUserIds?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const existingAnswers = currentState.groupMirrorAnswers || [];
        const newAnswers = await Promise.all(answers.map(async (a) => {
          const reason = (a.reasonText || '').slice(0, 100);
          const safetyResult = await validateContentSafeAsync(reason, 'reason', { userId });
          if (!safetyResult.safe && safetyResult.violation) {
            await recordViolation(userId, safetyResult.violation.type, safetyResult.violation.severity);
            throw new Error(`Content violation: ${safetyResult.violation.message || 'inappropriate content'}`);
          }
          return {
            userId,
            displayName,
            questionId: a.questionId,
            targetUserId: a.targetUserId,
            reasonText: reason,
          };
        }));

        const answerMap = new Map<string, typeof newAnswers[0]>();
        for (const a of existingAnswers) {
          answerMap.set(`${a.userId}::${a.questionId}`, a as any);
        }
        for (const a of newAnswers) {
          answerMap.set(`${a.userId}::${a.questionId}`, a as any);
        }
        currentState.groupMirrorAnswers = Array.from(answerMap.values());

        const submittedUserIds = currentState.groupMirrorSubmittedUserIds || [];
        if (!submittedUserIds.includes(userId)) submittedUserIds.push(userId);
        currentState.groupMirrorSubmittedUserIds = submittedUserIds;
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({ submitted: true, totalAnswers: freshState?.groupMirrorAnswers?.length ?? 0, operationId });
  }

  for (const a of answers) {
    const reason = (a.reasonText || '').slice(0, 100);
    const safetyResult = await validateContentSafeAsync(reason, 'reason', { userId });
    if (!safetyResult.safe && safetyResult.violation) {
      await recordViolation(userId, safetyResult.violation.type, safetyResult.violation.severity);
      return res.status(400).json(contentViolationResponse(safetyResult.violation).body);
    }
  }

  const existingAnswers = state.groupMirrorAnswers || [];
  const newAnswers = answers.map((a) => ({
    userId,
    displayName,
    questionId: a.questionId,
    targetUserId: a.targetUserId,
    reasonText: (a.reasonText || '').slice(0, 100),
  }));

  // Deduplicate by user + question
  const answerMap = new Map<string, typeof newAnswers[0]>();
  for (const a of existingAnswers) {
    answerMap.set(`${a.userId}::${a.questionId}`, a as any);
  }
  for (const a of newAnswers) {
    answerMap.set(`${a.userId}::${a.questionId}`, a as any);
  }
  state.groupMirrorAnswers = Array.from(answerMap.values());

  const submittedUserIds = state.groupMirrorSubmittedUserIds || [];
  if (!submittedUserIds.includes(userId)) submittedUserIds.push(userId);
  state.groupMirrorSubmittedUserIds = submittedUserIds;
  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, totalAnswers: state.groupMirrorAnswers.length, operationId: null });
});

router.post('/:socialSessionId/group-mirror/reveal', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await runBotSimulationSafely(socialSessionId, state, 'group-mirror-reveal');

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only host can reveal' });
  }

  const questions = state.groupMirrorQuestions || [];
  const answers = state.groupMirrorAnswers || [];

  const results: typeof state.groupMirrorResults = [];
  for (const q of questions) {
    const qAnswers = answers.filter((a: any) => a.questionId === q.id);
    const targetCounts: Record<string, number> = {};
    for (const a of qAnswers) {
      targetCounts[a.targetUserId] = (targetCounts[a.targetUserId] || 0) + 1;
    }

    let maxCount = 0;
    let topTarget = '';
    for (const [uid, count] of Object.entries(targetCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topTarget = uid;
      }
    }

    const topParticipant = await getParticipant(socialSessionId, topTarget);
    results.push({
      questionId: q.id,
      questionText: q.questionText,
      topTargetUserId: topTarget,
      topTargetDisplayName: topParticipant?.displayName || '匿名',
      voteCount: maxCount,
      totalVotes: qAnswers.length,
    });
  }

  state.groupMirrorResults = results;
  state.groupMirrorRevealed = true;
  await updateSession(socialSessionId, state);

  return res.json({ revealed: true, results });
});

// ---------------------------------------------------------------------------
// Speed Friending routes
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/speed-friending', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'speed_friending') {
    return res.status(400).json({ error: 'Not in speed friending phase' });
  }

  if (state.speedFriendingAllRoundsComplete) {
    return res.status(400).json({ error: 'Speed friending already completed' });
  }

  const pairs = state.speedFriendingPairs;
  if (!pairs || pairs.length === 0) {
    return res.status(400).json({ error: 'Speed friending has not been started yet' });
  }

  const totalRounds = state.speedFriendingTotalRounds ?? 0;
  const currentRound = state.speedFriendingCurrentRound ?? 0;

  return res.json({
    currentRound,
    totalRounds,
    allRoundsComplete: false,
    roundStartedAt: state.speedFriendingRoundStartedAt,
    state: await buildClientState(state, userId),
  });
});

router.post('/:socialSessionId/speed-friending/next-round', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can advance rounds' });
  }

  if (state.currentPhase !== 'speed_friending') {
    return res.status(400).json({ error: 'Not in speed_friending phase' });
  }

  if (!state.speedFriendingPairs || state.speedFriendingPairs.length === 0) {
    return res.status(400).json({ error: 'Speed friending has not been started yet' });
  }

  const totalRounds = state.speedFriendingTotalRounds ?? 0;
  const currentRound = state.speedFriendingCurrentRound ?? 0;

  if (currentRound >= totalRounds - 1) {
    return res.status(400).json({ error: 'Already at the final round' });
  }

  state.speedFriendingCurrentRound = currentRound + 1;
  state.speedFriendingRoundStartedAt = Date.now();
  await updateSession(socialSessionId, state);

  logger.info('Speed friending next round', { socialSessionId, currentRound: state.speedFriendingCurrentRound });

  return res.json({
    currentRound: state.speedFriendingCurrentRound,
    totalRounds: state.speedFriendingTotalRounds,
    allRoundsComplete: false,
    roundStartedAt: state.speedFriendingRoundStartedAt,
    state: await buildClientState(state, userId),
  });
});

router.post('/:socialSessionId/speed-friending/complete', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can complete speed friending' });
  }

  if (state.currentPhase !== 'speed_friending') {
    return res.status(400).json({ error: 'Not in speed_friending phase' });
  }

  if (!state.speedFriendingPairs || state.speedFriendingPairs.length === 0) {
    return res.status(400).json({ error: 'Speed friending has not been started yet' });
  }

  state.speedFriendingCurrentRound = state.speedFriendingTotalRounds ?? 0;
  state.speedFriendingAllRoundsComplete = true;
  state.speedFriendingRoundStartedAt = undefined;
  await updateSession(socialSessionId, state);

  logger.info('Speed friending completed', { socialSessionId });

  return res.json({
    currentRound: state.speedFriendingCurrentRound,
    totalRounds: state.speedFriendingTotalRounds,
    allRoundsComplete: true,
    state: await buildClientState(state, userId),
  });
});

export default router;
