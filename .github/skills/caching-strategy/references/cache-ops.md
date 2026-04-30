# Cache Operations and Detailed Reference

## Current caches

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

## Key naming rules

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

## TTL & eviction guidelines

- **AI-generated copy:** 7 days for expensive LLM output; 1 hour for cheap classification
- **Pair scores:** 5 minutes; should be tied to profile-update events
- **Rate limits:** Fixed-window is acceptable for beta; document migration path to sliding-window
- **Sessions:** 7 days via `connect-pg-simple`
- **Run-local caches:** Garbage-collected when function returns

## Invalidation contracts

| Event | Action |
|-------|--------|
| Profile update | Invalidate matching cache entries for that user |
| Group roster change | Invalidate `pairExplanationsCache` and `iceBreakersCache` |
| User ban / abuse flag | Invalidate rate-limit keys or session records |
| Archetype config change | Invalidate all matching caches |

## Horizontal scaling guardrails

- **Flag all in-memory `Map` caches** with `// TODO(redis):` if they must survive across instances
- `rateLimiter.ts` and `matchingCache.ts` are **not production-safe** under multi-instance deployment
- Rate limiter uses a fixed-window algorithm; behind a proxy, misconfigured `trust proxy` can cause all users to share one IP key

## Related skills

| Skill | When to hand off |
|-------|-----------------|
| `server-domain-architecture` | Adding new routes or repositories |
| `llm-runtime-safety-and-integration` | AI prompt caching or LLM output reuse |
| `frontend-performance-and-loading` | Client-side caching or asset loading |
| `platform-observability-and-ops` | Cache metrics and alerting |

## Canonical references

- `apps/server/src/matchingCache.ts`
- `apps/server/src/rateLimiter.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/inference/cache.ts`
- `apps/server/src/ai/minimaxTTSService.ts`
- `apps/server/src/xiaoyueAnalysisService.ts`
- `apps/server/src/triggerPerformanceService.ts`
- `packages/shared/src/schema.ts` (sessions, gossip cache)
