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
 *     topping up the occupation group from the existing vector index — scoped
 *     to the classified taxonomy category and floored by `TOP_UP_MIN_COSINE`,
 *     so the 换一个 tray never offers cross-category roles.
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

/**
 * Minimum cosine for a top-up candidate. Entries below the floor are excluded
 * even if that leaves fewer than three (or zero) candidates — an empty
 * occupation tray is spec-sanctioned (「无候选即待补充」) and beats showing
 * irrelevant roles.
 *
 * Calibration note (2026-10-14, re-measured 2026-10-15 against the regenerated
 * 167-entry index via the staging Granite endpoint): query-doc cosines live in
 * ~[0.66, 0.97] — self-matches (并购顾问 → ma_advisor 0.955, 投资经理 →
 * investment_manager 0.965, 行业研究员 → industry_researcher 0.901) rank top,
 * and even the worst cross-domain pair stays ≈0.66. Cross-industry distractors
 * score high (房产经纪 0.874 on a 并购顾问 query), which is exactly why the
 * category scoping in `topUpOccupationCandidates` — not the floor — does the
 * real work. So on the current index this floor filters nothing; 0.45 is a
 * deliberately conservative corruption net (future re-embedded index with a
 * wider spread, or corrupt vectors) that never empties a healthy tray.
 */
export const TOP_UP_MIN_COSINE = 0.45;

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
 * Classification context for the top-up, passed from the classified result so
 * the tray stays inside the category the user was classified into.
 */
export interface TopUpScope {
  /** Classified three-tier taxonomy category id (`INDUSTRY_TAXONOMY`). */
  categoryId?: string | null;
  /**
   * Classified taxonomy segment id. Currently unused for filtering (scoping is
   * category-level per spec); passed so segment-level ranking can be added
   * without changing the call-site signature again.
   */
  segmentId?: string | null;
}

/**
 * Vector-index `industryId` vocabulary (17 ids — the `INDUSTRIES` list in
 * packages/shared/src/occupations.ts, mirrored by every committed
 * `VectorEntry.industryId`) → three-tier taxonomy category ids
 * (`INDUSTRY_TAXONOMY` in packages/shared/src/industryTaxonomy.ts, 21 ids).
 *
 * Where one industry fans out to several taxonomy categories (e.g. `realestate`
 * covers 地产建筑 → 房地产 + 建筑工程) the value lists every plausible category;
 * an entry is in-scope when the classified category appears in its list.
 * `other` deliberately maps to nothing — those occupations only enter a scoped
 * tray via their `seedMappings` (signal b below) or the global fallback.
 */
const INDUSTRY_TO_TAXONOMY_CATEGORIES: Record<string, readonly string[]> = {
  ai: ['tech'], // AI/大数据 → tech/ai_ml + tech/data_analytics
  consulting: ['professional_services'], // 咨询/HR/行政 → 专业服务
  creative: ['media_creative'], // performers override to culture_sports via seedMappings
  ecommerce: ['consumer_retail'], // 跨境电商 → 消费品/零售
  education: ['education'],
  finance: ['finance'],
  hardware: ['semiconductor', 'manufacturing'], // 硬科技/芯片 → 半导体 + 制造
  hospitality: ['life_services'], // 航空酒店旅游 → 生活服务
  legal: ['professional_services'],
  lifestyle: ['life_services', 'consumer_retail'], // 咖啡/厨师等 → 生活服务/餐饮
  marketing: ['media_creative'], // 广告/公关/营销
  media: ['media_creative'],
  medical: ['healthcare'],
  new_energy: ['energy_environment', 'manufacturing'], // 新能源车 → 能源 + 汽车制造
  other: [], // 其他行业: no taxonomy home; seedMappings or global fallback only
  realestate: ['real_estate', 'construction'], // 地产建筑 → 房地产 + 建筑工程
  tech: ['tech'],
};

/**
 * occupationId → `seedMappings.category` for the catalog entries that carry an
 * explicit taxonomy anchor (38/167 at time of writing). Precomputed once —
 * the top-up must not do a per-entry `OCCUPATIONS.find` on the request path.
 */
const OCCUPATION_SEED_CATEGORY_BY_ID: ReadonlyMap<string, string> = new Map(
  OCCUPATIONS.flatMap((occ) =>
    occ.seedMappings ? [[occ.id, occ.seedMappings.category] as const] : [],
  ),
);

/**
 * An index entry belongs to the classified category when EITHER signal agrees:
 *  a. the entry's `industryId` maps to the category (vocabulary bridge above);
 *  b. the occupation's own `seedMappings.category` IS the category (handles
 *     deliberate cross-industry anchors like crypto_trader → finance and
 *     accountant → professional_services).
 */
function isEntryInCategoryScope(entry: VectorEntry, categoryId: string): boolean {
  if (OCCUPATION_SEED_CATEGORY_BY_ID.get(entry.id) === categoryId) return true;
  return INDUSTRY_TO_TAXONOMY_CATEGORIES[entry.industryId]?.includes(categoryId) ?? false;
}

/**
 * Top up the occupation group from the vector index when the classifier
 * produced fewer than the cap. Returns a new array.
 *
 * When `scope.categoryId` is known the candidate pool is first restricted to
 * entries belonging to the classified category; if that scoped set is empty
 * the global index is used instead, so taxonomy categories with no indexed
 * occupations still receive candidates. Candidates below `TOP_UP_MIN_COSINE`
 * are excluded even if the tray then holds fewer than the cap.
 */
export function topUpOccupationCandidates(
  existing: OccupationCandidate[],
  vector: number[],
  index: VectorEntry[],
  excludeId: string | null,
  scope: TopUpScope = {},
): OccupationCandidate[] {
  if (existing.length >= MAX_CORRECTION_CANDIDATES || index.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((candidate) => candidate.id));
  if (excludeId) seen.add(excludeId);

  const categoryId = scope.categoryId ?? null;
  let pool = index;
  if (categoryId) {
    const scoped = index.filter((entry) => isEntryInCategoryScope(entry, categoryId));
    if (scoped.length > 0) pool = scoped;
  }

  const toppedUp = [...existing];
  const ranked = pool
    .filter((entry) => !seen.has(entry.id))
    .map((entry) => ({ id: entry.id, label: entry.displayName, score: cosine(vector, entry.vector) }))
    .filter((entry) => entry.score >= TOP_UP_MIN_COSINE)
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

// Safety net: `occupation-vectors.json` is committed and copied into the runtime
// image, so an empty index now signals a *misbuilt/misconfigured* deploy rather
// than the expected steady state. Surface it once per process (not per request).
let emptyIndexWarned = false;
function warnEmptyIndexOnce(): void {
  if (emptyIndexWarned) return;
  emptyIndexWarned = true;
  logger.warn(
    '[occupationResolution] Occupation vector index missing/empty — embedding resolution and candidate top-up disabled; falling back to deterministic exact-match-only resolution. Check that apps/server/data/occupation-vectors.json is present in the image.',
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
        {
          categoryId: classification.category?.id ?? null,
          segmentId: classification.segment?.id ?? null,
        },
      );
    }
  }

  return { standardizedOccupationId, correctionCandidates };
}
