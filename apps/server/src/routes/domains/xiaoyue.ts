import { logger } from "../../lib/logger";
import type { Express } from "express";

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
