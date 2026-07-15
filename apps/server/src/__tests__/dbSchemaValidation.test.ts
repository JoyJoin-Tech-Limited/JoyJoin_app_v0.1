import { describe, expect, it } from 'vitest';
import { listSchemaTables } from '../db';

/**
 * Regression guard for the 2026-07-15 staging incident:
 * `social_icebreaker_participants.is_test_bot` existed in the Drizzle schema
 * but had no migration SQL, and the old hardcoded validateDbSchema table list
 * did not include the participants table — so staging started "healthy" and
 * every /start hung. The dynamic discovery must cover these tables forever.
 */
describe('listSchemaTables', () => {
  it('discovers all schema tables dynamically, including previously missed ones', () => {
    const tables = listSchemaTables();
    const names = tables.map((t) => t.exportName);

    // Sanity: the barrel holds dozens of tables, not a hand-picked few.
    expect(tables.length).toBeGreaterThan(40);

    // The tables whose drift caused production/staging incidents.
    expect(names).toContain('socialIcebreakerParticipants');
    expect(names).toContain('socialIcebreakerSessions');
    expect(names).toContain('socialIcebreakerMiniscriptSecrets');

    // The original critical set must stay covered.
    expect(names).toContain('users');
    expect(names).toContain('assessmentSessions');
    expect(names).toContain('assessmentAnswers');
    expect(names).toContain('eventPools');
    expect(names).toContain('adminAccounts');
  });
});
