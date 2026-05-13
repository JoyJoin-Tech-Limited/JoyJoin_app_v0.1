# Open beta — single replica contract

**Audience:** Engineering + SRE  
**Related:** [`product/open-beta-wider.md`](../product/open-beta-wider.md), [`product/launch-risks.md`](../product/launch-risks.md) (R-01, R-02)

## Contract

The wider open beta is approved to run on **exactly one** Node.js server process (one container/replica, no horizontal autoscaling of the API tier for this cohort).

## Why

In-memory components are **not** shared across processes:

- Rate limits: [`apps/server/src/rateLimiter.ts`](../../apps/server/src/rateLimiter.ts)
- Abuse soft state: [`apps/server/src/abuseDetection.ts`](../../apps/server/src/abuseDetection.ts)
- AI inference cache: [`apps/server/src/inference/cache.ts`](../../apps/server/src/inference/cache.ts)

## Deploy checklist

- [ ] Orchestrator / compose / platform **max replicas = 1** for the API service.
- [ ] Document in release notes that **scaling out requires** Redis (or equivalent) for limits/cache and persisted abuse state per post-beta remediation in `product/launch-risks.md`.
- [ ] After **any** deploy or restart, run a quick smoke: `GET /api/readyz`, auth login rate limit sanity, payment create (staging).

## Restart effects (support)

After restart, users may briefly hit stricter rate windows or rebuilt AI cache; **hard bans and DB state** remain. If abuse spikes right after restart, treat as possible gaming and monitor logs.
