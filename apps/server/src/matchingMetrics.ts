import { isSemanticSimilarityEnabled } from "./matchingSemantic";

interface HistogramState {
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
  buckets: number[];
}

const SCORE_BUCKETS = [20, 40, 60, 80, 100];
const DELTA_BUCKETS = [-5, 0, 5, 10, 20];

const semanticSimilarityHistogram = createHistogramState(SCORE_BUCKETS);
const semanticPairDeltaHistogram = createHistogramState(DELTA_BUCKETS);

function createHistogramState(bucketBounds: number[]): HistogramState {
  return {
    count: 0,
    sum: 0,
    min: null,
    max: null,
    buckets: Array.from({ length: bucketBounds.length + 1 }, () => 0),
  };
}

function observeHistogram(state: HistogramState, bucketBounds: number[], value: number): void {
  state.count += 1;
  state.sum += value;
  state.min = state.min === null ? value : Math.min(state.min, value);
  state.max = state.max === null ? value : Math.max(state.max, value);

  bucketBounds.forEach((bound, index) => {
    if (value <= bound) {
      state.buckets[index] += 1;
    }
  });
  state.buckets[bucketBounds.length] += 1;
}

function renderHistogram(
  name: string,
  help: string,
  bucketBounds: number[],
  state: HistogramState,
): string {
  const lines = [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} histogram`,
  ];

  bucketBounds.forEach((bound, index) => {
    lines.push(`${name}_bucket{le="${bound}"} ${state.buckets[index]}`);
  });
  lines.push(`${name}_bucket{le="+Inf"} ${state.buckets[bucketBounds.length]}`);
  lines.push(`${name}_sum ${state.sum}`);
  lines.push(`${name}_count ${state.count}`);
  return lines.join("\n");
}

function renderGauge(name: string, help: string, value: number): string {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} gauge`,
    `${name} ${value}`,
  ].join("\n");
}

function snapshotHistogram(bucketBounds: number[], state: HistogramState) {
  return {
    sampleCount: state.count,
    average: state.count > 0 ? Number((state.sum / state.count).toFixed(1)) : null,
    min: state.min,
    max: state.max,
    buckets: bucketBounds.map((bound, index) => ({
      le: bound,
      count: state.buckets[index],
    })),
    totalCount: state.buckets[bucketBounds.length],
  };
}

export function observeSemanticSimilarityMetrics(
  semanticSimilarityScore: number,
  pairScoreDelta: number,
): void {
  observeHistogram(semanticSimilarityHistogram, SCORE_BUCKETS, semanticSimilarityScore);
  observeHistogram(semanticPairDeltaHistogram, DELTA_BUCKETS, pairScoreDelta);
}

// ---------------------------------------------------------------------------
// Venue-assignment outcome metrics (budget-tier workstream T8)
// ---------------------------------------------------------------------------

interface LabelledCounterEntry {
  count: number;
  labels: Record<string, string>;
}

const venueAssignmentOutcomeCounters = new Map<string, LabelledCounterEntry>();

/**
 * Bounded label cardinality: unassigned reasons are an internal enum produced
 * by venueAssignmentService. A NEW reason must be added here explicitly —
 * anything unrecognized collapses into `__other__` so no code path can ever
 * grow an unbounded Prometheus label set.
 */
const VENUE_ASSIGNMENT_UNASSIGNED_REASONS = new Set([
  "budget_mismatch",
  "no_available_slots",
  "no_suitable_venue",
  "capacity_insufficient",
  "slot_fully_booked_at_save",
]);

function labelledCounterKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

function incrementVenueAssignmentCounter(labels: Record<string, string>, value: number): void {
  const key = labelledCounterKey(labels);
  const existing = venueAssignmentOutcomeCounters.get(key);
  if (existing) {
    existing.count += value;
  } else {
    venueAssignmentOutcomeCounters.set(key, { count: value, labels });
  }
}

export interface VenueAssignmentRunOutcome {
  assignedCount: number;
  unassignedByReason: Record<string, number>;
}

