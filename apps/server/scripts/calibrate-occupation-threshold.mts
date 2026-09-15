/**
 * Offline calibration for the occupation-resolution threshold τ (contract AC-11).
 *
 * Selects the lowest cosine threshold τ > 0.35 whose top-1 occupation match
 * holds precision ≥ 0.90 on a HELD-OUT split with N ≥ 100 labeled inputs, then
 * writes the machine-readable report consumed by
 * `src/lib/occupationResolution.ts` (so τ_code === τ_script by construction)
 * plus a human-readable markdown report.
 *
 * Corpus contract (`--corpus`, default `apps/server/data/occupation-resolution-corpus.json`):
 *   {
 *     "provenance": "<who/where the labels came from>",   // REQUIRED
 *     "selfDerived": false,                                // MUST be false
 *     "items": [ { "text": "<free-text profession>", "expectedOccupationId": "frontend_engineer" | null } ]
 *   }
 *
 * Provenance rules (AC-11): labels MUST be human-labeled or externally imported.
 * A corpus derived from `occupation-vectors.json` documents is rejected — it
 * would make precision trivially self-satisfiable.
 *
 * Usage:
 *   EMBEDDING_BASE_URL=http://localhost:8000/v1 npx tsx scripts/calibrate-occupation-threshold.mts \
 *     --corpus data/occupation-resolution-corpus.json
 *
 * Exits non-zero (without writing a report) when the corpus is missing, not
 * provably independent, too small, or no τ meets the precision bar.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddingClient } from '../src/embeddingClient.js';
import { cosine, loadIndex, type VectorEntry } from '../src/lib/occupationVectorIndex.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRIPT_VERSION = 'occupation-threshold-calibration-v1';
const TARGET_PRECISION = 0.9;
const MIN_THRESHOLD = 0.35; // τ must be strictly greater than this
const MIN_HELD_OUT = 100;
const MIN_PREDICTED = 10;
const HELD_OUT_FRACTION = 0.4;
const THRESHOLD_START = 0.36;
const THRESHOLD_STEP = 0.01;

const DEFAULT_CORPUS_PATH = resolve(__dirname, '..', 'data', 'occupation-resolution-corpus.json');
const VECTORS_PATH = resolve(__dirname, '..', 'data', 'occupation-vectors.json');
const REPORT_JSON_PATH = resolve(__dirname, '..', 'data', 'occupation-threshold-report.json');
const REPORT_MD_PATH = resolve(__dirname, '..', '..', '..', 'docs', 'reports', 'occupation-resolution-threshold.md');

interface CorpusItem {
  text: string;
  expectedOccupationId: string | null;
}

interface Corpus {
  provenance?: unknown;
  selfDerived?: unknown;
  items?: unknown;
}

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function fail(message: string): never {
  console.error(`\n❌ BLOCKED: ${message}\n`);
  process.exit(1);
}

function hashUnit(text: string): number {
  const digest = createHash('sha256').update(text).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function isHeldOut(text: string): boolean {
  return hashUnit(text) < HELD_OUT_FRACTION;
}

function loadCorpus(corpusPath: string): { provenance: string; items: CorpusItem[] } {
  if (!existsSync(corpusPath)) {
    fail(
      `labeled corpus not found at ${corpusPath}. Provide a human-labeled or externally\n` +
        `  imported corpus (see the header of this script). Do NOT derive one from\n` +
        `  occupation-vectors.json — AC-11 explicitly rejects self-referential corpora.`,
    );
  }
  if (resolve(corpusPath) === VECTORS_PATH) {
    fail('the corpus cannot be occupation-vectors.json itself (self-derived).');
  }

  let parsed: Corpus;
  try {
    parsed = JSON.parse(readFileSync(corpusPath, 'utf-8')) as Corpus;
  } catch (error) {
    fail(`could not parse corpus JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const provenance = typeof parsed.provenance === 'string' ? parsed.provenance.trim() : '';
  if (!provenance) {
    fail('corpus is missing a non-empty `provenance` string (who/where the labels came from).');
  }
  if (parsed.selfDerived !== false) {
    fail('corpus must set `"selfDerived": false` — self-derived labels are not acceptable.');
  }
  if (/occupation-vectors|build-occupation-vectors/i.test(provenance)) {
    fail('corpus provenance points at occupation-vectors.json; that is a self-derived corpus.');
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : null;
  if (!rawItems) fail('corpus is missing an `items` array.');

  const items: CorpusItem[] = [];
  const seen = new Set<string>();
  for (const entry of rawItems as Array<Record<string, unknown>>) {
    const text = typeof entry?.text === 'string' ? entry.text.trim() : '';
    if (!text) fail('every corpus item must have a non-empty `text`.');
    const expected = entry?.expectedOccupationId;
    if (expected !== null && typeof expected !== 'string') {
      fail(`corpus item "${text}" must have \`expectedOccupationId\` as a string or null.`);
    }
    const key = `${text}\u0000${expected ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ text, expectedOccupationId: expected as string | null });
  }
  if (items.length === 0) fail('corpus has no usable items.');

  return { provenance, items };
}

/**
 * Reject corpora that reuse the exact documents backing the vector index.
 * A corpus query that equals a vector `document` is self-derived.
 */
