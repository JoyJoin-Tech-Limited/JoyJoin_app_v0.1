-- ============================================================================
-- 转化 Conversion Funnel Metrics (2026-10-20 gap audit, AC-01 后半)
-- ============================================================================
--
-- Read-only aggregation over discover_analytics_events + payments + invitations.
-- No dashboards, no tables, no routes — run directly:
--   psql "$DATABASE_URL" -f apps/server/scripts/conversion-funnel-metrics.sql
--
-- Five funnel segments (audit §2 七目标裁决 → §4 SQL 草案):
--   Q1 北极星 `detail_to_checkout_conv`  — event_ticket_payment_view / registration_start
--   Q2 护栏   `checkout_cancel_rate`     — pay_cancel / pay_start (and / event_ticket_payment_view)
--   Q3 续费   `first_order_30d_renewal`  — payments (payment_type/status/paid_at)
--   Q4 guest 两段 (P1c)                  — impression→tap + login_tap→login_success (guestAttemptId)
--   Q5 duo   两段 (P1a/S6.1)             — impression→tap (CTR) + duo_invite_to_register_conv (纯 DB)
--
-- 口径 CAVEAT (read before quoting — mirrors icebreaker-wave3-funnel-metrics.sql):
--   Funnel is CLIENT-SIDE per acting client, not per-session server truth.
--   Each event is emitted at most once per page lifecycle (ref-guarded
--   one-shots), so re-mounts/re-installs can re-emit on another device and a
--   user who never reaches a later stage contributes no later-stage row.
--   Ratios below are raw-row counts with a distinct grain reported alongside
--   where correlation is meaningful.
--
--   ⚠️ user_id / session_id on discover_analytics_events are NULL for every row
--   (analytics route registers before express-session — audit §5.2). Cross-event
--   correlation MUST NOT use those columns; guest stages join on the client-
--   generated metadata->>'guestAttemptId' (icebreaker `socialSessionId` precedent),
--   checkout/detail counts are pure event counts (no userId needed).
-- ============================================================================

-- ── Q1: 北极星 detail_to_checkout_conv (last 30 days) ─────────────────────────
-- detail = `registration_start` (订座页 mount 一次性 view; the product has no
-- independent detail page — audit §2.1). checkout = `event_ticket_payment_view`
-- (收银台 mount 一次性 view). conv = checkout views / detail views.
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'event_ticket_payment_view'
      AND "timestamp" >= now() - interval '30 days')                    AS checkout_views,
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'registration_start'
      AND "timestamp" >= now() - interval '30 days')                    AS detail_views,
  ROUND(
    100.0
    * (SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'event_ticket_payment_view'
          AND "timestamp" >= now() - interval '30 days')
    / NULLIF((SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'registration_start'
          AND "timestamp" >= now() - interval '30 days'), 0),
    1
  )                                                                     AS detail_to_checkout_conv_pct;

-- ── Q1b: 北极星 pool-grain variant ───────────────────────────────────────────
-- Distinct-pool conversion. NOTE the asymmetry: registration_start stores
-- poolId in the pool_id COLUMN (pool-registration/index.tsx:462) while
-- event_ticket_payment_view stores it in metadata->>'poolId'
-- (event-ticket-payment/index.tsx:337). Normalize both into one set.
WITH detail_pools AS (
  SELECT DISTINCT pool_id AS pool_id
  FROM discover_analytics_events
  WHERE event_type = 'registration_start'
    AND pool_id IS NOT NULL
    AND "timestamp" >= now() - interval '30 days'
),
checkout_pools AS (
  SELECT DISTINCT metadata->>'poolId' AS pool_id
  FROM discover_analytics_events
  WHERE event_type = 'event_ticket_payment_view'
    AND "timestamp" >= now() - interval '30 days'
)
SELECT
  (SELECT COUNT(*) FROM detail_pools)                                   AS detail_pools,
  (SELECT COUNT(*) FROM checkout_pools)                                 AS checkout_pools,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM checkout_pools)
    / NULLIF((SELECT COUNT(*) FROM detail_pools), 0),
    1
  )                                                                     AS detail_to_checkout_conv_pct_pool_grain;

