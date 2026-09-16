/**
 * Deterministic occupation resolution + correction-candidate mapping for the
 * profession-understanding response (`POST /api/inference/understand-profession`).
 *
 * Two responsibilities:
 *  1. Resolve `standardizedOccupationId` to a canonical `OCCUPATIONS[].id`
 *     (or `null`). Decoupled from `industryNiche`; never guesses.
 *       a. exact / synonyms match in `OCCUPATIONS`      → that id
 *       b. embedding index top match with confidence ≥ τ → that occupationId
 *       c. otherwise                                     → null
 *  2. Map the classifier's existing `generateCandidates()` output
 *     (`classification.candidates`) into the `correctionCandidates` groups,
 *     topping up the occupation group from the existing vector index.
 *
 * No LLM call is made here. The embedding call (Granite, not an LLM) is the
 * only network dependency; it is skipped entirely when the vector index is
 * absent, is bounded by an abort budget, and degrades to `null` on missing
 * config/failure/timeout — the deterministic result is always preserved.
 *
 * τ provenance: the offline calibration script writes
 * `occupation-threshold-report.json`, but `apps/server/data/.gitignore`
 * excludes `*.json`, so a git deploy never carries the report and the runtime
 * τ is `null` — the embedding resolution branch is disabled (fail-closed;
 * only exact/synonym matches resolve). The report is consumed only when ops
 * explicitly mounts it into `apps/server/data/`; it is never generated at
 * runtime. The calibration script is an offline tool and is unused at runtime.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OCCUPATIONS } from '@shared/occupations';
import type { IndustryClassificationResult } from '../inference/industryClassifier';
import { embeddingClient } from '../embeddingClient';
import { cosine, safeLoadIndex, dataDirCandidates, type VectorEntry } from './occupationVectorIndex';
import { logger } from './logger';

export const MAX_CORRECTION_CANDIDATES = 3;

/** Contract AC-11: a usable τ must be strictly above 0.35. */
const MIN_CALIBRATED_THRESHOLD = 0.35;
/** Contract AC-11: selected τ must hold ≥ 0.90 precision on the held-out split. */
const MIN_CALIBRATION_PRECISION = 0.9;
/** Contract AC-11: held-out split must contain at least 100 labeled inputs. */
const MIN_CALIBRATION_HELD_OUT = 100;
const OCCUPATION_THRESHOLD_REPORT_FILENAME = 'occupation-threshold-report.json';

export interface OccupationCandidate {
  id: string;
  label: string;
}

export interface CorrectionCandidates {
  category: OccupationCandidate[];
  segment: OccupationCandidate[];
  occupation: OccupationCandidate[];
}

export interface IndexMatch {
  occupationId: string;
  displayName: string;
  confidence: number;
}

// dataDirCandidates() is imported from ./occupationVectorIndex (shared; handles
// both the source and the bundled dist/index.js layouts).

/**
 * Read the offline-calibrated threshold from the calibration report when it
 * is present (ops-mounted; the file is gitignored, so it is absent on git
 * deploys). Returns `null` (embedding resolution disabled) unless the report
 * proves the AC-11 bar: finite τ > 0.35, precision ≥ 0.90, held-out N ≥ 100.
 */
