---
name: platform-observability-and-ops
description: >
  Structured logging, request IDs, metrics, health/readiness, alerts, synthetic
  monitoring, and audit logging as operational telemetry. Use when instrumenting
  new server code, adding metrics, or reviewing operational readiness.
  Trigger phrases: "add logging to this route", "instrument a metric",
  "add an alert", "health vs readiness check", "audit log an admin action".
---

# Platform Observability and Ops

**Core rule:** Every production server action must be observable. Use the shared logger with structured fields. Attach the request ID. Add metrics for operations that matter for SLOs.

## When to use this skill

- Adding a new server route or service
- Instrumenting an existing route that has no logging
- Adding or reviewing health/readiness checks
- Setting up alerts for a new critical path
- Adding an audit log entry for an admin or sensitive operation

## Key files

| File | Purpose |
|------|---------|
| `apps/server/src/lib/logger.ts` | Structured JSON logger |
| `apps/server/src/middleware/requestId.ts` | Request correlation ID |
| `apps/server/src/middleware/metrics.ts` | Prometheus-style request metrics |
| `apps/server/src/lib/adminAuditLogger.ts` | Admin action audit log |
| `GET /api/health` | Health check endpoint |
| `GET /api/metrics` | Prometheus scrape endpoint |

## Structured logging overview

Always use the shared logger — never `console.log` in production server code.

```typescript
import { logger } from '../lib/logger';
logger.info('Pool matched', { poolId, groupCount });
const reqLogger = logger.child({ request_id: req.requestId });
reqLogger.info('Processing registration', { eventId, userId });
```

## Metric categories

- HTTP request metrics (count, duration, status) are emitted by `middleware/metrics.ts`
- Domain-specific metrics (match count, payment success rate) use counters/histograms
- Metrics are scraped at `GET /api/metrics` by Prometheus

For logger field tables, metric name lists, alert configuration, runbook templates, request ID propagation details, AI trace logging, and audit logging examples — see [references/ops-guide.md](references/ops-guide.md).

## Quick examples

**User says:** "Add structured logging to the new `POST /api/events/:id/publish` route."
**Apply this skill by:** Importing `logger` from `lib/logger.ts`, creating a child logger with `logger.child({ request_id: req.requestId })`, and emitting `info` on success and `error` with the `err.message` on failure.
**Result:** Every request is traceable by `request_id`; errors have full context for debugging.

---

**User says:** "Add a metric to track how many matches are made per pool run."
**Apply this skill by:** Adding a Prometheus counter in `middleware/metrics.ts`, incrementing it in `poolMatchingService.ts` after a successful group formation, exposing it via `GET /api/metrics`, and adding an alert rule in `infra/alerting/rules.yml` if it maps to an SLO.
**Result:** Match volume is measurable in Grafana; alerts fire if the rate drops unexpectedly.

## Troubleshooting

- **`request_id` is missing from log lines** — the route handler is not creating a child logger. Use `logger.child({ request_id: req.requestId })` per request instead of the root `logger` directly.
- **Metric is not appearing in `GET /api/metrics` output** — the counter/histogram was added near the call site but not registered in `middleware/metrics.ts`.
- **Health check is timing out** — `GET /api/health` must not perform database or external service calls. Move verification logic to `GET /api/readyz`.
- **Audit log entry is missing for an admin action** — `logAdminAudit()` was not called after a sensitive admin mutation. Add it with the correct `action`, `targetEntityType`, and `targetEntityId`.

## Review checklist

- [ ] All production server code uses `logger` from `lib/logger.ts` — no `console.log`
- [ ] Per-request log lines use a child logger bound to `req.requestId`
- [ ] New domain metrics are registered in `middleware/metrics.ts` and exposed at `/api/metrics`
- [ ] `GET /api/health` does not touch the database — verification is in `/api/readyz`
- [ ] Admin and sensitive operations emit an `adminAuditLogger` entry
- [ ] No sensitive values (tokens, codes, secrets) appear in log fields
