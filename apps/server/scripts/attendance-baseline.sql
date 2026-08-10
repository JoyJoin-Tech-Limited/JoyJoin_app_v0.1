-- ============================================================================
-- 到场率 (Show-up Rate) Baseline — weekly commitment-rate query
-- ============================================================================
--
-- Run directly with psql, no parameters required:
--   psql "$DATABASE_URL" -f apps/server/scripts/attendance-baseline.sql
--
-- 口径 CAVEAT (read before quoting these numbers):
--   event_attendance.attendance_status is a SELF-DECLARED intent captured
--   pre-event (the user taps 确认出席 / 会晚到 in the mini-program). It does
--   NOT record physical arrival. A physical no-show only becomes visible if
--   ops marks the attendee `absent` day-of via the admin attendance-override
--   endpoint. Until that habit exists, this metric measures 确认出席率
--   (commitment rate), not the true physical no-show rate. Rows still in
--   `pending` are users who never declared either way.
--
-- Definitions:
--   Numerator   = event_attendance rows with attendance_status IN
--                 ('confirmed', 'late') for the event. `absent` and `pending`
--                 rows are excluded from the numerator. Attendance rows whose
--                 legacy `status` column is 'cancelled' are excluded entirely
--                 (they represent a withdrawn registration, not an attendee).
--   Denominator = blind_box_events.total_participants (the matched roster
--                 size recorded at match time).
--   Grouping    = calendar week of the event (date_trunc('week', date_time)).
--   Exclusions  = events linked to a test pool (event_pools.is_test_pool),
--                 events with status = 'canceled', and events with a NULL
--                 total_participants (never matched).
-- ============================================================================

-- Query 1: weekly commitment-rate baseline ------------------------------------
-- CTEs keep one row per event before aggregation so the roster-seat
-- denominator is never multiplied by the attendance join fan-out.
WITH events_in_scope AS (
  SELECT
    bbe.id,
    bbe.date_time,
    bbe.total_participants
  FROM blind_box_events bbe
  LEFT JOIN event_pools ep
    ON ep.id = bbe.pool_id
  WHERE bbe.status <> 'canceled'
    AND bbe.total_participants IS NOT NULL
    AND COALESCE(ep.is_test_pool, false) = false
),
attendance_counts AS (
  SELECT
    ea.blind_box_event_id AS event_id,
    COUNT(*) FILTER (WHERE ea.attendance_status = 'confirmed') AS confirmed_count,
    COUNT(*) FILTER (WHERE ea.attendance_status = 'late')      AS late_count,
    COUNT(*) FILTER (WHERE ea.attendance_status = 'absent')    AS absent_count,
    COUNT(*) FILTER (WHERE ea.attendance_status = 'pending')   AS pending_count
  FROM event_attendance ea
  WHERE COALESCE(ea.status, 'confirmed') <> 'cancelled'
  GROUP BY ea.blind_box_event_id
)
SELECT
  date_trunc('week', e.date_time)::date            AS week_start,
  COUNT(*)                                          AS matched_events,
  SUM(e.total_participants)                         AS roster_seats,
  SUM(COALESCE(a.confirmed_count, 0))               AS confirmed_count,
  SUM(COALESCE(a.late_count, 0))                    AS late_count,
  SUM(COALESCE(a.absent_count, 0))                  AS absent_count,
  SUM(COALESCE(a.pending_count, 0))                 AS pending_count,
  ROUND(
    100.0 * SUM(COALESCE(a.confirmed_count, 0) + COALESCE(a.late_count, 0))
      / NULLIF(SUM(e.total_participants), 0),
    1
  )                                                 AS commitment_rate_pct
FROM events_in_scope e
LEFT JOIN attendance_counts a
  ON a.event_id = e.id
GROUP BY 1
ORDER BY 1 DESC;

-- Query 2: per-event drill-down, most recent 8 weeks --------------------------
SELECT
  bbe.id                                            AS event_id,
  bbe.date_time                                     AS event_time,
  bbe.city,
  bbe.event_type,
  bbe.status                                        AS event_status,
  jsonb_array_length(COALESCE(bbe.matched_attendees, '[]'::jsonb))
                                                    AS matched_count,
  bbe.total_participants                            AS roster_seats,
  COUNT(ea.id) FILTER (
    WHERE ea.attendance_status = 'confirmed'
  )                                                 AS confirmed_count,
  COUNT(ea.id) FILTER (
    WHERE ea.attendance_status = 'late'
  )                                                 AS late_count,
  COUNT(ea.id) FILTER (
    WHERE ea.attendance_status = 'absent'
  )                                                 AS absent_count,
  COUNT(ea.id) FILTER (
    WHERE ea.attendance_status = 'pending'
  )                                                 AS pending_count
FROM blind_box_events bbe
LEFT JOIN event_attendance ea
  ON ea.blind_box_event_id = bbe.id
 AND COALESCE(ea.status, 'confirmed') <> 'cancelled'
LEFT JOIN event_pools ep
  ON ep.id = bbe.pool_id
WHERE bbe.status <> 'canceled'
  AND bbe.total_participants IS NOT NULL
  AND COALESCE(ep.is_test_pool, false) = false
  AND bbe.date_time >= date_trunc('week', NOW()) - INTERVAL '8 weeks'
GROUP BY bbe.id
ORDER BY bbe.date_time DESC;
