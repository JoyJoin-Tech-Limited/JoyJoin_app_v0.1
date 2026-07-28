---
{
  "id": "server-multi-instance-state-blockers",
  "title": "Server horizontal-scaling blockers: process-local state that must migrate to Redis/DB",
  "status": "candidate",
  "owner": "Backend / Platform",
  "lastValidatedAt": "2026-07-28",
  "tags": ["scalability", "multi-instance", "redis", "stateless", "horizontal-scaling", "joyjoin-server"],
  "triggerTerms": ["horizontal scale", "multi-instance", "multiple replicas", "Redis", "sticky session", "distributed lock", "rate limit shared", "WebSocket broadcast"],
  "relatedPaths": [
    "apps/server/src/wsService.ts",
    "apps/server/src/ai/deepseekBudgetTracker.ts",
    "apps/server/src/inference/asyncInferenceQueue.ts",
    "apps/server/src/abuseDetection.ts",
    "apps/server/src/deepseekClientXiaoyue.ts",
    "apps/server/src/routes/socialIcebreakerHelpers.ts",
    "apps/server/src/rateLimiter.ts",
    "apps/server/src/userSemanticProfileService.ts",
    "apps/server/src/matchingCache.ts",
    "apps/server/src/middleware/metrics.ts"
  ],
  "sources": [
    "2026-07-28 S4 code audit of apps/server/src for process-local Maps/Sets/NodeCache ahead of horizontal-scaling planning"
  ],
  "confidence": "high"
}
---

# Candidate: Server multi-instance state blockers

## Context

JoyJoin server is currently a single-container deployment on a shared CVM. The architecture is mostly stateless (DB in PostgreSQL, sessions in DB, social-icebreaker state in DB), but several modules keep process-local state. Running two or more API replicas behind a load balancer will break or weaken these modules.

## Process-local state inventory

| # | Module | State | Multi-instance impact | Severity |
|---|--------|-------|----------------------|----------|
| 1 | `wsService.ts` | `clients` Map, `eventRooms` Map, per-WS rate-limit / blocked state | WebSocket connections and rooms exist only on the instance that accepted the upgrade. A broadcast to a user or event room will not reach clients connected to other replicas. | **BLOCK** |
| 2 | `deepseekBudgetTracker.ts` | `spendStore` NodeCache (daily Pro spend) | Each replica maintains its own daily budget counter. With N replicas the effective Pro budget is N× the configured value before downgrade kicks in. | **BLOCK** |
| 3 | `asyncInferenceQueue.ts` | `pendingInferences`, `completedResults`, `cleanupTimers` Maps | A session's async inference requests and results are bound to one process. If subsequent reads land on another replica, the client cannot retrieve results and may re-trigger work. | **BLOCK** |
| 4 | `abuseDetection.ts` | `userStates` Map (`lastMessageTime`, `conversationTurns`, `recentMessages`) | Rate, turn, repetition and duplicate-message guards are per-process. An attacker can bypass limits by cycling requests across replicas. (Daily token budget is already DB-backed and safe.) | **BLOCK** |
| 5 | `deepseekClientXiaoyue.ts` | `sessionInferenceStates`, `sessionInsightStore` Maps (no TTL) | Xiaoyue chat inference context and accumulated insights are tied to one process. Cross-replica requests see a cold context; memory also leaks because there is no eviction. | **BLOCK** |
| 6 | `socialIcebreakerHelpers.ts` | `fuseExecutionsInFlight` Set | The all-ready / stall fuse dedupe works only inside one process. Multiple replicas can concurrently execute `transitionPhase` for the same scheduled fuse, causing duplicate phase transitions or lost updates. | **WARN** |
| 7 | `rateLimiter.ts` | `rateLimitStore` Map | Per-process counters for AI, auth, payment, geo, webhooks. Distributed attackers can exceed limits by hitting different replicas. | **WARN** |
| 8 | `userSemanticProfileService.ts` | `pendingRecomputes`, `queuedReasons` Maps | Cross-instance deduplication of embedding recomputation fails; the same user update can trigger multiple expensive embedding calls on different replicas. | **WARN** |
| 9 | `matchingCache.ts` | local `matchingCache` / `signatureCache` | A profile update processed on replica A will invalidate cache only on A. Replica B continues serving stale pair scores / signatures until TTL expires. | **WARN** |
| 10 | `middleware/metrics.ts` | process-level Prometheus counters/histograms | Not a blocker. Prometheus scrape targets each replica and aggregates counters. The `nodejs_event_loop_delay_ms` gauge is per-instance only, which is acceptable. | **INFO** |

## Recommended migration roadmap

### Phase 0 — prerequisites

1. Introduce a single Redis instance (or reuse the existing PostgreSQL with advisory locks where Redis is overkill).
2. Create a small `packages/server/src/lib/redis.ts` wrapper (ioredis) with connection health logging and graceful shutdown.
3. Add `REDIS_URL` to env files and CI; keep local dev optional via `redis-memory-server` or Docker Compose.

### Phase 1 — trust & safety (highest ROI)