/**
 * Record the outcome of one venue-assignment run (saveVenueAssignments).
 * Side-effect-free and fail-safe: observability must never break the
 * assignment path (same contract as aiTraceLogger).
 */
export function observeVenueAssignmentRun(outcome: VenueAssignmentRunOutcome): void {
  try {
    if (Number.isFinite(outcome.assignedCount) && outcome.assignedCount > 0) {
      incrementVenueAssignmentCounter({ outcome: "assigned" }, outcome.assignedCount);
    }
    for (const [rawReason, count] of Object.entries(outcome.unassignedByReason)) {
      if (!Number.isFinite(count) || count <= 0) continue;
      const reason = VENUE_ASSIGNMENT_UNASSIGNED_REASONS.has(rawReason) ? rawReason : "__other__";
      incrementVenueAssignmentCounter({ outcome: "unassigned", reason }, count);
    }
  } catch {
    // Intentionally swallowed — metrics must never fail the request path.
  }
}

function renderVenueAssignmentCounter(): string {
  const name = "joyjoin_venue_assignment_groups_total";
  const lines = [
    `# HELP ${name} Groups processed by venue assignment, by outcome (assigned) or unassigned reason.`,
    `# TYPE ${name} counter`,
  ];
  for (const entry of venueAssignmentOutcomeCounters.values()) {
    lines.push(`${name}{${labelledCounterKey(entry.labels)}} ${entry.count}`);
  }
  if (venueAssignmentOutcomeCounters.size === 0) {
    // Keep the series present in scrapes before the first run so alerting on
    // absence does not flap on a cold start.
    lines.push(`${name} 0`);
  }
  return lines.join("\n");
}

function snapshotVenueAssignment() {
  let assigned = 0;
  let unassignedTotal = 0;
  const unassignedByReason: Record<string, number> = {};
  for (const entry of venueAssignmentOutcomeCounters.values()) {
    if (entry.labels.outcome === "assigned") {
      assigned += entry.count;
    } else if (entry.labels.outcome === "unassigned") {
      const reason = entry.labels.reason ?? "__other__";
      unassignedByReason[reason] = (unassignedByReason[reason] ?? 0) + entry.count;
      unassignedTotal += entry.count;
    }
  }
  return { assigned, unassignedTotal, unassignedByReason };
}

export function getMatchingMetricsSnapshot() {
  return {
    semanticFeatureEnabled: isSemanticSimilarityEnabled(),
    semanticSimilarity: snapshotHistogram(SCORE_BUCKETS, semanticSimilarityHistogram),
    semanticPairDelta: snapshotHistogram(DELTA_BUCKETS, semanticPairDeltaHistogram),
    venueAssignment: snapshotVenueAssignment(),
  };
}

export function getMatchingMetricsText(): string {
  return [
    renderGauge(
      "joyjoin_matching_semantic_feature_enabled",
      "Whether semantic similarity pair scoring is currently enabled.",
      isSemanticSimilarityEnabled() ? 1 : 0,
    ),
    renderHistogram(
      "joyjoin_matching_semantic_similarity_score",
      "Distribution of bounded semantic similarity scores for newly computed user pairs.",
      SCORE_BUCKETS,
      semanticSimilarityHistogram,
    ),
    renderHistogram(
      "joyjoin_matching_semantic_pair_score_delta",
      "Distribution of pair-score deltas introduced by semantic similarity weighting.",
      DELTA_BUCKETS,
      semanticPairDeltaHistogram,
    ),
    renderVenueAssignmentCounter(),
  ].join("\n\n");
}

export function _resetMatchingMetricsForTest(): void {
  semanticSimilarityHistogram.count = 0;
  semanticSimilarityHistogram.sum = 0;
  semanticSimilarityHistogram.min = null;
  semanticSimilarityHistogram.max = null;
  semanticSimilarityHistogram.buckets.fill(0);

  semanticPairDeltaHistogram.count = 0;
  semanticPairDeltaHistogram.sum = 0;
  semanticPairDeltaHistogram.min = null;
  semanticPairDeltaHistogram.max = null;
  semanticPairDeltaHistogram.buckets.fill(0);

  venueAssignmentOutcomeCounters.clear();
}
