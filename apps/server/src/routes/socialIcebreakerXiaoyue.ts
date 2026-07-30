import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { buildCachedAIMeta } from '@shared/types/aiMeta';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import {
  updateSession,
  listParticipants,
} from '../lib/socialIcebreakerStore';
import {
  resolveSession,
  isHostAuthorized,
  buildClientState,
} from './socialIcebreakerHelpers';
import {
  generateAdaptiveGameSuggestion,
  generateXiaoyueSessionPack,
} from '../socialIcebreakerAIService';
import { generateXiaoyueAdaptiveSuggestion } from '../xiaoyueAdaptiveEngine';
import { PHASE_CONFIG } from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const router = Router();

const socialSessionIdParamSchema = z.object({
  socialSessionId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/session-pack
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/xiaoyue/session-pack', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: 'Invalid social session id' });
  }
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate a session pack' });
  }

  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({ error: 'Session pack can only be generated during warmup phase' });
  }

  if (state.xiaoyueSessionPack) {
    const cachedMeta = {
      ...(state.xiaoyueSessionPackMeta ??
        buildCachedAIMeta(state.xiaoyueSessionPack.generatedAt, null, 'social-session-pack-v1')),
      fromCache: true,
    };
    return res.json({
      pack: state.xiaoyueSessionPack,
      meta: cachedMeta,
      state: await buildClientState(state, userId),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const packResult = await generateXiaoyueSessionPack({
      participants: roster.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        archetype: p.archetype ?? undefined,
      })),
      eventType: state.eventType,
      playerCount: Math.max(state.playerCount, roster.length || 1),
    });

    state.xiaoyueSessionPack = packResult.data;
    state.xiaoyueSessionPackMeta = packResult.meta;
    await updateSession(socialSessionId, state);

    return res.json({
      pack: packResult.data,
      meta: packResult.meta,
      state: await buildClientState(state, userId),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] xiaoyue/session-pack error:', { error });
    return res.status(500).json({ error: 'Failed to generate session pack' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/adaptive-suggestion
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/xiaoyue/adaptive-suggestion', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: 'Invalid social session id' });
  }
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can request adaptive suggestions' });
  }

  // Adaptive suggestions are meaningful only during active phases
  if (state.currentPhase === 'recap') {
    return res.status(400).json({ error: 'Adaptive suggestions are not available during recap' });
  }

  try {
    const fallback = generateXiaoyueAdaptiveSuggestion(state);
    const result = await generateAdaptiveGameSuggestion({
      phase: state.currentPhase,
      phaseLabel: PHASE_CONFIG[state.currentPhase]?.name ?? state.currentPhase,
      playerCount: state.playerCount,
      signals: fallback.basedOnSignals,
      fallback,
      currentGameFacts: [
        `已完成成员数：${state.challengeCompletedBy?.length ?? state.diceCompletedBy?.length ?? 0}`,
        `当前话题序号：${(state.currentTopicIndex ?? 0) + 1}`,
        `当前拍卖品序号：${(state.auctionCurrentLotIndex ?? 0) + 1}`,
        `拍卖是否全部结束：${state.auctionAllLotsClosed === true ? '是' : '否'}`,
        `已提交群像镜像答案：${state.groupMirrorSubmittedUserIds?.length ?? 0}`,
        `当前活跃人数：${state.activePlayerCount ?? 0}`,
      ],
    });
    state.xiaoyueAdaptiveSuggestion = result.data;
    state.xiaoyueAdaptiveSuggestionMeta = result.meta;
    await updateSession(socialSessionId, state);

    return res.json({
      suggestion: result.data,
      meta: result.meta,
      state: await buildClientState(state, userId),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] xiaoyue/adaptive-suggestion error:', { error });
    return res.status(500).json({ error: 'Failed to generate adaptive suggestion' });
  }
});

export default router;
