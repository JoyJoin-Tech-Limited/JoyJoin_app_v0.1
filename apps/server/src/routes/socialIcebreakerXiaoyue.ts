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
import { applyXiaoyueAgentAskDecision } from '../lib/xiaoyueAgentPolicy';
import { executeWarmupTopicRotation } from '../lib/xiaoyueAgentActions';
import { updateSessionAtomic } from '../lib/socialIcebreakerStore';
import { appendSocialAgentEvent } from '../repositories/socialAgentEventsRepo';
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

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/agent/decision
// ---------------------------------------------------------------------------
const agentDecisionSchema = z.object({
  askId: z.string().min(1).max(80),
  decision: z.enum(['accepted', 'ignored', 'closed_session', 'action_failed_dismissed']),
  idempotencyKey: z.string().min(8).max(80).optional(),
  clientActionId: z.string().max(120).optional(),
});

function agentError(res: Response, status: number, code: string) {
  return res.status(status).json({ code, error: code });
}

router.post('/:socialSessionId/xiaoyue/agent/decision', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) return agentError(res, 400, 'INVALID_SOCIAL_SESSION_ID');
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = agentDecisionSchema.safeParse(req.body);
  if (!parsed.success) return agentError(res, 400, 'INVALID_AGENT_DECISION');
  const { askId, decision, idempotencyKey, clientActionId } = parsed.data;
  if (decision === 'accepted' && !idempotencyKey) {
    return agentError(res, 400, 'IDEMPOTENCY_KEY_REQUIRED');
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return agentError(res, 403, 'AGENT_NOT_HOST');
  }

  const ask = state.xiaoyueAgent?.ask;
  if (!ask || ask.id !== askId) return agentError(res, 400, 'AGENT_ASK_NOT_FOUND');
  if (ask.phase !== state.currentPhase || state.currentPhase !== 'warmup') {
    return agentError(res, 409, 'AGENT_PHASE_MISMATCH');
  }
  if (ask.status !== 'pending' && ask.status !== 'failed' && ask.status !== 'unknown') {
    return agentError(res, 409, 'AGENT_ASK_EXPIRED');
  }

  if (decision === 'accepted') {
    const outcome = await executeWarmupTopicRotation({
      state,
      socialSessionId,
      userId,
      askId,
      idempotencyKey: idempotencyKey!,
    });
    return res.json({
      status: outcome.status,
      ...(outcome.topicSetRevision !== undefined
        ? { topicSetRevision: outcome.topicSetRevision }
        : {}),
      ...(outcome.errorCode ? { code: outcome.errorCode } : {}),
      state: await buildClientState(outcome.state, userId),
    });
  }

  let applied = false;
  const atomic = await updateSessionAtomic(
    socialSessionId,
    (latest) => {
      const latestAsk = latest.xiaoyueAgent?.ask;
      if (!latestAsk || latestAsk.id !== askId) return false;
      if (latestAsk.status !== 'pending' && latestAsk.status !== 'failed' && latestAsk.status !== 'unknown') {
        return false;
      }
      const next = applyXiaoyueAgentAskDecision(latest, decision, Date.now());
      Object.assign(latest, next);
      applied = true;
      return true;
    },
    async (latest, tx) => {
      if (!applied) return;
      await appendSocialAgentEvent(
        {
          socialSessionId,
          phase: latest.currentPhase,
          kind: 'ask_decision',
          askId,
          actorUserId: userId,
          payload: {
            decision,
            askKind: ask.kind,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        },
        tx,
      );
    },
  );

  if (atomic.outcome === 'not_found') return agentError(res, 410, 'SESSION_EXPIRED');
  if (atomic.outcome !== 'updated') return agentError(res, 409, 'AGENT_ASK_EXPIRED');

  logger.info('[XiaoyueAgent] decision recorded', {
    socialSessionId,
    askId,
    decision,
    clientActionId,
  });

  return res.json({
    status: 'decision_recorded',
    state: await buildClientState(atomic.state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/agent/policy
// ---------------------------------------------------------------------------
const agentPolicySchema = z.object({ proactiveEnabled: z.boolean() });

router.post('/:socialSessionId/xiaoyue/agent/policy', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) return agentError(res, 400, 'INVALID_SOCIAL_SESSION_ID');
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = agentPolicySchema.safeParse(req.body);
  if (!parsed.success) return agentError(res, 400, 'INVALID_AGENT_POLICY');
  const { proactiveEnabled } = parsed.data;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;
  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return agentError(res, 403, 'AGENT_NOT_HOST');
  }

  const atomic = await updateSessionAtomic(
    socialSessionId,
    (latest) => {
      if (!latest.xiaoyueAgent) return false;
      latest.xiaoyueAgent.policy.proactiveDisabled = !proactiveEnabled;
      if (proactiveEnabled) latest.xiaoyueAgent.policy.ignoredStreak = 0;
      return true;
    },
    async (latest, tx) => {
      await appendSocialAgentEvent(
        {
          socialSessionId,
          phase: latest.currentPhase,
          kind: 'policy_changed',
          actorUserId: userId,
          payload: {
            proactiveEnabled,
            ignoredStreak: latest.xiaoyueAgent?.policy.ignoredStreak ?? 0,
          },
        },
        tx,
      );
    },
  );

  if (atomic.outcome === 'not_found') return agentError(res, 410, 'SESSION_EXPIRED');
  if (atomic.outcome !== 'updated') return agentError(res, 400, 'AGENT_POLICY_UNAVAILABLE');

  return res.json({
    status: 'decision_recorded',
    state: await buildClientState(atomic.state, userId),
  });
});

export default router;