/**
 * Shared occupation vector index.
 *
 * Extracted from `routes/domains/occupationSearch.ts` so both the occupation
 * search route and the profession-understanding resolution path can reuse the
 * same memoized index without a domain importing a routes file.
 *
 * The index is a pre-computed array of Granite embeddings built by
 * `scripts/build-occupation-vectors.mts` (`apps/server/data/occupation-vectors.json`).
 * Loading is lazy and memoized: the file is read at most once per process.
 *
 * Path resolution must work in BOTH layouts:
 *  - dev (tsx): module at `apps/server/src/lib`  → `../../data`
 *  - bundled:  esbuild inlines this into `apps/server/dist/index.js` → `../data`
 * so `dataDirCandidates()` tries both (shared with `occupationResolution.ts`).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INDEX_FILENAME = 'occupation-vectors.json';

/**
 * Candidate `data/` directories across source and bundle layouts. The bundle
 * collapses every module to `dist/index.js`, so `__dirname` there is
 * `apps/server/dist` and the index sits one level up in `apps/server/data`.
 */
export function dataDirCandidates(): string[] {
  return [
    resolve(__dirname, '..', '..', 'data'),
    resolve(__dirname, '..', 'data'),
  ];
}

export interface VectorEntry {
  id: string;
  displayName: string;
  industryId: string;
  vector: number[];
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

let vectorIndex: VectorEntry[] | null = null;

export function loadIndex(): VectorEntry[] {
  if (vectorIndex) return vectorIndex;

  for (const dir of dataDirCandidates()) {
    const path = resolve(dir, INDEX_FILENAME);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, 'utf-8');
    vectorIndex = JSON.parse(raw) as VectorEntry[];
    return vectorIndex;
  }

  throw new Error('occupation-vectors.json not found. Run: npx tsx scripts/build-occupation-vectors.mts');
}

/**
 * Load the index but never throw — returns an empty index when the generated
 * artifact is missing (e.g. a clean CI checkout). Callers on the request path
 * must degrade to "no candidates" instead of failing the route.
 */
export function safeLoadIndex(): VectorEntry[] {
  try {
    return loadIndex();
  } catch {
    return [];
  }
}
