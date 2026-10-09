import { describe, expect, it } from 'vitest';

import {
  LEGACY_CREDIT_MIGRATION_ORDER_PREFIX,
  planLegacyCreditMigration,
  type LegacyCreditRow,
} from '../scripts/backfill-legacy-event-credits';

/**
 * Legacy event-credits backfill planner (2026-10-06).
 * Pure decision logic — DB side effects are exercised via --apply in ops.
 */
describe('planLegacyCreditMigration', () => {
  const row = (userId: string, eventCredits: number | null, expiresAt: Date | null = null): LegacyCreditRow => ({
    userId,
    eventCredits,
    eventCreditsExpiry: expiresAt,
  });

  it('plans a migration for users with a positive legacy balance', () => {
    const actions = planLegacyCreditMigration([row('u1', 3)], new Set());
    expect(actions).toEqual([
      { kind: 'migrate', userId: 'u1', credits: 3, expiresAt: null },
    ]);
  });

  it('carries the legacy expiry onto the grant', () => {
    const expiry = new Date('2027-01-01T00:00:00Z');
    const actions = planLegacyCreditMigration([row('u1', 1, expiry)], new Set());
    expect(actions[0]).toMatchObject({ kind: 'migrate', expiresAt: expiry });
  });

  it('skips users whose deterministic migration payment already exists (idempotent re-run)', () => {
    const actions = planLegacyCreditMigration(
      [row('u1', 3)],
      new Set([`${LEGACY_CREDIT_MIGRATION_ORDER_PREFIX}u1`]),
    );
    expect(actions).toEqual([{ kind: 'skip_already_migrated', userId: 'u1' }]);
  });

  it('skips null and zero balances defensively', () => {
    const actions = planLegacyCreditMigration([row('u1', null), row('u2', 0)], new Set());
    expect(actions).toEqual([
      { kind: 'skip_no_balance', userId: 'u1' },
      { kind: 'skip_no_balance', userId: 'u2' },
    ]);
  });

  it('mixed cohort: migrates only the eligible users', () => {
    const actions = planLegacyCreditMigration(
      [row('u1', 2), row('u2', 0), row('u3', 5)],
      new Set([`${LEGACY_CREDIT_MIGRATION_ORDER_PREFIX}u3`]),
    );
    expect(actions.map((a) => a.kind)).toEqual(['migrate', 'skip_no_balance', 'skip_already_migrated']);
  });
});
