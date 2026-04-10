# Alerting Runbook

> **Scope:** Describes every Prometheus alert defined in
> `infra/alerting/rules.yml`, the expected automated response, and the
> manual remediation steps.
>
> **Audience:** On-call engineers and platform team members.

---

## Table of Contents

1. [General principles](#general-principles)
2. [Alerts](#alerts)
   - [JoyJoinServiceDown](#joyjoinservicedown)
   - [JoyJoinHighErrorRate](#joyjoinhigherrorrate)
   - [JoyJoinElevated4xxRate](#joyjoinelevated4xxrate)
   - [JoyJoinHighLatency](#joyjoinhighlatency)
   - [JoyJoinHighMemory](#joyjoinhighmemory)
   - [JoyJoinHighCPU](#joyjoinhighcpu)
   - [JoyJoinSyntheticProbeFailed](#joyjoinsyntheticprobefailed)
3. [How to silence an alert](#how-to-silence-an-alert)
4. [Escalation path](#escalation-path)

---

## General principles

1. **Check the Grafana dashboard first.** Open the [JoyJoin Server Overview](http://localhost:3000/d/joyjoin-server-overview) dashboard and inspect the panels that correspond to the firing alert.
2. **Correlate with logs.** Use the Loki datasource in Grafana Explore or the Loki HTTP API to query recent error logs.
3. **Do not silence an alert without understanding root cause.** Silencing is appropriate for planned maintenance only.
4. **Update this runbook** after every incident with any new resolution steps discovered.

---

## Alerts

### JoyJoinServiceDown

**Severity:** Critical  
**Condition:** No Prometheus metrics received from the `joyjoin_server` job for 2 minutes.  
**Meaning:** The JoyJoin server is completely unreachable or the `/api/metrics` endpoint is broken.

**Immediate response:**
1. Check server process status on the host:
   ```bash
   systemctl status joyjoin  # or: pm2 list / docker ps
   ```
2. Check recent logs:
   ```bash
   journalctl -u joyjoin -n 100
   # or
   docker logs joyjoin --tail 100
   ```
3. If the process is running but Prometheus cannot scrape, check network connectivity between the Prometheus container and the server host.
4. If the process is crashed, restart it and investigate the error in logs.
5. Check `GET /api/health` directly:
   ```bash
   curl https://api.yuejuapp.com/api/health
   ```

**Resolution:** Alert resolves automatically once metrics are received again.

**Owner:** Platform team.

---

### JoyJoinHighErrorRate

**Severity:** Critical  
**Condition:** 5xx error rate > 1% of total requests, sustained for 5 minutes.  
**Meaning:** The server is returning an elevated rate of internal server errors.

**Immediate response:**
1. Open Grafana → **Error Rate by Status Class** panel. Identify which endpoints are returning 5xx.
2. In Grafana Explore → Loki, query recent errors:
   ```logql
   {service="joyjoin-server"} | json | level = "error"
   ```
3. Look for stack traces, database errors, or external service failures (AI provider, WeChat API, etc.).
4. If a specific endpoint is failing, check recent deployments that affected that endpoint.
5. If a database error: check Neon serverless connection limits and query performance.
6. If an AI provider error: check `DEEPSEEK_API_KEY` / `MINIMAX_API_KEY` validity; the service has deterministic fallbacks so errors should be transient.

**Resolution:** Alert resolves when 5xx rate drops below 1% for 5 minutes.

**Owner:** Backend team / on-call engineer.

---

### JoyJoinElevated4xxRate

**Severity:** Warning  
**Condition:** 4xx error rate > 5% of total requests, sustained for 10 minutes.  
**Meaning:** Clients are making a high rate of invalid or unauthorized requests.

**Immediate response:**
1. Check which paths generate the most 4xx errors using the **Error Rate by Status Class** panel filtered by path.
2. A spike in 401s may indicate an auth regression or a bot scan.
3. A spike in 404s may indicate a broken client build or removed endpoint.
4. A spike in 429s indicates rate limit exhaustion — check if legitimate users are being throttled.

**Resolution:** Alert resolves when 4xx rate drops below 5%.

**Owner:** Backend / frontend team.

---

### JoyJoinHighLatency

**Severity:** Warning  
**Condition:** p95 request latency > 1500 ms on any endpoint, sustained for 5 minutes.  
**Meaning:** Some API paths are significantly slower than acceptable for a good user experience.

**Note:** 1500 ms is a static beta threshold. Replace with a 1.5× dynamic baseline once 7 days of production data are available.

**Immediate response:**
1. In the **Request Latency Percentiles** panel, identify which endpoint(s) are slow.
2. Common causes:
   - Slow database queries (check Neon query logs)
   - AI service timeouts (check `[AITrace]` log lines in Loki: `{service="joyjoin-server"} | json | level = "info" | message = "[AITrace]"`)
   - Event matching algorithm running on large pools (check `poolMatchingService` logs)
3. If AI calls are slow, verify the provider is healthy; fallback paths should activate automatically.

**Resolution:** Alert resolves when p95 drops below 1500 ms for 5 minutes.

**Owner:** Backend team.

---

### JoyJoinHighMemory

**Severity:** Warning  
**Condition:** Process RSS > 768 MB, sustained for 10 minutes.  
**Meaning:** The Node.js process is consuming an unusually large amount of memory.

**Immediate response:**
1. Check the **Memory Usage** panel trend — is it a gradual leak or a sudden spike?
2. Gradual leak: check for large in-memory caches (rate limiter store, matching cache, inference logs) that are not being pruned.
3. Sudden spike: may be correlated with a large matching run (`matchEventPool`) or a large WebSocket broadcast.
4. If the process is near OOM, consider a rolling restart during a low-traffic window.
5. For persistent leaks, enable heap snapshots (`--expose-gc`) in a staging environment.

**Resolution:** Alert resolves when RSS drops below 768 MB.

**Owner:** Backend team.

---

### JoyJoinHighCPU

**Severity:** Warning  
**Condition:** CPU user time rate > 85% of one core, sustained for 10 minutes.  
**Meaning:** The Node.js process is CPU-bound, which can cause event-loop lag and latency spikes.

**Immediate response:**
1. Check the **CPU Utilisation** and **Event Loop Delay** panels.
2. A matching run (`matchEventPool`) on a large pool is expected to be CPU-intensive. If this is the cause, consider scheduling large pools during off-peak hours.
3. If not correlated with a known batch job, check for runaway loops or unexpectedly large request bodies.
4. Profile with Node.js `--cpu-prof` flag in a staging environment.

**Resolution:** Alert resolves when CPU rate drops below 85%.

**Owner:** Backend team.

---

### JoyJoinSyntheticProbeFailed

**Severity:** Critical  
**Condition:** The `joyjoin_synthetic_probe_success` gauge is `0`, or no fresh probe metric is received for 10 minutes; sustained for 5 minutes.  
**Meaning:** The automated synthetic probe (running in GitHub Actions every 5 min) is failing at least one of its checks:
- `GET /api/health` not returning 200 + `{"status":"ok"}`
- `GET /api/metrics` not returning Prometheus text
- `GET /api/auth/user` not returning 401

**Immediate response:**
1. Check the [GitHub Actions synthetic-probe workflow](https://github.com/JoyJoin-Tech-Limited/JoyJoin_app_v0.1/actions/workflows/synthetic-probe.yml) for the most recent run logs.
2. The probe output is structured JSON — look for `"ok":false` entries and the `"error"` field.
3. If `/api/health` fails: follow [JoyJoinServiceDown](#joyjoinservicedown).
4. If `/api/metrics` fails: check that `metricsMiddleware` is mounted in `index.ts` and the route is registered in `routes.ts`.
5. If `/api/auth/user` fails with non-401: check the auth middleware stack.

**Maintenance:**
The workflow defaults to `https://api.yuejuapp.com`; update the `PRODUCTION_BASE_URL` secret whenever the probe should target a different production URL.
Update `scripts/synthetic/happy-path-probe.mjs` if the probed endpoints change.

**Resolution:** Alert resolves when the probe exits 0 and a fresh `joyjoin_synthetic_probe_success 1` sample is scraped.

**Owner:** Platform team.

---

## How to silence an alert

Use the Alertmanager UI or API:

```bash
# Via UI: http://localhost:9093/#/silences/new
# Via API:
curl -X POST http://localhost:9093/api/v2/silences \
  -H 'Content-Type: application/json' \
  -d '{
    "matchers": [{ "name": "alertname", "value": "JoyJoinHighMemory", "isRegex": false }],
    "startsAt": "2026-04-01T10:00:00Z",
    "endsAt": "2026-04-01T11:00:00Z",
    "createdBy": "engineer-name",
    "comment": "Planned maintenance — restarting server"
  }'
```

---

## Escalation path

| Severity | First responder | Escalation after |
|----------|-----------------|------------------|
| Critical | On-call engineer | 15 min → Tech Lead |
| Warning | Async investigation | Next business day |

Configure on-call rotation and Slack / PagerDuty integration in `infra/alerting/alertmanager.yml`.
