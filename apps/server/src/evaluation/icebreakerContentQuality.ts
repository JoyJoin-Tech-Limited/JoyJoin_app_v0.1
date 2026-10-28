import { z } from "zod";

/**
 * Offline Deck Quality Score (DQS) evidence gate.
 *
 * This module evaluates supplied evidence only. It never generates content,
 * reads live traffic, or infers live user-perceived quality. The thresholds are
 * deliberately not input-configurable: changing them requires a new DQS
 * protocol and preregistration, not an edit after seeing results.
 */

export const DQS_DIMENSIONS = [
  "answerability",
  "contextFit",
  "specificity",
  "arc",
  "freshness",
] as const;

export type DqsDimension = (typeof DQS_DIMENSIONS)[number];
export type EvaluationConclusion = "PASS" | "FAIL" | "INCONCLUSIVE";

export const DQS_WEIGHTS: Readonly<Record<DqsDimension, number>> = Object.freeze({
  answerability: 0.3,
  contextFit: 0.25,
  specificity: 0.2,
  arc: 0.15,
  freshness: 0.1,
});

export const DQS_GATE_THRESHOLDS = Object.freeze({
  minimumReliability: 0.6,
  minimumDqsDelta: 0.4,
  minimumDqsDeltaCiLowerExclusive: 0.2,
  minimumPreference: 0.6,
  minimumPreferenceCiLowerExclusive: 0.5,
  maximumDimensionDrop: 0.2,
  minimumCalibrationDecks: 20,
  minimumRatersPerDeck: 3,
  minimumBootstrapResamples: 1000,
  confidenceLevel: 0.95,
  maximumAcceptToTerminalP95Ms: 6000,
});

const Z_0_975 = 1.959963984540054;
const Z_0_80 = 0.8416212335729143;
const EPSILON = 1e-9;

const nonEmptyString = z.string().trim().min(1).max(500);
const scoreSchema = z.number().int().min(1).max(5);
const nonNegativeInteger = z.number().int().min(0);
const positiveInteger = z.number().int().min(1);

const dimensionScoresSchema = z
  .object({
    answerability: scoreSchema,
    contextFit: scoreSchema,
    specificity: scoreSchema,
    arc: scoreSchema,
    freshness: scoreSchema,
  })
  .strict();

const hardGatesSchema = z
  .object({
    contentSafety: z.boolean(),
    schemaPlayability: z.boolean(),
    arcConstraints: z.boolean(),
    withinSessionDedupe: z.boolean(),
    metadataTraceability: z.boolean(),
  })
  .strict();

const engineeringGatesSchema = z
  .object({
    acceptToTerminalWithin6s: z.boolean(),
    revisionAtomicity: z.boolean(),
    readyAndIdempotent: z.boolean(),
    costWithinBudget: z.boolean(),
    safeCuratedFallback: z.boolean(),
    moderationAndAigcIntegrity: z.boolean(),
  })
  .strict();

const variantSchema = z
  .object({
    variantId: nonEmptyString,
    role: z.enum(["current", "candidate"]),
    promptVersion: nonEmptyString,
  })
  .strict();

const contextSchema = z
  .object({
    contextId: nonEmptyString,
    vibe: nonEmptyString,
    rotationReason: nonEmptyString,
    rosterSize: positiveInteger,
    rosterArchetypeCounts: z.record(z.string(), nonNegativeInteger),
    sharedInterests: z.array(nonEmptyString).max(100),
    tier: z.enum(["breeze", "glow", "blaze"]),
  })
  .strict();

const raterSchema = z
  .object({
    raterId: nonEmptyString,
    calibrationDecksCompleted: nonNegativeInteger,
  })
  .strict();

const deckSchema = z
  .object({
    deckId: nonEmptyString,
    contextId: nonEmptyString,
    variantId: nonEmptyString,
    promptVersion: nonEmptyString,
    rawOutput: z.unknown().optional(),
    hardGates: hardGatesSchema,
    engineeringGates: engineeringGatesSchema,
    invalidReasons: z.array(nonEmptyString).max(100).optional(),
    fallbackUsed: z.boolean(),
    dedupeRelaxed: z.boolean(),
    acceptToTerminalLatencyMs: z.number().nonnegative().finite().optional(),
    generationCostUsd: z.number().nonnegative().finite().optional(),
    aiCorrelationId: nonEmptyString.optional(),
  })
  .strict();

const ratingSchema = z
  .object({
    deckId: nonEmptyString,
    raterId: nonEmptyString,
    scores: dimensionScoresSchema,
  })
  .strict();

const adjudicationSchema = z
  .object({
    deckId: nonEmptyString,
    dimension: z.enum(DQS_DIMENSIONS),
    adjudicatorRaterId: nonEmptyString,
    score: scoreSchema,
  })
  .strict();

const preferenceSchema = z
  .object({
    contextId: nonEmptyString,
    raterId: nonEmptyString,
    leftDeckId: nonEmptyString,
    rightDeckId: nonEmptyString,
    choice: z.enum(["left", "right", "tie"]),
    leftRightRandomized: z.boolean(),
  })
  .strict();

const preregistrationSchema = z
  .object({
    registrationId: nonEmptyString,
    registeredAt: z.string().datetime(),
    lockedBeforeEvidence: z.boolean(),
    alpha: z.number().gt(0).lt(1),
    power: z.number().gt(0).lt(1),
    minimumDetectableEffect: z.number().positive().finite(),
    assumedPairedDeltaSd: z.number().positive().finite(),
    baseContextsRequired: positiveInteger,
    basePairwiseComparisonsRequired: positiveInteger,
    contextDesignEffect: z.number().positive().finite(),
    raterDesignEffect: z.number().positive().finite(),
    contextIds: z.array(nonEmptyString).min(1).max(10_000),
    requiredRatersPerDeck: positiveInteger,
    requiredPairwiseComparisons: positiveInteger,
    requiredCalibrationDecks: positiveInteger,
    bootstrap: z
      .object({
        seed: z.number().int(),
        resamples: positiveInteger.max(100_000),
        confidenceLevel: z.number().gt(0).lt(1),
      })
      .strict(),
    stoppingRules: z
      .object({
        maxContexts: positiveInteger,
        maxPairwiseComparisons: positiveInteger,
        rules: z.array(nonEmptyString).min(1).max(100),
      })
      .strict(),
  })
  .strict();

const liveEvidenceSchema = z
  .object({
    variantId: nonEmptyString,
    assignedDecks: nonNegativeInteger,
    exposedDecks: nonNegativeInteger,
    unobservedDecks: nonNegativeInteger,
    invalidatedDecks: nonNegativeInteger,
    helpful: nonNegativeInteger,
    neutral: nonNegativeInteger,
    awkward: nonNegativeInteger,
  })
  .strict();

export const icebreakerContentQualityInputSchema = z
  .object({
    schemaVersion: z.literal("icebreaker-content-quality-v1"),
    evaluationId: nonEmptyString,
    dataOrigin: z.enum(["synthetic_unit_test", "offline_human_evidence"]),
    evidenceStartedAt: z.string().datetime().optional(),
    preregistration: preregistrationSchema.optional(),
    variants: z.array(variantSchema).length(2),
    contexts: z.array(contextSchema).max(10_000),
    raters: z.array(raterSchema).max(100_000),
    decks: z.array(deckSchema).max(100_000),
    ratings: z.array(ratingSchema).max(1_000_000),
    adjudications: z.array(adjudicationSchema).max(1_000_000),
    preferences: z.array(preferenceSchema).max(1_000_000),
    liveEvidence: z.array(liveEvidenceSchema).min(1).max(2).optional(),
  })
  .strict();

