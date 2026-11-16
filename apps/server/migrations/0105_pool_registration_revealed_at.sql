-- Reveal fact for the sealed Events card (2026-11-11).
--
-- Grain is one user × one formed table, and `event_pool_registrations` already
-- carries that pair (user_id + assigned_group_id), so the timestamp lives on the
-- same row instead of a new table. The fact is server-owned: a second device
-- must not re-offer the 拆盒 ceremony that already happened. The mini-program
-- keeps `jj_revealed_<groupId>` only as an offline/optimistic cache.
--
-- NULL means "not opened yet" — never backfill it, or every existing table
-- silently loses its ceremony.
--
-- Idempotent: safe to re-run.
ALTER TABLE event_pool_registrations
  ADD COLUMN IF NOT EXISTS revealed_at timestamp;
