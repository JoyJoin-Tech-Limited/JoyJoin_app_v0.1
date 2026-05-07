import test from 'node:test';
import assert from 'node:assert/strict';
import { listGuardrailsAppSourcePaths } from '../guardrails-app-sources.mjs';

const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const allowedEmojiContextPattern = /emoji\s*=\s*['"]|icon\s*=\s*['"]|fallbackEmoji/;

test('listGuardrailsAppSourcePaths skips paths missing from worktree', () => {
  const tracked = [
    'apps/admin-client/src/DeletedButStillIndexed.tsx',
    'apps/server/src/Present.ts',
    'packages/shared/src/not-scanned.ts',
  ];
  const existsSync = (p) => p === 'apps/server/src/Present.ts';
  assert.deepEqual(listGuardrailsAppSourcePaths(tracked, existsSync), ['apps/server/src/Present.ts']);
});

test('listGuardrailsAppSourcePaths only includes app src ts/tsx', () => {
  const existsSync = () => true;
  assert.deepEqual(
    listGuardrailsAppSourcePaths(['apps/admin-client/src/a.tsx', 'apps/admin-client/readme.md'], existsSync),
    ['apps/admin-client/src/a.tsx'],
  );
});

test('emojiPattern detects common emojis', () => {
  assert.ok(emojiPattern.test('🎉'), 'should detect party popper');
  assert.ok(emojiPattern.test('😔'), 'should detect sad face');
  assert.ok(emojiPattern.test('✅'), 'should detect checkmark');
  assert.ok(emojiPattern.test('★'), 'should detect star');
});

test('allowedEmojiContextPattern permits icon system usages', () => {
  assert.ok(allowedEmojiContextPattern.test("emoji='📅'"), 'should allow emoji prop');
  assert.ok(allowedEmojiContextPattern.test('icon="😕"'), 'should allow icon prop');
  assert.ok(allowedEmojiContextPattern.test('fallbackEmoji'), 'should allow fallbackEmoji identifier');
  assert.ok(!allowedEmojiContextPattern.test('Hello 🎉 world'), 'should not match plain text');
});
