import { logger } from "../../lib/logger";
import { storage } from "../../storage";
import { restoreEngineState } from "../../lib/assessmentEngineState";
import type { Express } from "express";

/** Minimum answered questions before a session-derived prefetch is worth generating. */
const MID_TEST_PREFETCH_MIN_ANSWERS = 8;

export function registerXiaoyueRoutes(app: Express): void {
  // ============ Share Card Data Endpoint ============

  // ============ Xiaoyue AI Analysis Endpoint ============
  app.post('/api/xiaoyue/analysis', async (req: any, res) => {
    try {
      const { archetype, secondaryArchetype, topArchetypes, traitScores, confidence } = req.body;
      const normalizedTopArchetypes = Array.isArray(topArchetypes)
        ? topArchetypes.filter((item: any) =>
            item &&
            typeof item.archetype === 'string' &&
            item.archetype.length > 0 &&
            typeof item.score === 'number' &&
            Number.isFinite(item.score)
          )
        : undefined;
      
      if (!archetype || !traitScores) {
        return res.status(400).json({ message: 'Missing archetype or traitScores' });
      }

      const { generateXiaoyueAnalysis } = await import('../../xiaoyueAnalysisService');
      const result = await generateXiaoyueAnalysis({
        archetype,
        secondaryArchetype,
        topArchetypes: normalizedTopArchetypes,
        traitScores: {
          affinity: traitScores.A || traitScores.affinity || 0.5,
          openness: traitScores.O || traitScores.openness || 0.5,
          conscientiousness: traitScores.C || traitScores.conscientiousness || 0.5,
          emotionalStability: traitScores.E || traitScores.emotionalStability || 0.5,
          extraversion: traitScores.X || traitScores.extraversion || 0.5,
          positivity: traitScores.P || traitScores.positivity || 0.5,
        },
        confidence,
      });
      
      res.json(result);
    } catch (error: any) {
      logger.error('[Xiaoyue Analysis] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to generate analysis', error: error.message });
    }
  });

  // Prefetch xiaoyue analysis when test approaches completion
  app.post('/api/xiaoyue/prefetch', async (req: any, res) => {
    try {
      const { sessionId } = req.body;

      // Session-derived prefetch: the server replays the stored answers to
      // compute the authoritative mid-test profile (matches, confidence,
      // trait scores) instead of trusting client-supplied values. Used during
      // the test itself so the LLM generation finishes before the result page.
      if (typeof sessionId === 'string' && sessionId.length > 0) {
        const session = await storage.getAssessmentSession(sessionId);
        if (!session) {
          return res.json({ prefetched: false, reason: 'Session not found' });
        }

        const { V2_ASSESSMENT_CONFIG, DEFAULT_ASSESSMENT_CONFIG } = await import('@shared/personality');
        const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
        const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
        const { engineState } = await restoreEngineState(session, assessmentConfig);

        const matches = engineState.currentMatches ?? [];
        const archetype = matches[0]?.archetype;
        const confidence = matches[0]?.confidence ?? 0;
        const answeredCount = engineState.answeredQuestionIds?.size ?? 0;

        if (!archetype || answeredCount < MID_TEST_PREFETCH_MIN_ANSWERS || confidence < 0.7) {
          return res.json({ prefetched: false, reason: 'Not ready yet' });
        }

        const scores = engineState.traitConfidences ?? {};
        const { prefetchAnalysisIfReady } = await import('../../xiaoyueAnalysisService');
        prefetchAnalysisIfReady(
          {
            archetype,
            secondaryArchetype: matches[1]?.archetype ?? null,
            topArchetypes: matches.slice(0, 3).map((m: any) => ({ archetype: m.archetype, score: m.score })),
            traitScores: {
              affinity: scores.A?.score ?? 0.5,
              openness: scores.O?.score ?? 0.5,
              conscientiousness: scores.C?.score ?? 0.5,
              emotionalStability: scores.E?.score ?? 0.5,
              extraversion: scores.X?.score ?? 0.5,
              positivity: scores.P?.score ?? 0.5,
            },
          },
          confidence
        );

        return res.json({ prefetched: true, source: 'session' });
      }

      const { archetype, secondaryArchetype, topArchetypes, traitScores, confidence } = req.body;
      const normalizedTopArchetypes = Array.isArray(topArchetypes)
        ? topArchetypes.filter((item: any) =>
            item &&
            typeof item.archetype === 'string' &&
            item.archetype.length > 0 &&
            typeof item.score === 'number' &&
            Number.isFinite(item.score)
          )
        : undefined;
      
      if (!archetype || !traitScores || confidence < 0.7) {
        return res.json({ prefetched: false, reason: 'Not ready yet' });
      }

      const { prefetchAnalysisIfReady } = await import('../../xiaoyueAnalysisService');
      prefetchAnalysisIfReady(
        {
          archetype,
          secondaryArchetype,
          topArchetypes: normalizedTopArchetypes,
          traitScores: {
            affinity: traitScores.A ?? traitScores.affinity ?? 0.5,
            openness: traitScores.O ?? traitScores.openness ?? 0.5,
            conscientiousness: traitScores.C ?? traitScores.conscientiousness ?? 0.5,
            emotionalStability: traitScores.E ?? traitScores.emotionalStability ?? 0.5,
            extraversion: traitScores.X ?? traitScores.extraversion ?? 0.5,
            positivity: traitScores.P ?? traitScores.positivity ?? 0.5,
          },
        },
        confidence
      );
      
      res.json({ prefetched: true });
    } catch (error: any) {
      logger.error('[Xiaoyue Prefetch] Error', { error: String(error) });
      res.json({ prefetched: false, error: error.message });
    }
  });

}
