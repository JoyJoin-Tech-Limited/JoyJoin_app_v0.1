# Social Icebreaker AI — observability and alerts

This note ties **runtime behaviour** to **Prometheus metrics** exposed at `GET /api/metrics` (see [`apps/server/src/middleware/metrics.ts`](../../apps/server/src/middleware/metrics.ts)).

## Metrics (JoyJoin AI)

| Metric | Labels | Meaning |
| --- | --- | --- |
| `joyjoin_ai_calls_total` | `domain`, `feature`, `outcome` | `outcome` = `cache` \| `live` \| `fallback`. Successful **provider swap** (e.g. DeepSeek after MiniMax) is counted as **`fallback`** (non-primary path). |
| `joyjoin_ai_call_latency_ms` | same | Histogram of wall-clock ms for those calls. |
| `joyjoin_ai_provider_recovery_total` | `domain`, `feature` | Incremented when the **secondary** provider’s output was accepted (e.g. MiniScript framework JSON from DeepSeek after MiniMax failure). Narrow signal for dashboards. |

Structured logs: `[AITrace]` JSON lines from [`logAITrace`](../../apps/server/src/lib/aiTraceLogger.ts) — include `promptVersion`, `fallbackUsed`, `errorCode` (non-PII).

## Example PromQL (Grafana / Prometheus)

**Recovery share (miniscript, rough):**

```promql
sum(rate(joyjoin_ai_provider_recovery_total{domain="miniscript"}[5m]))
/
sum(rate(joyjoin_ai_calls_total{domain="miniscript"}[5m]))
```

**Icebreaker LLM fallbacks (any reason — stub, parse, or provider swap):**

```promql
sum(rate(joyjoin_ai_calls_total{domain="icebreaker",outcome="fallback"}[5m]))
```

**p95 latency (miniscript feature):**

```promql
histogram_quantile(0.95,
  sum(rate(joyjoin_ai_call_latency_ms_bucket{domain="miniscript",feature="generateMiniScriptFramework"}[5m])) by (le)
)
```

Tune histogram buckets in code if your p95s exceed the largest bucket.

## Suggested alerts (starting points)

| Alert | Condition | Action |
| --- | --- | --- |
| High fallback rate | `rate(joyjoin_ai_calls_total{domain="icebreaker",outcome="fallback"}[15m]) > N` | Check provider keys, MiniMax status, `extractLlmJson` parse errors in logs. |
| Sustained recovery | `rate(joyjoin_ai_provider_recovery_total[15m]) > M` | Primary (MiniMax) unhealthy for structured JSON — review prompts, `max_tokens`, timeouts. |
| Latency SLO | p95 from histogram vs budget | Scale or tune `max_tokens` / timeouts only after confirming truncation in traces. |

Replace `N` / `M` with baselines from staging after a week of traffic.

## Related docs

- [`docs/product/product/LAUNCH_CONFIG.md`](../product/LAUNCH_CONFIG.md) — API keys and degraded (MiniMax-only) posture.
- [`.github/skills/social-icebreaker-domain/references/production-ai-surfaces.md`](../../.github/skills/social-icebreaker-domain/references/production-ai-surfaces.md) — phase → generator → `promptVersion` map.
- [`docs/ops/icebreaker-ai-quality-protocol.md`](./icebreaker-ai-quality-protocol.md) — human ratings, `aiCorrelationId`, and admin aggregates.
