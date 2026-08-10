import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 2026-07-28 — the feedback mutual-contact picker called
// GET /api/events/:id/participants since the flow shipped, but the endpoint
// was never implemented: step 2 (选择想保持联系的人) rendered
// 「暂时没有其他参与者信息」 for every real user, not just single-test
// pools. These locks keep the route wired with its three resolution paths,
// its participant-only access boundary, and its privacy-minimal payload.

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');
const ROUTES_FILE = path.join(REPO_ROOT, 'apps/server/src/routes/domains/social.ts');

function readRoutesSource(): string {
  return readFileSync(ROUTES_FILE, 'utf8');
}

function extractRouteBlock(source: string, startMarker: string, endMarker: string): string {
  const startIndex = source.indexOf(startMarker);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  const endIndex = source.indexOf(endMarker, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe('GET /api/events/:eventId/participants (feedback mutual-contact roster)', () => {
  const source = readRoutesSource();
  const handler = extractRouteBlock(
    source,
    "app.get('/api/events/:eventId/participants', requireAuth, async (req: any, res) => {",
    "app.get('/api/events/:eventId/messages',",
  );

  it('is mounted behind requireAuth', () => {
    expect(source).toContain("app.get('/api/events/:eventId/participants', requireAuth");
  });

  it('resolves blind-box events via matchedAttendees and rejects non-owners', () => {
    expect(handler).toContain('schema.blindBoxEvents');
    expect(handler).toContain('matchedAttendees');
    expect(handler).toContain('blindBoxEvent.userId !== userId');
    expect(handler).toContain("res.status(403).json({ message: 'Not a participant of this event' })");
  });

  it('resolves event pools via the viewer matched group only', () => {
    expect(handler).toContain('schema.eventPoolRegistrations');
    expect(handler).toContain('assignedGroupId');
    // Only matched group members are listable — pending registrations must
    // not leak the pool's candidate roster.
    expect(handler).toContain("eq(schema.eventPoolRegistrations.matchStatus, 'matched')");
    // Registered-but-unmatched viewers get an empty roster, not a 403.
    expect(handler).toContain('if (!myRegistration.assignedGroupId)');
  });

  it('resolves legacy events via attendance and excludes cancelled seats', () => {
    expect(handler).toContain('schema.eventAttendance');
    expect(handler).toContain("ne(schema.eventAttendance.status, 'cancelled')");
  });

  it('excludes the viewer server-side and dedupes rows', () => {
    expect(handler).toContain('row.id === userId');
    expect(handler).toContain('seen.has(row.id)');
  });

  it('returns the approved profile or WeChat avatar for each tablemate', () => {
    expect(handler).toContain('profileImageUrl: schema.users.profileImageUrl');
    expect(handler).toContain('wechatAvatarUrl: schema.users.wechatAvatarUrl');
    expect(handler).toContain('firstNonEmptyString(row.profileImageUrl, row.wechatAvatarUrl)');
    expect(handler).toContain('firstNonEmptyString(attendeeUser.profileImageUrl, attendeeUser.wechatAvatarUrl)');
  });

  it('stays privacy-minimal — no age, industry, or WeChat id in the payload', () => {
    expect(handler).not.toContain('wechatContactId');
    expect(handler).not.toContain('topInterests');
    expect(handler).not.toContain('industryNicheLabel');
    expect(handler).not.toContain('ageVisible');
  });
});
