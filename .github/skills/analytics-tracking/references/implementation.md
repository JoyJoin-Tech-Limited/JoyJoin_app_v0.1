# Analytics Implementation Reference

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

## Canonical references

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
