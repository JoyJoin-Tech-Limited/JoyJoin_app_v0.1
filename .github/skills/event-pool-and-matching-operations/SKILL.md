---
name: event-pool-and-matching-operations
description: >-
  Event-pool lifecycle, pool stats semantics, match-run operations, and post-match
  group outcome handling around event pools. Use when creating or updating event
  pools, pool registrations, admin match runs, pool stats, or group outcome
  submissions. Trigger phrases: "create an event pool", "run matching on this
  pool", "event pool constraints", "estimated groups", "group outcome", "how
  do groups form".
---

# Event Pool and Matching Operations

## Purpose

This skill owns the operational layer around event pools: pool lifecycle,
registration and stats semantics, match-run orchestration surfaces, and
post-match outcome submission. It does **not** own the scoring math itself.
Scoring logic and weight decisions remain under `matching-domain`.

## When to use this skill

Use this skill when you are:

- creating or updating an event pool route or admin flow
- changing pool registration rules, pool stats, or pool lifecycle behavior
- wiring or reviewing the admin surface that runs matching for a pool
- interpreting `estimatedGroups`, registration counts, or formed-group outcomes
- adding or debugging event group outcome submission and validation

## Boundary rule

Split pool operations from scoring logic.

- `event-pool-and-matching-operations` owns pool state, stats semantics, admin operations, and group-outcome handling.
- `matching-domain` owns pair scoring, group scoring, chemistry logic, thresholds, and explanation boundaries.

If the task changes `calculatePairScore`, weight distribution, or chemistry rules, load `matching-domain` first.

## Core workflow

1. Decide whether the task is pool operations or scoring math.
   Do not hide scoring changes inside a pool-lifecycle change.

2. Keep pool-layer signals separate from formed-group outcomes.
   Registrations, archetype mix, and projected capacity describe the pool.
   Match scores and theme titles describe groups that already formed from the pool.

3. Keep capacity estimates conservative.
   `estimatedGroups` should stay floor-based and capped by the pool's configured group limit. Partial groups are not counted as formable.

4. Treat match-run operations as operational orchestration.
   Auth, reliability, and observability still matter here even when the scoring engine is unchanged.

5. Validate post-match submissions against real group membership.
   Group outcome submission must come from an authenticated member of the group, and `connectionRadar` may only reference other members of that same group.

6. Be explicit about duplicate-submission behavior.
   If a group outcome route replaces a prior submission, document and preserve that behavior instead of letting duplicates silently pile up.

## Current operational rules

- Pool stats intentionally mix two layers only when they are clearly labeled: pool signals and historical formed-group outcomes.
- `estimatedGroups` is conservative by design. Do not switch it to optimistic rounding.
- Theme titles returned from pool stats are historical examples from already-formed groups, not evidence that the current pool has formed a new group.
- Group outcome submissions reject invalid `connectionRadar` targets that point to the submitter or to non-members.

## Quick examples

- **Add a new pool stats field**: decide whether it is a pool-layer signal or a historical group outcome, then name and document it so those layers do not blur together.
- **Wire an admin "run matching" action**: keep the operational flow, auth guard, and telemetry clear, and leave score calculation changes to `matching-domain`.
- **Extend group-outcome capture**: validate the new field against actual group membership rules and preserve the existing duplicate-submission strategy.

## Troubleshooting

**Registrations exist but no groups formed**
Projected capacity is not proof of a completed match run. Inspect the pool operation flow separately from the scoring engine.

**Stats are overstating how many groups can form**
Check that the estimate still uses `Math.floor(...)` and respects the configured group limit rather than optimistic rounding.

**A group outcome submission is rejected with `403`**
Verify that the submitting user is actually a member of the target group for the target pool.

**A group outcome submission is rejected with `400`**
Inspect `connectionRadar` targets first. The route only accepts other members of the same group.

## Review checklist

- [ ] The change stays on the pool-operations side and does not quietly alter scoring math
- [ ] Pool signals and formed-group outcomes remain clearly separated
- [ ] Capacity estimates remain conservative and capped by configured limits
- [ ] Group outcome validation checks real group membership and connection-radar targets
- [ ] Auth, reliability, and telemetry concerns are handled where the operation is privileged or stateful
- [ ] Duplicate submission behavior is explicit rather than accidental

## Related files

- [`apps/server/src/routes/domains/eventPools.ts`](../../apps/server/src/routes/domains/eventPools.ts)
- [`apps/server/src/routes/domains/eventGroupOutcomes.ts`](../../apps/server/src/routes/domains/eventGroupOutcomes.ts)
- [`apps/server/src/poolMatchingService.ts`](../../apps/server/src/poolMatchingService.ts)
- [`docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md)