-- ── Q2: 护栏 checkout_cancel_rate (last 7 days) ──────────────────────────────
-- Two denominators (audit §2.7): pay_start = "entered the payment attempt"
-- (primary); event_ticket_payment_view = "saw the checkout page" (broader,
-- includes browse-only visits that never initiated payment).
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'pay_cancel' AND "timestamp" >= now() - interval '7 days') AS cancels,
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'pay_start'  AND "timestamp" >= now() - interval '7 days') AS pay_starts,
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'event_ticket_payment_view'
      AND "timestamp" >= now() - interval '7 days')                    AS checkout_views,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'pay_cancel' AND "timestamp" >= now() - interval '7 days')
    / NULLIF((SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'pay_start' AND "timestamp" >= now() - interval '7 days'), 0),
    1
  )                                                                     AS cancel_rate_vs_pay_start_pct,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'pay_cancel' AND "timestamp" >= now() - interval '7 days')
    / NULLIF((SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'event_ticket_payment_view'
          AND "timestamp" >= now() - interval '7 days'), 0),
    1
  )                                                                     AS cancel_rate_vs_view_pct;

-- ── Q3: 续费率 first_order_30d_renewal (all-time, windowed) ──────────────────
-- 口径 (audit §2.6): an "order" = a completed payment_type='event' payment.
-- event_bundle (三连局包/六连局包) is EXCLUDED — bundle credit redemptions flow
-- through event_credit_grants/redemptions and are not new orders (PM to lock
-- whether bundle first-purchase counts as a "first order"; this query counts
-- payment_type='event' only). Renewal = a 2nd completed 'event' order within
-- 30 days of the user's 1st. users with only a bundle order contribute nothing.
WITH completed_orders AS (
  SELECT
    user_id,
    paid_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY paid_at) AS ord
  FROM payments
  WHERE payment_type = 'event'
    AND status = 'completed'
    AND paid_at IS NOT NULL
    AND user_id IS NOT NULL
),
first_order AS (
  SELECT user_id, paid_at AS first_paid_at
  FROM completed_orders
  WHERE ord = 1
),
second_order AS (
  SELECT user_id, paid_at AS second_paid_at
  FROM completed_orders
  WHERE ord = 2
)
SELECT
  COUNT(*)                                                              AS first_orders,
  COUNT(*) FILTER (
    WHERE so.second_paid_at <= fo.first_paid_at + interval '30 days'
  )                                                                     AS renewed_within_30d,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE so.second_paid_at <= fo.first_paid_at + interval '30 days'
    ) / NULLIF(COUNT(*), 0),
    1
  )                                                                     AS renewal_pct
FROM first_order fo
LEFT JOIN second_order so ON so.user_id = fo.user_id;

-- ── Q4a: guest_view_to_assessment_rate (P1c, last 30 days) ───────────────────
-- impression (guest card rendered, once) → tap (card tap → assessment/login).
-- Raw-row ratio; a distinct-grain guestAttemptId variant follows in Q4b.
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'guest_preview_card_impression'
      AND "timestamp" >= now() - interval '30 days')                    AS impressions,
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'guest_preview_card_tap'
      AND "timestamp" >= now() - interval '30 days')                    AS taps,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'guest_preview_card_tap'
          AND "timestamp" >= now() - interval '30 days')
    / NULLIF((SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'guest_preview_card_impression'
          AND "timestamp" >= now() - interval '30 days'), 0),
    1
  )                                                                     AS view_to_assessment_pct;