- **rateLimiter.ts**: replace the in-memory Map with `rate-limit-redis` (Express middleware) or move abusive-traffic limiting to the API gateway (Nginx / Cloudflare / AWS WAF). Gateway-level limiting is preferred for DDoS/abuse because it runs before the application.
- **abuseDetection.ts**: move `lastMessageTime`, `conversationTurns`, `recentMessages` into Redis hashes with TTL. Daily token budget already uses DB; keep that.

### Phase 2 — real-time & cost

- **wsService.ts**: keep WebSocket connections local, but route broadcasts through Redis pub/sub. Add sticky sessions at the load balancer so a given user's WebSocket always lands on the same replica. Long-term evaluate Socket.IO with Redis adapter.
- **deepseekBudgetTracker.ts**: implement a Redis atomic counter (INCR/HINCRBY) keyed by `deepseek:pro:budget:YYYY-MM-DD`. Read can be cached locally for a short TTL; write must go to Redis.

### Phase 3 — consistency & deduplication

- **asyncInferenceQueue.ts**: replace with BullMQ / Bull backed by Redis, or a PostgreSQL async-job table. Persist job status and results so any replica can query them.
- **userSemanticProfileService.ts**: use Redis distributed lock (`SET session:<userId>:recompute NX EX <ttl>`) so only one replica recomputes embeddings at a time.
- **socialIcebreakerHelpers.ts**: add an optimistic lock/version column to `social_icebreaker_sessions` (or use PostgreSQL advisory locks) so `transitionPhase` is exclusive across replicas.
- **matchingCache.ts**: either move to Redis shared cache, or keep local caches + Redis pub/sub invalidation channel. Given short TTL (5–30 min) and write volume, invalidation broadcast is usually cheaper than full shared cache.

### Phase 4 — legacy cleanup

- **deepseekClientXiaoyue.ts**: the chat-based Xiaoyue inference store is deprecated per AGENTS.md (Xiaoyue is now mascot-only). Either remove these Maps entirely, or migrate the remaining usage to the DB-backed `dialogueEmbeddingsService.getSessionInsights`. Note: the two modules currently export functions with the same name (`getSessionInsights`), which is itself a maintenance risk.

## Short-term mitigation (before Redis)

If business needs force horizontal scaling before the migration is complete:

1. **Sticky sessions by userId** at the load balancer. This keeps a single user's requests (and WebSocket) on one replica, masking most of the per-user state problems.
2. **Do not scale until Phase 1 is done** for `rateLimiter.ts` and `abuseDetection.ts`; otherwise abuse controls become advisory only.
3. **Keep social-icebreaker sessions sticky** as well; the `fuseExecutionsInFlight` Set then remains effective for a given session.
4. **Accept stale matching cache** as a transient quality issue, or disable `matchingCache` when scaling >1 replica.

## S4 staging verification notes (2026-07-28)

The original production symptom was repeated `502` / request-timeout on `POST /api/social-icebreaker/:id/topics`. After the S1 memory-limit fix (2 GiB container + `--max-old-space-size=1536`) and S3 tsx-removal, the same path was replayed on staging:

- `POST /api/test/single-test/start` → `POST /api/social-icebreaker/:groupId/start` → `POST /api/social-icebreaker/:socialSessionId/topics`.
- Single `/topics` call: **HTTP 200**, ~6.7 s, returned 5 warmup topics.
- 5 concurrent `/topics` calls (simulating the retry storm in the device log): **all HTTP 200**, ~6.5–7.6 s.
- Memory stayed flat: RSS ~135 MiB, heap used ~55 MiB, heap limit 1.62 GiB; no `.heapsnapshot` produced.

This confirms the root cause was the previous 512 MiB container limit combined with tsx runtime overhead, which drove V8 heap OOM and SIGABRT → 502 gaps. The fix is validated.

### Caveat: matching-test smoke path blocked by schema drift

The originally prepared matching-test smoke script (`/api/test/matching-test/start`) failed on staging with:

```
FAILED_TO_START: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

The failing statement is the bot-seed `users` upsert in `seedMatchingTestBots` (`apps/server/src/services/matchingTestService.ts`), which targets `users.phone_number`. The schema declares `phoneNumber` as `.unique()`, and the baseline migration `migrations/0001_next_jackpot.sql` includes `CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")`, but the **staging database is missing this constraint**. This is schema drift, unrelated to horizontal scaling, and must be repaired (or the matching-test smoke path remains broken).

## Validation checklist

- [ ] Redis reachable from all API replicas; connection failures fail open where safe, fail closed for budget/abuse.
- [ ] WebSocket broadcast works across replicas (open two connections on different replicas in a test cluster).
- [ ] Rate-limit and abuse checks survive sticky-session disable in load-test.
- [ ] `deepseekBudgetTracker` Pro downgrade threshold is the same for 1 vs N replicas.
- [ ] Social-icebreaker auto-advance does not double-fire under concurrent requests across replicas.
- [ ] Matching cache invalidation propagates to all replicas within seconds after profile update.
