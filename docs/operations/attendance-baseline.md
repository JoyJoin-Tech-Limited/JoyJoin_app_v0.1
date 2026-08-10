# 到场率 Baseline (Attendance / Show-up Rate)

> How to run and read the weekly 到场率 baseline query at
> `apps/server/scripts/attendance-baseline.sql`.

---

## ⚠️ 口径 Caveat — read this first

`event_attendance.attendance_status` is a **self-declared intent** captured
pre-event: the user taps 确认出席 / 会晚到 in the mini-program (squad-unboxing
or event-coordination surfaces). It does **not** record physical arrival.

A physical no-show only becomes visible if ops marks the attendee `absent`
day-of via the admin attendance-override endpoint
(`PATCH /api/admin/events/:eventId/attendees/:userId/attendance-status`,
operator role or above — see `apps/server/src/routes/domains/attendance.ts`).

Until that marking habit exists, this metric measures **确认出席率
(commitment rate)**, not the true physical no-show rate:

- `confirmed` / `late` → counted in the numerator (the user committed).
- `absent` → excluded from the numerator. Mixes self-declared 无法出席
  (pre-event) with ops-marked no-shows (day-of); the drill-down query cannot
  separate the two today.
- `pending` → the user never declared either way. A high `pending_count`
  means the commitment prompt isn't being acted on, not that people skipped
  the event.

**Recommendation:** ops should mark no-shows `absent` day-of via the existing
admin override for every event. As that habit lands, `absent_count` converges
to true no-shows and `commitment_rate_pct` converges to the real show-up rate.

---

## How to run

The script is plain SQL, no parameters:

```bash
# Local dev (database from your root .env)
psql "$DATABASE_URL" -f apps/server/scripts/attendance-baseline.sql

# Staging (Docker network on the CVM; DB is the postgres-staging container)
psql "postgres://joyjoin:<password>@localhost:5432/joyjoin_staging" \
  -f apps/server/scripts/attendance-baseline.sql

# Production (run from the CVM against the postgres container)
psql "$DATABASE_URL" -f apps/server/scripts/attendance-baseline.sql
```

The script runs two queries back-to-back and prints both result sets.

### Query 1 — weekly baseline

One row per calendar week (`date_trunc('week', blind_box_events.date_time)`):

| Column | Meaning |
|--------|---------|
| `week_start` | Monday of the event week |
| `matched_events` | Matched blind-box events that week (canceled + test pools excluded) |
| `roster_seats` | Sum of `total_participants` — the denominator |
| `confirmed_count` / `late_count` | Self-declared 出席 / 晚到 (numerator parts) |
| `absent_count` | Declared/marked absent |
| `pending_count` | No declaration |
| `commitment_rate_pct` | `(confirmed + late) / roster_seats × 100` |

### Query 2 — per-event drill-down (last 8 weeks)

One row per event with `matched_count` (from `matched_attendees` JSONB),
`roster_seats`, and the four status counts — use it to sanity-check weeks
where the baseline moves (e.g. one large pending-heavy event dragging the
rate down).

## Inclusion rules (both queries)

- Events with `blind_box_events.status = 'canceled'` are excluded.
- Events whose pool is a test pool (`event_pools.is_test_pool = true`,
  joined via `blind_box_events.pool_id`) are excluded. Events with no pool
  link (NULL `pool_id`) are kept.
- Events with NULL `total_participants` (never matched) are excluded.
- Attendance rows with legacy `status = 'cancelled'` (withdrawn
  registration) are excluded from all counts.

## Data sources

- `event_attendance` — `packages/shared/src/schema/_definitions.ts` (`eventAttendance`)
- `blind_box_events` — same file (`blindBoxEvents`)
- `event_pools.is_test_pool` — same file (`eventPools`)
