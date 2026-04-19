# Observability Operations Runbook

> **Audience:** Platform team and on-call engineers.  
> This runbook covers day-2 operations for the JoyJoin observability stack:
> how to start/stop components, verify health, add new observability, and
> troubleshoot common problems.

---

## Table of Contents

1. [Starting the observability stack](#1-starting-the-observability-stack)
2. [Verifying logs reach Loki](#2-verifying-logs-reach-loki)
3. [Verifying metrics reach Prometheus](#3-verifying-metrics-reach-prometheus)
4. [Grafana access and dashboard import](#4-grafana-access-and-dashboard-import)
5. [Adding a new structured log field](#5-adding-a-new-structured-log-field)
6. [Adding a new metric](#6-adding-a-new-metric)
7. [Adding a new alert](#7-adding-a-new-alert)
8. [Updating the synthetic probe](#8-updating-the-synthetic-probe)
9. [Log retention and storage](#9-log-retention-and-storage)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Starting the observability stack

```bash
# From the repository root
docker compose -f infra/docker-compose.observability.yml up -d

# Check all containers are healthy
docker compose -f infra/docker-compose.observability.yml ps
```

**URLs after startup:**

| Service | URL | Default credentials |
|---------|-----|---------------------|
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | — |
| Alertmanager | http://localhost:9093 | — |
| Loki | http://localhost:3100 | — |
| Promtail | http://localhost:9080 | — |

> Change the Grafana admin password on first login.
> Set `GRAFANA_ADMIN_PASSWORD` in your environment before starting if you want
> to override the default.

---

## 2. Verifying logs reach Loki

### Step 1 — Confirm the JoyJoin server emits structured JSON

```bash
# If you run the API directly on the host, this verifies JSON log formatting only.
node --import tsx/esm apps/server/src/index.ts 2>&1 | head -5
```

Each line should be valid JSON:
```json
{"timestamp":"2026-04-01T09:00:00.000Z","level":"info","service":"joyjoin-server","message":"JoyJoin Server started","port":5001}
```

### Step 2 — Confirm Promtail is scraping

> **Important:** the current Promtail configuration uses `docker_sd_configs`, so
> Loki ingestion verification requires the JoyJoin API to be running in Docker
> (for example via `deployment/docker-compose.nginx.yml`, where the backend
> container is `joyjoin-api`). A host-run `node ... apps/server/src/index.ts`
> process will not be discovered by Promtail.

```bash
# Start the deployed stack (or at minimum the API container) so Promtail can
# discover Docker logs from `joyjoin-api`.
docker compose -f deployment/docker-compose.nginx.yml up -d api

curl http://localhost:9080/targets | python3 -m json.tool | grep joyjoin
```

### Step 3 — Confirm Loki has received data

```bash
# List labels
curl 'http://localhost:3100/loki/api/v1/labels' | python3 -m json.tool

# Query recent logs (last 5 minutes)
curl -G 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={service="joyjoin-server"}' \
  --data-urlencode "start=$(date -u -d '5 minutes ago' +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode 'limit=20' \
  | python3 -m json.tool
```

### Step 4 — Grafana Explore

1. Open http://localhost:3000 → Explore → select **Loki** datasource.
2. Enter query: `{service="joyjoin-server"}` and click **Run query**.
3. Log lines should appear within a few seconds of the server handling a request.

---

## 3. Verifying metrics reach Prometheus

### Step 1 — Confirm the /api/metrics endpoint returns data

```bash
curl http://localhost:5001/api/metrics | head -30
```

Expected output starts with:
```
# HELP http_requests_total Total number of HTTP requests.
# TYPE http_requests_total counter
```

### Step 2 — Check Prometheus scrape status

1. Open http://localhost:9090/targets.
2. The `joyjoin_server` target should show **State: UP**.
3. If it shows **DOWN**, check the target URL in `infra/prometheus/prometheus.yml`
   matches the actual server address from the Prometheus container's perspective.

### Step 3 — Query a metric in Prometheus UI

1. Open http://localhost:9090/graph.
2. Enter: `http_requests_total{job="joyjoin_server"}` and press Execute.
3. Data should appear after Prometheus has scraped at least once (≤ 15 s after the first request).

---

## 4. Grafana access and dashboard import

The Grafana dashboard is **auto-provisioned** when using the Docker Compose setup
(via `infra/grafana/provisioning/dashboards/`).

To manually import the dashboard:
1. Open http://localhost:3000 → Dashboards → Import.
2. Upload `infra/grafana/dashboards/joyjoin-server-overview.json`.
3. Select **Prometheus** as the Prometheus datasource and **Loki** as the Loki datasource.
4. Click **Import**.

---

## 5. Adding a new structured log field

1. Call `logger.info` / `logger.warn` / `logger.error` with an extra context object:
   ```typescript
   logger.info('Event pool finalized', {
     poolId,
     groupCount,
     matchDurationMs,
   });
   ```

2. The field will appear in Loki automatically once Promtail parses the JSON.

3. To **filter** on the new field in Grafana Explore:
   ```logql
   {service="joyjoin-server"} | json | poolId = "pool-123"
   ```

4. To **create a Grafana panel** from a log-derived metric:
   - Grafana Explore → Loki → enable **Metrics** mode.
   - Example: `count_over_time({service="joyjoin-server"} | json | message="Event pool finalized" [1m])`

---

## 6. Adding a new metric

The current implementation uses a hand-rolled Prometheus text exporter in
`apps/server/src/middleware/metrics.ts` that tracks HTTP request counters and
histograms.

For **business-level counters** (e.g. "user registrations"), the simplest approach
is to emit a structured log line and create a Loki-derived metric in Grafana
(see section 5 above).

For **low-level performance counters** that need Prometheus labels:
1. Add a new `Map<string, CounterEntry>` or `Map<string, HistogramEntry>` in
   `middleware/metrics.ts`.
2. Expose increment helpers following the existing pattern.
3. Add a `renderCounter()` or `renderHistogram()` call in `getMetricsText()`.
4. Write a unit test in `src/__tests__/metrics.test.ts`.
5. Add the metric to the Grafana dashboard JSON and a PromQL alert if needed.

---

## 7. Adding a new alert

1. Add a new rule block to `infra/alerting/rules.yml`:
   ```yaml
   - alert: MyNewAlert
     expr: <promql>
     for: 5m
     labels:
       severity: warning
       team: platform
     annotations:
       summary: "Short description"
       description: "Longer description with {{ $value }}"
       runbook_url: "https://github.com/.../docs/runbooks/alerting.md#mynewAlert"
   ```

2. Reload Prometheus:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

3. Test the alert fires correctly by temporarily lowering the threshold and
   checking Prometheus UI → Alerts tab.

4. Document the alert in `docs/runbooks/alerting.md` following the existing pattern.

5. Update `infra/alerting/alertmanager.yml` if the alert needs a different
   notification receiver.

---

## 8. Updating the synthetic probe

The probe is defined in `scripts/synthetic/happy-path-probe.mjs`.

To add a new probe step:
```javascript
const PROBES = [
  // ... existing probes ...
  {
    name: 'new_critical_endpoint',
    url: `${BASE_URL}/api/new-endpoint`,
    opts: { expectedStatus: 200, expectedBodyContains: 'expected_field' },
  },
];
```

Re-test locally:
```bash
BASE_URL=http://localhost:5001 node scripts/synthetic/happy-path-probe.mjs
```

The GitHub Actions workflow (`.github/workflows/synthetic-probe.yml`) will pick
up the change automatically on the next scheduled run.

---

## 9. Log retention and storage

**Loki** is configured to retain logs for **30 days** (`retention_period: 720h`
in `infra/loki/loki.yml`). Adjust as needed for compliance requirements.

Loki data is stored in the `loki_data` Docker volume. To inspect the volume:
```bash
docker volume inspect joyjoin_loki_data
```

For production deployments, consider using Loki's S3 or GCS object store backend
instead of the filesystem to avoid disk pressure.

---

## 10. Troubleshooting

### Grafana shows "No data" for Prometheus panels

- Check that Prometheus is scraping successfully (http://localhost:9090/targets).
- Verify the `job` label in PromQL matches the `job_name` in `prometheus.yml` (`joyjoin_server`).
- Ensure the server has received at least one HTTP request (metrics are counters; no requests = no data).

### Logs not appearing in Loki

- Check Promtail is running: `docker compose -f infra/docker-compose.observability.yml ps promtail`.
- Check Promtail logs for parse errors: `docker logs joyjoin_promtail --tail 50`.
- Verify the JoyJoin container name matches the Promtail `filters.name` value in `promtail.yml`.
- Ensure the server emits valid single-line JSON (no pretty-printed multi-line output).

### Alert not firing

- Verify the PromQL expression returns data in Prometheus UI → Graph.
- Check Prometheus UI → Alerts tab for the alert state (Inactive / Pending / Firing).
- Ensure `rule_files` in `prometheus.yml` points to `rules.yml`.

### Metrics endpoint returns empty body

- Confirm `metricsMiddleware` is imported and `app.use(metricsMiddleware)` appears
  before route registration in `apps/server/src/index.ts`.
- Confirm `app.get('/api/metrics', ...)` is registered in `apps/server/src/routes/domains/analytics.ts` and mounted via the composition root in `apps/server/src/routes.ts`.
- The endpoint emits data only after at least one request has been instrumented.

### Synthetic probe fails in GitHub Actions but server is healthy

- Check whether the workflow is using the default target (`https://api.yuejuapp.com`) or a `PRODUCTION_BASE_URL` override, and confirm that URL is the reachable API base.
- Check network connectivity from GitHub Actions runner to the production endpoint.
- Trailing slashes are trimmed automatically by the probe script, so focus on host/path correctness.
- Verify the probe timeout (`PROBE_TIMEOUT_MS`) is large enough for production latency.