export type IcebreakerContentQualityInput = z.infer<
  typeof icebreakerContentQualityInputSchema
>;
type Preregistration = NonNullable<IcebreakerContentQualityInput["preregistration"]>;
type DeckInput = IcebreakerContentQualityInput["decks"][number];
type VariantInput = IcebreakerContentQualityInput["variants"][number];
type DimensionScores = Record<DqsDimension, number>;

interface EvidenceIssue {
  code: string;
  message: string;
  deckId?: string;
  contextId?: string;
  raterId?: string;
}

interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
  method: string;
  seed: number;
  resamples: number;
}

interface DisagreementReport {
  dimension: DqsDimension;
  range: number;
  adjudicated: boolean;
  adjudicatorRaterId: string | null;
}

interface DeckReport {
  deckId: string;
  contextId: string;
  variantId: string;
  promptVersion: string;
  rawOutputProvided: boolean;
  aiCorrelationId: string | null;
  invalid: boolean;
  invalidReasons: string[];
  hardGatesPassed: boolean;
  engineeringGatesPassed: boolean;
  engineeringGateFailures: string[];
  fallbackUsed: boolean;
  dedupeRelaxed: boolean;
  acceptToTerminalLatencyMs: number | null;
  generationCostUsd: number | null;
  raterCount: number;
  disagreements: DisagreementReport[];
  scores: {
    dimensions: DimensionScores;
    dqs: number;
  } | null;
}

interface DeckAnalysis {
  report: DeckReport;
  rawDimensions: DimensionScores | null;
}

interface PairedContext {
  contextId: string;
  current: DimensionScores;
  candidate: DimensionScores;
  currentDqs: number;
  candidateDqs: number;
  delta: number;
}

interface OrdinalAlphaResult {
  alpha: number | null;
  ratingCount: number;
  unitCount: number;
}

interface OperationsSummary {
  deckCount: number;
  invalidCount: number;
  invalidRate: number | null;
  fallbackCount: number;
  fallbackRate: number | null;
  dedupeRelaxedCount: number;
  dedupeRelaxedRate: number | null;
  latencyObservationCount: number;
  latencyCoverage: number | null;
  p95LatencyMs: number | null;
  costObservationCount: number;
  costCoverage: number | null;
  totalCostUsd: number | null;
  meanCostPerDeckUsd: number | null;
}

export class IcebreakerContentQualityInputError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "IcebreakerContentQualityInputError";
    this.issues = issues;
  }
}

function failInput(message: string): never {
  throw new IcebreakerContentQualityInputError(message);
}

function round(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.abs(value) < 5e-13 ? 0 : Number(value.toFixed(6));
}

