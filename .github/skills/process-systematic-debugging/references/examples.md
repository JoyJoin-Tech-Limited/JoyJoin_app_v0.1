# Worked debugging examples

Concrete illustrations of the 5-phase protocol (reproduce → isolate → hypothesize → verify → fix). Referenced from `SKILL.md`.

## Example 1: Intermittent API failure

**Symptom:** `GET /api/event-pools` returns 500 for ~5% of requests.

- **Phase 1 (Reproduce):** high-volume load test; failure correlates with pools that have >20 registrations.
- **Phase 2 (Isolate):** narrow to the `GROUP BY` archetype aggregation query; fails when `users.primaryArchetype` is null for some registrants.
- **Phase 3 (Hypothesize):** `coalesce` in the aggregation returns null, causing downstream mapping to throw.
- **Phase 4 (Verify):** add null-check logging; hypothesis confirmed.
- **Phase 5 (Fix):** `coalesce(users.primaryArchetype, users.archetype, '未设置')`; add a regression test with null-archetype data.

## Example hypothesis set (Phase 3 format)

For a bug, specify mechanism + evidence + fix scope per hypothesis:

1. *Race condition in icebreaker advance guard* → evidence: concurrent `advance` calls from host + reconnect
2. *Cache TTL mismatch* → evidence: `pool_ai_copy.expires_at` older than the cron interval
3. *Missing null check in archetype aggregation* → evidence: `GROUP BY` returns `null` for users without archetype
