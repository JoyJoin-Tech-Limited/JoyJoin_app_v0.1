import { describe, expect, it, beforeEach } from "vitest";

import {
  _resetMatchingMetricsForTest,
  getMatchingMetricsSnapshot,
  getMatchingMetricsText,
  observeSemanticSimilarityMetrics,
  observeVenueAssignmentRun,
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

  it("exposes the venue-assignment series at zero before the first run (cold-start stable)", () => {
    const text = getMatchingMetricsText();

    expect(text).toContain("# TYPE joyjoin_venue_assignment_groups_total counter");
    expect(text).toContain("joyjoin_venue_assignment_groups_total 0");
    expect(getMatchingMetricsSnapshot().venueAssignment).toEqual({
      assigned: 0,
      unassignedTotal: 0,
      unassignedByReason: {},
    });
  });

  it("accumulates venue-assignment outcomes across runs", () => {
    observeVenueAssignmentRun({ assignedCount: 5, unassignedByReason: { budget_mismatch: 1 } });
    observeVenueAssignmentRun({
      assignedCount: 1,
      unassignedByReason: { budget_mismatch: 2, no_available_slots: 1 },
    });

    const snapshot = getMatchingMetricsSnapshot();
    expect(snapshot.venueAssignment.assigned).toBe(6);
    expect(snapshot.venueAssignment.unassignedTotal).toBe(4);
    expect(snapshot.venueAssignment.unassignedByReason).toEqual({
      budget_mismatch: 3,
      no_available_slots: 1,
    });

    const text = getMatchingMetricsText();
    expect(text).toContain('joyjoin_venue_assignment_groups_total{outcome="assigned"} 6');
    expect(text).toContain(
      'joyjoin_venue_assignment_groups_total{outcome="unassigned",reason="budget_mismatch"} 3',
    );
  });

  it("collapses unknown unassigned reasons into __other__ to bound label cardinality", () => {
    observeVenueAssignmentRun({
      assignedCount: 0,
      unassignedByReason: { some_future_reason: 2 },
    });

    const snapshot = getMatchingMetricsSnapshot();
    expect(snapshot.venueAssignment.unassignedByReason).toEqual({ __other__: 2 });
  });

  it("ignores non-positive counts and never throws on malformed input", () => {
    expect(() =>
      observeVenueAssignmentRun({
        assignedCount: 0,
        unassignedByReason: { budget_mismatch: 0, no_available_slots: -1 },
      }),
    ).not.toThrow();
    expect(() =>
      observeVenueAssignmentRun(null as unknown as Parameters<typeof observeVenueAssignmentRun>[0]),
    ).not.toThrow();

    expect(getMatchingMetricsSnapshot().venueAssignment.unassignedTotal).toBe(0);
  });

  it("resets venue-assignment counters for test isolation", () => {
    observeVenueAssignmentRun({ assignedCount: 3, unassignedByReason: { capacity_insufficient: 1 } });

    _resetMatchingMetricsForTest();

    expect(getMatchingMetricsSnapshot().venueAssignment).toEqual({
      assigned: 0,
      unassignedTotal: 0,
      unassignedByReason: {},
    });
    expect(getMatchingMetricsText()).toContain("joyjoin_venue_assignment_groups_total 0");
  });
});
