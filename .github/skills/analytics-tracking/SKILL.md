---
name: analytics-tracking
description: >
  Product analytics, event tracking, KPI dashboards, registration funnel analysis, trigger performance, and matching benchmarks. Use when adding analytics events, tracking user funnels, instrumenting product metrics, or reviewing data-collection boundaries. Trigger phrases: "track this event", "add analytics", "funnel conversion", "KPI dashboard", "registration dropoff", "trigger performance", "CSAT/NPS", "matching benchmark".
---

# analytics-tracking

**Core rule:** Analytics must be fail-open — never block the user flow. Events are validated and stored server-side; malformed events are silently dropped. All analytics endpoints return 200 even on write failure.

## When to use this skill

- Adding a new product analytics event or client-side tracking call
- Building or modifying a KPI dashboard, CSAT/NPS calculation, or engagement metric
- Analyzing registration funnel dropoff (L1/L2/L3 stages)
- Instrumenting trigger performance for the AI evolution system
- Adding or reviewing a matching stress-test benchmark
- Tracking onboarding checkpoint progression or step-level analytics
- Reviewing data-collection boundaries (what we track vs what we don't)

## When NOT to use this skill

- Task is purely about server route structure (use `server-domain-architecture`)
- Task is about operational logging, health checks, or Prometheus metrics (use `platform-observability-and-ops`)
- Task is about frontend UI or component placement (use `frontend-component-architecture`)
- Task is about A/B test design or product requirements (use `draft-prd`)

## Tracking principles

Three event streams are validated and stored server-side:
- **Participation experiment** — fire-and-forget client events (Wave 2 atmosphere/goal/ignition flows)
- **Personality result** — lightweight copy/share/presenter instrumentation
- **Onboarding** — step-level tracking with duration validation

KPIs (CSAT, NPS, engagement), trigger performance (38 triggers with Bayesian tuning), and matching benchmarks are computed in dedicated services.

See [references/implementation.md](references/implementation.md) for full event taxonomy, funnel details, KPI service functions, trigger performance specifics, and matching benchmark parameters.

## Quick examples

**User says:** "Add a new analytics event when users tap the 'remind me' button on the pool card."
**Apply this skill by:** Adding the event type string to `PARTICIPATION_EVENT_TYPES` in `routes/domains/analytics.ts`, documenting it in the JSDoc, and having the client POST to `/api/analytics/participation_experiment` with the new event type. Ensure the endpoint still returns 200 if the event is malformed.
**Result:** The new interaction is trackable in the participation experiment dataset without blocking the user flow.

---

**User says:** "The admin KPI dashboard shows 0 NPS for the last 7 days — what's wrong?"
**Apply this skill by:** Checking `kpiService.ts` → `calculateNPS` to verify the date range is inclusive, confirming `eventFeedback` rows exist with `atmosphereScore` in the queried window, and tracing whether `generateDailyKpiSnapshot` has run since the feedback was submitted. Check if the snapshot for today exists in `kpiSnapshots`.
**Result:** The root cause is identified as either missing feedback data, an ungenerated snapshot, or a date-range boundary bug.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Analytics endpoint returning 500 | Exception thrown inside handler | Wrap all writes in try/catch and return 200 with `{success: false}` |
| Event types rejected as invalid | Missing from `ALLOWED_*_EVENT_TYPES` set | Add the new type to the const array and rebuild the Set |
| KPI snapshot shows stale data | `generateDailyKpiSnapshot` not run | Run manually or verify cron/scheduler is active; check `kpiSnapshots.snapshotDate` |
| Trigger threshold stuck at 0.5 | `recordTriggerActivation` never called | Verify trigger integration point calls the service after user action |
| Churned users count seems high | `isChurned` flag uses 30-day window | Confirm `lastEventDate` logic; users with no events are not marked churned (null `daysSinceLastActivity`) |
| Matching benchmark OOMs | userCount too large for local memory | Run on staging for n ≥ 2000; use `--ai-chat` sparingly |

## Review checklist

- [ ] Analytics endpoints return 200 even on write failure (fail-open)
- [ ] New event types are added to both the const array and the `ALLOWED_*` Set
- [ ] Metadata is sanitized and size-capped before storage
- [ ] No PII (phone numbers, WeChat codes, exact GPS) is stored in analytics metadata
- [ ] KPI calculations use the same date-range boundaries (inclusive/exclusive) as the dashboard query
- [ ] Trigger performance updates are idempotent — safe to retry
- [ ] Matching benchmarks do not accidentally query the production database
- [ ] Legacy `registration_sessions` identifiers are not introduced into active onboarding code

## Related skills

| Skill | When to hand off |
|-------|-----------------|
| `platform-observability-and-ops` | Operational logging, Prometheus metrics, health checks, audit logs |
| `server-domain-architecture` | Where to place new analytics routes or services |
| `reliability-and-state-integrity` | Making KPI snapshot generation idempotent or adding retry guards |
| `database-migration-safety` | Adding new analytics tables or indexes |
| `testing-and-regression-guardrails` | Regression tests for analytics event validation or KPI calculation |
| `performance-benchmark` | Before/after measurement of matching or route performance |
| `draft-prd` | Defining new metrics, funnels, or A/B tests before implementation |
