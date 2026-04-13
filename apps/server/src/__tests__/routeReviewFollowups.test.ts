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

  it('emits normalized AI metadata on legacy pair-explanation responses', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');

    expect(routesSource).toContain("app.get('/api/event-pool-groups/:groupId/match-explanations'");
    expect(routesSource).toContain("app.get('/api/blind-box-events/:eventId/match-explanations'");
    expect(routesSource).toContain('promptVersion: groupAnalysis.promptVersion');
    expect(routesSource).toContain('fromCache: groupAnalysis.fromCache');
    expect(routesSource).toContain('provider: groupAnalysis.provider');
  });

  it('persists blind-box attendance confirmations and keeps pool-group age payloads privacy-safe', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');

    expect(routesSource).toContain("await storage.updateAttendanceStatus(blindBoxEventId, userId, 'confirmed')");
    expect(routesSource).toContain("ageLabel: formatAge(member.birthdate, member.ageVisible ?? 'hide_all')");
    expect(routesSource).not.toContain('members: groupMembers');
  });

  it('returns a stable coupon response object and preserves total-versus-available semantics', () => {
    const assessmentRoutesSource = readRepoFile('apps/server/src/routes/domains/assessment.ts');
    const sharedApiSource = readRepoFile('packages/shared/src/api.ts');

    expect(assessmentRoutesSource).toContain('res.json({ count: coupons.length, coupons });');
    expect(sharedApiSource).toContain('availableCount');
    expect(sharedApiSource).toContain('count: explicitCount ?? coupons.length');
  });

  // Guards against regression: event chat routes must return a redacted participant/message
  // shape and continue accepting the canonical message field while tolerating older callers.
  it('sanitizes event chat payloads and normalizes message writes', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');

    expect(routesSource).toContain('participants.map(toEventChatParticipantSummary)');
    expect(routesSource).toContain('messages: messages.map(toEventChatMessageSummary)');
    expect(routesSource).toContain('message: req.body?.message ?? req.body?.content');
  });

  it('uses the authenticated user as the reporter when creating chat reports', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');

    expect(routesSource).toContain('reportedBy: userId');
    expect(routesSource).toContain('return res.status(401).json({ message: "Authentication required" });');
  });

  it('normalizes pricing payloads and subscription plan aliases across payment surfaces', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');
    const paymentsSource = readRepoFile('apps/server/src/routes/domains/payments.ts');
    const sharedApiSource = readRepoFile('packages/shared/src/api.ts');

    expect(routesSource).toContain('displayName: s.displayName');
    expect(routesSource).toContain('displayNameEn: s.displayNameEn');
    expect(paymentsSource).toContain('const normalizedPlanType = normalizeSubscriptionPlanType(planType);');
    expect(sharedApiSource).toContain('export function normalizeSubscriptionPlanType');
    expect(sharedApiSource).toContain('export function findPricingPlan');
  });

  it('removes dead coupon-validation and event-pack purchase dependencies from blind-box payment pages', () => {
    const userPaymentSource = readRepoFile('apps/user-client/src/pages/BlindBoxPaymentPage.tsx');
    const adminPaymentSource = readRepoFile('apps/admin-client/src/pages/BlindBoxPaymentPage.tsx');

    expect(userPaymentSource).toContain('const supportsCoupons = false;');
    expect(userPaymentSource).toContain('const supportsEventPacks = false;');
    expect(userPaymentSource).not.toContain('/api/coupons/validate');
    expect(userPaymentSource).not.toContain('/api/event-packs/purchase');

    expect(adminPaymentSource).toContain('const supportsCoupons = false;');
    expect(adminPaymentSource).toContain('const supportsEventPacks = false;');
    expect(adminPaymentSource).not.toContain('/api/coupons/validate');
    expect(adminPaymentSource).not.toContain('/api/event-packs/purchase');
  });
});
