import { Router, type Request, type Response } from 'express';
import { embeddingClient } from '../../embeddingClient.js';
import { OCCUPATIONS } from '@shared/occupations';
import { requireAuth } from '../../middleware/auth';
import { cosine, loadIndex } from '../../lib/occupationVectorIndex.js';

export function registerOccupationSearchRoutes(router: Router): void {
  router.post('/api/occupation/search', requireAuth, async (req: Request, res: Response) => {
    try {
      const query = (req.body?.query ?? '').trim();
      if (!query) {
        res.json({ query, matches: [], matchSource: 'none' });
        return;
      }

      // Step 1: exact match against displayName or synonyms
      const exactDisplay = OCCUPATIONS.find(
        (o) => o.displayName === query || (o.synonyms ?? []).includes(query),
      );
      if (exactDisplay) {
        res.json({
          query,
          matches: [{
            occupationId: exactDisplay.id,
            displayName: exactDisplay.displayName,
            industryId: exactDisplay.industryId,
            confidence: 1,
          }],
          matchSource: 'exact',
        });
        return;
      }

      // Step 2: embedding search
      const index = loadIndex();
      const queryVec = await embeddingClient.embed(query);
      if (!queryVec) {
        res.json({ query, matches: [], matchSource: 'none' });
        return;
      }

      const scored = index
        .map((e) => ({
          occupationId: e.id,
          displayName: e.displayName,
          industryId: e.industryId,
          confidence: cosine(queryVec.vector, e.vector),
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

      const hasHigh = scored.some((m) => m.confidence > 0.7);

      res.json({
        query,
        matches: scored,
        matchSource: hasHigh ? 'embedding' : 'none',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'search failed';
      res.status(500).json({ error: message });
    }
  });
}
