# Pool Operations and Detailed Reference

## Pool stats semantics

Pool stats intentionally mix two layers only when they are clearly labeled: pool signals and historical formed-group outcomes.

- `estimatedGroups` is conservative by design: `Math.floor` registrations ÷ `minGroupSize`, capped by `targetGroups`
- Do not switch it to optimistic rounding
- Theme titles returned from pool stats are historical examples from already-formed groups, not evidence that the current pool has formed a new group

## Match-run operation details

Treat match-run operations as operational orchestration. Auth, reliability, and observability still matter here even when the scoring engine is unchanged.

Pool matching must not run concurrently for the same pool — use an execution guard. The matching result is persisted before notifications fire. On error, the execution guard must always be released (`finally` block).

## Registration constraints

- Group outcome submission must come from an authenticated member of the group
- `connectionRadar` may only reference other members of that same group
- Group outcome submissions reject invalid `connectionRadar` targets that point to the submitter or to non-members
- Be explicit about duplicate-submission behavior: if a group outcome route replaces a prior submission, document and preserve that behavior

## Related files

- `apps/server/src/routes/domains/eventPools.ts` — pool routes, `GET /api/event-pools/:poolId/stats`, `buildEventPoolStatsResponse`
- `apps/server/src/routes/domains/eventGroupOutcomes.ts`
- `apps/server/src/poolRealtimeMatchingService.ts` — registration-triggered and scheduled match runs
- `apps/server/src/poolMatchingService.ts` — read-only for understanding how pool config feeds group formation (scoring changes belong to `matching-domain`)
- `docs/MATCHING_ALGORITHM_REFERENCE.md` — pair/group algorithm reference (cross-check with pool operations)
- `docs/admin-rbac-matrix.md`
