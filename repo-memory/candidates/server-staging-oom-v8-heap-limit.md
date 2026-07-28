---
{
  "id": "server-staging-oom-v8-heap-limit",
  "title": "Staging API OOM: 512m container + Node V8 heap ceiling = restart-loop 502s",
  "status": "candidate",
  "owner": "Backend / Platform",
  "lastValidatedAt": "2026-07-28",
  "tags": ["oom", "memory", "v8", "node-options", "staging", "deploy", "infrastructure"],
  "triggerTerms": ["heap out of memory", "Reached heap limit", "FATAL ERROR", "502", "staging API unstable", "server crash loop", "memory limit"],
  "relatedPaths": [
    "deployment/docker-compose.staging.yml",
    "deployment/docker-compose.nginx.yml",
    "apps/server/src/middleware/metrics.ts",
    "apps/server/build.mjs",
    "infra/alerting/rules.yml"
  ],
  "sources": [
    "2026-07-28 staging API crash-loop diagnosis: 3x SIGABRT within 5 min, heap capped at ~256MB by Node cgroup heuristic inside a 512m Docker container",
    "JoyJoin internal deploy docs: staging/prod API containers share the CVM with Postgres; production had no memory limit"
  ],
  "confidence": "high"
}
---

# Candidate: Staging API OOM root cause + hardening pattern

## What happened (2026-07-28)

`joyjoin-api-staging` on the CVM repeatedly returned 502s during icebreaker test sessions. Server logs showed:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

Three SIGABRT crashes in ~5 minutes; each restart produced another OOM under LLM load.

## Root cause

- Docker container memory limit: **512 MB**
- Node 20 sees a 512 MB cgroup limit and sets V8 old-space limit to ~**256 MB**
- Process baseline RSS alone is ~170 MB; LLM bursts (15x pair explanations + group analysis + icebreaker pre-generation jobs) pushed old space to the ceiling
- V8 GC entered a death spiral (`average mu ~0.275`, i.e. >70% CPU in GC) and then SIGABRT → Docker restart → 502 gap while nginx had no upstream

## Fix pattern

1. **Immediate ops:** raise container limit + set explicit `--max-old-space-size`
   - staging: `mem_limit: 2g`, `NODE_OPTIONS: --max-old-space-size=1536 --heapsnapshot-near-heap-limit=3`
   - prod: `mem_limit: 2g`, `NODE_OPTIONS: --max-old-space-size=1536`
2. **Observability:** expose `nodejs_heap_size_limit_bytes` and alert `process_heap_used_bytes / nodejs_heap_size_limit_bytes > 0.8`
3. **Baseline reduction:** bundle `@joyjoin/shared` into `dist/` so production starts with plain `node dist/index.js` (no tsx/esbuild runtime), cutting baseline RSS
4. **Diagnosis:** when staging nears heap limit, `--heapsnapshot-near-heap-limit` writes `.heapsnapshot` files into the container workdir for Chrome DevTools analysis

## Rules of thumb

- Never rely on Node's cgroup heuristic for small containers; always pair `mem_limit` with explicit `--max-old-space-size`.
- On a shared-host CVM, give production API a memory limit too — otherwise a leak can starve Postgres.
- `process_resident_memory_bytes` alone is not enough; alert on heap-used / heap-limit ratio for early warning.
- Bundling workspace TS source into the runtime bundle removes tsx/esbuild from the production image, improving both RSS and startup time.
