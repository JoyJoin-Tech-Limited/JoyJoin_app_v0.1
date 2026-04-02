import { describe, expect, it, beforeEach } from "vitest";

import {
  _resetMatchingMetricsForTest,
  getMatchingMetricsSnapshot,
  getMatchingMetricsText,
  observeSemanticSimilarityMetrics,
} from "../matchingMetrics";

describe("matchingMetrics", () => {
  beforeEach(() => {
    _resetMatchingMetricsForTest();
    delete process.env.ENABLE_SEMANTIC_SIMILARITY;
  });

  it("captures semantic similarity snapshots for admin visibility", () => {
    observeSemanticSimilarityMetrics(72, 3);
    observeSemanticSimilarityMetrics(88, 6);

    const snapshot = getMatchingMetricsSnapshot();

    expect(snapshot.semanticFeatureEnabled).toBe(false);
    expect(snapshot.semanticSimilarity.sampleCount).toBe(2);
    expect(snapshot.semanticSimilarity.average).toBe(80);
    expect(snapshot.semanticPairDelta.average).toBe(4.5);
  });

  it("renders prometheus metrics for ops scraping", () => {
    process.env.ENABLE_SEMANTIC_SIMILARITY = "true";
    observeSemanticSimilarityMetrics(90, 4);

    const text = getMatchingMetricsText();

    expect(text).toContain("joyjoin_matching_semantic_feature_enabled 1");
    expect(text).toContain("# TYPE joyjoin_matching_semantic_similarity_score histogram");
    expect(text).toContain("# TYPE joyjoin_matching_semantic_pair_score_delta histogram");
  });
});
