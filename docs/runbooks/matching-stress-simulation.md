# Matching & AI stress simulation (local)

Deterministic **CPU** benchmarks for the same greedy pool matcher used in production (`runGreedyPoolMatchingCore` in `apps/server/src/poolMatchingService.ts`). **No database queries** during the hot path: synthetic users and in-memory interest caches only.

This does **not** replace HTTP load tests (k6), real LLM QPS tests, or social-icebreaker concurrency tests — see [Limits](#limits).

## Prerequisites

- Run from **`apps/server`** so workspace aliases (`@shared/*`) resolve:

  ```bash
  cd apps/server
  ```

- **`DATABASE_URL`** must be set before any module loads `db.ts`. The CLI wrapper sets a harmless placeholder if unset; for a clean run you can export your dev URL instead.

## Commands

**Matching (default 1000 synthetic users)**

```bash
npm run benchmark:matching-stress -- 1000
```

**Smaller smoke run**

```bash
npm run benchmark:matching-stress -- 100
```

**Matching + in-process “AI chat flow” simulation** (dialog guidance; **no** network LLM in the default loop — same as `apps/server/src/tests/runSimulation.ts`)

```bash
npm run benchmark:matching-stress -- 1000 --ai-chat 200
```

Direct `tsx` (equivalent):

```bash
npx tsx src/benchmarks/matchingStressSimulation.cli.ts 1000
```

## What is measured

| Phase | What runs | DB |
|-------|-----------|-----|
| Matching | Full **O(n²)** pairwise scoring + greedy grouping (same code path as `matchEventPool` after caches) | None in benchmark |
| `--ai-chat` | `aiChatFlowSimulation` onboarding-style dialog | None |

Enable **`ENABLE_SEMANTIC_SIMILARITY=true`** to include the 7D semantic dimension (hash vectors), closer to production when the flag is on.

## Limits

- **Social icebreaker HTTP / WebSocket**: not covered — use a staged API tool (e.g. k6) against **non-production** only.
- **Real LLM / embedding QPS**: not covered — use rate-capped scripts and provider budgets; see [`mini-program-ai-smoke.md`](./mini-program-ai-smoke.md).
- **End-to-end pool lifecycle**: seed a test DB and call admin match or `scanPoolAndMatch` separately; this benchmark stays **in-memory** for repeatability.

## Safety

- Placeholder `DATABASE_URL` does not need a live server for this benchmark, but avoid pointing scripts at **production** databases.
- Do not run **`--ai-chat`** with huge counts on CI without a time budget; it is CPU-heavy.
