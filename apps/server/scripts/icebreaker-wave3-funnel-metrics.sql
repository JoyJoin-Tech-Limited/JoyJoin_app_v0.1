-- ============================================================================
-- Icebreaker Wave 3 Funnel Metrics (icebreaker-uiux-wave3, contract AC-05)
-- ============================================================================
--
-- Read-only aggregation over the three Wave-1 pre-embedded social-icebreaker
-- funnel events. No dashboards, no tables, no routes — run directly:
--   psql "$DATABASE_URL" -f apps/server/scripts/icebreaker-wave3-funnel-metrics.sql
--
-- Events (persisted in discover_analytics_events via POST
-- /api/analytics/social-icebreaker, whitelist-gated):
--   warmup_ready_rate      — one snapshot when a session LEAVES warmup.
--                            metadata: readyCount, playerCount, everyoneReady,
--                            socialSessionId, icebreakerSessionId, phase='warmup'
--                            (emission: useIcebreakerSessionAnalytics.ts)
--   phase_completion_rate  — one snapshot at the recap/ended terminal moment.
--                            metadata: completedCount, enabledCount, earlyEnd,
--                            playerCount, socialSessionId, icebreakerSessionId
--                            (emission: useIcebreakerSessionAnalytics.ts)
--   moment_card_saved      — 纪念卡 save tap on the recap screen.
--                            metadata: socialSessionId, icebreakerSessionId,
--                            phase='recap' (+ client save-target keys)
--                            (emission: MomentCardView.tsx)
--
-- 口径 CAVEAT (read before quoting):
--   Each event is emitted AT MOST ONCE per client page lifecycle (ref-guarded
--   one-shots), so a user who never opens the recap page contributes no
--   phase_completion_rate row and a user who never taps save contributes no
--   moment_card_saved row. These are CLIENT-SIDE funnels (per acting client),
--   not per-session server truths. Duplicate rows for the same
--   socialSessionId can occur across devices/re-installs; the per-day query
--   therefore also reports DISTINCT session counts alongside raw row counts.
-- ============================================================================

-- ── Q1: 30-day funnel overview — daily volume + distinct sessions ────────────
SELECT
  date_trunc('day', "timestamp")                                   AS day,
  event_type,
  COUNT(*)                                                         AS rows_emitted,
  COUNT(DISTINCT metadata->>'socialSessionId')                     AS distinct_sessions
FROM discover_analytics_events
WHERE event_type IN ('warmup_ready_rate', 'phase_completion_rate', 'moment_card_saved')
  AND "timestamp" >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ── Q2: warmup ready-rate distribution (last 30 days) ────────────────────────
-- everyoneReady=true share = tables where every roster member tapped ready
-- before leaving warmup; median ready fraction shows the typical shortfall.
SELECT
  COUNT(*)                                                              AS snapshots,
  COUNT(*) FILTER (WHERE (metadata->>'everyoneReady')::boolean)         AS everyone_ready,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE (metadata->>'everyoneReady')::boolean) / NULLIF(COUNT(*), 0),
    1
  )                                                                     AS everyone_ready_pct,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (metadata->>'readyCount')::numeric
             / NULLIF((metadata->>'playerCount')::numeric, 0)
    )::numeric,
    3
  )                                                                     AS median_ready_fraction
FROM discover_analytics_events
WHERE event_type = 'warmup_ready_rate'
  AND "timestamp" >= now() - interval '30 days'
  AND (metadata->>'playerCount')::numeric > 0;

-- ── Q3: phase completion rate (last 30 days) ─────────────────────────────────
-- completed/enabled per session; earlyEnd split shows how often hosts
-- interrupt the run vs. reaching recap naturally.
SELECT
  COUNT(*)                                                              AS snapshots,
  ROUND(AVG((metadata->>'completedCount')::numeric), 2)                   AS avg_completed_phases,
  ROUND(AVG((metadata->>'enabledCount')::numeric), 2)                     AS avg_enabled_phases,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (metadata->>'completedCount')::numeric
             / NULLIF((metadata->>'enabledCount')::numeric, 0)
    )::numeric,
    3
  )                                                                     AS median_completion_fraction,
  COUNT(*) FILTER (WHERE (metadata->>'earlyEnd')::boolean)                AS early_end_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE (metadata->>'earlyEnd')::boolean) / NULLIF(COUNT(*), 0),
    1
  )                                                                     AS early_end_pct
FROM discover_analytics_events
WHERE event_type = 'phase_completion_rate'
  AND "timestamp" >= now() - interval '30 days'
  AND (metadata->>'enabledCount')::numeric > 0;

-- ── Q4: 纪念卡 save rate vs. recap views (last 30 days) ─────────────────────
-- Denominator = recap_view events (already whitelisted + emitted at the same
-- terminal moment), so the ratio reads as "of tables that saw the recap,
-- how many saved the card". Both funnels are client-side (see CAVEAT above).
SELECT
  (SELECT COUNT(DISTINCT metadata->>'socialSessionId')
     FROM discover_analytics_events
    WHERE event_type = 'recap_view'
      AND "timestamp" >= now() - interval '30 days')                      AS recap_viewed_sessions,
  (SELECT COUNT(DISTINCT metadata->>'socialSessionId')
     FROM discover_analytics_events
    WHERE event_type = 'moment_card_saved'
      AND "timestamp" >= now() - interval '30 days')                      AS card_saved_sessions,
  ROUND(
    100.0
    * (SELECT COUNT(DISTINCT metadata->>'socialSessionId')
         FROM discover_analytics_events
        WHERE event_type = 'moment_card_saved'
          AND "timestamp" >= now() - interval '30 days')
    / NULLIF((SELECT COUNT(DISTINCT metadata->>'socialSessionId')
         FROM discover_analytics_events
        WHERE event_type = 'recap_view'
          AND "timestamp" >= now() - interval '30 days'), 0),
    1
  )                                                                     AS save_rate_pct;

-- ── Q5 (OBS-01 evidence): raw lookup used by QA to verify E2E persistence ────
-- After exercising a session on any environment, confirm the three event
-- types landed (replace the session id):
--   SELECT event_type, user_id, metadata, "timestamp"
--   FROM discover_analytics_events
--   WHERE metadata->>'socialSessionId' = 'social_<sessionId>'
--     AND event_type IN ('warmup_ready_rate', 'phase_completion_rate', 'moment_card_saved')
--   ORDER BY "timestamp";
