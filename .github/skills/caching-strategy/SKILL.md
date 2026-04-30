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

## Backend selection overview

| Need | Backend | Examples |
|------|---------|----------|
| **Ephemeral, run-local** | In-memory `Map` | `poolMatchingService.ts` `pairScoreCache` (per-run deduplication) |
| **Process-local TTL** | `node-cache` | `inference/cache.ts` industry classification (1h TTL) |
| **Durable, shared** | PostgreSQL | Sessions (`connect-pg-simple`), gossip cache, match explanations |
| **Future: distributed** | Redis | Rate limiting, matching cache, phone verification codes |

**No Redis is currently deployed.** Multiple files have `// TODO(redis):` comments marking caches that need distributed storage for horizontal scaling.

## TTL design principles

- **AI-generated copy:** 7 days for expensive LLM output; 1 hour for cheap classification
- **Pair scores:** 5 minutes; should be tied to profile-update events
- **Rate limits:** Fixed-window is acceptable for beta; document migration path to sliding-window
- **Sessions:** 7 days via `connect-pg-simple`
- **Run-local caches:** Garbage-collected when function returns

See [`references/cache-ops.md`](references/cache-ops.md) for the full current cache inventory, key naming rules, invalidation contracts, and horizontal-scaling guardrails.

## Quick examples

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

## Review checklist

- [ ] Cache backend matches durability need (ephemeral vs. persistent vs. distributed)
- [ ] Key design is collision-resistant and version-aware
- [ ] TTL is documented and appropriate for data volatility
- [ ] Invalidation contract is explicit and wired to write paths
- [ ] PII is not cached in-memory without TTL
- [ ] `// TODO(redis):` added if cache must survive horizontal scaling
- [ ] Cache hit/miss is observable (structured logging or metrics)
- [ ] Rate-limit key correctly identifies the actor (not shared IP behind proxy)
