# JoyJoin Observability Guide

> **Issue reference:** Resolves [#393 — \[LAUNCH BLOCKER\] Observability and operational monitoring not sufficient for internal beta readiness](https://github.com/JoyJoin-Tech-Limited/JoyJoin_app_v0.1/issues/393)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Structured Logging](#2-structured-logging)
3. [Metrics Collection](#3-metrics-collection)
4. [Dashboards](#4-dashboards)
5. [Alerting](#5-alerting)
6. [Synthetic Monitoring](#6-synthetic-monitoring)
7. [How to Add New Metrics or Alerts](#7-how-to-add-new-metrics-or-alerts)
8. [Querying Logs](#8-querying-logs)
9. [Error Dashboard Usage](#9-error-dashboard-usage)
10. [Runbooks](#10-runbooks)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  JoyJoin Server (Node.js + Express)                              │
│                                                                  │
│  apps/server/src/lib/logger.ts          → Structured JSON logs  │
│  apps/server/src/middleware/requestId.ts → Correlation IDs      │
│  apps/server/src/middleware/metrics.ts  → Prometheus counters   │
│  GET /api/health                        → Health check          │
│  GET /api/metrics                       → Prometheus scrape      │
└────────────────────┬─────────────────────────────┬──────────────┘
                     │ stdout/stderr JSON           │ HTTP scrape
                     ▼                             ▼
              ┌────────────┐              ┌──────────────────┐
              │   Promtail  │              │   Prometheus      │
              │  (log ship) │              │   (metrics TSDB)  │
              └──────┬─────┘              └────────┬─────────┘
                     │                             │
                     ▼                             ▼
              ┌────────────┐              ┌──────────────────┐
              │    Loki     │              │  Alertmanager     │
              │  (log TSDB) │              │  (route alerts)   │
              └──────┬─────┘              └────────┬─────────┘
                     │                             │ Slack / PagerDuty
                     ▼                             │
              ┌────────────────────────────────────┤
              │         Grafana                    │
              │  (dashboards, log search, alerts)  │
              └────────────────────────────────────┘

scripts/synthetic/happy-path-probe.mjs
  └── GitHub Actions schedule (*/5 * * * *)
         └── Probe /api/health, /api/metrics, /api/auth/user
```

**Key files:**

| File | Purpose |
|------|---------|
| `apps/server/src/lib/logger.ts` | Reusable structured JSON logger |
| `apps/server/src/middleware/requestId.ts` | Request correlation ID middleware |
| `apps/server/src/middleware/metrics.ts` | Prometheus-style metrics middleware |
| `infra/docker-compose.observability.yml` | Spin up the full observability stack locally |
| `infra/prometheus/prometheus.yml` | Prometheus scrape config |
| `infra/alerting/rules.yml` | Prometheus alerting rules |
| `infra/alerting/alertmanager.yml` | Alertmanager routing and receivers |
| `infra/grafana/dashboards/joyjoin-server-overview.json` | Grafana dashboard |
| `infra/loki/loki.yml` | Loki storage config |
| `infra/loki/promtail.yml` | Promtail log shipper config |
| `scripts/synthetic/happy-path-probe.mjs` | Synthetic monitoring script |
| `.github/workflows/synthetic-probe.yml` | Scheduled synthetic probe workflow |

---

## 2. Structured Logging

### Logger utility

All backend services should use the shared logger from `apps/server/src/lib/logger.ts`.

```typescript
import { logger } from '../lib/logger';

// Basic usage
logger.info('Event pool matched', { poolId: 'pool-123', groupCount: 4 });
logger.warn('Rate limit approaching', { userId: 'u-456', remaining: 5 });
logger.error('Payment webhook failed', { orderId: 'ord-789', error: err.message });

// Per-request child logger (includes request_id automatically)
const reqLogger = logger.child({ request_id: req.requestId });
reqLogger.info('Processing registration', { eventId });
```

### Log record shape

Every emitted line is a single-line JSON object:

```json
{
  "timestamp": "2026-04-01T09:00:00.000Z",
  "level": "info",
  "service": "joyjoin-server",
  "message": "HTTP request",
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "POST",
  "path": "/api/events",
  "status_code": 201,
  "duration_ms": 45
}
```

### Log levels

| Level | Destination | When to use |
|-------|-------------|-------------|
| `debug` | stdout | Verbose diagnostic info, disabled in production by default |
| `info` | stdout | Normal operational events (requests, startup, etc.) |
| `warn` | stderr | Recoverable issues or approaching limits |
| `error` | stderr | Failures that require attention |

Set `LOG_LEVEL=debug` in `.env` to enable debug output.

### Request correlation IDs

The `requestIdMiddleware` (mounted first in `index.ts`) attaches a UUID to every
incoming request as `req.requestId` and echoes it in the `X-Request-Id` response
header.  Upstream proxies (Caddy, Nginx, ALB) can propagate their own trace ID
by setting the `X-Request-Id` request header.

To filter all log lines for a single request in Loki:

```logql
{service="joyjoin-server"} | json | request_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Log aggregation setup

1. Start the observability stack:
   ```bash
   docker compose -f infra/docker-compose.observability.yml up -d
   ```

2. Verify Promtail is ingesting logs:
   ```bash
   # Check Promtail targets
   curl http://localhost:9080/targets
   # Check Loki has received streams
   curl 'http://localhost:3100/loki/api/v1/labels'
   ```

3. In Grafana → Explore → select **Loki** datasource → query:
   ```logql
   {service="joyjoin-server"}
   ```

---

## 3. Metrics Collection

### What is collected

The `metricsMiddleware` (mounted in `index.ts`) instruments every Express request:

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | `method`, `path`, `status_code` |
| `http_request_duration_ms` | Histogram | `method`, `path`, `status_code` |
| `http_errors_total` | Counter | `method`, `path`, `status_code` |
| `process_resident_memory_bytes` | Gauge | — |
| `process_heap_used_bytes` | Gauge | — |
| `process_heap_total_bytes` | Gauge | — |
| `process_cpu_user_seconds_total` | Gauge | — |
| `process_cpu_system_seconds_total` | Gauge | — |
| `process_uptime_seconds` | Gauge | — |
| `nodejs_event_loop_delay_ms` | Gauge | — |

### Matching-specific metrics (`apps/server/src/matchingMetrics.ts`)

Emitted during pool matching runs (appended to the `/api/metrics` scrape endpoint):

| Metric | Type | Labels | Source |
|--------|------|--------|--------|
| `joyjoin_matching_semantic_similarity_score` | Histogram | — | Raw semantic score per user pair; active only when `ENABLE_SEMANTIC_SIMILARITY=true` |
| `joyjoin_matching_semantic_pair_score_delta` | Histogram | — | Score delta introduced by enabling the 7th dimension; bucket bounds: −5, 0, 5, 10, 20 |
| `joyjoin_matching_semantic_feature_enabled` | Gauge | — | `1` when `ENABLE_SEMANTIC_SIMILARITY=true`, `0` otherwise |

### LLM fallback inference metrics (`apps/server/src/middleware/metrics.ts`)

Emitted for shadow and runtime LLM attribute inference calls:

| Metric | Type | Labels | Source |
|--------|------|--------|--------|
| `llm_fallback_inference_requests_total` | Counter | `provider`, `mode`, `success` | Shadow inference call completions (per provider / mode / success tuple) |
| `llm_fallback_inference_latency_ms` | Histogram | `provider`, `mode`, `success` | Per-call latency for shadow LLM fallback calls |
| `llm_fallback_inference_estimated_cost_usd_total` | Counter | `provider`, `mode` | Estimated USD cost of shadow LLM fallback inference |
| `inference_runtime_llm_fallback_total` | Counter | `field`, `outcome` | Runtime (live) LLM fallback calls — emitted when a bounded field uses the LLM path |

Path segments that are numeric IDs or UUID v4 values are automatically normalised
to `:id` to prevent cardinality explosion (e.g. `/api/events/123` → `/api/events/:id`).

### Scraping

Prometheus scrapes `GET /api/metrics` every 15 seconds (configurable in
`infra/prometheus/prometheus.yml`).

Verify the endpoint is accessible:
```bash
curl http://localhost:5001/api/metrics | head -30
```

---

## 4. Dashboards

### JoyJoin Server Overview

Location: `infra/grafana/dashboards/joyjoin-server-overview.json`

Panels:
- **Request Rate (req/s)** — aggregate and per-endpoint traffic
- **Error Rate by Status Class** — 4xx and 5xx trends
- **Request Latency Percentiles** — p50 / p95 / p99
- **Memory Usage** — RSS, heap used, heap total
- **CPU Utilisation** — user + system CPU
- **Node.js Event Loop Delay**
- **Error & Warning Logs** — live Loki log stream filtered to `level=~"error|warn"`

### Importing the dashboard

1. Open Grafana at http://localhost:3000
2. Navigate to **Dashboards → Import**
3. Upload `infra/grafana/dashboards/joyjoin-server-overview.json`
4. Select the **Prometheus** and **Loki** datasources when prompted

When using `docker-compose.observability.yml`, the dashboard is auto-provisioned
via `infra/grafana/provisioning/dashboards/`.

---

## 5. Alerting

Alert rules live in `infra/alerting/rules.yml`. See the [Alerting Runbook](runbooks/alerting.md)
for the complete list of alerts, thresholds, and response procedures.

**Active alerts:**

| Alert | Severity | Condition |
|-------|----------|-----------|
| `JoyJoinServiceDown` | critical | No metrics received for 2 min |
| `JoyJoinHighErrorRate` | critical | 5xx rate > 1% over 5 min |
| `JoyJoinElevated4xxRate` | warning | 4xx rate > 5% over 10 min |
| `JoyJoinHighLatency` | warning | p95 > 1500 ms for 5 min |
| `JoyJoinHighMemory` | warning | RSS > 768 MB for 10 min |
| `JoyJoinHighCPU` | warning | CPU > 85% for 10 min |
| `JoyJoinSyntheticProbeFailed` | critical | Synthetic probe fails for 5 min |

Alerts are routed through Alertmanager (`infra/alerting/alertmanager.yml`).
Configure Slack webhooks or PagerDuty integration keys as environment variables —
see `alertmanager.yml` for receiver templates.

---

## 6. Synthetic Monitoring

**Script:** `scripts/synthetic/happy-path-probe.mjs`

**Probed flow:**
1. `GET /api/health` — expects `200` + `"status":"ok"`
2. `GET /api/metrics` — expects `200` + Prometheus text body
3. `GET /api/auth/user` — expects `401` (auth middleware reachable)

**How to run locally:**
```bash
BASE_URL=http://localhost:5001 node scripts/synthetic/happy-path-probe.mjs
```

**GitHub Actions schedule** (`.github/workflows/synthetic-probe.yml`):
- Runs every 5 minutes via cron.
- Targets `https://api.yuejuapp.com` by default, matching the active production deployment entrypoint.
- Supports overriding the target with the `PRODUCTION_BASE_URL` repository secret or the manual `workflow_dispatch` input.
- Optionally posts results to a Prometheus Pushgateway (`PUSHGATEWAY_URL` secret).
- Logs a workflow error and exposes the `JoyJoinSyntheticProbeFailed` Prometheus
  gauge (via Pushgateway) when any probe fails.

---

## 7. How to Add New Metrics or Alerts

### Adding a custom metric

1. Import `metricsMiddleware` helpers — or create a standalone counter by
   extending `apps/server/src/middleware/metrics.ts` if you need route-specific
   counters.

2. For business metrics (e.g. "registrations per minute"), emit a log line with
   a well-known field and create a Loki-derived metric in Grafana:
   ```typescript
   logger.info('User registered', { event: 'user_registration', userId });
   ```
   Then in Grafana → Explore → Loki → create a **Metric** panel using
   `count_over_time({service="joyjoin-server"} | json | event="user_registration" [1m])`.

### Adding a new alert

1. Add a rule block to `infra/alerting/rules.yml`.
2. Reload Prometheus: `curl -X POST http://localhost:9090/-/reload`
3. Document the alert in `docs/runbooks/alerting.md`.
4. Test with Prometheus UI → Alerts tab.

---

## 8. Querying Logs

### Loki / LogQL examples

```logql
# All logs from the server
{service="joyjoin-server"}

# All error logs
{service="joyjoin-server"} | json | level = "error"

# Logs for a specific request
{service="joyjoin-server"} | json | request_id = "<uuid>"

# Slow requests (> 500 ms)
{service="joyjoin-server"} | json | duration_ms > 500

# Errors in the last 10 minutes
{service="joyjoin-server"} | json | level = "error" | __error__=""
```

### Prometheus / PromQL examples

```promql
# Request rate over 1 minute
sum(rate(http_requests_total{job="joyjoin_server"}[1m]))

# 5xx error rate
sum(rate(http_errors_total{job="joyjoin_server", status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total{job="joyjoin_server"}[5m]))

# p95 latency by endpoint
histogram_quantile(0.95,
  sum(rate(http_request_duration_ms_bucket{job="joyjoin_server"}[5m])) by (le, path)
)
```

---

## 9. Error Dashboard Usage

The **JoyJoin Server Overview** Grafana dashboard includes an **Error & Warning Logs**
panel (Loki) at the bottom that surfaces the most recent error and warning log lines.

To investigate an incident:
1. Note the approximate time range of the incident.
2. Open the dashboard and set the time picker to that range.
3. In the **Error & Warning Logs** panel, click a log line to expand the full record
   and copy the `request_id`.
4. Open **Explore → Loki** and filter by that `request_id` to see the full request trace.
5. Cross-reference with the **Error Rate** and **Latency** panels to understand impact.

---

## 10. Runbooks

- [Observability Runbook](runbooks/observability.md) — architecture, day-2 ops
- [Alerting Runbook](runbooks/alerting.md) — per-alert response procedures
