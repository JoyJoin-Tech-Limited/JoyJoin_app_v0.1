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

  it('restores blind-box coupon support through the payment domain and keeps event packs disabled', () => {
    const userPaymentPageSource = readRepoFile('apps/user-client/src/pages/BlindBoxPaymentPage.tsx');
    const adminPaymentPageSource = readRepoFile('apps/admin-client/src/pages/BlindBoxPaymentPage.tsx');
    const paymentsRoutesSource = readRepoFile('apps/server/src/routes/domains/payments.ts');

    expect(userPaymentPageSource).toContain('/api/coupons/validate');
    expect(userPaymentPageSource).toContain('/api/payments/create');
    expect(userPaymentPageSource).not.toContain('/api/blind-box-events');
    expect(userPaymentPageSource).not.toContain('/api/event-packs/purchase');
    expect(adminPaymentPageSource).toContain('/api/coupons/validate');
    expect(adminPaymentPageSource).toContain('/api/payments/create');
    expect(adminPaymentPageSource).not.toContain('/api/blind-box-events');
    expect(adminPaymentPageSource).not.toContain('/api/event-packs/purchase');
    expect(userPaymentPageSource).toContain('supportsCoupons = true');
    expect(userPaymentPageSource).toContain('supportsEventPacks = false');
    expect(adminPaymentPageSource).toContain('supportsCoupons = true');
    expect(adminPaymentPageSource).toContain('supportsEventPacks = false');

    expect(paymentsRoutesSource).toContain('app.post("/api/coupons/validate"');
    expect(paymentsRoutesSource).toContain('getAvailableUserCouponByCode');
    expect(paymentsRoutesSource).toContain('countUserCouponAssignments');
    expect(paymentsRoutesSource).toContain('eventRegistrationPayload = eventCheckout.eventRegistrationPayload');
  });

  it('publishes pricing display aliases and explicit browser payment redirect metadata', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');
    const paymentsRoutesSource = readRepoFile('apps/server/src/routes/domains/payments.ts');
    const sharedApiSource = readRepoFile('packages/shared/src/api.ts');

    expect(routesSource).toContain('displayName: s.displayName');
    expect(routesSource).toContain('displayNameEn: s.displayNameEn');
    expect(routesSource).toContain('isActive: s.isActive');
    expect(paymentsRoutesSource).toContain('const paymentRedirectUrl = paymentResult.h5Url ?? null;');
    expect(paymentsRoutesSource).toContain('const paymentStatus = paymentRedirectUrl ? "pending" : "completed";');
    expect(sharedApiSource).toContain("paymentStatus?: 'pending' | 'completed'");
    expect(sharedApiSource).toContain('paymentRedirectUrl?: string | null');
  });

  it('normalizes event chat payloads and keeps legacy message field compatibility', () => {
    const routesSource = readRepoFile('apps/server/src/routes.ts');

    expect(routesSource).toContain('messages: messages.map(toEventChatMessageSummary)');
    expect(routesSource).toContain('message: req.body?.message ?? req.body?.content');
    expect(routesSource).toContain('profileImageUrl: firstNonEmptyString(user.profileImageUrl, user.wechatAvatarUrl) ?? null');
  });
});
