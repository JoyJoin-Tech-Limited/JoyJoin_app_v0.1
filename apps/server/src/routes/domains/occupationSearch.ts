import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { embeddingClient } from '../../embeddingClient.js';
import { OCCUPATIONS } from '@shared/occupations';
import { requireAuth } from '../../middleware/auth';
import { cosine, safeLoadIndex } from '../../lib/occupationVectorIndex.js';
import { logger } from '../../lib/logger';

const occupationSearchSchema = z.object({
  query: z.string().max(200).optional(),
});

export function registerOccupationSearchRoutes(router: Router): void {
  router.post('/api/occupation/search', requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = occupationSearchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', code: 'INVALID_SEARCH_QUERY' });
        return;
      }

      const query = (parsed.data.query ?? '').trim();
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

      // Step 2: embedding search. Degrade to "no matches" when the generated
      // vector index is absent (e.g. a clean checkout) instead of 500-ing.
      const index = safeLoadIndex();
      if (index.length === 0) {
        res.json({ query, matches: [], matchSource: 'none' });
        return;
      }
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
      logger.error('Occupation search failed', { error: message });
      res.status(500).json({ error: message });
    }
  });
}
