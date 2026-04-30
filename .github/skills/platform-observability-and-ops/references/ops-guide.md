# Observability Ops Guide

## Logger field tables

Log record fields: `level`, `time`, `msg`, `request_id` (when available), plus context fields.

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

## Request ID propagation

- `requestId` middleware is registered globally — it sets `req.requestId` on every request
- Use `logger.child({ request_id: req.requestId })` to bind the request ID to all log lines for that handler
- Pass the request ID to downstream service calls when available, so logs can be correlated

## Metric name lists

- HTTP request metrics (count, duration, status) are emitted by `middleware/metrics.ts`
- For domain-specific metrics (e.g. match count, payment success rate), add a counter or histogram via the metrics module
- Metrics are scraped at `GET /api/metrics` by Prometheus
- Review `infra/prometheus/prometheus.yml` for scrape config and `infra/alerting/rules.yml` for alert rules

## Alert configuration

1. Add a counter/histogram in `middleware/metrics.ts` or near the call site
2. Expose it via `GET /api/metrics`
3. Add an alert rule in `infra/alerting/rules.yml` if it maps to a SLO threshold
4. Document the intent in `docs/observability.md` — Runbooks section

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

## Health and readiness

- `GET /api/health` returns `{ status: 'ok' }` when the server is healthy
- `GET /api/readyz` is the readiness probe — it verifies database and config readiness before returning 200
- Health check must not perform heavy computation or block on external services
- The synthetic probe script (`scripts/synthetic/happy-path-probe.mjs`) runs on a 5-minute schedule via GitHub Actions

### MCP integration

- **Observability MCP:** Use the **JoyJoin Observability MCP server** (`observability`) to run health checks (`/api/health`, `/api/readyz`), query Prometheus metrics (`/api/metrics`), and execute the synthetic happy-path probe on demand.

## Runbook templates

- `request_id` is missing from log lines → the route handler is not creating a child logger
- Metric is not appearing in `GET /api/metrics` output → the counter/histogram was added near the call site but not registered in `middleware/metrics.ts`
- Health check is timing out → `GET /api/health` must not perform database or external service calls; move verification logic to `GET /api/readyz`
- Audit log entry is missing for an admin action → `logAdminAudit()` was not called after a sensitive admin mutation
