# Connection Selection V2 — G0 Runbook

> 2026-11-10 · G0 implementation runbook
> Flag: `mutualSelectionV2Enabled` · Migration: `0101_connection_selection_windows.sql`

## Scope

This runbook covers the additive schema and rollback drill for the 24h pending mutual-selection loop. It does **not** claim a staging rehearsal has been performed. Run every step in staging first; production stays on the flag-off legacy path until the G0 gate closes.

## What the migration adds

- `connections.reveal_at` — nullable `timestamptz`; set when a selection becomes `mutual_pending`.
- `connection_selection_windows` — one row per event: `opens_at`, `closes_at`, `reveal_at`, `created_at`.
- Partial index `connections_mutual_pending_reveal_at_idx` for the reveal sweep.

The migration is additive and safe to apply before the application deploy. It does not backfill or rewrite existing `connections` rows.

## Pre-checks

```sql
-- Must return NULL before the migration.
SELECT to_regclass('public.connection_selection_windows');

-- Must return zero rows before the migration.
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'connections' AND column_name = 'reveal_at';
```

## Apply — staging

```bash
docker exec -i postgres-staging psql \
  -U joyjoin -d joyjoin_staging -v ON_ERROR_STOP=1 \
  < apps/server/migrations/0101_connection_selection_windows.sql
```

## Apply — production

Production DDL is manual. Apply only after the staging rehearsal and a backup/restore point exist.

```bash
psql "$DATABASE_URL" -f apps/server/migrations/0101_connection_selection_windows.sql
```

## Post-checks

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'connections' AND column_name = 'reveal_at';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'connection_selection_windows'
ORDER BY ordinal_position;

SELECT indexname
FROM pg_indexes
WHERE indexname = 'connections_mutual_pending_reveal_at_idx';

SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'connection_selection_windows'::regclass;
```

Expected: `reveal_at` is nullable `timestamp with time zone`; four window columns exist; the partial index exists; the unique event constraint and events FK exist.

## Enable the flag (staging only)

```sql
UPDATE feature_flags
SET value = 'true', updated_at = now()
WHERE key = 'mutualSelectionV2Enabled';
```

The resolver has a 5-second LRU. Do not enable in production until the staging smoke and device QA are signed off.

## Rollback drill

### 1. Disable the behavior first

```sql
UPDATE feature_flags
SET value = 'false', updated_at = now()
WHERE key = 'mutualSelectionV2Enabled';
```

Flag-off restores the legacy immediate-mutual path: no `mutual_pending`, no 0–5 cap enforcement from V2, peer `pendingRequests` visible again, and the reveal scheduler becomes a no-op. Existing `mutual_pending` rows are **not** automatically resolved by flipping the flag. If the pilot is abandoned:

```sql
SELECT count(*) FROM connections WHERE status = 'mutual_pending';
```

Decide explicitly whether to finalize those rows (run one reveal sweep) or leave them dormant. Never drop `reveal_at` while V2 code is still deployed.

### 2. Revert the schema only after the code is reverted

The additive schema is intentionally kept during a flag rollback because the deployed Drizzle schema still selects `reveal_at`. Drop it only after a code rollback:

```sql
DROP INDEX IF EXISTS connections_mutual_pending_reveal_at_idx;
ALTER TABLE connections DROP COLUMN IF EXISTS reveal_at;
DROP TABLE IF EXISTS connection_selection_windows;
```

## Staging smoke checklist

- [ ] Migration applied with `ON_ERROR_STOP=1`; post-checks pass.
- [ ] Server starts and `/api/readyz` is healthy.
- [ ] Flag on: `POST /api/events/:eventId/feedback` with 1–5 peers creates `pending` rows; a second user selecting the first moves the pair to `mutual_pending` and sets `reveal_at`.
- [ ] Before `reveal_at`: `GET /api/shell/connections` exposes only `pendingReveal { count, revealAt }`; no peer identities.
- [ ] `PUT /api/events/:eventId/connection-selection` replaces the caller’s selection; a sixth peer returns `400 TOO_MANY_SELECTIONS`; a closed window returns `409 SELECTION_WINDOW_CLOSED`.
- [ ] After `reveal_at`: scheduler flips due rows to `mutual`, snapshots WeChat IDs once, sets `revealed_at`, and the Connections page shows the mutual card.
- [ ] Reveal fan-out: each side receives at most one in-app reveal notification per connection, with no peer name or selection count.
- [ ] Tablemate gate: a peer outside the caller's table returns `400 INVALID_TABLEMATE_SELECTION`; a valid tablemate still succeeds.
- [ ] 30-day cleanup: only non-mutual rows older than the retention cutoff are deleted; mutual rows are never touched.
- [ ] Quip privacy: a pre-reveal ballot built from the opaque `answerId` is accepted; no raw author user ID appears in the client payload.
- [ ] Flag off: legacy behavior is restored and the scheduler does not write.
- [ ] Rollback SQL executed in staging (flag off first; schema drop only after code revert).

## G0 gate status

Code-complete in this branch: attribution privacy, 0–5 cap, pending/reveal schema, window helper, reveal scheduler, PUT endpoint, pending card, flag docs, reveal-time in-app notification, 30-day non-mutual cleanup, tablemate validation, opaque quip answer IDs, and seven G0 analytics events.

Not closed by this runbook: staging rehearsal, production apply, live end-to-end notification/ballot verification, device/WeChat DevTools QA, and the G1/G2 field gates. Notification dedupe is currently `INSERT … WHERE NOT EXISTS`; a cross-replica unique constraint is intentionally deferred. Table grouping falls back to same-event attendance when a pool group is unavailable, tracked as a TODO.

## Ownership

- Migration rehearsal: backend on-call + ops.
- Flag enable/disable: backend on-call; audit the change.
- Device QA: mini-program owner.
- G0 gate sign-off: product + engineering.