function rounded(value: number | null): number | null {
  return value === null ? null : round(value);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueIssues(issues: EvidenceIssue[]): EvidenceIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [issue.code, issue.deckId, issue.contextId, issue.raterId, issue.message].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) failInput(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function validateCrossReferences(input: IcebreakerContentQualityInput): {
  currentVariant: VariantInput;
  candidateVariant: VariantInput;
  variantById: Map<string, VariantInput>;
  contextById: Map<string, IcebreakerContentQualityInput["contexts"][number]>;
  deckById: Map<string, DeckInput>;
  raterById: Map<string, IcebreakerContentQualityInput["raters"][number]>;
} {
  const currentVariants = input.variants.filter((variant) => variant.role === "current");
  const candidateVariants = input.variants.filter((variant) => variant.role === "candidate");
  if (currentVariants.length !== 1 || candidateVariants.length !== 1) {
    failInput("Exactly one current variant and one candidate variant are required");
  }
  const currentVariant = currentVariants[0]!;
  const candidateVariant = candidateVariants[0]!;
  assertUnique(input.variants.map((variant) => variant.variantId), "variantId");
  assertUnique(input.contexts.map((context) => context.contextId), "contextId");
  assertUnique(input.decks.map((deck) => deck.deckId), "deckId");
  assertUnique(input.raters.map((rater) => rater.raterId), "raterId");
  assertUnique(
    input.decks.map((deck) => `${deck.contextId}|${deck.variantId}`),
    "context/variant deck",
  );
  assertUnique(
    input.ratings.map((rating) => `${rating.deckId}|${rating.raterId}`),
    "deck/rater rating",
  );
  assertUnique(
    input.adjudications.map((adjudication) => `${adjudication.deckId}|${adjudication.dimension}`),
    "deck/dimension adjudication",
  );
  assertUnique(
    input.preferences.map((preference) => `${preference.contextId}|${preference.raterId}`),
    "context/rater preference",
  );
  if (input.preregistration) {
    assertUnique(input.preregistration.contextIds, "preregistered contextId");
  }

  const variantById = new Map(input.variants.map((variant) => [variant.variantId, variant]));
  const contextById = new Map(input.contexts.map((context) => [context.contextId, context]));
  const deckById = new Map(input.decks.map((deck) => [deck.deckId, deck]));
  const raterById = new Map(input.raters.map((rater) => [rater.raterId, rater]));

  for (const deck of input.decks) {
    const variant = variantById.get(deck.variantId);
    if (!variant) failInput(`Deck ${deck.deckId} references unknown variant ${deck.variantId}`);
    if (!contextById.has(deck.contextId)) {
      failInput(`Deck ${deck.deckId} references unknown context ${deck.contextId}`);
    }
    if (deck.promptVersion !== variant.promptVersion) {
      failInput(`Deck ${deck.deckId} promptVersion does not match its variant`);
    }
  }
  for (const rating of input.ratings) {
    if (!deckById.has(rating.deckId)) failInput(`Rating references unknown deck ${rating.deckId}`);
    if (!raterById.has(rating.raterId)) failInput(`Rating references unknown rater ${rating.raterId}`);
  }
  for (const adjudication of input.adjudications) {
    if (!deckById.has(adjudication.deckId)) {
      failInput(`Adjudication references unknown deck ${adjudication.deckId}`);
    }
    if (!raterById.has(adjudication.adjudicatorRaterId)) {
      failInput(`Adjudication references unknown rater ${adjudication.adjudicatorRaterId}`);
    }
  }
  for (const preference of input.preferences) {
    if (!contextById.has(preference.contextId)) {
      failInput(`Preference references unknown context ${preference.contextId}`);
    }
    if (!raterById.has(preference.raterId)) {
      failInput(`Preference references unknown rater ${preference.raterId}`);
    }
    const left = deckById.get(preference.leftDeckId);
    const right = deckById.get(preference.rightDeckId);
    if (!left || !right || left.deckId === right.deckId) {
      failInput(`Preference for ${preference.contextId} must reference two known, distinct decks`);
    }
    if (left.contextId !== preference.contextId || right.contextId !== preference.contextId) {
      failInput(`Preference decks must belong to context ${preference.contextId}`);
    }
    const leftRole = variantById.get(left.variantId)?.role;
    const rightRole = variantById.get(right.variantId)?.role;
    if (!((leftRole === "current" && rightRole === "candidate") ||
      (leftRole === "candidate" && rightRole === "current"))) {
      failInput(`Preference for ${preference.contextId} must compare current against candidate`);
    }
  }

  const liveVariants = new Set<string>();
  for (const live of input.liveEvidence ?? []) {
    if (!variantById.has(live.variantId)) failInput(`Live evidence references ${live.variantId}`);
    if (liveVariants.has(live.variantId)) failInput(`Duplicate live evidence for ${live.variantId}`);
    liveVariants.add(live.variantId);
    if (live.assignedDecks !== live.exposedDecks + live.unobservedDecks + live.invalidatedDecks) {
      failInput(`Live exposure counts do not reconcile for ${live.variantId}`);
    }
    if (live.helpful + live.neutral + live.awkward > live.exposedDecks) {
      failInput(`Live feedback exceeds exposed decks for ${live.variantId}`);
    }
  }

  return { currentVariant, candidateVariant, variantById, contextById, deckById, raterById };
}

function analyzePreregistration(input: IcebreakerContentQualityInput): {
  complete: boolean;
  issues: EvidenceIssue[];
} {
  const preregistration = input.preregistration;
  if (!preregistration) {
    return {
      complete: false,
      issues: [{ code: "PREREGISTRATION_MISSING", message: "Preregistration is required" }],
    };
  }
  const issues: EvidenceIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });

  if (!preregistration.lockedBeforeEvidence) {
    add("PREREGISTRATION_NOT_LOCKED", "Preregistration was not locked before evidence collection");
  }
  if (!input.evidenceStartedAt) {
    add("PREREGISTRATION_TEMPORAL_LOCK_UNVERIFIABLE", "evidenceStartedAt is required to verify registration order");
  } else if (Date.parse(preregistration.registeredAt) > Date.parse(input.evidenceStartedAt)) {
    add("PREREGISTRATION_AFTER_EVIDENCE", "Preregistration timestamp follows evidence start");
  }
  if (Math.abs(preregistration.alpha - 0.05) > EPSILON) {
    add("PREREGISTRATION_ALPHA_NOT_0_05", "DQS v1 requires alpha=0.05");
  }
  if (Math.abs(preregistration.power - 0.8) > EPSILON) {
    add("PREREGISTRATION_POWER_NOT_0_80", "DQS v1 requires 80% power");
  }
  if (preregistration.contextDesignEffect < 1 || preregistration.raterDesignEffect < 1) {
    add("PREREGISTRATION_INVALID_DESIGN_EFFECT", "Context and rater design effects must be at least 1");
  }

  const minimumBaseContexts = Math.max(
    1,
    Math.ceil(
      ((Z_0_975 + Z_0_80) * preregistration.assumedPairedDeltaSd /
        preregistration.minimumDetectableEffect) ** 2 - EPSILON,
    ),
  );
  if (preregistration.baseContextsRequired < minimumBaseContexts) {
    add(
      "PREREGISTRATION_BASE_POWER_INSUFFICIENT",
      `Paired-DQS power formula requires at least ${minimumBaseContexts} base contexts`,
    );
  }
  const combinedDesignEffect = preregistration.contextDesignEffect * preregistration.raterDesignEffect;
  const minimumContexts = Math.ceil(preregistration.baseContextsRequired * combinedDesignEffect - EPSILON);
  if (preregistration.contextIds.length < minimumContexts) {
    add(
      "PREREGISTRATION_CONTEXT_DESIGN_UNDERPOWERED",
      `Preregistered context list must contain at least ${minimumContexts} contexts after design effects`,
    );
  }
  const minimumComparisons = Math.ceil(
    preregistration.basePairwiseComparisonsRequired * combinedDesignEffect - EPSILON,
  );
  if (preregistration.requiredPairwiseComparisons < minimumComparisons) {
    add(
      "PREREGISTRATION_PREFERENCE_DESIGN_UNDERPOWERED",
      `At least ${minimumComparisons} pairwise comparisons are required after design effects`,
    );
  }
  if (preregistration.requiredRatersPerDeck < DQS_GATE_THRESHOLDS.minimumRatersPerDeck) {
    add("PREREGISTRATION_TOO_FEW_RATERS", "At least three raters per deck must be preregistered");
  }
  if (preregistration.requiredCalibrationDecks < DQS_GATE_THRESHOLDS.minimumCalibrationDecks) {
    add("PREREGISTRATION_CALIBRATION_TOO_SMALL", "At least 20 calibration decks are required");
  }
  if (preregistration.bootstrap.resamples < DQS_GATE_THRESHOLDS.minimumBootstrapResamples) {
    add("PREREGISTRATION_BOOTSTRAP_TOO_SMALL", "At least 1000 bootstrap resamples are required");
  }
  if (Math.abs(preregistration.bootstrap.confidenceLevel - DQS_GATE_THRESHOLDS.confidenceLevel) > EPSILON) {
    add("PREREGISTRATION_CONFIDENCE_NOT_0_95", "The preregistered interval must be 95%");
  }
  if (preregistration.stoppingRules.maxContexts < preregistration.contextIds.length) {
    add("PREREGISTRATION_CONTEXT_STOPPING_CONFLICT", "maxContexts is below the required context count");
  }
  if (preregistration.stoppingRules.maxPairwiseComparisons < preregistration.requiredPairwiseComparisons) {
    add("PREREGISTRATION_PREFERENCE_STOPPING_CONFLICT", "Pairwise stopping maximum is below the required count");
  }

  return { complete: issues.length === 0, issues };
}

function weightedDqs(dimensions: DimensionScores): number {
  return DQS_DIMENSIONS.reduce(
    (total, dimension) => total + dimensions[dimension] * DQS_WEIGHTS[dimension],
    0,
  );
}

function midranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start + 1;
    while (end < order.length && order[end]!.value === order[start]!.value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[order[index]!.index] = rank;
    start = end;
  }
  return ranks;
}

function pairDistanceSummary(values: number[]): { distance: number; pairs: number } {
  const total = values.reduce((sum, value) => sum + value, 0);
  const totalSquares = values.reduce((sum, value) => sum + value * value, 0);
  const pairs = (values.length * (values.length - 1)) / 2;
  return {
    distance: Math.max(0, values.length * totalSquares - total * total),
    pairs,
  };
}

/**
 * Ordinal Krippendorff-style alpha: pooled midranks with squared rank
 * distances, observed within-unit pair disagreement over expected global pair
 * disagreement. Adjudicated scores are never included. This pair-weighted
 * form also supports missing readings; units with fewer than two ratings are
 * excluded from reliability rather than treated as agreement.
 */
function ordinalAlpha(units: Array<{ unitId: string; values: number[] }>): OrdinalAlphaResult {
  const pairable = units.filter((unit) => unit.values.length >= 2);
  const flattened = pairable.flatMap((unit) => unit.values);
  if (pairable.length === 0 || flattened.length < 2) {
    return { alpha: null, ratingCount: flattened.length, unitCount: pairable.length };
  }
  const ranks = midranks(flattened);
  let offset = 0;
  let observedDistance = 0;
  let observedPairs = 0;
  for (const unit of pairable) {
    const unitRanks = ranks.slice(offset, offset + unit.values.length);
    offset += unit.values.length;
    const summary = pairDistanceSummary(unitRanks);
    observedDistance += summary.distance;
    observedPairs += summary.pairs;
  }
  const expected = pairDistanceSummary(ranks);
  if (observedPairs === 0 || expected.pairs === 0 || expected.distance <= EPSILON) {
    return { alpha: null, ratingCount: flattened.length, unitCount: pairable.length };
  }
  const observedDisagreement = observedDistance / observedPairs;
  const expectedDisagreement = expected.distance / expected.pairs;
  const alpha = 1 - observedDisagreement / expectedDisagreement;
  return {
    alpha: Math.abs(alpha) < 1e-12 ? 0 : alpha,
    ratingCount: flattened.length,
    unitCount: pairable.length,
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sortedValues: number[], probability: number): number {
  if (sortedValues.length === 0) throw new Error("Cannot calculate an empty quantile");
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex]!;
  const upper = sortedValues[upperIndex]!;
  return lower + (upper - lower) * (position - lowerIndex);
}

