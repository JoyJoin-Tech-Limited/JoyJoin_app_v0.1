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

-- ============================================================================
-- Wave 2 P1 (sprint icebreaker-polish-p1, contract AC-06 补6): session health
-- ============================================================================
--
-- `session_health_snapshot` — emitted once per user at recap first display
-- (same ref-guarded one-shot discipline as recap_view). metadata:
--   phaseCount     — playable phases completed (phase_selection excluded)
--   myActionCount  — viewer's own visible contributions, DERIVED client-side
--                    from the final session state (zero new requests):
--                    descriptions/answers/statements/votes/bids/completions
--   playerCount    — roster size at display time
--   (+ socialSessionId, icebreakerSessionId, phase='recap'|'ended')
-- Same 口径 CAVEAT as above: client-side funnel, per acting client, not a
-- per-session server truth.

-- ── Q6: per-capita action distribution (last 30 days) ────────────────────────
-- 补6 健康指标 ②: how much did the average viewer actually DO? Median is the
-- honest center; the zero-action share flags ghost passengers.
SELECT
  COUNT(*)                                                              AS snapshots,
  ROUND(AVG((metadata->>'myActionCount')::numeric), 2)                  AS avg_actions_per_user,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (metadata->>'myActionCount')::numeric
    )::numeric,
    1
  )                                                                     AS median_actions_per_user,
  COUNT(*) FILTER (WHERE (metadata->>'myActionCount')::numeric = 0)     AS zero_action_users,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE (metadata->>'myActionCount')::numeric = 0) / NULLIF(COUNT(*), 0),
    1
  )                                                                     AS zero_action_pct
FROM discover_analytics_events
WHERE event_type = 'session_health_snapshot'
  AND "timestamp" >= now() - interval '30 days';

-- ── Q7: recap reach (last 30 days) ───────────────────────────────────────────
-- 补6 健康指标 ③: of the tables that STARTED a playable phase (phase_view),
-- how many distinct sessions had at least one member reach the recap and
-- fire the health snapshot. Denominator excludes same-day sessions still
-- mid-run (sessions whose latest phase_view is < 3h old).
SELECT
  (SELECT COUNT(DISTINCT metadata->>'socialSessionId')
     FROM discover_analytics_events
    WHERE event_type = 'phase_view'
      AND "timestamp" >= now() - interval '30 days'
      AND "timestamp" <= now() - interval '3 hours')                    AS started_sessions,
  (SELECT COUNT(DISTINCT metadata->>'socialSessionId')
     FROM discover_analytics_events
    WHERE event_type = 'session_health_snapshot'
      AND "timestamp" >= now() - interval '30 days'
      AND "timestamp" <= now() - interval '3 hours')                    AS recap_reached_sessions,
  ROUND(
    100.0
    * (SELECT COUNT(DISTINCT metadata->>'socialSessionId')
         FROM discover_analytics_events
        WHERE event_type = 'session_health_snapshot'
          AND "timestamp" >= now() - interval '30 days'
          AND "timestamp" <= now() - interval '3 hours')
    / NULLIF((SELECT COUNT(DISTINCT metadata->>'socialSessionId')
         FROM discover_analytics_events
        WHERE event_type = 'phase_view'
          AND "timestamp" >= now() - interval '30 days'
          AND "timestamp" <= now() - interval '3 hours'), 0),
    1
  )                                                                     AS recap_reach_pct;

-- ── Q8: phaseCount at recap vs. per-capita actions (joint read, 30 days) ─────
-- Healthy tables finish more phases AND act more; a quadrant split shows
-- whether low-action sessions also bail early.
SELECT
  ROUND(AVG((metadata->>'phaseCount')::numeric), 2)                     AS avg_phase_count,
  ROUND(
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (metadata->>'phaseCount')::numeric
    )::numeric,
    1
  )                                                                     AS median_phase_count,
  ROUND(
    corr((metadata->>'phaseCount')::numeric, (metadata->>'myActionCount')::numeric)::numeric,
    3
  )                                                                     AS phase_action_corr
FROM discover_analytics_events
WHERE event_type = 'session_health_snapshot'
  AND "timestamp" >= now() - interval '30 days';

-- ============================================================================
-- P2 #6 quip 灵感 chips funnel (2026-10-20, spec 规格二 §4/§5)
-- ============================================================================
--
-- Static-curation chips on the quip_battle answer phase (flag
-- `quipInspirationChipsEnabled`, ships dark). Three client-emitted events
-- (whitelist parity only — no aggregation tables):
--   quip_chip_shown   — per-prompt chips-row first render.
--                       metadata: promptId (+ socialSessionId, phase='quip_battle')
--   quip_chip_tap     — chip text actually landed in the box (a cancelled
--                       replace-confirm emits nothing).
--                       metadata: promptId, chipId, replaced
--   quip_chip_adopted — 采纳率分子: submit success with an answer that starts
--                       with the chip's original text (edits still count).
--                       metadata: promptId, chipId
-- Same 口径 CAVEAT as Wave 1 events: CLIENT-SIDE funnel per acting client,
-- not per-session server truth; shown is ref-guarded once per
-- (socialSessionId, promptId) per page lifecycle, so re-mounts/rejoins can
-- re-emit on another device. Ratios below read within-client.

-- ── Q9: chips funnel overview (last 30 days) ────────────────────────────────
-- tap_rate = taps / showns (row appeal); adopt_rate = adopteds / taps (fill
-- quality). Both raw-row and distinct (session, prompt) grains are reported.
SELECT
  COUNT(*) FILTER (WHERE event_type = 'quip_chip_shown')             AS shown_rows,
  COUNT(*) FILTER (WHERE event_type = 'quip_chip_tap')               AS tap_rows,
  COUNT(*) FILTER (WHERE event_type = 'quip_chip_adopted')           AS adopted_rows,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'quip_chip_tap')
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'quip_chip_shown'), 0),
    1
  )                                                                  AS tap_rate_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'quip_chip_adopted')
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'quip_chip_tap'), 0),
    1
  )                                                                  AS adopt_rate_pct,
  COUNT(DISTINCT metadata->>'socialSessionId')
    FILTER (WHERE event_type = 'quip_chip_shown')                    AS shown_sessions
FROM discover_analytics_events
WHERE event_type IN ('quip_chip_shown', 'quip_chip_tap', 'quip_chip_adopted')
  AND "timestamp" >= now() - interval '30 days';

-- ── Q10: per-chip appeal ranking (last 30 days) ──────────────────────────────
-- Which curated starters actually get used; bottom performers are pool-refresh
-- candidates (content decision, no schema change).
SELECT
  metadata->>'chipId'                                                AS chip_id,
  COUNT(*) FILTER (WHERE event_type = 'quip_chip_tap')               AS taps,
  COUNT(*) FILTER (WHERE event_type = 'quip_chip_adopted')           AS adopteds,
  COUNT(*) FILTER (
    WHERE event_type = 'quip_chip_tap'
      AND (metadata->>'replaced')::boolean
  )                                                                  AS replaced_handtyped,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'quip_chip_adopted')
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'quip_chip_tap'), 0),
    1
  )                                                                  AS adopt_rate_pct
FROM discover_analytics_events
WHERE event_type IN ('quip_chip_tap', 'quip_chip_adopted')
  AND "timestamp" >= now() - interval '30 days'
GROUP BY 1
ORDER BY taps DESC, chip_id;