function assertNotLeakedFromVectorDocuments(corpusPath: string, items: CorpusItem[]): void {
  if (!existsSync(VECTORS_PATH)) return;
  let documents: Set<string>;
  try {
    const entries = JSON.parse(readFileSync(VECTORS_PATH, 'utf-8')) as Array<{ document?: string }>;
    documents = new Set(entries.map((e) => (e.document ?? '').trim()).filter(Boolean));
  } catch {
    return;
  }
  const leaked = items.filter((item) => documents.has(item.text));
  if (leaked.length > 0) {
    fail(
      `${leaked.length}/${items.length} corpus inputs are verbatim occupation-vectors.json\n` +
        `  documents (e.g. "${leaked[0].text.slice(0, 40)}"). This corpus is self-derived.`,
    );
  }
}

interface ScoredItem {
  text: string;
  expectedOccupationId: string | null;
  top1: { occupationId: string; displayName: string; confidence: number } | null;
}

function precisionAt(items: ScoredItem[], tau: number): { precision: number; predicted: number; correct: number } {
  let predicted = 0;
  let correct = 0;
  for (const item of items) {
    if (!item.top1 || item.top1.confidence < tau) continue;
    predicted++;
    if (item.expectedOccupationId === item.top1.occupationId) correct++;
  }
  return { precision: predicted === 0 ? 0 : correct / predicted, predicted, correct };
}

function top1For(vector: number[], index: VectorEntry[]): ScoredItem['top1'] {
  let best: ScoredItem['top1'] = null;
  for (const entry of index) {
    const confidence = cosine(vector, entry.vector);
    if (!best || confidence > best.confidence) {
      best = { occupationId: entry.id, displayName: entry.displayName, confidence };
    }
  }
  return best;
}

