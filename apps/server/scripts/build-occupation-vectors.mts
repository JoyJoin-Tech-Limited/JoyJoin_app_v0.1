/**
 * Pre-compute occupation embeddings using the running Granite server.
 *
 * Usage:
 *   EMBEDDING_BASE_URL=http://localhost:8000/v1 npx tsx scripts/build-occupation-vectors.mts
 *
 * Output: apps/server/data/occupation-vectors.json
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddingClient } from '../src/embeddingClient.js';
import { OCCUPATIONS } from '@shared/occupations';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'data', 'occupation-vectors.json');

interface OccupationEntry {
  id: string;
  displayName: string;
  industryId: string;
  vector: number[];
  document: string;
}

async function main() {
  console.log(`Building occupation vectors for ${OCCUPATIONS.length} occupations...\n`);

  const entries: OccupationEntry[] = [];

  for (let i = 0; i < OCCUPATIONS.length; i++) {
    const o = OCCUPATIONS[i];
    const doc = [
      o.displayName,
      ...(o.synonyms ?? []),
      ...(o.keywords ?? []),
    ].filter(Boolean).join(' ');

    const r = await embeddingClient.embed(doc);
    if (!r) {
      console.error(`  FAIL: ${o.id} — skipping`);
      continue;
    }

    entries.push({
      id: o.id,
      displayName: o.displayName,
      industryId: o.industryId,
      vector: r.vector,
      document: doc,
    });

    if ((i + 1) % 50 === 0 || i === OCCUPATIONS.length - 1) {
      console.log(`  ${i + 1}/${OCCUPATIONS.length}`);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`\nDone. ${entries.length} vectors written to ${OUT_PATH}`);
  console.log(`Vector dimension: ${entries[0]?.vector.length ?? '?'}`);
}

main();