-- ── Q4b: guest_to_login_conv (P1c, last 30 days) ─────────────────────────────
-- login_tap → login_success. user_id/session_id are NULL on this channel, so the
-- pair is joined on the client-generated metadata->>'guestAttemptId' (impression
-- mints a fresh id via beginGuestAttempt; tap/success carry the same id). COUNT
-- DISTINCT id so a re-tapped CTA that only succeeds once still counts one conv.
SELECT
  (SELECT COUNT(DISTINCT metadata->>'guestAttemptId') FROM discover_analytics_events
    WHERE event_type = 'guest_preview_login_tap'
      AND "timestamp" >= now() - interval '30 days')                    AS login_taps,
  (SELECT COUNT(DISTINCT metadata->>'guestAttemptId') FROM discover_analytics_events
    WHERE event_type = 'guest_preview_login_success'
      AND "timestamp" >= now() - interval '30 days')                    AS login_success,
  ROUND(
    100.0 * (SELECT COUNT(DISTINCT metadata->>'guestAttemptId') FROM discover_analytics_events
        WHERE event_type = 'guest_preview_login_success'
          AND "timestamp" >= now() - interval '30 days')
    / NULLIF((SELECT COUNT(DISTINCT metadata->>'guestAttemptId') FROM discover_analytics_events
        WHERE event_type = 'guest_preview_login_tap'
          AND "timestamp" >= now() - interval '30 days'), 0),
    1
  )                                                                     AS guest_login_conv_pct;

-- ── Q5a: duo_entry_ctr (P1a/S6.1, last 30 days) ──────────────────────────────
-- checkout DuoEntryLink impression → tap. Both carry poolId in metadata.
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'duo_entry_link_impression'
      AND "timestamp" >= now() - interval '30 days')                    AS impressions,
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type = 'duo_entry_link_tap'
      AND "timestamp" >= now() - interval '30 days')                    AS taps,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'duo_entry_link_tap'
          AND "timestamp" >= now() - interval '30 days')
    / NULLIF((SELECT COUNT(*) FROM discover_analytics_events
        WHERE event_type = 'duo_entry_link_impression'
          AND "timestamp" >= now() - interval '30 days'), 0),
    1
  )                                                                     AS duo_entry_ctr_pct;

-- ── Q5b: duo_invite_to_register_conv (纯 DB, no analytics events) ────────────
-- 口径 (audit §2.5): denominator = duo invitations created (invitations where
-- invitation_type='duo'); numerator = duo invites whose invitee actually bound
-- a pool registration (invitation_uses.pool_registration_id → event_pool_registrations).
-- The registration-row join is an integrity confirmation of the binding; a duo
-- invite is 1:1 with an invitee, so conv ≤ 100%.
SELECT
  (SELECT COUNT(*) FROM invitations
    WHERE invitation_type = 'duo')                                     AS duo_invites,
  (SELECT COUNT(*)
     FROM invitation_uses u
     JOIN invitations i ON i.id = u.invitation_id
     JOIN event_pool_registrations r ON r.id = u.pool_registration_id
    WHERE i.invitation_type = 'duo'
      AND u.pool_registration_id IS NOT NULL)                           AS registered_invitees,
  ROUND(
    100.0 * (SELECT COUNT(*)
        FROM invitation_uses u
        JOIN invitations i ON i.id = u.invitation_id
        JOIN event_pool_registrations r ON r.id = u.pool_registration_id
       WHERE i.invitation_type = 'duo'
         AND u.pool_registration_id IS NOT NULL)
    / NULLIF((SELECT COUNT(*) FROM invitations
        WHERE invitation_type = 'duo'), 0),
    1
  )                                                                     AS duo_invite_conv_pct;

-- ── OBS-01 evidence: raw lookup for QA E2E persistence ────────────────────────
-- After exercising the guest preview card + checkout duo link on any env, confirm
-- the six event types landed (replace the guestAttemptId / poolId):
--   SELECT event_type, pool_id, metadata, "timestamp"
--   FROM discover_analytics_events
--   WHERE event_type IN (
--     'guest_preview_card_impression','guest_preview_card_tap',
--     'guest_preview_login_tap','guest_preview_login_success',
--     'duo_entry_link_impression','duo_entry_link_tap'
--   )
--   ORDER BY "timestamp";
