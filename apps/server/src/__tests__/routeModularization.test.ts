import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');
const ROUTES_FILE = path.join(REPO_ROOT, 'apps/server/src/routes.ts');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('server route modularization', () => {
  it('keeps top-level routes.ts as a composition entry for extracted domains', () => {
    const source = readRepoFile('apps/server/src/routes.ts');

    expect(source).toContain('registerAnalyticsRoutes(app);');
    expect(source).toContain('registerAuthRoutes(app);');
    expect(source).toContain('registerOnboardingRoutes(app);');
    expect(source).toContain('registerAssessmentRoutes(app);');
    expect(source).toContain('registerAdminRoutes(app);');
    expect(source).toContain('registerEventGroupOutcomeRoutes(app);');
    expect(source).toContain('registerPaymentRoutes(app);');
    expect(source).toContain('registerIcebreakerRoutes(app);');
  });

  it('moves representative route ownership out of routes.ts into domain modules', () => {
    const topLevel = readFileSync(ROUTES_FILE, 'utf8');
    expect(topLevel).not.toContain("app.get('/api/auth/user'");
    expect(topLevel).not.toContain("app.post('/api/personality-test/submit'");
    expect(topLevel).not.toContain('app.post("/api/event-pools/:poolId/group-outcome"');
    expect(topLevel).not.toContain('app.post("/api/payments/create"');

    expect(readRepoFile('apps/server/src/routes/domains/auth.ts')).toContain("app.get('/api/auth/user'");
    expect(readRepoFile('apps/server/src/routes/domains/assessment.ts')).toContain("app.post('/api/personality-test/submit'");
    expect(readRepoFile('apps/server/src/routes/domains/eventGroupOutcomes.ts')).toContain('app.post(GROUP_OUTCOME_ROUTE');
    expect(readRepoFile('apps/server/src/routes/domains/payments.ts')).toContain('app.post("/api/payments/create"');
  });
});
