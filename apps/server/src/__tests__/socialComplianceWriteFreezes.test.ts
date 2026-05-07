import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

describe('social compliance chat boundary', () => {
  it('keeps event chat writes fail-closed and unavailable', () => {
    const source = readRoutesSource();
    const handler = extractRouteBlock(
      source,
      "app.post('/api/events/:eventId/messages', requireAuth, async (req: any, res) => {",
      "app.post('/api/events/:eventId/feedback',",
    );

    // Guards against regression: the legacy event chat write path must stay frozen.
    expect(handler).toContain('Blocked event chat write because the feature is under compliance freeze');
    expect(handler).toContain('res.status(503).json({');
    expect(handler).toContain('featureUnavailable: true');
    expect(handler).not.toContain('storage.createChatMessage(');
  });

  it('keeps post-event contact exchange enabled while only chat stays frozen', () => {
    const source = readRoutesSource();
    const handler = extractRouteBlock(
      source,
      "app.post('/api/events/:eventId/feedback', requireAuth, async (req: any, res) => {",
      "app.post('/api/insight-feedback',",
    );

    // Guards against regression: the compliance scope blocks chat only, not off-platform contact exchange.
    expect(handler).not.toContain('Suppressed event feedback contact-exchange writes due to compliance freeze');
    expect(handler).not.toContain('connections: []');
    expect(handler).not.toContain('mutualMatches: []');
    expect(handler).toContain('storage.updateUserWechatId(');
    expect(handler).toContain('storage.upsertConnection(');
    expect(handler).toContain('storage.getMutualConnections(');
    expect(handler).toContain('storage.createNotification(');
  });
});
