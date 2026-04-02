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

export function getMatchingMetricsSnapshot() {
  return {
    semanticFeatureEnabled: isSemanticSimilarityEnabled(),
    semanticSimilarity: snapshotHistogram(SCORE_BUCKETS, semanticSimilarityHistogram),
    semanticPairDelta: snapshotHistogram(DELTA_BUCKETS, semanticPairDeltaHistogram),
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
}
