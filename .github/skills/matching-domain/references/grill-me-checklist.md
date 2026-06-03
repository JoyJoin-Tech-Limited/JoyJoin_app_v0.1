# Grill-Me — Matching Domain

> Stress-test matching logic assumptions. One question per turn.
> "It works for 10 users" ≠ "it works for 1000." Every edge case must be defended.

## Scoring Weights

Ask when modifying scoring dimensions:

**Q1:** What are all the active scoring dimensions? Do their weights sum to exactly 100% for BOTH the 6D default AND 7D semantic paths?
- Recommended: Both weight tables verified to ∑ = 100%. If `ENABLE_SEMANTIC_SIMILARITY` changes, both tables adjusted.

**Q2:** Show me the math for a pair score. What's the minimum possible score? Maximum? What threshold gates group formation?
- Recommended: Scores normalized 0–100. `avgScore ≥ 60` for group eligibility. Edge cases (empty interests, missing archetype) handled.

## Signal Boundary

Ask when touching data sources:

**Q3:** Does ANY scoring function read from `user_interest_signals`? Run the test to confirm.
- Recommended: Zero reads from `user_interest_signals` in scoring path. `interestSignalBoundary.test.ts` confirms. Signals are AI-only.

**Q4:** What tables does the scoring path read from? List them. Are they all approved sources?
- Recommended: Only `user_interests`, `users`, archetype chemistry matrix. No signal tables, no AI-generated data.

## Hard Constraints (L1)

Ask when groups aren't forming:

**Q5:** Walk through the L1 filters applied before scoring: budget, gender, industry, education, age. Which filter is rejecting the most users?
- Recommended: Each filter identified with rejection count. Users passing all L1 constraints proceed to scoring.

**Q6:** If ALL users in a pool fail an L1 filter, what happens? Empty group set returned? Error?
- Recommended: Empty group set returned gracefully. Pool status reflects "no viable groups." Admin alerted.

## Concurrent Execution

Ask when matching runs:

**Q7:** What prevents two matching runs for the same pool from executing simultaneously?
- Recommended: Execution guard (DB row lock or in-memory mutex). `FOR UPDATE` on pool row. `finally` releases guard.

**Q8:** If matching crashes mid-run, does the guard release? Does the pool get stuck in "matching" forever?
- Recommended: Guard released in `finally`. Timeout-based recovery for stale guards. Pool revertible to pre-match state.

## Group Formation

Ask when groups are unexpected:

**Q9:** What's the minimum group size? What happens when only 3 users have compatible scores but min is 4?
- Recommended: `minGroupSize` = 4. Groups of 3 rejected. Users ungrouped → pool status reflects incomplete matching.

**Q10:** Does the greedy algorithm always produce the same groups for the same input? Is matching deterministic?
- Recommended: Deterministic. Same input → same groups. AI explanation may enrich output but doesn't change groups.

## Layer Separation

Ask when adding AI or enrichment:

**Q11:** Is this new logic in the deterministic scoring layer or the AI enrichment layer? Will it change pair scores or just explanations?
- Recommended: AI enrichment → explanation layer only. No scoring impact. Deterministic scores are sacred.