function percentileInterval(
  replicates: number[],
  confidenceLevel: number,
  method: string,
  seed: number,
): Omit<ConfidenceInterval, "resamples"> {
  const sorted = [...replicates].sort((a, b) => a - b);
  const tail = (1 - confidenceLevel) / 2;
  return {
    lower: round(quantile(sorted, tail)),
    upper: round(quantile(sorted, 1 - tail)),
    confidenceLevel,
    method,
    seed,
  };
}

function bootstrapMeanDelta(
  contexts: PairedContext[],
  preregistration: Preregistration,
): ConfidenceInterval | null {
  if (contexts.length === 0) return null;
  const { seed, resamples, confidenceLevel } = preregistration.bootstrap;
  const random = mulberry32(seed);
  const deltas = contexts.map((context) => context.delta);
  const replicates: number[] = [];
  for (let replicate = 0; replicate < resamples; replicate += 1) {
    let sum = 0;
    for (let index = 0; index < deltas.length; index += 1) {
      sum += deltas[Math.floor(random() * deltas.length)]!;
    }
    replicates.push(sum / deltas.length);
  }
  return {
    ...percentileInterval(replicates, confidenceLevel, "paired_context_cluster_bootstrap_percentile", seed),
    resamples,
  };
}

interface PreferenceCluster {
  comparisons: number;
  effectiveWins: number;
}

function bootstrapPreference(
  clusters: PreferenceCluster[],
  preregistration: Preregistration,
): ConfidenceInterval | null {
  if (clusters.length === 0) return null;
  const { resamples, confidenceLevel } = preregistration.bootstrap;
  const seed = (preregistration.bootstrap.seed ^ 0x9e3779b9) >>> 0;
  const random = mulberry32(seed);
  const replicates: number[] = [];
  for (let replicate = 0; replicate < resamples; replicate += 1) {
    let comparisons = 0;
    let effectiveWins = 0;
    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[Math.floor(random() * clusters.length)]!;
      comparisons += cluster.comparisons;
      effectiveWins += cluster.effectiveWins;
    }
    if (comparisons > 0) replicates.push(effectiveWins / comparisons);
  }
  if (replicates.length === 0) return null;
  return {
    ...percentileInterval(replicates, confidenceLevel, "context_cluster_bootstrap_percentile", seed),
    resamples,
  };
}

function nearestRankP95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!;
}

function summarizeOperations(decks: DeckInput[]): OperationsSummary {
  const latencies = decks
    .map((deck) => deck.acceptToTerminalLatencyMs)
    .filter((value): value is number => value !== undefined);
  const costs = decks
    .map((deck) => deck.generationCostUsd)
    .filter((value): value is number => value !== undefined);
  const deckCount = decks.length;
  const totalCost = costs.length > 0 ? costs.reduce((sum, value) => sum + value, 0) : null;
  return {
    deckCount,
    invalidCount: 0,
    invalidRate: null,
    fallbackCount: decks.filter((deck) => deck.fallbackUsed).length,
    fallbackRate: deckCount > 0 ? round(decks.filter((deck) => deck.fallbackUsed).length / deckCount) : null,
    dedupeRelaxedCount: decks.filter((deck) => deck.dedupeRelaxed).length,
    dedupeRelaxedRate: deckCount > 0 ? round(decks.filter((deck) => deck.dedupeRelaxed).length / deckCount) : null,
    latencyObservationCount: latencies.length,
    latencyCoverage: deckCount > 0 ? round(latencies.length / deckCount) : null,
    p95LatencyMs: rounded(nearestRankP95(latencies)),
    costObservationCount: costs.length,
    costCoverage: deckCount > 0 ? round(costs.length / deckCount) : null,
    totalCostUsd: rounded(totalCost),
    meanCostPerDeckUsd: rounded(mean(costs)),
  };
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  if (average === null) return null;
  const sumSquares = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return Math.sqrt(sumSquares / (values.length - 1));
}

