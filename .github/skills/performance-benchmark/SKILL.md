---
name: performance-benchmark
description: >-
  Measure and compare performance baselines before and after changes. Use when
  benchmarking route transitions, web vitals, bundle behavior, script throughput,
  or regression impact instead of directly implementing the performance fix.
  Trigger phrases: "benchmark this", "before and after", "Lighthouse", "measure LCP",
  "performance baseline".
---

# Performance Benchmark

## Purpose

This skill covers measurement and comparison. It is for proving whether performance changed,
not for choosing the implementation strategy itself.

## When to use this skill

Use this skill when you are:

- asked to benchmark a change before and after implementation
- measuring route transitions, load metrics, or bundle behavior
- comparing script throughput or algorithm runtime across revisions
- validating whether a performance claim is real
- defining a repeatable performance verification method for a risky change

## Core rules

1. Measure before optimizing.
   A performance fix without a baseline is a guess.

2. Keep the metric tied to the question.
   Route transition time, LCP, bundle size, long-list scroll behavior, and script throughput
   are different problems and should not be collapsed into one vague score.

3. Prefer repeatable commands or probes.
   The benchmark should be runnable again by another engineer.

4. Report environment assumptions.
   Local machine, throttling profile, seeded data, and sample size all matter.

5. Hand off implementation questions cleanly.
   Once measurement shows the problem, move to `frontend-performance-and-loading` or the owning
   domain skill for the actual fix.

## Current repo anchors

- `docs/perf.md` defines the current web performance goals and validation ideas.
- `scripts/test-performance-fixes.sh` is a lightweight example of repeatable verification.
- Several simulation and analysis scripts under `scripts/` can act as baseline measurement harnesses for non-UI work.

## Quick examples

- **Web route regression**: record route transition timing or Lighthouse data before and after the change.
- **Bundle claim**: compare build output or route-loading behavior instead of asserting the page is "lighter".
- **Script throughput**: use the same script, same input size, and the same env assumptions for both runs.

## Troubleshooting

**The result says "faster" with no numbers**
That is not a benchmark. Add at least one metric and a comparison point.

**Different environments are being compared**
Normalize the environment or call the comparison inconclusive.

**The benchmark mixes implementation and measurement**
Split them. First prove the regression or improvement, then choose the fix path.

**The metric is too broad**
Pick the metric that matches the user-visible problem instead of using a generic perf label.

## Review checklist

- [ ] There is a clear before-and-after or baseline comparison
- [ ] The chosen metric matches the actual performance question
- [ ] The benchmark is repeatable by another engineer
- [ ] Environment assumptions and sample conditions are stated
- [ ] Results are numeric or otherwise concrete, not only subjective
- [ ] Implementation decisions are separated from measurement findings

## Related files

- `docs/perf.md`
- `scripts/test-performance-fixes.sh`
- `scripts/analyze-matching-issues.ts`
- `scripts/simulate-1000-users.ts`
- `scripts/comprehensive_simulation.ts`