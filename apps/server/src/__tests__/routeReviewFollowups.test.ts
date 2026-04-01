import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeOptionalDuration } from "../routes/domains/helpers";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('route review follow-ups', () => {
  it('preserves zero onboarding durations while rejecting invalid values', () => {
    expect(normalizeOptionalDuration(0)).toBe(0);
    expect(normalizeOptionalDuration(12)).toBe(12);
    expect(normalizeOptionalDuration(-1)).toBeNull();
    expect(normalizeOptionalDuration('0')).toBeNull();
    expect(normalizeOptionalDuration(undefined)).toBeNull();
  });

  it('uses the active assessment session storage helper instead of an in-progress phase literal', () => {
    const authSource = readRepoFile('apps/server/src/routes/domains/auth.ts');

    expect(authSource).toContain('storage.getAssessmentSessionByUser(userId)');
    expect(authSource).not.toContain("eq(assessmentSessions.phase, 'in_progress')");
  });

  it('aggregates profile stats with count queries', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');

    expect(routesSource).toContain('sql<number>`count(*)::int`');
    expect(routesSource).toContain('const [completedEventsResult] = await db');
    expect(routesSource).toContain('const [connectionsResult] = await db');
  });
});
