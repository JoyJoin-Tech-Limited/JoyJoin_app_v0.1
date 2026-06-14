import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import {
  socialIcebreakerSelectPhaseSchema,
  socialIcebreakerEndSessionSchema,
} from '@shared/api';
import { getPhaseModule } from '@shared/phaseRegistry';
import { updateSession } from '../lib/socialIcebreakerStore';
import { getFeatureFlag } from '../lib/featureFlags';
import { logger } from '../lib/logger';
import {
  resolveSession,
  isHostAuthorized,
  buildClientState,
  ensureRecapSnapshot,
} from './socialIcebreakerHelpers';
import { cleanupPhaseStateForNextPhase } from '../socialIcebreakerPhaseConfig';

const router = Router();

const socialSessionIdParamSchema = z.object({
  socialSessionId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/select-phase
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/select-phase', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: 'Invalid social session id' });
  }
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsedBody = socialIcebreakerSelectPhaseSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { phase, phaseSelectionId } = parsedBody.data;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can select a phase' });
  }

  if (state.eventTier !== 'custom') {
    return res.status(400).json({ error: 'Phase selection is only available in custom mode' });
  }

  if (state.currentPhase !== 'phase_selection') {
    return res.status(400).json({ error: 'Session is not in phase selection' });
  }

  if (!state.phaseSelectionId || state.phaseSelectionId !== phaseSelectionId) {
    return res.status(400).json({ error: 'Phase selection round has expired' });
  }

  const phaseModule = getPhaseModule(phase as SocialIcebreakerPhase);
  if (!phaseModule) {
    return res.status(400).json({ error: 'Unknown phase' });
  }

  if (state.playerCount < phaseModule.minPlayers) {
    return res.status(400).json({
      error: `Phase ${phaseModule.name} requires at least ${phaseModule.minPlayers} players`,
    });
  }

  state.currentPhase = phase as SocialIcebreakerPhase;
  state.phaseStartedAt = Date.now();
  state.phaseSelectionId = undefined;
  state.pulseChecks = [];

  await updateSession(socialSessionId, state);

  logger.info('Custom mode phase selected', {
    socialSessionId,
    userId,
    phase,
  });

  return res.json({ state: await buildClientState(state, userId) });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/end-session
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/end-session', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: 'Invalid social session id' });
  }
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsedBody = socialIcebreakerEndSessionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { phaseSelectionId } = parsedBody.data;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can end the session' });
  }

  if (state.eventTier !== 'custom') {
    return res.status(400).json({ error: 'End session is only available in custom mode' });
  }

  if (state.currentPhase !== 'phase_selection') {
    return res.status(400).json({ error: 'Session can only be ended from the phase selection screen' });
  }

  if (!state.phaseSelectionId || state.phaseSelectionId !== phaseSelectionId) {
    return res.status(400).json({ error: 'Phase selection round has expired' });
  }

  if (!state.completedPhases.includes(state.currentPhase)) {
    state.completedPhases = [...(state.completedPhases || []), state.currentPhase];
  }
  cleanupPhaseStateForNextPhase(state, state.currentPhase);
  state.currentPhase = 'recap';
  state.phaseStartedAt = Date.now();
  state.phaseSelectionId = undefined;

  await ensureRecapSnapshot(state, socialSessionId);
  await updateSession(socialSessionId, state);

  logger.info('Custom mode session ended', {
    socialSessionId,
    userId,
  });

  return res.json({ state: await buildClientState(state, userId) });
});

export default router;