export function evaluateIcebreakerContentQuality(
  value: unknown,
): Record<string, unknown> & {
  conclusion: EvaluationConclusion;
  reasons: string[];
  dataOrigin: IcebreakerContentQualityInput["dataOrigin"];
  liveQualityClaim: "not_evaluated_offline_only";
  preregistration: Record<string, unknown> & { complete: boolean; issues: EvidenceIssue[] };
  evidence: { complete: boolean; issues: EvidenceIssue[] };
  power: {
    adequate: boolean;
    requiredContexts: number | null;
    observedContexts: number;
    requiredPairwiseComparisons: number | null;
    observedPairwiseComparisons: number;
  };
  reliability: Record<string, unknown> & { alpha: number | null };
  dqs: Record<string, unknown> & {
    delta: number | null;
    ci: ConfidenceInterval | null;
    dimensions: Record<DqsDimension, { current: number | null; candidate: number | null; delta: number | null }>;
  };
  preference: Record<string, unknown> & {
    score: number | null;
    ci: ConfidenceInterval | null;
    comparisons: number;
    wins: number;
    losses: number;
    ties: number;
  };
  operations: Record<string, unknown> & { byVariant: Record<string, OperationsSummary> };
  liveEvidence: Record<string, unknown> & {
    usedInOfflineConclusion: false;
    byVariant: Record<string, Record<string, number | null>>;
  };
  decks: DeckReport[];
  contexts: Array<Record<string, unknown>>;
} {
  const parsed = icebreakerContentQualityInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new IcebreakerContentQualityInputError(
      "Invalid icebreaker content-quality input",
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`),
    );
  }
  const input = parsed.data;
  const {
    currentVariant,
    candidateVariant,
    variantById,
    contextById,
    deckById,
    raterById,
  } = validateCrossReferences(input);
  const preregistrationAnalysis = analyzePreregistration(input);
  const preregistration = input.preregistration;
  const evidenceIssues: EvidenceIssue[] = [];
  const addEvidence = (issue: EvidenceIssue) => evidenceIssues.push(issue);

  const ratingsByDeck = new Map<string, IcebreakerContentQualityInput["ratings"]>();
  for (const rating of input.ratings) {
    const entries = ratingsByDeck.get(rating.deckId) ?? [];
    entries.push(rating);
    ratingsByDeck.set(rating.deckId, entries);
  }
  for (const entries of ratingsByDeck.values()) {
    entries.sort((a, b) => a.raterId.localeCompare(b.raterId));
  }
  const adjudicationByDeckDimension = new Map(
    input.adjudications.map((entry) => [`${entry.deckId}|${entry.dimension}`, entry]),
  );
  const deckAnalysisById = new Map<string, DeckAnalysis>();
  const overallReliabilityUnits: Array<{ unitId: string; values: number[] }> = [];
  const dimensionReliabilityUnits = Object.fromEntries(
    DQS_DIMENSIONS.map((dimension) => [dimension, [] as Array<{ unitId: string; values: number[] }>]),
  ) as Record<DqsDimension, Array<{ unitId: string; values: number[] }>>;

  const sortedDecks = [...input.decks].sort((a, b) => {
    const contextOrder = a.contextId.localeCompare(b.contextId);
    if (contextOrder !== 0) return contextOrder;
    const roleA = variantById.get(a.variantId)?.role;
    const roleB = variantById.get(b.variantId)?.role;
    if (roleA !== roleB) return roleA === "current" ? -1 : 1;
    return a.deckId.localeCompare(b.deckId);
  });

  const requiredRaters = preregistration?.requiredRatersPerDeck ?? DQS_GATE_THRESHOLDS.minimumRatersPerDeck;
  const requiredCalibration = preregistration?.requiredCalibrationDecks ?? DQS_GATE_THRESHOLDS.minimumCalibrationDecks;

  for (const deck of sortedDecks) {
    const hardGateFailures = Object.entries(deck.hardGates)
      .filter(([, passed]) => !passed)
      .map(([gate]) => gate);
    const engineeringGateFailures = Object.entries(deck.engineeringGates)
      .filter(([, passed]) => !passed)
      .map(([gate]) => gate);
    const invalidReasons = [...new Set([
      ...(deck.invalidReasons ?? []),
      ...hardGateFailures.map((gate) => `hardGate:${gate}`),
    ])];
    const invalid = invalidReasons.length > 0;
    const ratings = ratingsByDeck.get(deck.deckId) ?? [];
    const rawDimensions: DimensionScores = { answerability: 0, contextFit: 0, specificity: 0, arc: 0, freshness: 0 };
    const disagreements: DisagreementReport[] = [];

    if (deck.rawOutput === undefined || deck.rawOutput === null) {
      addEvidence({ code: "MISSING_RAW_OUTPUT", message: "Raw deck output is required", deckId: deck.deckId });
    }
    if (deck.acceptToTerminalLatencyMs === undefined) {
      addEvidence({ code: "MISSING_LATENCY", message: "Accept-to-terminal latency is required", deckId: deck.deckId });
    }
    if (deck.generationCostUsd === undefined) {
      addEvidence({ code: "MISSING_COST", message: "Generation cost is required", deckId: deck.deckId });
    }

    if (!invalid && ratings.length < requiredRaters) {
      addEvidence({
        code: "INSUFFICIENT_RATERS",
        message: `Deck has ${ratings.length} ratings; ${requiredRaters} are required`,
        deckId: deck.deckId,
      });
    }

    if (!invalid && ratings.length > 0) {
      const baseRaterIds = new Set(ratings.map((rating) => rating.raterId));
      for (const dimension of DQS_DIMENSIONS) {
        const values = ratings.map((rating) => rating.scores[dimension]);
        const range = Math.max(...values) - Math.min(...values);
        const adjudication = adjudicationByDeckDimension.get(`${deck.deckId}|${dimension}`);
        const independentAdjudication = adjudication && !baseRaterIds.has(adjudication.adjudicatorRaterId)
          ? adjudication
          : undefined;
        if (range >= 2) {
          disagreements.push({
            dimension,
            range,
            adjudicated: independentAdjudication !== undefined,
            adjudicatorRaterId: independentAdjudication?.adjudicatorRaterId ?? null,
          });
          if (!adjudication) {
            addEvidence({
              code: "ADJUDICATION_REQUIRED",
              message: `${dimension} range ${range} requires fourth-rater adjudication`,
              deckId: deck.deckId,
            });
          } else if (!independentAdjudication) {
            addEvidence({
              code: "ADJUDICATOR_NOT_INDEPENDENT",
              message: `${dimension} adjudicator must be a fourth rater`,
              deckId: deck.deckId,
              raterId: adjudication.adjudicatorRaterId,
            });
          }
        } else if (adjudication) {
          addEvidence({
            code: "UNEXPECTED_ADJUDICATION",
            message: `${dimension} range ${range} does not permit adjudication`,
            deckId: deck.deckId,
          });
        }
        const average = mean(values)!;
        rawDimensions[dimension] = range >= 2 && independentAdjudication
          ? independentAdjudication.score
          : average;
      }
      if (ratings.length >= 2) {
        for (const dimension of DQS_DIMENSIONS) {
          const unit = {
            unitId: `${deck.deckId}|${dimension}`,
            values: ratings.map((rating) => rating.scores[dimension]),
          };
          overallReliabilityUnits.push(unit);
          dimensionReliabilityUnits[dimension].push(unit);
        }
      }
    } else if (!invalid) {
      for (const adjudication of input.adjudications.filter((entry) => entry.deckId === deck.deckId)) {
        addEvidence({
          code: "ADJUDICATION_WITHOUT_RATINGS",
          message: "Adjudication requires base ratings",
          deckId: deck.deckId,
          raterId: adjudication.adjudicatorRaterId,
        });
      }
    }

    const dimensions = !invalid && ratings.length > 0 ? rawDimensions : null;
    const report: DeckReport = {
      deckId: deck.deckId,
      contextId: deck.contextId,
      variantId: deck.variantId,
      promptVersion: deck.promptVersion,
      rawOutputProvided: deck.rawOutput !== undefined && deck.rawOutput !== null,
      aiCorrelationId: deck.aiCorrelationId ?? null,
      invalid,
      invalidReasons,
      hardGatesPassed: hardGateFailures.length === 0 && (deck.invalidReasons ?? []).length === 0,
      engineeringGatesPassed: engineeringGateFailures.length === 0,
      engineeringGateFailures,
      fallbackUsed: deck.fallbackUsed,
      dedupeRelaxed: deck.dedupeRelaxed,
      acceptToTerminalLatencyMs: deck.acceptToTerminalLatencyMs ?? null,
      generationCostUsd: deck.generationCostUsd ?? null,
      raterCount: ratings.length,
      disagreements,
      scores: dimensions
        ? {
            dimensions: Object.fromEntries(
              DQS_DIMENSIONS.map((dimension) => [dimension, round(dimensions[dimension])]),
            ) as unknown as DimensionScores,
            dqs: round(weightedDqs(dimensions)),
          }
        : null,
    };
    deckAnalysisById.set(deck.deckId, { report, rawDimensions: dimensions });
  }

  const usedRaterIds = new Set([
    ...input.ratings.map((rating) => rating.raterId),
    ...input.preferences.map((preference) => preference.raterId),
    ...input.adjudications.map((adjudication) => adjudication.adjudicatorRaterId),
  ]);
  for (const raterId of [...usedRaterIds].sort()) {
    const rater = raterById.get(raterId)!;
    if (rater.calibrationDecksCompleted < requiredCalibration) {
      addEvidence({
        code: "UNCALIBRATED_RATER",
        message: `Rater has ${rater.calibrationDecksCompleted} calibration decks; ${requiredCalibration} required`,
        raterId,
      });
    }
  }
  const calibratedUsedRaters = [...usedRaterIds].filter(
    (raterId) => (raterById.get(raterId)?.calibrationDecksCompleted ?? 0) >= requiredCalibration,
  );
  if (calibratedUsedRaters.length < DQS_GATE_THRESHOLDS.minimumRatersPerDeck) {
    addEvidence({ code: "INSUFFICIENT_CALIBRATED_RATERS", message: "At least three calibrated raters are required" });
  }

  const deckByContextVariant = new Map(
    input.decks.map((deck) => [`${deck.contextId}|${deck.variantId}`, deck]),
  );
  for (const context of input.contexts) {
    for (const variant of [currentVariant, candidateVariant]) {
      const key = `${context.contextId}|${variant.variantId}`;
      if (!deckByContextVariant.has(key)) {
        addEvidence({
          code: "MISSING_DECK",
          message: `Missing ${variant.role} deck`,
          contextId: context.contextId,
        });
      }
    }
  }
  if (preregistration) {
    const preregisteredContexts = new Set(preregistration.contextIds);
    const declaredContexts = new Set(input.contexts.map((context) => context.contextId));
    const missing = preregistration.contextIds.filter((contextId) => !declaredContexts.has(contextId));
    const unregistered = [...declaredContexts].filter((contextId) => !preregisteredContexts.has(contextId));
    if (missing.length > 0 || unregistered.length > 0) {
      addEvidence({
        code: "PREREGISTERED_CONTEXT_SET_MISMATCH",
        message: `Missing=[${missing.join(",")}] unregistered=[${unregistered.join(",")}]`,
      });
    }
    if (input.contexts.length > preregistration.stoppingRules.maxContexts) {
      addEvidence({ code: "CONTEXT_STOPPING_RULE_EXCEEDED", message: "Declared contexts exceed preregistered maximum" });
    }
  }

  const pairedContexts: PairedContext[] = [];
  const contextReports: Array<Record<string, unknown>> = [];
  for (const context of [...input.contexts].sort((a, b) => a.contextId.localeCompare(b.contextId))) {
    const currentDeck = deckByContextVariant.get(`${context.contextId}|${currentVariant.variantId}`);
    const candidateDeck = deckByContextVariant.get(`${context.contextId}|${candidateVariant.variantId}`);
    const currentAnalysis = currentDeck ? deckAnalysisById.get(currentDeck.deckId) : undefined;
    const candidateAnalysis = candidateDeck ? deckAnalysisById.get(candidateDeck.deckId) : undefined;
    const currentDimensions = currentAnalysis?.rawDimensions ?? null;
    const candidateDimensions = candidateAnalysis?.rawDimensions ?? null;
    let paired: PairedContext | null = null;
    if (currentDimensions && candidateDimensions) {
      const currentDqs = weightedDqs(currentDimensions);
      const candidateDqs = weightedDqs(candidateDimensions);
      paired = {
        contextId: context.contextId,
        current: currentDimensions,
        candidate: candidateDimensions,
        currentDqs,
        candidateDqs,
        delta: candidateDqs - currentDqs,
      };
      pairedContexts.push(paired);
    }
    contextReports.push({
      ...context,
      currentDeckId: currentDeck?.deckId ?? null,
      candidateDeckId: candidateDeck?.deckId ?? null,
      dqsDelta: rounded(paired?.delta ?? null),
    });
  }

  const invalidDeckIds = new Set(
    [...deckAnalysisById.values()].filter((analysis) => analysis.report.invalid).map((analysis) => analysis.report.deckId),
  );
  const eligiblePreferences = input.preferences.filter(
    (preference) => !invalidDeckIds.has(preference.leftDeckId) && !invalidDeckIds.has(preference.rightDeckId),
  );
  const invalidatedComparisons = input.preferences.length - eligiblePreferences.length;
  for (const preference of input.preferences) {
    if (!preference.leftRightRandomized) {
      addEvidence({
        code: "PREFERENCE_RANDOMIZATION_MISSING",
        message: "Left/right assignment must be randomized",
        contextId: preference.contextId,
        raterId: preference.raterId,
      });
    }
  }
  if (preregistration) {
    for (const contextId of preregistration.contextIds) {
      const comparisons = eligiblePreferences.filter((preference) => preference.contextId === contextId).length;
      if (comparisons < requiredRaters) {
        addEvidence({
          code: "INSUFFICIENT_CONTEXT_PREFERENCES",
          message: `Context has ${comparisons} eligible preferences; ${requiredRaters} required`,
          contextId,
        });
      }
    }
    if (eligiblePreferences.length > preregistration.stoppingRules.maxPairwiseComparisons) {
      addEvidence({ code: "PREFERENCE_STOPPING_RULE_EXCEEDED", message: "Eligible comparisons exceed preregistered maximum" });
    }
  }

  const preregisteredContextSet = new Set(preregistration?.contextIds ?? []);
  const observedContexts = preregistration
    ? preregistration.contextIds.filter((contextId) => {
        const currentDeck = deckByContextVariant.get(`${contextId}|${currentVariant.variantId}`);
        const candidateDeck = deckByContextVariant.get(`${contextId}|${candidateVariant.variantId}`);
        return currentDeck !== undefined && candidateDeck !== undefined;
      }).length
    : pairedContexts.length;
  const observedPairwiseComparisons = preregistration
    ? eligiblePreferences.filter((preference) => preregisteredContextSet.has(preference.contextId)).length
    : eligiblePreferences.length;
  const powerIssues: EvidenceIssue[] = [];
  if (preregistration) {
    if (observedContexts < preregistration.contextIds.length) {
      powerIssues.push({
        code: "UNDERPOWERED_CONTEXTS",
        message: `${observedContexts}/${preregistration.contextIds.length} required contexts have both decks`,
      });
    }
    if (observedPairwiseComparisons < preregistration.requiredPairwiseComparisons) {
      powerIssues.push({
        code: "UNDERPOWERED_PAIRWISE_COMPARISONS",
        message: `${observedPairwiseComparisons}/${preregistration.requiredPairwiseComparisons} eligible pairwise comparisons`,
      });
    }
  }
  const powerAdequate = preregistration !== undefined && powerIssues.length === 0;

  const overallAlpha = ordinalAlpha(overallReliabilityUnits);
  const alphaByDimension = Object.fromEntries(
    DQS_DIMENSIONS.map((dimension) => [dimension, rounded(ordinalAlpha(dimensionReliabilityUnits[dimension]).alpha)]),
  ) as Record<DqsDimension, number | null>;
  const reliabilityIssues: EvidenceIssue[] = [];
  if (overallAlpha.alpha === null) {
    reliabilityIssues.push({ code: "RELIABILITY_UNDEFINED", message: "Ordinal reliability is undefined for the supplied readings" });
  } else if (overallAlpha.alpha < DQS_GATE_THRESHOLDS.minimumReliability) {
    reliabilityIssues.push({
      code: "RELIABILITY_BELOW_THRESHOLD",
      message: `Ordinal alpha ${overallAlpha.alpha} is below 0.60`,
    });
  }
  const reliable = overallAlpha.alpha !== null && overallAlpha.alpha >= DQS_GATE_THRESHOLDS.minimumReliability;

  const dimensionDeltas = Object.fromEntries(
    DQS_DIMENSIONS.map((dimension) => {
      const current = mean(pairedContexts.map((context) => context.current[dimension]));
      const candidate = mean(pairedContexts.map((context) => context.candidate[dimension]));
      return [dimension, {
        current: rounded(current),
        candidate: rounded(candidate),
        delta: rounded(current === null || candidate === null ? null : candidate - current),
        rawDelta: current === null || candidate === null ? null : candidate - current,
      }];
    }),
  ) as Record<DqsDimension, { current: number | null; candidate: number | null; delta: number | null; rawDelta: number | null }>;
  const currentDqs = mean(pairedContexts.map((context) => context.currentDqs));
  const candidateDqs = mean(pairedContexts.map((context) => context.candidateDqs));
  const dqsDelta = currentDqs === null || candidateDqs === null ? null : candidateDqs - currentDqs;
  const dqsCi = preregistration ? bootstrapMeanDelta(pairedContexts, preregistration) : null;
  const pairedDeltaSd = sampleStandardDeviation(pairedContexts.map((context) => context.delta));
  const effectSize = dqsDelta !== null && pairedDeltaSd !== null && pairedDeltaSd > EPSILON
    ? dqsDelta / pairedDeltaSd
    : null;

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let candidateLeft = 0;
  let candidateRight = 0;
  const preferenceClusterByContext = new Map<string, PreferenceCluster>();
  for (const preference of eligiblePreferences) {
    const leftDeck = deckById.get(preference.leftDeckId)!;
    const candidateIsLeft = leftDeck.variantId === candidateVariant.variantId;
    if (candidateIsLeft) candidateLeft += 1;
    else candidateRight += 1;
    let effectiveWins: number;
    if (preference.choice === "tie") {
      ties += 1;
      effectiveWins = 0.5;
    } else {
      const candidateWon = (preference.choice === "left" && candidateIsLeft) ||
        (preference.choice === "right" && !candidateIsLeft);
      if (candidateWon) wins += 1;
      else losses += 1;
      effectiveWins = candidateWon ? 1 : 0;
    }
    const cluster = preferenceClusterByContext.get(preference.contextId) ?? { comparisons: 0, effectiveWins: 0 };
    cluster.comparisons += 1;
    cluster.effectiveWins += effectiveWins;
    preferenceClusterByContext.set(preference.contextId, cluster);
  }
  const preferenceComparisons = eligiblePreferences.length;
  const effectivePreferenceWins = wins + 0.5 * ties;
  const preferenceScore = preferenceComparisons > 0 ? effectivePreferenceWins / preferenceComparisons : null;
  const preferenceClusters = [...preferenceClusterByContext.entries()]
    .sort(([contextA], [contextB]) => contextA.localeCompare(contextB))
    .map(([, cluster]) => cluster);
  const preferenceCi = preregistration ? bootstrapPreference(preferenceClusters, preregistration) : null;

  const operationsEntries = [currentVariant, candidateVariant].map((variant) => {
    const decks = input.decks.filter((deck) => deck.variantId === variant.variantId);
    const summary = summarizeOperations(decks);
    summary.invalidCount = decks.filter((deck) => invalidDeckIds.has(deck.deckId)).length;
    summary.invalidRate = decks.length > 0 ? round(summary.invalidCount / decks.length) : null;
    return [variant.variantId, summary] as const;
  });
  const operationsByVariant = Object.fromEntries(operationsEntries) as Record<string, OperationsSummary>;
  const currentOperations = operationsByVariant[currentVariant.variantId]!;
  const candidateOperations = operationsByVariant[candidateVariant.variantId]!;
  const rateNotWorse = (candidate: number | null, current: number | null): boolean | null =>
    candidate === null || current === null ? null : candidate <= current + EPSILON;
  const latencyNotWorse = currentOperations.latencyCoverage === 1 && candidateOperations.latencyCoverage === 1
    ? rateNotWorse(candidateOperations.p95LatencyMs, currentOperations.p95LatencyMs)
    : null;
  const costNotWorse = currentOperations.costCoverage === 1 && candidateOperations.costCoverage === 1
    ? rateNotWorse(candidateOperations.meanCostPerDeckUsd, currentOperations.meanCostPerDeckUsd)
    : null;
  const latencyWithinLimit = currentOperations.latencyCoverage === 1 && candidateOperations.latencyCoverage === 1 &&
    currentOperations.p95LatencyMs !== null && candidateOperations.p95LatencyMs !== null
    ? currentOperations.p95LatencyMs <= DQS_GATE_THRESHOLDS.maximumAcceptToTerminalP95Ms &&
      candidateOperations.p95LatencyMs <= DQS_GATE_THRESHOLDS.maximumAcceptToTerminalP95Ms
    : null;
  const nonRegression = {
    invalidRateNotWorse: rateNotWorse(candidateOperations.invalidRate, currentOperations.invalidRate),
    fallbackRateNotWorse: rateNotWorse(candidateOperations.fallbackRate, currentOperations.fallbackRate),
    p95LatencyNotWorse: latencyNotWorse,
    meanCostPerDeckNotWorse: costNotWorse,
    p95LatencyWithin6000ms: latencyWithinLimit,
  };
  const engineeringFailures: string[] = [];
  if ([...deckAnalysisById.values()].some((analysis) => !analysis.report.engineeringGatesPassed)) {
    engineeringFailures.push("ENGINEERING_GATE_FAILURE");
  }
  if (nonRegression.invalidRateNotWorse === false) engineeringFailures.push("INVALID_RATE_REGRESSION");
  if (nonRegression.fallbackRateNotWorse === false) engineeringFailures.push("FALLBACK_REGRESSION");
  if (nonRegression.p95LatencyNotWorse === false) engineeringFailures.push("LATENCY_REGRESSION");
  if (nonRegression.meanCostPerDeckNotWorse === false) engineeringFailures.push("COST_REGRESSION");
  if (nonRegression.p95LatencyWithin6000ms === false) engineeringFailures.push("LATENCY_LIMIT_FAILURE");
  const engineeringComplete = Object.values(nonRegression).every((result) => result !== null);
  const engineeringPassed = engineeringFailures.length === 0 && engineeringComplete;

  const cleanEvidenceIssues = uniqueIssues(evidenceIssues);
  const evidenceComplete = cleanEvidenceIssues.length === 0;
  const qualityGates = {
    dqsDelta: {
      actual: rounded(dqsDelta),
      minimum: DQS_GATE_THRESHOLDS.minimumDqsDelta,
      passed: dqsDelta !== null && dqsDelta >= DQS_GATE_THRESHOLDS.minimumDqsDelta,
    },
    dqsDeltaCiLower: {
      actual: dqsCi?.lower ?? null,
      exclusiveMinimum: DQS_GATE_THRESHOLDS.minimumDqsDeltaCiLowerExclusive,
      passed: dqsCi !== null && dqsCi.confidenceLevel === 0.95 &&
        dqsCi.lower > DQS_GATE_THRESHOLDS.minimumDqsDeltaCiLowerExclusive,
    },
    preference: {
      actual: rounded(preferenceScore),
      minimum: DQS_GATE_THRESHOLDS.minimumPreference,
      passed: preferenceScore !== null && preferenceScore >= DQS_GATE_THRESHOLDS.minimumPreference,
    },
    preferenceCiLower: {
      actual: preferenceCi?.lower ?? null,
      exclusiveMinimum: DQS_GATE_THRESHOLDS.minimumPreferenceCiLowerExclusive,
      passed: preferenceCi !== null && preferenceCi.confidenceLevel === 0.95 &&
        preferenceCi.lower > DQS_GATE_THRESHOLDS.minimumPreferenceCiLowerExclusive,
    },
    dimensions: {
      maximumDrop: DQS_GATE_THRESHOLDS.maximumDimensionDrop,
      passed: pairedContexts.length > 0 && DQS_DIMENSIONS.every(
        (dimension) => dimensionDeltas[dimension].rawDelta !== null &&
          dimensionDeltas[dimension].rawDelta! >= -DQS_GATE_THRESHOLDS.maximumDimensionDrop - EPSILON,
      ),
      failedDimensions: DQS_DIMENSIONS.filter(
        (dimension) => dimensionDeltas[dimension].rawDelta === null ||
          dimensionDeltas[dimension].rawDelta! < -DQS_GATE_THRESHOLDS.maximumDimensionDrop - EPSILON,
      ),
    },
  };
  const qualityPassed = Object.values(qualityGates).every((gate) => gate.passed);
  const canJudgeQuality = preregistrationAnalysis.complete && evidenceComplete && powerAdequate && reliable;
  const hardGatePassed = invalidDeckIds.size === 0;
  const reasons: string[] = [];
  const addReasons = (issues: EvidenceIssue[]) => {
    for (const issue of issues) if (!reasons.includes(issue.code)) reasons.push(issue.code);
  };
  addReasons(preregistrationAnalysis.issues);
  addReasons(cleanEvidenceIssues);
  addReasons(powerIssues);
  addReasons(reliabilityIssues);
  if (!hardGatePassed) reasons.push("HARD_GATE_FAILURE");

  let conclusion: EvaluationConclusion;
  if (!hardGatePassed) {
    conclusion = "FAIL";
  } else if (!canJudgeQuality) {
    conclusion = "INCONCLUSIVE";
  } else {
    for (const failure of engineeringFailures) reasons.push(failure);
    if (!qualityGates.dqsDelta.passed) reasons.push("DQS_DELTA_BELOW_THRESHOLD");
    if (!qualityGates.dqsDeltaCiLower.passed) reasons.push("DQS_CI_LOWER_NOT_ABOVE_THRESHOLD");
    if (!qualityGates.preference.passed) reasons.push("PREFERENCE_BELOW_THRESHOLD");
    if (!qualityGates.preferenceCiLower.passed) reasons.push("PREFERENCE_CI_LOWER_NOT_ABOVE_THRESHOLD");
    if (!qualityGates.dimensions.passed) reasons.push("DIMENSION_DROP_OVER_THRESHOLD");
    conclusion = engineeringPassed && qualityPassed ? "PASS" : "FAIL";
  }

  const liveByVariant = Object.fromEntries(
    (input.liveEvidence ?? []).map((live) => {
      const feedbackResponses = live.helpful + live.neutral + live.awkward;
      return [live.variantId, {
        assignedDecks: live.assignedDecks,
        exposedDecks: live.exposedDecks,
        unobservedDecks: live.unobservedDecks,
        invalidatedDecks: live.invalidatedDecks,
        helpful: live.helpful,
        neutral: live.neutral,
        awkward: live.awkward,
        feedbackResponses,
        feedbackCoverage: live.exposedDecks > 0 ? round(feedbackResponses / live.exposedDecks) : null,
      }];
    }),
  ) as Record<string, Record<string, number | null>>;

  const raterReports = [...input.raters]
    .sort((a, b) => a.raterId.localeCompare(b.raterId))
    .map((rater) => ({
      raterId: rater.raterId,
      calibrationDecksCompleted: rater.calibrationDecksCompleted,
      calibrated: rater.calibrationDecksCompleted >= requiredCalibration,
      ratingAssignments: input.ratings.filter((rating) => rating.raterId === rater.raterId).length,
      preferenceAssignments: input.preferences.filter((preference) => preference.raterId === rater.raterId).length,
      adjudicationAssignments: input.adjudications.filter(
        (adjudication) => adjudication.adjudicatorRaterId === rater.raterId,
      ).length,
    }));

  const dimensionsReport = Object.fromEntries(
    DQS_DIMENSIONS.map((dimension) => [dimension, {
      current: dimensionDeltas[dimension].current,
      candidate: dimensionDeltas[dimension].candidate,
      delta: dimensionDeltas[dimension].delta,
    }]),
  ) as Record<DqsDimension, { current: number | null; candidate: number | null; delta: number | null }>;

  return {
    schemaVersion: "icebreaker-content-quality-report-v1",
    evaluationId: input.evaluationId,
    dataOrigin: input.dataOrigin,
    scope: "offline_deck_quality_only",
    disclaimer: input.dataOrigin === "synthetic_unit_test"
      ? "Synthetic unit-test evidence only; not a real-world result. Offline DQS does not establish live user-perceived quality."
      : "Offline deck-quality evidence only; does not establish live user-perceived quality, attendance, or commercial uplift.",
    liveQualityClaim: "not_evaluated_offline_only",
    conclusion,
    reasons,
    thresholds: DQS_GATE_THRESHOLDS,
    variants: [currentVariant, candidateVariant],
    preregistration: {
      complete: preregistrationAnalysis.complete,
      issues: preregistrationAnalysis.issues,
      registrationId: preregistration?.registrationId ?? null,
      registeredAt: preregistration?.registeredAt ?? null,
      lockedBeforeEvidence: preregistration?.lockedBeforeEvidence ?? null,
      evidenceStartedAt: input.evidenceStartedAt ?? null,
      alpha: preregistration?.alpha ?? null,
      power: preregistration?.power ?? null,
      minimumDetectableEffect: preregistration?.minimumDetectableEffect ?? null,
      contextDesignEffect: preregistration?.contextDesignEffect ?? null,
      raterDesignEffect: preregistration?.raterDesignEffect ?? null,
      contextIds: preregistration?.contextIds ?? [],
      requiredContexts: preregistration?.contextIds.length ?? null,
      requiredRatersPerDeck: preregistration?.requiredRatersPerDeck ?? null,
      requiredPairwiseComparisons: preregistration?.requiredPairwiseComparisons ?? null,
      requiredCalibrationDecks: preregistration?.requiredCalibrationDecks ?? null,
      bootstrap: preregistration?.bootstrap ?? null,
      stoppingRules: preregistration?.stoppingRules ?? null,
    },
    evidence: { complete: evidenceComplete, issues: cleanEvidenceIssues },
    power: {
      adequate: powerAdequate,
      requiredContexts: preregistration?.contextIds.length ?? null,
      observedContexts,
      requiredPairwiseComparisons: preregistration?.requiredPairwiseComparisons ?? null,
      observedPairwiseComparisons,
    },
    raters: raterReports,
    reliability: {
      method: "ordinal_krippendorff_alpha_pooled_midrank_squared_distance_v1",
      alpha: rounded(overallAlpha.alpha),
      minimum: DQS_GATE_THRESHOLDS.minimumReliability,
      byDimension: alphaByDimension,
      ratingCount: overallAlpha.ratingCount,
      unitCount: overallAlpha.unitCount,
      raterCount: input.raters.length,
      calibratedRaterCount: calibratedUsedRaters.length,
      adjudicatedScoresIncluded: false,
    },
    dqs: {
      weights: DQS_WEIGHTS,
      current: rounded(currentDqs),
      candidate: rounded(candidateDqs),
      delta: rounded(dqsDelta),
      ci: dqsCi,
      pairedContextCount: pairedContexts.length,
      effectSize: { cohensDz: rounded(effectSize) },
      dimensions: dimensionsReport,
    },
    preference: {
      formula: "(wins + 0.5 * ties) / comparisons",
      submittedComparisons: input.preferences.length,
      invalidatedComparisons,
      comparisons: preferenceComparisons,
      wins,
      losses,
      ties,
      tieRate: preferenceComparisons > 0 ? round(ties / preferenceComparisons) : null,
      score: rounded(preferenceScore),
      ci: preferenceCi,
      leftRightRandomized: input.preferences.every((preference) => preference.leftRightRandomized),
      candidateLeft,
      candidateRight,
    },
    operations: {
      byVariant: operationsByVariant,
      nonRegression,
    },
    gates: {
      hard: { passed: hardGatePassed, invalidDeckIds: [...invalidDeckIds].sort() },
      engineering: {
        passed: engineeringPassed,
        complete: engineeringComplete,
        failures: engineeringFailures,
      },
      quality: qualityGates,
    },
    liveEvidence: {
      supplied: (input.liveEvidence ?? []).length > 0,
      usedInOfflineConclusion: false,
      byVariant: liveByVariant,
    },
    contexts: contextReports,
    decks: [...deckAnalysisById.values()].map((analysis) => analysis.report),
  };
}
