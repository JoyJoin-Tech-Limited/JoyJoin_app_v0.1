---
name: platform-observability-and-ops
description: >
  Structured logging, request IDs, metrics, health/readiness, alerts, synthetic monitoring, and
  audit logging as operational telemetry. Use when instrumenting new server code, adding metrics,
  or reviewing operational readiness. Trigger phrases: "add logging to this route", "instrument a
  metric", "add an alert", "health vs readiness check", "audit log an admin action".
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
| `apps/server/src/lib/logger.ts` | Structured JSON logger (shared across all server code) |
| `apps/server/src/middleware/requestId.ts` | Request correlation ID — attaches `req.requestId` |
| `apps/server/src/middleware/metrics.ts` | Prometheus-style request metrics |
| `apps/server/src/lib/adminAuditLogger.ts` | Admin action audit log |
| `apps/server/src/lib/aiTraceLogger.ts` | AI response trace logger |
| `GET /api/health` | Health check endpoint |
| `GET /api/metrics` | Prometheus scrape endpoint |
| `scripts/synthetic/happy-path-probe.mjs` | Synthetic monitoring script |
| `infra/` | Prometheus, Alertmanager, Grafana, Loki, Promtail configs |

## Structured logging

Always use the shared logger — never `console.log` in production server code.

```typescript
import { logger } from '../lib/logger';

// Simple event
logger.info('Pool matched', { poolId, groupCount });

// Per-request child logger (includes request_id automatically)
const reqLogger = logger.child({ request_id: req.requestId });
reqLogger.info('Processing registration', { eventId, userId });

// Error with context
logger.error('Payment webhook failed', { orderId, error: err.message });
```

Log record fields: `level`, `time`, `msg`, `request_id` (when available), plus context fields.

## Request correlation IDs

- `requestId` middleware is registered globally — it sets `req.requestId` on every request
- Use `logger.child({ request_id: req.requestId })` to bind the request ID to all log lines for that handler
- Pass the request ID to downstream service calls when available, so logs can be correlated

## Metrics

- HTTP request metrics (count, duration, status) are emitted by `middleware/metrics.ts`
- For domain-specific metrics (e.g. match count, payment success rate), add a counter or histogram via the metrics module
- Metrics are scraped at `GET /api/metrics` by Prometheus
- Review `infra/prometheus/prometheus.yml` for scrape config and `infra/alerting/rules.yml` for alert rules

## Health and readiness

- `GET /api/health` returns `{ status: 'ok' }` when the server is healthy
- `GET /api/readyz` is the readiness probe — it verifies database and config readiness before returning 200
- Health check must not perform heavy computation or block on external services
- The synthetic probe script (`scripts/synthetic/happy-path-probe.mjs`) runs on a 5-minute schedule via GitHub Actions

### MCP integration

- **Observability MCP:** Use the **JoyJoin Observability MCP server** (`observability`) to run health checks (`/api/health`, `/api/readyz`), query Prometheus metrics (`/api/metrics`), and execute the synthetic happy-path probe on demand. This is the fastest way to verify server state before and after infrastructure changes.

## Audit logging

Admin and sensitive operations must emit an audit log entry:

```typescript
import { logAdminAudit } from '../lib/adminAuditLogger';

logAdminAudit({
  adminId: req.adminAccount.id,
  adminRole: req.adminAccount.role,
  action: 'EVENT_POOL_STATUS_CHANGED',
  targetEntityType: 'event_pool',
  targetEntityId: poolId,
  context: { groupCount },
});
```

Audit logs are distinct from application logs — they record *who did what* to *what*, not system events.

## AI trace logging

AI service call sites should emit a structured trace:

```typescript
import { logAITrace } from '../lib/aiTraceLogger';

logAITrace({
  domain: 'match_explanation',
  feature: 'generatePairExplanation',
  provider,
  model,
  latencyMs: Date.now() - startedAt,
  success: true,
  fallbackUsed: false,
  fromCache,
  promptVersion,
});
```

`logAITrace` emits `[AITrace] {json}` single-line structured log entries — do not use ad-hoc `console.log` for AI calls.

## Adding a new metric or alert

1. Add a counter/histogram in `middleware/metrics.ts` or near the call site
2. Expose it via `GET /api/metrics`
3. Add an alert rule in `infra/alerting/rules.yml` if it maps to a SLO threshold
4. Document the intent in `docs/observability.md` — Runbooks section

## Common mistakes to avoid

- Using `console.log` instead of the shared logger
- Not including `request_id` in per-request log lines
- Treating `/api/health` as a readiness probe — database and config verification belong in `/api/readyz`
- Adding metrics but no alert rule for a critical path
- Performing audit-worthy admin actions without an audit log entry
- Logging sensitive data (session tokens, WeChat codes, payment tokens) in log fields

## Related files

- `apps/server/src/lib/logger.ts`
- `apps/server/src/middleware/requestId.ts`
- `apps/server/src/middleware/metrics.ts`
- `apps/server/src/lib/adminAuditLogger.ts`
- `apps/server/src/lib/aiTraceLogger.ts`
- `infra/docker-compose.observability.yml`
- `infra/alerting/rules.yml`
- `scripts/synthetic/happy-path-probe.mjs`
- `docs/observability.md` — full observability guide and runbooks

## Quick examples

**User says:** "Add structured logging to the new `POST /api/events/:id/publish` route."
**Apply this skill by:** Importing `logger` from `lib/logger.ts`, creating a child logger with `logger.child({ request_id: req.requestId })`, and emitting `info` on success and `error` with the `err.message` on failure. Never use `console.log`.
**Result:** Every request is traceable by `request_id`; errors have full context for debugging.

---

**User says:** "Add a metric to track how many matches are made per pool run."
**Apply this skill by:** Adding a Prometheus counter in `middleware/metrics.ts`, incrementing it in `poolMatchingService.ts` after a successful group formation, exposing it via `GET /api/metrics`, and adding an alert rule in `infra/alerting/rules.yml` if it maps to an SLO.
**Result:** Match volume is measurable in Grafana; alerts fire if the rate drops unexpectedly.

## Troubleshooting

- **`request_id` is missing from log lines** — the route handler is not creating a child logger. Use `logger.child({ request_id: req.requestId })` per request instead of the root `logger` directly.
- **Metric is not appearing in `GET /api/metrics` output** — the counter/histogram was added near the call site but not registered in `middleware/metrics.ts`. Move registration to the metrics module or confirm the registry import is correct.
- **Health check is timing out** — `GET /api/health` must not perform database or external service calls. Move verification logic to `GET /api/readyz`.
- **Audit log entry is missing for an admin action** — `logAdminAudit()` was not called after a sensitive admin mutation. Add it with the correct `action`, `targetEntityType`, and `targetEntityId`.

## Review checklist

- [ ] All production server code uses `logger` from `lib/logger.ts` — no `console.log`
- [ ] Per-request log lines use a child logger bound to `req.requestId`
- [ ] New domain metrics are registered in `middleware/metrics.ts` and exposed at `/api/metrics`
- [ ] `GET /api/health` does not touch the database — verification is in `/api/readyz`
- [ ] Admin and sensitive operations emit an `adminAuditLogger` entry
- [ ] No sensitive values (tokens, codes, secrets) appear in log fields