async function main(): Promise<void> {
  const corpusPath = resolve(readArg('--corpus') ?? DEFAULT_CORPUS_PATH);

  console.log('=== Occupation-resolution threshold calibration (AC-11) ===\n');
  console.log(`Corpus:     ${corpusPath}`);
  console.log(`Vectors:    ${VECTORS_PATH}`);
  console.log(`Endpoint:   ${process.env.EMBEDDING_BASE_URL || '(not set)'}\n`);

  const { provenance, items } = loadCorpus(corpusPath);
  assertNotLeakedFromVectorDocuments(corpusPath, items);

  const heldOut = items.filter((item) => isHeldOut(item.text));
  const train = items.filter((item) => !isHeldOut(item.text));
  if (heldOut.length < MIN_HELD_OUT) {
    fail(
      `held-out split has ${heldOut.length} inputs (< ${MIN_HELD_OUT}). Supply at least ` +
        `${Math.ceil(MIN_HELD_OUT / HELD_OUT_FRACTION)} labeled items.`,
    );
  }

  const probe = await embeddingClient.embed('occupation threshold calibration probe');
  if (!probe) {
    fail(
      'embedding endpoint not reachable. Set EMBEDDING_BASE_URL to a running Granite\n' +
        '  embedding server before calibrating (τ cannot be produced offline).',
    );
  }

  const index = loadIndex();
  console.log(`Corpus:     ${items.length} items (train=${train.length}, held-out=${heldOut.length})`);
  console.log(`Embeddings: model=${probe.model} dim=${probe.dimensions}`);
  console.log(`Index:      ${index.length} occupation vectors\n`);

  const score = async (subset: CorpusItem[]): Promise<ScoredItem[]> => {
    const scored: ScoredItem[] = [];
    for (let i = 0; i < subset.length; i++) {
      const item = subset[i];
      const result = await embeddingClient.embed(item.text);
      if (!result) fail(`embedding returned null for corpus item "${item.text.slice(0, 40)}".`);
      scored.push({
        text: item.text,
        expectedOccupationId: item.expectedOccupationId,
        top1: top1For(result.vector, index),
      });
      if ((i + 1) % 50 === 0) console.log(`  embedded ${i + 1}/${subset.length}`);
    }
    return scored;
  };

  console.log('Embedding held-out split...');
  const heldOutScored = await score(heldOut);
  console.log('Embedding train split...');
  const trainScored = await score(train);

  const sweep: Array<{ tau: number; precision: number; predicted: number; correct: number; trainPrecision: number; trainPredicted: number }> = [];
  let selected: (typeof sweep)[number] | null = null;

  for (let tau = THRESHOLD_START; tau <= 1.0001; tau = Math.round((tau + THRESHOLD_STEP) * 100) / 100) {
    const held = precisionAt(heldOutScored, tau);
    const tr = precisionAt(trainScored, tau);
    const row = { tau, precision: held.precision, predicted: held.predicted, correct: held.correct, trainPrecision: tr.precision, trainPredicted: tr.predicted };
    sweep.push(row);
    if (!selected && tau > MIN_THRESHOLD && held.precision >= TARGET_PRECISION && held.predicted >= MIN_PREDICTED) {
      selected = row;
    }
  }

  if (!selected) {
    const best = [...sweep].sort((a, b) => b.precision - a.precision)[0];
    fail(
      `no τ > ${MIN_THRESHOLD} reached precision ≥ ${TARGET_PRECISION} with ≥ ${MIN_PREDICTED} predictions ` +
        `on the held-out split (best held-out precision=${(best?.precision ?? 0).toFixed(3)} ` +
        `at τ=${best?.tau ?? 'n/a'}). Report this to the corpus owner instead of lowering the bar.`,
    );
  }

  const report = {
    tau: selected.tau,
    targetPrecision: TARGET_PRECISION,
    precision: Number(selected.precision.toFixed(4)),
    predicted: selected.predicted,
    correct: selected.correct,
    heldOutN: heldOutScored.length,
    totalN: items.length,
    trainN: trainScored.length,
    coverage: Number((selected.predicted / heldOutScored.length).toFixed(4)),
    corpusProvenance: provenance,
    corpusPath,
    embeddingModel: probe.model,
    scriptVersion: SCRIPT_VERSION,
    generatedAt: new Date().toISOString(),
    thresholds: sweep.map((row) => ({
      tau: row.tau,
      precision: Number(row.precision.toFixed(4)),
      predicted: row.predicted,
    })),
  };

  mkdirSync(dirname(REPORT_JSON_PATH), { recursive: true });
  writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf-8');

  const markdown = [
    '# Occupation-resolution threshold calibration (AC-11)',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Script: \`apps/server/scripts/calibrate-occupation-threshold.mts\` (${SCRIPT_VERSION})`,
    `- Corpus: \`${corpusPath}\``,
    `- **Corpus provenance**: ${provenance}`,
    `- Embedding model: \`${probe.model}\` (${probe.dimensions} dims)`,
    `- Split: ${items.length} total → ${trainScored.length} train / ${heldOutScored.length} held-out (deterministic sha256)`,
    '',
    '## Selected threshold',
    '',
    `- **τ = ${report.tau}** (contract: τ > 0.35 ✓)`,
    `- Held-out precision = ${report.precision} (target ≥ ${TARGET_PRECISION} ✓)`,
    `- Predicted ${report.predicted}/${report.heldOutN} held-out inputs (coverage ${(report.coverage * 100).toFixed(1)}%)`,
    `- Correct ${report.correct}/${report.predicted}`,
    '',
    '> Runtime consumes this value from `apps/server/data/occupation-threshold-report.json`',
    '> via `OCCUPATION_RESOLUTION_THRESHOLD`, so `τ_code === τ_script` by construction.',
    '',
    '## Precision sweep (held-out)',
    '',
    '| τ | precision | predicted |',
    '|---|-----------|-----------|',
    ...sweep.filter((_, i) => i % 5 === 0).map((row) => `| ${row.tau.toFixed(2)} | ${row.precision.toFixed(3)} | ${row.predicted} |`),
    '',
  ].join('\n');
  mkdirSync(dirname(REPORT_MD_PATH), { recursive: true });
  writeFileSync(REPORT_MD_PATH, markdown, 'utf-8');

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ SELECTED τ = ${report.tau}`);
  console.log(`   held-out precision = ${report.precision} (N=${report.heldOutN}, predicted=${report.predicted})`);
  console.log(`   report  → ${REPORT_JSON_PATH}`);
  console.log(`   summary → ${REPORT_MD_PATH}`);
  console.log(`\nRuntime reads τ from the JSON report automatically (τ_code === τ_script).`);
}

main().catch((error) => {
  console.error('Calibration failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