function readCalibratedThreshold(): number | null {
  for (const dir of dataDirCandidates()) {
    const reportPath = resolve(dir, OCCUPATION_THRESHOLD_REPORT_FILENAME);
    try {
      if (!existsSync(reportPath)) continue;
      const report = JSON.parse(readFileSync(reportPath, 'utf-8')) as {
        tau?: unknown;
        precision?: unknown;
        heldOutN?: unknown;
      };
      const tau = typeof report.tau === 'number' ? report.tau : Number.NaN;
      const precision = typeof report.precision === 'number' ? report.precision : Number.NaN;
      const heldOutN = typeof report.heldOutN === 'number' ? report.heldOutN : Number.NaN;
      if (!Number.isFinite(tau) || tau <= MIN_CALIBRATED_THRESHOLD) return null;
      if (!Number.isFinite(precision) || precision < MIN_CALIBRATION_PRECISION) return null;
      if (!Number.isFinite(heldOutN) || heldOutN < MIN_CALIBRATION_HELD_OUT) return null;
      return tau;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Runtime occupation-resolution threshold τ (raw cosine).
 *
 * `null` = no valid calibration report mounted (the normal case on git
 * deploys, since the report is gitignored) → embedding resolution is
 * disabled and only exact/synonyms matches produce a canonical id.
 */
export const OCCUPATION_RESOLUTION_THRESHOLD: number | null = readCalibratedThreshold();

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Exact match against `OCCUPATIONS[].displayName` or `synonyms`.
 *
 * Ambiguous terms owned by more than one occupation (e.g. the widely shared
 * synonym "大厂") resolve to `null` rather than silently picking the first —
 * the contract's resolution rule is "never guess".
 */
export function findExactOccupationId(rawInput: string): string | null {
  const term = normalizeTerm(rawInput);
  if (!term) return null;
  const matches = OCCUPATIONS.filter((occ) => {
    if (normalizeTerm(occ.displayName) === term) return true;
    return (occ.synonyms ?? []).some((synonym) => normalizeTerm(synonym) === term);
  });
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Top-1 cosine match over a preloaded index, gated by `threshold` (inclusive:
 * confidence ≥ τ passes).
 */
export function findIndexMatch(
  vector: number[],
  index: VectorEntry[],
  threshold: number,
): IndexMatch | null {
  let best: IndexMatch | null = null;
  for (const entry of index) {
    const confidence = cosine(vector, entry.vector);
    if (!best || confidence > best.confidence) {
      best = { occupationId: entry.id, displayName: entry.displayName, confidence };
    }
  }
  if (!best || best.confidence < threshold) return null;
  return best;
}

/**
 * Map `generateCandidates()` output into the three correction groups.
 * Deduped by id, excludes already-chosen values, capped at ≤3 per group.
 */
export function mapCandidateGroups(
  candidates: IndustryClassificationResult['candidates'],
  exclude: {
    categoryId?: string | null;
    segmentId?: string | null;
    occupationId?: string | null;
  } = {},
): CorrectionCandidates {
  const category: OccupationCandidate[] = [];
  const segment: OccupationCandidate[] = [];
  const occupation: OccupationCandidate[] = [];
  const seenCategory = new Set<string>();
  const seenSegment = new Set<string>();
  const seenOccupation = new Set<string>();

  for (const candidate of candidates ?? []) {
    if (candidate?.category?.id) {
      const id = candidate.category.id;
      if (id !== exclude.categoryId && !seenCategory.has(id) && category.length < MAX_CORRECTION_CANDIDATES) {
        seenCategory.add(id);
        category.push({ id, label: candidate.category.label });
      }
    }
    if (candidate?.segment?.id) {
      const id = candidate.segment.id;
      if (id !== exclude.segmentId && !seenSegment.has(id) && segment.length < MAX_CORRECTION_CANDIDATES) {
        seenSegment.add(id);
        segment.push({ id, label: candidate.segment.label });
      }
    }
    const occupationId = candidate?.occupationId;
    const occupationName = candidate?.occupationName;
    if (occupationId && occupationName) {
      if (occupationId !== exclude.occupationId && !seenOccupation.has(occupationId) && occupation.length < MAX_CORRECTION_CANDIDATES) {
        seenOccupation.add(occupationId);
        occupation.push({ id: occupationId, label: occupationName });
      }
    }
  }

  return { category, segment, occupation };
}

/**
 * Top up the occupation group from the vector index when the classifier
 * produced fewer than the cap. Returns a new array.
 */
export function topUpOccupationCandidates(
  existing: OccupationCandidate[],
  vector: number[],
  index: VectorEntry[],
  excludeId: string | null,
): OccupationCandidate[] {
  if (existing.length >= MAX_CORRECTION_CANDIDATES || index.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((candidate) => candidate.id));
  if (excludeId) seen.add(excludeId);

  const toppedUp = [...existing];
  const ranked = index
    .filter((entry) => !seen.has(entry.id))
    .map((entry) => ({ id: entry.id, label: entry.displayName, score: cosine(vector, entry.vector) }))
    .sort((a, b) => b.score - a.score);

  for (const entry of ranked) {
    if (toppedUp.length >= MAX_CORRECTION_CANDIDATES) break;
    toppedUp.push({ id: entry.id, label: entry.label });
  }

  return toppedUp;
}

export interface ProfessionOccupationResolution {
  standardizedOccupationId: string | null;
  correctionCandidates: CorrectionCandidates;
}

export interface ResolveProfessionOccupationOptions {
  /** Override the runtime τ. `null` disables the embedding resolution branch. */
  threshold?: number | null;
  /** Precomputed query embedding, to avoid a duplicate embedding call. */
  queryVector?: number[] | null;
  /**
   * Abort budget for the embedding call. On expiry the call is aborted and
   * resolution continues with the deterministic result. Defaults to
   * `DEFAULT_EMBEDDING_TIMEOUT_MS`; callers on a request path should pass a
   * budget comfortably below their own outer timeout.
   */
  embeddingTimeoutMs?: number;
}

/**
 * Default abort budget for the embedding call. Kept below the route-level
 * occupation-resolution bound (1500ms) so a slow/hung embedding degrades to
 * the deterministic result instead of tripping the outer timeout.
 */
export const DEFAULT_EMBEDDING_TIMEOUT_MS = 1200;

// Fix C: the production Docker image ships without `occupation-vectors.json`,
// so an empty index is the expected steady state there — surface it once per
// process instead of spamming per request.
let emptyIndexWarned = false;
function warnEmptyIndexOnce(): void {
  if (emptyIndexWarned) return;
  emptyIndexWarned = true;
  logger.warn(
    '[occupationResolution] Occupation vector index missing/empty — embedding resolution and candidate top-up disabled; falling back to deterministic exact-match-only resolution',
  );
}

/**
 * Resolve the canonical occupation id and build correction candidates.
 * Deterministic: identical input + identical index ⇒ identical output.
 *
 * Control flow (Fix A + Fix B):
 *  1. The deterministic exact/synonym match and the `generateCandidates()`
 *     group mapping are computed first and are never gated on the network.
 *  2. The embedding call is a bounded best-effort: it is skipped entirely
 *     when the vector index is empty (no quota/latency spent), and an
 *     abort/timeout/failure resolves to `null` so the deterministic result
 *     above is returned unchanged — never discarded.
 */
export async function resolveProfessionOccupation(
  rawInput: string,
  classification: Pick<IndustryClassificationResult, 'category' | 'segment' | 'niche' | 'candidates'>,
  options: ResolveProfessionOccupationOptions = {},
): Promise<ProfessionOccupationResolution> {
  const threshold =
    options.threshold === undefined ? OCCUPATION_RESOLUTION_THRESHOLD : options.threshold;
  const embeddingTimeoutMs = options.embeddingTimeoutMs ?? DEFAULT_EMBEDDING_TIMEOUT_MS;

  // Snapshot the index once: every embedding/index decision below keys off it.
  const index = safeLoadIndex();
  const hasIndex = index.length > 0;
  if (!hasIndex) warnEmptyIndexOnce();

  let queryVector: number[] | null = options.queryVector ?? null;
  let vectorResolved = queryVector !== null;

  // Bounded best-effort embedding. Skipped without an index; abort/timeout
  // or provider failure yields `null`, preserving the deterministic result.
  const getQueryVector = async (): Promise<number[] | null> => {
    if (!hasIndex) return null;
    if (vectorResolved) return queryVector;
    vectorResolved = true;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), embeddingTimeoutMs);
    try {
      const result = await embeddingClient.embed(rawInput, { signal: abort.signal });
      queryVector = result?.vector ?? null;
    } catch {
      queryVector = null;
    } finally {
      clearTimeout(timer);
    }
    return queryVector;
  };

  let standardizedOccupationId = findExactOccupationId(rawInput);
  if (!standardizedOccupationId && typeof threshold === 'number') {
    const vector = await getQueryVector();
    if (vector) {
      standardizedOccupationId = findIndexMatch(vector, index, threshold)?.occupationId ?? null;
    }
  }

  const correctionCandidates = mapCandidateGroups(classification.candidates, {
    categoryId: classification.category?.id ?? null,
    segmentId: classification.segment?.id ?? null,
    occupationId: standardizedOccupationId,
  });

  if (correctionCandidates.occupation.length < MAX_CORRECTION_CANDIDATES) {
    const vector = await getQueryVector();
    if (vector) {
      correctionCandidates.occupation = topUpOccupationCandidates(
        correctionCandidates.occupation,
        vector,
        index,
        standardizedOccupationId,
      );
    }
  }

  return { standardizedOccupationId, correctionCandidates };
}
