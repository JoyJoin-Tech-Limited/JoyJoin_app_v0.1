import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { type TierMachineId, resolveTierDisplay } from '@shared/socialIcebreakerTierManifest';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { compileForSession } from '../services/runPlanService';
import {
  updateSession,
  listParticipants,
  invalidatePreGenerationForSession,
} from '../lib/socialIcebreakerStore';
import {
  resolveSession,
  isHostAuthorized,
  buildClientState,
} from './socialIcebreakerHelpers';
import { enqueueRunPlanPreGeneration } from '../jobs/preGenerationQueue';
import { getFeatureFlag } from '../lib/featureFlags';
import { logger } from '../lib/logger';

const router = Router();

const socialSessionIdParamSchema = z.object({
  socialSessionId: z.string().min(1),
});

const setTierBodySchema = z.object({
  tier: z.string().min(1),
  vibe: z.enum(['chat', 'balanced', 'game']).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/set-tier
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/set-tier', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: 'Invalid social session id' });
  }
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsedBody = setTierBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { tier, vibe } = parsedBody.data;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can set the tier' });
  }

  // Changing runPlan after warmup would desync currentPhase from the new segment order
  // (getNextEligiblePhase uses runPlan.segments); only allow while still in warmup.
  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({
      error: 'Tier can only be changed during warmup (before advancing past the first phase)',
    });
  }

  const VALID_TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze', 'custom'];
  if (!tier || !VALID_TIERS.includes(tier as TierMachineId)) {
    return res.status(400).json({ error: 'Invalid tier. Must be one of: breeze, glow, blaze, custom' });
  }

  const newTier = tier as TierMachineId;

  if (newTier === 'custom') {
    const customModeEnabled = await getFeatureFlag('socialIcebreakerCustomModeEnabled', true);
    if (!customModeEnabled) {
      return res.status(400).json({ error: 'Custom mode is not enabled' });
    }
    state.eventTier = newTier;
    state.vibe = vibe && ['chat', 'balanced', 'game'].includes(vibe) ? vibe : state.vibe || 'balanced';
    state.runPlan = undefined;
    state.autoAdvanceEnabled = false;
    await updateSession(socialSessionId, state);
    await invalidatePreGenerationForSession(socialSessionId);
    logger.info('Social icebreaker tier updated to custom', { socialSessionId, userId });
    return res.json({
      socialSessionId,
      eventTier: newTier,
      tierDisplayName: resolveTierDisplay(newTier, { glowVariant: 'default' }),
      runPlan: undefined,
      state: await buildClientState(state, userId),
    });
  }

  if (vibe && ['chat', 'balanced', 'game'].includes(vibe)) {
    state.vibe = vibe;
  }
  const runPlan = await compileForSession(state, newTier);

  state.eventTier = newTier;
  state.runPlan = runPlan;
  state.autoAdvanceEnabled = true;
  await updateSession(socialSessionId, state);

  await invalidatePreGenerationForSession(socialSessionId);

  // Re-enqueue pre-generation for the new run plan (best-effort)
  const rosterAfterTierChange = await listParticipants(socialSessionId);
  try {
    await enqueueRunPlanPreGeneration(
      socialSessionId,
      runPlan,
      {
        participantCount: rosterAfterTierChange.length,
        eventType: state.eventType,
        participants: rosterAfterTierChange.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
        })),
      },
    );
  } catch (preGenErr) {
    logger.warn('Failed to enqueue run plan pre-generation on set-tier', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  logger.info('Social icebreaker tier updated', {
    socialSessionId,
    userId,
    tier: newTier,
  });

  return res.json({
    socialSessionId,
    eventTier: newTier,
    tierDisplayName: resolveTierDisplay(newTier, { glowVariant: 'default' }),
    runPlan,
    state: await buildClientState(state, userId),
  });
});

export default router;
