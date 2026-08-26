-- PR-2: composite index for the onboarding funnel aggregation
-- (repositories/onboardingFunnelRepo.ts) — every funnel/emotion query filters
-- on event_type + timestamp, previously covered only by single-column indexes.
--
-- Note: plain CREATE INDEX (not CONCURRENTLY) because the migration runner may
-- wrap statements in a transaction, where CONCURRENTLY is illegal. Table volume
-- is low enough that the brief write lock is acceptable. If this ever needs to
-- run against a high-volume table, apply manually with CONCURRENTLY via psql.
CREATE INDEX IF NOT EXISTS "idx_onboarding_analytics_event_type_timestamp"
  ON "onboarding_analytics" USING btree ("event_type", "timestamp");
