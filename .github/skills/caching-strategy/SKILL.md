---
name: caching-strategy
description: >
  Caching and rate-limiting strategy: backend selection, TTL design, key naming, invalidation
  contracts, and horizontal-scaling guardrails. Use when adding caches, modifying rate limits, or
  debugging stale data. Triggers: cache, Redis, rate limit, matchingCache, node-cache, TTL,
  eviction, invalidate cache, stale data, thundering herd, connect-pg-simple, session store.
---

# Caching Strategy

**Core rule:** Match the backend to the durability need. In-memory `Map` for ephemeral run-local deduplication; PostgreSQL for durable AI output and sessions; `node-cache` for simple process-local TTL; Redis is the explicit future target for horizontal scaling.

---

## When to use this skill

- Adding a new cache layer or changing cache backend
- Modifying rate-limit rules, windows, or key patterns
- Debugging stale data, cache invalidation bugs, or thundering herd
- Changing session store configuration or TTL
- Moving from in-memory to persistent caching
- Reviewing caching for horizontal-scaling readiness

## When NOT to use this skill

- Database query optimization → use `server-domain-architecture` or `database-query-optimization`
- General performance tuning without caching → use `frontend-performance-and-loading`
- AI prompt caching or LLM output reuse → use `llm-runtime-safety-and-integration`

---

## Backend Selection Matrix

| Need | Backend | Examples |
|------|---------|----------|
| **Ephemeral, run-local** | In-memory `Map` | `poolMatchingService.ts` `pairScoreCache` (per-run deduplication) |
| **Process-local TTL** | `node-cache` | `inference/cache.ts` industry classification (1h TTL) |
| **Durable, shared** | PostgreSQL | Sessions (`connect-pg-simple`), gossip cache, match explanations |
| **Future: distributed** | Redis | Rate limiting, matching cache, phone verification codes |

**No Redis is currently deployed.** Multiple files have `// TODO(redis):` comments marking caches that need distributed storage for horizontal scaling.

## Current Caches

| Cache | File | Backend | TTL | Max Size |
|-------|------|---------|-----|----------|
| Matching pairs | `matchingCache.ts` | In-memory `Map` | 5 min | 500 |
| Matching signatures | `matchingCache.ts` | In-memory `Map` | 30 min | 200 |
| Rate limiter | `rateLimiter.ts` | In-memory `Map` | 60s window | unbounded |
| Sessions | `routes.ts` | PostgreSQL | 7 days | table-managed |
| Industry AI | `inference/cache.ts` | `node-cache` | 1 hour | automatic |
| TTS audio | `ai/minimaxTTSService.ts` | In-memory `Map` | none | unbounded |
| Match explanations | `matchExplanationService.ts` | PostgreSQL JSONB | 7 days | roster-hash validated |
| Xiaoyue analysis | `xiaoyueAnalysisService.ts` | In-memory `Map` | 1 hour | unbounded |
| Trigger performance | `triggerPerformanceService.ts` | In-memory `Map` | none | write-through |
| Pool run caches | `poolMatchingService.ts` | In-memory `Map` | run lifetime | function-local |

## Key Naming Rules

| Cache | Pattern | Example |
|-------|---------|---------|
| Matching pairs | `pair:${sortedUid1}:${sortedUid2}` | `pair:abc:def` |
| Matching signatures | `sig:${userId}` | `sig:u_123` |
| Rate limiter | `${prefix}:${userId\|ip}` | `ai:u_123`, `auth:192.168.1.1` |
| Match explanations | roster `memberHash` | sorted user IDs hash |

**Rules:**
- Use stable, collision-resistant keys
- Include version/hash when data shape matters
- Avoid substring invalidation (current `invalidateUserCache()` uses `key.includes(userId)` — fragile)
- Never cache PII in in-memory stores without TTL

## TTL & Eviction Guidelines

- **AI-generated copy:** 7 days for expensive LLM output; 1 hour for cheap classification
- **Pair scores:** 5 minutes; should be tied to profile-update events
- **Rate limits:** Fixed-window is acceptable for beta; document migration path to sliding-window
- **Sessions:** 7 days via `connect-pg-simple`
- **Run-local caches:** Garbage-collected when function returns

## Invalidation Contracts

| Event | Action |
|-------|--------|
| Profile update | Invalidate matching cache entries for that user |
| Group roster change | Invalidate `pairExplanationsCache` and `iceBreakersCache` |
| User ban / abuse flag | Invalidate rate-limit keys or session records |
| Archetype config change | Invalidate all matching caches |

## Horizontal Scaling Guardrails

- **Flag all in-memory `Map` caches** with `// TODO(redis):` if they must survive across instances
- `rateLimiter.ts` and `matchingCache.ts` are **not production-safe** under multi-instance deployment
- Rate limiter uses a fixed-window algorithm; behind a proxy, misconfigured `trust proxy` can cause all users to share one IP key

## Quick Examples

**User:** "Add caching for generated event themes"
→ Use this skill. Use PostgreSQL JSONB (durable, roster-validated) with a `memberHash` key and 7-day TTL. Emit `logAITrace` with `fromCache`. Add invalidation on roster change.

**User:** "Rate limits are resetting on every deploy"
→ Use this skill. The rate limiter uses in-memory `Map` — process-local. Mark with `// TODO(redis):` and plan migration to a shared store.

**User:** "Users see stale match explanations after updating their profile"
→ Use this skill. Check invalidation: profile updates should trigger `invalidateUserCache()` or a targeted key deletion. Current substring-based invalidation may miss roster-hash keys.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cache grows unbounded | No max size or TTL | Add TTL or cap; use `node-cache` or PostgreSQL |
| Stale data after update | Missing invalidation | Add explicit invalidation on write; prefer exact-key deletion |
| Rate limit shared across users | `trust proxy` misconfigured | Verify Express `trust proxy` setting behind load balancer |
| Matching cache reset on deploy | In-memory only | Add `// TODO(redis):` and plan distributed backend |
| Thundering herd on cache miss | No stampede protection | Add brief lock or warming pattern |

## Review Checklist

- [ ] Cache backend matches durability need (ephemeral vs. persistent vs. distributed)
- [ ] Key design is collision-resistant and version-aware
- [ ] TTL is documented and appropriate for data volatility
- [ ] Invalidation contract is explicit and wired to write paths
- [ ] PII is not cached in-memory without TTL
- [ ] `// TODO(redis):` added if cache must survive horizontal scaling
- [ ] Cache hit/miss is observable (structured logging or metrics)
- [ ] Rate-limit key correctly identifies the actor (not shared IP behind proxy)

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `server-domain-architecture` | Adding new routes or repositories |
| `llm-runtime-safety-and-integration` | AI prompt caching or LLM output reuse |
| `frontend-performance-and-loading` | Client-side caching or asset loading |
| `platform-observability-and-ops` | Cache metrics and alerting |

## Canonical References

- `apps/server/src/matchingCache.ts`
- `apps/server/src/rateLimiter.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/inference/cache.ts`
- `apps/server/src/ai/minimaxTTSService.ts`
- `apps/server/src/xiaoyueAnalysisService.ts`
- `apps/server/src/triggerPerformanceService.ts`
- `packages/shared/src/schema.ts` (sessions, gossip cache)
