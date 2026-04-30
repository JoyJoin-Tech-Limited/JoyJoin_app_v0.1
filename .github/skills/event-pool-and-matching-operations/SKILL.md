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

**Core rule:** Split pool operations from scoring logic. This skill owns pool state, stats semantics, admin operations, and group-outcome handling. Scoring logic and weight decisions remain under `matching-domain`.

## When to use this skill

Use this skill when you are:

- creating or updating an event pool route or admin flow
- changing pool registration rules, pool stats, or pool lifecycle behavior
- wiring or reviewing the admin surface that runs matching for a pool
- interpreting `estimatedGroups`, registration counts, or formed-group outcomes
- adding or debugging event group outcome submission and validation

## Boundary rule

- `event-pool-and-matching-operations` owns pool state, stats semantics, admin operations, and group-outcome handling.
- `matching-domain` owns pair scoring, group scoring, chemistry logic, thresholds, and explanation boundaries.

If the task changes `calculatePairScore`, weight distribution, or chemistry rules, load `matching-domain` first.

## Pool lifecycle overview

1. Keep pool-layer signals separate from formed-group outcomes. Registrations, archetype mix, and projected capacity describe the pool. Match scores and theme titles describe groups that already formed.
2. Keep capacity estimates conservative. `estimatedGroups` should stay floor-based and capped by the pool's configured group limit. Partial groups are not counted as formable.
3. Treat match-run operations as operational orchestration. Auth, reliability, and observability still matter even when the scoring engine is unchanged.
4. Pool matching must not run concurrently for the same pool — use an execution guard. The matching result is persisted before notifications fire.

See [`references/pool-ops.md`](references/pool-ops.md) for full pool stats semantics, match-run operation details, estimated groups logic, and registration constraints.

## Group outcome overview

Group outcome submission must come from an authenticated member of the group. `connectionRadar` may only reference other members of that same group. Be explicit about duplicate-submission behavior rather than letting duplicates silently pile up.

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

**Theme titles in pool stats are confusing**
Theme titles are historical examples from already-formed groups, not evidence that the current pool has formed a new group.

## Review checklist

- [ ] The change stays on the pool-operations side and does not quietly alter scoring math
- [ ] Pool signals and formed-group outcomes remain clearly separated
- [ ] Capacity estimates remain conservative and capped by configured limits
- [ ] Group outcome validation checks real group membership and connection-radar targets
- [ ] Auth, reliability, and telemetry concerns are handled where the operation is privileged or stateful
- [ ] Duplicate submission behavior is explicit rather than accidental
