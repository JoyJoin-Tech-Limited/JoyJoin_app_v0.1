import { Router, type Request, type Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddingClient } from '../../embeddingClient.js';
import { OCCUPATIONS } from '@shared/occupations';
import { requireAuth } from '../../phoneAuth';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface VectorEntry {
  id: string;
  displayName: string;
  industryId: string;
  vector: number[];
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

let vectorIndex: VectorEntry[] | null = null;

function loadIndex(): VectorEntry[] {
  if (vectorIndex) return vectorIndex;

  const path = resolve(__dirname, '..', '..', '..', 'data', 'occupation-vectors.json');
  if (!existsSync(path)) {
    throw new Error('occupation-vectors.json not found. Run: npx tsx scripts/build-occupation-vectors.mts');
  }

  const raw = readFileSync(path, 'utf-8');
  vectorIndex = JSON.parse(raw) as VectorEntry[];
  return vectorIndex;
}

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
