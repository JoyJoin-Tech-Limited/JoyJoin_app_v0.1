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

## Key files

| File | Purpose |
|------|---------|
| `apps/server/src/routes/domains/analytics.ts` | Analytics API routes — participation experiment & personality result events |
| `apps/server/src/routes/domains/onboarding.ts` | Onboarding checkpoint and `/api/analytics/onboarding` event ingestion |
| `apps/server/src/kpiService.ts` | CSAT, NPS, engagement metrics, daily KPI snapshots, churn analysis, assessment metrics |
| `apps/server/src/triggerPerformanceService.ts` | 38-trigger performance tracking with Bayesian threshold adjustment |
| `apps/server/src/analytics/registrationFunnelAnalytics.ts` | Legacy registration funnel L1/L2/L3 analysis (admin reporting only) |
| `apps/server/src/middleware/metrics.ts` | Prometheus-style HTTP & AI call metrics (operational telemetry overlap) |
| `apps/server/src/matchingMetrics.ts` | Matching-domain histograms for semantic similarity scoring |
| `apps/server/src/benchmarks/matchingStressSimulation.ts` | In-memory matching CPU stress test (no DB) |
| `packages/shared/src/schema.ts` | DB tables: `onboardingAnalytics`, `participationExperimentEvents`, `triggerPerformance`, `kpiSnapshots`, `userEngagementMetrics`, `eventSatisfactionSummary`, `registrationSessions` |

## Event tracking system

### Participation experiment events (Wave 2)

Fire-and-forget client events stored in `participationExperimentEvents`:

```
atmosphere_framing_shown
atmosphere_framing_selected
goal_reframe_shown
goal_reframe_primary_selected
goal_reframe_secondary_added
ignition_shown
ignition_swipe_started
ignition_swipe_completed
ignition_swipe_abandoned
ignition_fallback_used
archetype_waiting_shown
```

Endpoint: `POST /api/analytics/participation_experiment`
- Auth optional (anonymous events accepted with `userId = null`)
- Always returns 200; silently drops invalid event types
- Metadata capped at 4 KB; poolId capped at 120 chars

### Personality result events

Lightweight instrumentation for copy/share/presenter interactions:

```
personality_result_viewed
personality_text_share_copied
personality_share_variant_copied
personality_poster_opened
personality_native_share_used
```

Endpoint: `POST /api/analytics/personality_result`
- Logs via structured logger (`logger.info`) rather than DB table
- Same fail-open semantics

### Onboarding analytics

Endpoint: `POST /api/analytics/onboarding`
- Tracks step, eventType, sessionDuration, stepDuration, metadata
- Validates durations are non-negative via `normalizeOptionalDuration`
- Accepts unauthenticated tracking (userId/sessionId optional)

## KPI service

| Function | What it computes |
|----------|-----------------|
| `calculateCSAT` | % of feedback with `atmosphereScore >= 4` |
| `calculateNPS` | % Promoters (>=9) − % Detractors (<=6), adjusted for connections |
| `updateUserEngagement` | Events attended, feedback given, churn flag (30-day window), cohort |
| `updateEventSatisfaction` | Avg atmosphere, connection rate, venue like/neutral/dislike counts |
| `generateDailyKpiSnapshot` | Daily aggregate: users, events, feedback, CSAT, NPS, churn, xiaoyue chats |
| `getKpiDashboardData` | Trend data for the last N days |
| `getChurnAnalysis` | Churned users by cohort and registration method |
| `getAssessmentMetrics` | V1 vs V2 assessment completion, confidence distribution, decisive ratio |
| `logAssessmentCompletion` | Telemetry console log for assessment sessions |

## Trigger performance service

The AI evolution system tracks 38 triggers with Bayesian threshold tuning:
- `recordTriggerActivation(triggerId, wasSuccessful)` — increments counters
- `getTriggerThreshold(triggerId)` — returns current threshold (cached)
- Thresholds auto-adjust every 20 activations using beta-distribution mean
- `getTopPerformingTriggers(limit)` / `getUnderperformingTriggers(threshold)` for diagnostics

## Registration funnel analytics (legacy boundary)

`registrationFunnelAnalytics.ts` reads historical `registration_sessions` telemetry **for admin reporting only**. Do not reuse these identifiers in active onboarding code.

Funnel stages:
1. **started** — user record created
2. **l1_complete** — displayName, gender, currentCity filled
3. **l2_engaged** — interests carousel completed
4. **l3_inferred** — personality test completed
5. **completed** — all essential data present

## Matching benchmarks

`matchingStressSimulation.ts` runs the greedy matcher on synthetic in-memory users (no DB queries):
- Default 1,000 users; minimum 8 (group-size floor)
- Optional `--ai-chat N` second phase
- Use for local CPU profiling and regression testing of matching performance

## Common mistakes to avoid

- Returning non-200 from analytics endpoints — always fail-open
- Storing PII in event metadata — sanitize before insertion
- Using legacy `registration_sessions` identifiers in active onboarding flows
- Adding heavy computation inside analytics route handlers — fire-and-forget only
- Mixing product analytics with operational metrics — they serve different consumers

## Related files

- `apps/server/src/routes/domains/analytics.ts`
- `apps/server/src/routes/domains/onboarding.ts`
- `apps/server/src/kpiService.ts`
- `apps/server/src/triggerPerformanceService.ts`
- `apps/server/src/analytics/registrationFunnelAnalytics.ts`
- `apps/server/src/middleware/metrics.ts`
- `apps/server/src/matchingMetrics.ts`
- `apps/server/src/benchmarks/matchingStressSimulation.ts`
- `packages/shared/src/schema.ts`

## Quick Examples

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

## Canonical References

- `apps/server/src/routes/domains/analytics.ts`
- `apps/server/src/routes/domains/onboarding.ts`
- `apps/server/src/kpiService.ts`
- `apps/server/src/triggerPerformanceService.ts`
- `apps/server/src/analytics/registrationFunnelAnalytics.ts`
- `apps/server/src/middleware/metrics.ts`
- `apps/server/src/matchingMetrics.ts`
- `apps/server/src/benchmarks/matchingStressSimulation.ts`
- `apps/server/src/benchmarks/matchingStressSimulation.cli.ts`
- `packages/shared/src/schema.ts`
